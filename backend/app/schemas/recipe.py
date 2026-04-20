# backend/app/schemas/recipe.py
"""Schemas de recetas de destilación — NeoStills."""
from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, Field

from app.models.recipe import RecipeStatus, DistillationMethod

StrID = Annotated[str, BeforeValidator(str)]


class RecipeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    spirit_type: str | None = Field(None, max_length=100)   # whisky, gin, brandy, ron, vodka
    description: str | None = None
    distillation_method: DistillationMethod | None = None
    stripping_run_enabled: bool = False

    # Parámetros del wash
    wash_volume_liters: float | None = None
    batch_size_liters: float | None = None
    fermentation_tank_capacity_liters: float | None = None
    fruit_brix: float | None = None

    # Gravedad y ABV
    og: float | None = None
    fg: float | None = None
    wash_abv: float | None = None
    target_abv: float | None = None
    spirit_yield_liters: float | None = None

    # Cortes
    cut_points: list[dict] | None = None

    # Ingredientes
    cereals: list[dict] | None = None
    botanicals: list[dict] | None = None
    fermentation_yeasts: list[dict] | None = None
    adjuncts: list[dict] | None = None
    mash_steps: list[dict] | None = None
    water_profile: dict | None = None
    notes: str | None = None


class RecipeUpdate(RecipeCreate):
    name: str | None = None  # type: ignore[assignment]
    status: RecipeStatus | None = None


class RecipeOut(BaseModel):
    id: StrID
    distillery_id: StrID
    name: str
    spirit_type: str | None
    description: str | None
    status: str
    distillation_method: str | None
    stripping_run_enabled: bool
    wash_volume_liters: float | None
    batch_size_liters: float | None
    fermentation_tank_capacity_liters: float | None
    fruit_brix: float | None
    og: float | None
    fg: float | None
    wash_abv: float | None
    target_abv: float | None
    spirit_yield_liters: float | None
    cut_points: list[dict] | None
    cereals: list[dict] | None
    botanicals: list[dict] | None
    fermentation_yeasts: list[dict] | None
    adjuncts: list[dict] | None
    mash_steps: list[dict] | None
    water_profile: dict | None
    notes: str | None
    created_at: Any | None = None
    updated_at: Any | None = None

    model_config = {"from_attributes": True}


class CanDistillItem(BaseModel):
    name: str
    required: float
    unit: str


class CanDistillLowStock(BaseModel):
    name: str
    required: float
    available: float
    unit: str


class CanDistillResult(BaseModel):
    status: str  # ready | partial | missing
    missing: list[CanDistillItem]
    low_stock: list[CanDistillLowStock]
    available: list[str]


# Aliases de retrocompatibilidad
CanBrewItem = CanDistillItem
CanBrewLowStock = CanDistillLowStock
CanBrewResult = CanDistillResult
