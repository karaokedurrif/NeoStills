# backend/app/schemas/brewing.py
"""Schemas de lotes de destilación."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field

from app.models.brew_session import SessionPhase

StrID = Annotated[str, BeforeValidator(str)]


class RunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    recipe_id: int | None = None
    batch_number: int | None = None
    still_type: str | None = None
    wash_volume_liters: float | None = None
    planned_og: float | None = None
    planned_fg: float | None = None
    wash_abv: float | None = None
    target_abv: float | None = None
    stripping_run_enabled: bool = False
    wash_date: datetime | None = None
    notes: str | None = None


class RunUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    phase: SessionPhase | None = None
    still_type: str | None = None
    actual_wash_liters: float | None = None
    actual_og: float | None = None
    actual_fg: float | None = None
    wash_abv: float | None = None
    target_abv: float | None = None
    actual_abv: float | None = None
    wash_yield_pct: float | None = None
    spirit_volume_liters: float | None = None
    stripping_run_enabled: bool | None = None
    heads_liters: float | None = None
    hearts_liters: float | None = None
    tails_liters: float | None = None
    cut_temperature_heads: float | None = None
    cut_temperature_tails: float | None = None
    fermentation_start: datetime | None = None
    distillation_date: datetime | None = None
    bottling_date: datetime | None = None
    step_log: list[dict] | None = None
    notes: str | None = None


class RunOut(BaseModel):
    id: StrID
    distillery_id: StrID
    recipe_id: StrID | None
    name: str
    batch_number: int | None
    phase: str
    still_type: str | None
    wash_volume_liters: float | None
    actual_wash_liters: float | None
    planned_og: float | None
    actual_og: float | None
    planned_fg: float | None
    actual_fg: float | None
    wash_abv: float | None
    target_abv: float | None
    actual_abv: float | None
    wash_yield_pct: float | None
    spirit_volume_liters: float | None
    stripping_run_enabled: bool
    heads_liters: float | None
    hearts_liters: float | None
    tails_liters: float | None
    cut_temperature_heads: float | None
    cut_temperature_tails: float | None
    wash_date: datetime | None
    fermentation_start: datetime | None
    distillation_date: datetime | None
    bottling_date: datetime | None
    step_log: list[dict] | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhaseAdvance(BaseModel):
    phase: SessionPhase
    notes: str | None = None


# Aliases de retrocompatibilidad
SessionCreate = RunCreate
SessionUpdate = RunUpdate
SessionOut = RunOut
