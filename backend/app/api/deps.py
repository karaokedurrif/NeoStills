# backend/app/api/deps.py
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.brewery import Distillery


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return current_user


async def get_current_distillery(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Distillery:
    """
    Obtiene la destilería del usuario actual.
    Usado en todos los endpoints con scope de destilería (inventory, recipes, etc.)
    """
    result = await db.execute(
        select(Distillery).where(Distillery.owner_id == current_user.id)
    )
    distillery = result.scalar_one_or_none()
    if distillery is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró destilería para este usuario. Por favor, crea una primero.",
        )
    return distillery
