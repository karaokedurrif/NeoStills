# backend/app/models/brew_session.py
"""Modelo de lote de destilación."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SessionPhase(str, enum.Enum):
    planned = "planned"
    mashing = "mashing"            # Macerado / preparación del wash
    fermenting = "fermenting"      # Fermentación del wash
    stripping_run = "stripping_run"    # Primera destilación (stripping)
    spirit_run = "spirit_run"          # Segunda destilación (spirit run)
    cuts_collection = "cuts_collection"  # Separación de cortes (heads/hearts/tails)
    aging = "aging"                # Envejecimiento / maduración
    bottling = "bottling"          # Embotellado
    completed = "completed"
    aborted = "aborted"


class DistillationRun(Base):
    __tablename__ = "distillation_runs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    distillery_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("distilleries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipe_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    batch_number: Mapped[int | None] = mapped_column(Integer)
    phase: Mapped[SessionPhase] = mapped_column(
        Enum(SessionPhase, name="session_phase_enum"),
        default=SessionPhase.planned,
        nullable=False,
    )

    # Tipo de alambique usado en este lote
    still_type: Mapped[str | None] = mapped_column(String(50))  # pot_still | column_still | reflux_still

    # Volumen de wash (fermentado antes de destilar)
    wash_volume_liters: Mapped[float | None] = mapped_column(Float)
    actual_wash_liters: Mapped[float | None] = mapped_column(Float)

    # Gravedad del wash
    planned_og: Mapped[float | None] = mapped_column(Float)   # OG del wash
    actual_og: Mapped[float | None] = mapped_column(Float)
    planned_fg: Mapped[float | None] = mapped_column(Float)   # FG del wash
    actual_fg: Mapped[float | None] = mapped_column(Float)

    # ABV
    wash_abv: Mapped[float | None] = mapped_column(Float)      # ABV del wash antes de destilar
    target_abv: Mapped[float | None] = mapped_column(Float)    # ABV objetivo del destilado final
    actual_abv: Mapped[float | None] = mapped_column(Float)    # ABV real obtenido

    # Rendimiento
    wash_yield_pct: Mapped[float | None] = mapped_column(Float)
    spirit_volume_liters: Mapped[float | None] = mapped_column(Float)  # Volumen de corazón obtenido

    # Cortes (heads/hearts/tails) en litros
    stripping_run_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    heads_liters: Mapped[float | None] = mapped_column(Float)
    hearts_liters: Mapped[float | None] = mapped_column(Float)
    tails_liters: Mapped[float | None] = mapped_column(Float)
    cut_temperature_heads: Mapped[float | None] = mapped_column(Float)  # °C fin de cabezas
    cut_temperature_tails: Mapped[float | None] = mapped_column(Float)  # °C inicio de colas

    # Fechas
    wash_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fermentation_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    distillation_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    bottling_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Log de pasos [{step, start, end, notes}, …]
    step_log: Mapped[list[dict] | None] = mapped_column(JSON)
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    distillery: Mapped[Any] = relationship("Distillery", back_populates="distillation_runs")
    recipe: Mapped[Any] = relationship("Recipe", back_populates="distillation_runs")
    fermentation_data: Mapped[list["FermentationDataPoint"]] = relationship(
        "FermentationDataPoint",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="FermentationDataPoint.recorded_at",
    )


# Alias de retrocompatibilidad
BrewSession = DistillationRun
