# backend/app/api/v1/ai.py
"""
AI chat endpoint — SSE streaming with hybrid provider chain.
Together.ai (Llama 3.3 70B) → Claude (premium fallback) → Ollama (local).
Stores conversations + messages in PostgreSQL.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, BeforeValidator, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.conversation import AIConversation, AIMessage, MessageRole
from app.services.ai.prompts import build_system_prompt
from app.services.ai.router import get_router

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

# Rate limiting handled by app-level middleware in main.py

StrID = Annotated[str, BeforeValidator(str)]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=32_768)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=50)
    conversation_id: int | None = None
    context_page: str | None = Field(None, max_length=64)
    context_data: dict[str, Any] | None = None
    max_tokens: int = Field(1024, ge=64, le=4096)


class ConversationOut(BaseModel):
    id: StrID
    title: str | None
    context_page: str | None
    created_at: datetime
    message_count: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat(
    request: Request,
    chat_request: ChatRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    SSE streaming chat with hybrid AI provider chain.
    Creates / updates a conversation record and saves messages.
    """
    brewery = current_user.distillery
    if not distillery:
        raise HTTPException(status_code=400, detail="No brewery found for user")

    # Resolve or create conversation
    conversation: AIConversation | None = None
    if chat_request.conversation_id:
        conversation = await db.scalar(
            select(AIConversation).where(
                AIConversation.id == chat_request.conversation_id,
                AIConversation.distillery_id == distillery.id,
            )
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        # Auto-title from first user message
        title = chat_request.messages[0].content[:80] if chat_request.messages else None
        conversation = AIConversation(
            brewery_id=distillery.id,
            user_id=current_user.id,
            title=title,
            context_page=chat_request.context_page,
            context_data=chat_request.context_data,
        )
        db.add(conversation)
        await db.flush()

    # Save user messages
    for msg in chat_request.messages:
        if msg.role == "user":
            db.add(
                AIMessage(
                    conversation_id=conversation.id,
                    role=MessageRole.user,
                    content=msg.content,
                )
            )
    await db.commit()
    await db.refresh(conversation)

    system_prompt = build_system_prompt(
        context_page=chat_request.context_page,
        context_data=chat_request.context_data,
    )
    raw_messages = [{"role": m.role, "content": m.content} for m in chat_request.messages]

    async def event_generator():
        full_text = ""
        in_tokens: int | None = None
        out_tokens: int | None = None

        # Send conversation id first so client can track it
        yield f"data: {json.dumps({'conversation_id': conversation.id})}\n\n"

        try:
            router = get_router()
            async for chunk, it, ot in router.stream(raw_messages, system_prompt, chat_request.max_tokens):
                if chunk:
                    full_text += chunk
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
                if it is not None:
                    in_tokens, out_tokens = it, ot
        except Exception as exc:
            logger.error("Streaming error: %s", exc)
            yield f"data: {json.dumps({'error': 'Streaming interrupted'})}\n\n"
            return
        finally:
            # Persist assistant reply
            if full_text:
                async with db.begin_nested():
                    db.add(
                        AIMessage(
                            conversation_id=conversation.id,
                            role=MessageRole.assistant,
                            content=full_text,
                            input_tokens=in_tokens,
                            output_tokens=out_tokens,
                        )
                    )
                    await db.commit()

        yield f"data: {json.dumps({'done': True, 'input_tokens': in_tokens, 'output_tokens': out_tokens})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    brewery = current_user.distillery
    if not distillery:
        raise HTTPException(status_code=400, detail="No se encontró destilería")

    rows = await db.execute(
        select(AIConversation)
        .where(AIConversation.distillery_id == distillery.id)
        .order_by(AIConversation.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    convs = rows.scalars().all()
    if not convs:
        return []

    # Single query to get message counts for all conversations (avoids N+1)
    conv_ids = [c.id for c in convs]
    count_rows = await db.execute(
        select(AIMessage.conversation_id, func.count(AIMessage.id))
        .where(AIMessage.conversation_id.in_(conv_ids))
        .group_by(AIMessage.conversation_id)
    )
    counts = dict(count_rows.all())

    return [
        ConversationOut(
            id=c.id,
            title=c.title,
            context_page=c.context_page,
            created_at=c.created_at,
            message_count=counts.get(c.id, 0),
        )
        for c in convs
    ]


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    brewery = current_user.distillery
    if not distillery:
        raise HTTPException(status_code=400, detail="No se encontró destilería")

    conv = await db.scalar(
        select(AIConversation).where(
            AIConversation.id == conversation_id,
            AIConversation.distillery_id == distillery.id,
        )
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = await db.execute(
        select(AIMessage)
        .where(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.id)
    )
    messages = msgs.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role.value,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
            "input_tokens": m.input_tokens,
            "output_tokens": m.output_tokens,
        }
        for m in messages
    ]


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    brewery = current_user.distillery
    if not distillery:
        raise HTTPException(status_code=400, detail="No se encontró destilería")

    conv = await db.scalar(
        select(AIConversation).where(
            AIConversation.id == conversation_id,
            AIConversation.distillery_id == distillery.id,
        )
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conv)
    await db.commit()


@router.get("/providers")
async def list_providers(current_user=Depends(get_current_user)):
    """Show configured AI providers and their status."""
    router = get_router()
    availability = await router.check_providers()
    return {
        "chain": [p.name for p in router.providers],
        "primary": router.primary.name,
        "providers": {
            p.name: {
                "available": availability.get(p.name, False),
                "model": getattr(p, "model", "unknown"),
            }
            for p in router.providers
        },
    }


# ---------------------------------------------------------------------------
# TTS — Text-to-Speech using edge-tts (Microsoft Neural Voices)
# ---------------------------------------------------------------------------

# Max text length to prevent abuse
_TTS_MAX_CHARS = 4096

# Clean markdown/code/emoji for cleaner speech
_MD_CODE_RE = re.compile(r"```[\s\S]*?```")
_MD_TABLE_RE = re.compile(r"\|[^\n]+\|")
_MD_MARKUP_RE = re.compile(r"[#*_~`>|]")
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_EMOJI_RE = re.compile(
    r"[\U0001F300-\U0001FAD6\U0001FA70-\U0001FAFF\u2600-\u27BF\u2300-\u23FF"
    r"\uFE00-\uFE0F\u200D]+",
    flags=re.UNICODE,
)


def _clean_for_speech(text: str) -> str:
    """Strip markdown, code blocks, tables, and emoji from text."""
    text = _MD_CODE_RE.sub(" ", text)
    text = _MD_TABLE_RE.sub(" ", text)
    text = _MD_MARKUP_RE.sub("", text)
    text = _MD_LINK_RE.sub(r"\1", text)
    text = _EMOJI_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=_TTS_MAX_CHARS)
    voice: str = Field("spanish narrator man", max_length=64)


# --- TTS providers ---
_TOGETHER_TTS_URL = "https://api.together.xyz/v1/audio/speech"
_TOGETHER_TTS_MODEL = "cartesia/sonic-2"
_REPLICATE_API_URL = "https://api.replicate.com/v1/predictions"
_XTTS_MODEL_VERSION = "684bc3855b37866c0c65add2ff39c78f3dea3f4ff103a436465326e0f438d55e"
_SPEAKER_REF_URL = "https://www.neostills.es/assets/avatar/comandante-lara-voice.wav"

# Voice ID that triggers Replicate voice cloning
_CLONED_VOICE_ID = "comandante-lara"


async def _tts_replicate(text: str) -> bytes:
    """Generate speech with cloned Comandante Lara voice via Replicate XTTS-v2."""
    token = settings.REPLICATE_API_TOKEN
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "wait",  # Synchronous — wait for result (up to 60s)
    }
    payload = {
        "version": _XTTS_MODEL_VERSION,
        "input": {
            "text": text,
            "speaker": _SPEAKER_REF_URL,
            "language": "es",
            "cleanup_voice": False,
        },
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10, read=90, write=10, pool=10)) as client:
        resp = await client.post(_REPLICATE_API_URL, headers=headers, json=payload)
        if resp.status_code not in (200, 201):
            logger.error("Replicate error %s: %s", resp.status_code, resp.text[:300])
            raise HTTPException(status_code=502, detail="Voice cloning provider error")

        result = resp.json()
        status = result.get("status")
        output_url = result.get("output")

        # If "Prefer: wait" didn't resolve, poll
        if status != "succeeded" or not output_url:
            poll_url = result.get("urls", {}).get("get", f"{_REPLICATE_API_URL}/{result['id']}")
            for _ in range(30):  # max ~60s polling
                import asyncio
                await asyncio.sleep(2)
                poll_resp = await client.get(poll_url, headers={"Authorization": f"Bearer {token}"})
                poll_data = poll_resp.json()
                status = poll_data.get("status")
                if status == "succeeded":
                    output_url = poll_data.get("output")
                    break
                if status == "failed":
                    logger.error("Replicate prediction failed: %s", poll_data.get("error"))
                    raise HTTPException(status_code=502, detail="Voice cloning failed")

        if not output_url:
            raise HTTPException(status_code=502, detail="Voice cloning timed out")

        # Download the generated audio
        audio_resp = await client.get(output_url)
        if audio_resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to download cloned audio")
        return audio_resp.content


async def _tts_together(text: str, voice: str) -> bytes:
    """Generate speech with Together AI Cartesia Sonic-2 preset voices."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            _TOGETHER_TTS_URL,
            headers={
                "Authorization": f"Bearer {settings.TOGETHER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": _TOGETHER_TTS_MODEL,
                "input": text,
                "voice": voice,
                "language": "es",
                "response_format": "mp3",
            },
        )
        if resp.status_code != 200:
            logger.error("Together TTS error %s: %s", resp.status_code, resp.text[:200])
            raise HTTPException(status_code=502, detail="TTS provider error")
        return resp.content


@router.post("/tts")
async def text_to_speech(
    tts_req: TTSRequest,
    current_user=Depends(get_current_user),
):
    """
    Hybrid TTS: Replicate XTTS-v2 (voice cloning) for Comandante Lara,
    Together AI Cartesia Sonic-2 for preset voices.
    """
    clean = _clean_for_speech(tts_req.text)
    if len(clean) < 2:
        raise HTTPException(status_code=400, detail="Text too short after cleanup")

    try:
        if tts_req.voice == _CLONED_VOICE_ID and settings.REPLICATE_API_TOKEN:
            logger.info("TTS via Replicate XTTS-v2 (voice cloning), text: %d chars", len(clean))
            audio_bytes = await _tts_replicate(clean)
            media_type = "audio/wav"
        elif settings.TOGETHER_API_KEY:
            voice = tts_req.voice if tts_req.voice != _CLONED_VOICE_ID else "spanish narrator man"
            logger.info("TTS via Together/Cartesia voice=%s, text: %d chars", voice, len(clean))
            audio_bytes = await _tts_together(clean, voice)
            media_type = "audio/mpeg"
        else:
            raise HTTPException(status_code=503, detail="No TTS provider configured")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="TTS generation timed out")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("TTS generation failed: %s", exc)
        raise HTTPException(status_code=500, detail="TTS generation failed")

    if not audio_bytes or len(audio_bytes) < 100:
        raise HTTPException(status_code=500, detail="TTS produced no audio")

    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={
            "Content-Length": str(len(audio_bytes)),
            "Cache-Control": "no-cache",
        },
    )
