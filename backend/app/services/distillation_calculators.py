# backend/app/services/distillation_calculators.py
"""
Calculadoras de destilación para NeoStills.

Fórmulas implementadas:
  - Dilución de alcohol (C1·V1 = C2·V2)
  - ABV del wash a partir de OG/FG
  - Rendimiento de fermentación por tipo de azúcar/cereal
  - Estimación de cortes heads/hearts/tails por temperatura y ABV
  - Temperaturas de mashing por tipo de enzima / cereal
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


# ---------------------------------------------------------------------------
# 1. Dilución de alcohol — C1·V1 = C2·V2
# ---------------------------------------------------------------------------

def calculate_dilution(
    initial_abv: float,
    initial_volume_liters: float,
    target_abv: float,
) -> dict[str, float]:
    """
    Calcula el volumen de agua a añadir para alcanzar el ABV objetivo.

    Parámetros:
        initial_abv: ABV inicial del destilado (%, 0-100)
        initial_volume_liters: Volumen inicial en litros
        target_abv: ABV objetivo tras dilución (%, 0-100)

    Devuelve:
        {
          "water_to_add_liters": float,   # Agua a añadir
          "final_volume_liters": float,    # Volumen final
          "final_abv": float               # ABV final (= target_abv)
        }

    Raises:
        ValueError: Si los parámetros son inválidos
    """
    if not (0 < target_abv < initial_abv <= 100):
        raise ValueError(
            f"target_abv ({target_abv}%) debe ser > 0 y < initial_abv ({initial_abv}%)"
        )
    if initial_volume_liters <= 0:
        raise ValueError("initial_volume_liters debe ser positivo")

    # C1·V1 = C2·V2  →  V2 = C1·V1 / C2
    final_volume = (initial_abv * initial_volume_liters) / target_abv
    water_to_add = final_volume - initial_volume_liters

    return {
        "water_to_add_liters": round(water_to_add, 3),
        "final_volume_liters": round(final_volume, 3),
        "final_abv": round(target_abv, 2),
    }


# ---------------------------------------------------------------------------
# 2. ABV del wash a partir de OG/FG
# ---------------------------------------------------------------------------

def calculate_wash_abv(og: float, fg: float) -> float:
    """
    Calcula el ABV del wash fermentado usando la fórmula estándar.

    ABV = (OG − FG) × 131.25

    Parámetros:
        og: Original Gravity del wash (ej. 1.080)
        fg: Final Gravity del wash (ej. 1.010)

    Returns:
        ABV en % vol
    """
    if og <= fg:
        raise ValueError(f"OG ({og}) debe ser mayor que FG ({fg})")
    if not (1.0 <= og <= 1.200):
        raise ValueError(f"OG ({og}) fuera de rango razonable (1.000–1.200)")
    if not (0.990 <= fg <= 1.050):
        raise ValueError(f"FG ({fg}) fuera de rango razonable (0.990–1.050)")

    return round((og - fg) * 131.25, 2)


# ---------------------------------------------------------------------------
# 3. Rendimiento de fermentación por tipo de materia prima
# ---------------------------------------------------------------------------

@dataclass
class FermentableSpec:
    name: str
    sugar_content_pct: float      # % de azúcares fermentables
    fermentation_yield_pct: float  # % de conversión esperado
    typical_og_per_kg_per_liter: float  # puntos de gravedad por kg por litro


FERMENTABLE_DATABASE: dict[str, FermentableSpec] = {
    "maiz": FermentableSpec(
        name="Maíz (bourbon)",
        sugar_content_pct=72.0,
        fermentation_yield_pct=90.0,
        typical_og_per_kg_per_liter=30.0,
    ),
    "cebada_malteada": FermentableSpec(
        name="Cebada malteada (single malt)",
        sugar_content_pct=78.0,
        fermentation_yield_pct=88.0,
        typical_og_per_kg_per_liter=32.0,
    ),
    "centeno": FermentableSpec(
        name="Centeno (rye whisky)",
        sugar_content_pct=68.0,
        fermentation_yield_pct=85.0,
        typical_og_per_kg_per_liter=28.0,
    ),
    "trigo": FermentableSpec(
        name="Trigo (vodka de trigo)",
        sugar_content_pct=75.0,
        fermentation_yield_pct=90.0,
        typical_og_per_kg_per_liter=31.0,
    ),
    "melaza": FermentableSpec(
        name="Melaza de caña (ron)",
        sugar_content_pct=55.0,
        fermentation_yield_pct=92.0,
        typical_og_per_kg_per_liter=22.0,
    ),
    "uva": FermentableSpec(
        name="Uva (brandy/grappa)",
        sugar_content_pct=18.0,  # depende de Brix
        fermentation_yield_pct=95.0,
        typical_og_per_kg_per_liter=7.0,
    ),
    "manzana": FermentableSpec(
        name="Manzana (calvados)",
        sugar_content_pct=12.0,
        fermentation_yield_pct=90.0,
        typical_og_per_kg_per_liter=5.0,
    ),
}


def calculate_fermentation_yield(
    fermentable_type: str,
    amount_kg: float,
    wash_volume_liters: float,
    custom_sugar_pct: float | None = None,
    custom_brix: float | None = None,
) -> dict[str, Any]:
    """
    Calcula el rendimiento de fermentación para un cereal o fruta.

    Parámetros:
        fermentable_type: clave del FERMENTABLE_DATABASE
        amount_kg: cantidad en kg
        wash_volume_liters: volumen del wash en litros
        custom_sugar_pct: % de azúcar personalizado (anula el de la DB)
        custom_brix: Brix medido (para fruta fresca; 1 Brix ≈ 10 g/L de azúcar)
    """
    if fermentable_type not in FERMENTABLE_DATABASE:
        available = list(FERMENTABLE_DATABASE.keys())
        raise ValueError(f"Tipo '{fermentable_type}' no reconocido. Disponibles: {available}")
    if amount_kg <= 0:
        raise ValueError("amount_kg debe ser positivo")
    if wash_volume_liters <= 0:
        raise ValueError("wash_volume_liters debe ser positivo")

    spec = FERMENTABLE_DATABASE[fermentable_type]
    sugar_pct = custom_sugar_pct if custom_sugar_pct is not None else spec.sugar_content_pct

    # Si se provee Brix para fruta (ej 18°Bx → 18 g/100g → 180 g/L)
    if custom_brix is not None:
        sugars_per_kg = custom_brix * 10  # g de azúcar por kg de fruta
        sugar_pct = sugars_per_kg / 10    # % en peso

    fermentable_sugars_kg = amount_kg * (sugar_pct / 100)
    # 1 kg de azúcar → ~0.511 kg de etanol (ratio de Gay-Lussac)
    ethanol_kg = fermentable_sugars_kg * 0.511 * (spec.fermentation_yield_pct / 100)
    # Densidad del etanol ≈ 0.789 kg/L
    ethanol_liters = ethanol_kg / 0.789
    wash_abv = (ethanol_liters / wash_volume_liters) * 100

    # OG estimado (1 punto = 0.001 SG)
    og_points = spec.typical_og_per_kg_per_liter * (amount_kg / wash_volume_liters)
    estimated_og = 1.0 + og_points / 1000

    return {
        "fermentable": spec.name,
        "amount_kg": amount_kg,
        "wash_volume_liters": wash_volume_liters,
        "sugar_pct_used": round(sugar_pct, 2),
        "fermentable_sugars_kg": round(fermentable_sugars_kg, 3),
        "ethanol_liters": round(ethanol_liters, 3),
        "estimated_wash_abv_pct": round(wash_abv, 2),
        "estimated_og": round(estimated_og, 4),
        "fermentation_yield_pct": spec.fermentation_yield_pct,
    }


# ---------------------------------------------------------------------------
# 4. Estimación de cortes heads/hearts/tails
# ---------------------------------------------------------------------------

@dataclass
class CutPoints:
    heads_end_temp_c: float    # temperatura de fin de cabezas (°C)
    hearts_end_temp_c: float   # temperatura de fin de corazón (°C)
    heads_abv_threshold: float  # ABV mínimo para cabezas (%)
    tails_abv_threshold: float  # ABV mínimo para colas (%)


DEFAULT_CUT_POINTS = CutPoints(
    heads_end_temp_c=78.0,
    hearts_end_temp_c=93.0,
    heads_abv_threshold=75.0,
    tails_abv_threshold=40.0,
)


def estimate_cuts(
    wash_volume_liters: float,
    wash_abv: float,
    cut_points: CutPoints | None = None,
) -> dict[str, Any]:
    """
    Estima el volumen aproximado de cada corte basándose en el wash.

    Parámetros:
        wash_volume_liters: Volumen del wash antes de destilar
        wash_abv: ABV del wash (%)
        cut_points: Parámetros de corte (usa DEFAULT_CUT_POINTS si None)

    Returns:
        {
          "heads_liters", "hearts_liters", "tails_liters",
          "total_distillate_liters", "spirit_yield_pct",
          "cut_temperatures"
        }
    """
    if wash_volume_liters <= 0:
        raise ValueError("wash_volume_liters debe ser positivo")
    if not (0 < wash_abv <= 20):
        raise ValueError(f"wash_abv ({wash_abv}%) debe estar entre 0 y 20% para un wash normal")

    cp = cut_points or DEFAULT_CUT_POINTS

    # Etanol total en el wash
    ethanol_total_liters = wash_volume_liters * (wash_abv / 100)

    # Estimaciones empíricas basadas en ratio típico de destilación
    # Cabezas: ~5% del total de etanol (metanol, acetaldehído)
    # Corazón: ~70% del total de etanol
    # Colas: ~25% del total de etanol
    heads_fraction = 0.05
    hearts_fraction = 0.70
    tails_fraction = 0.25

    # Conversión a litros de destilado (approx @ ABV promedio de cada fracción)
    heads_liters = round(ethanol_total_liters * heads_fraction / (cp.heads_abv_threshold / 100), 2)
    hearts_liters = round(ethanol_total_liters * hearts_fraction / 0.65, 2)  # ~65% ABV corazón
    tails_liters = round(ethanol_total_liters * tails_fraction / (cp.tails_abv_threshold / 100), 2)

    total_distillate = round(heads_liters + hearts_liters + tails_liters, 2)
    spirit_yield_pct = round((hearts_liters / wash_volume_liters) * 100, 2) if wash_volume_liters > 0 else 0

    return {
        "wash_volume_liters": wash_volume_liters,
        "wash_abv_pct": wash_abv,
        "ethanol_total_liters": round(ethanol_total_liters, 3),
        "heads_liters": heads_liters,
        "hearts_liters": hearts_liters,
        "tails_liters": tails_liters,
        "total_distillate_liters": total_distillate,
        "spirit_yield_pct": spirit_yield_pct,
        "cut_temperatures": {
            "heads_end_c": cp.heads_end_temp_c,
            "hearts_end_c": cp.hearts_end_temp_c,
        },
        "safety_note": (
            "⚠️ Las cabezas contienen metanol y acetaldehído. "
            "SIEMPRE descarta las cabezas. Mantén ventilación adecuada."
        ),
    }


# ---------------------------------------------------------------------------
# 5. Mashing para destilación — temperaturas de enzimas / gelatinización
# ---------------------------------------------------------------------------

MASH_PROFILES: dict[str, dict[str, Any]] = {
    "maiz": {
        "gelatinization_temp_c": 75.0,
        "saccharification_temp_c": 63.5,
        "enzyme_additions": [
            {"enzyme": "alfa-amilasa", "dose_g_per_kg": 2.0, "temp_c": 75.0, "duration_min": 30},
            {"enzyme": "glucoamilasa", "dose_g_per_kg": 1.5, "temp_c": 63.5, "duration_min": 60},
        ],
        "ph_range": (5.2, 5.5),
        "notes": "Gelatinización obligatoria antes de sacarificación. Añadir cebada malteada para aportar enzimas.",
    },
    "centeno": {
        "gelatinization_temp_c": 60.0,
        "saccharification_temp_c": 63.5,
        "enzyme_additions": [
            {"enzyme": "beta-glucanasa", "dose_g_per_kg": 1.0, "temp_c": 45.0, "duration_min": 20},
            {"enzyme": "alfa-amilasa", "dose_g_per_kg": 1.5, "temp_c": 65.0, "duration_min": 60},
        ],
        "ph_range": (5.2, 5.6),
        "notes": "El centeno contiene mucho beta-glucano. Reposo a 45°C reduce viscosidad.",
    },
    "cebada_malteada": {
        "gelatinization_temp_c": 52.0,
        "saccharification_temp_c": 64.0,
        "enzyme_additions": [],
        "ph_range": (5.2, 5.4),
        "notes": "La cebada malteada tiene enzimas propias. No requiere adiciones externas.",
    },
    "trigo": {
        "gelatinization_temp_c": 58.0,
        "saccharification_temp_c": 63.0,
        "enzyme_additions": [
            {"enzyme": "alfa-amilasa", "dose_g_per_kg": 1.0, "temp_c": 65.0, "duration_min": 45},
        ],
        "ph_range": (5.3, 5.6),
        "notes": "Trigo tiende a pegar. Usar rice hulls o agitación constante.",
    },
}


def get_mash_profile(
    cereal_type: str,
    amount_kg: float,
    water_liters: float,
) -> dict[str, Any]:
    """
    Devuelve el perfil de mashing recomendado para un cereal.

    Parámetros:
        cereal_type: tipo de cereal (maiz, centeno, cebada_malteada, trigo)
        amount_kg: cantidad de cereal en kg
        water_liters: volumen de agua de macerado en litros

    Returns:
        Perfil completo de mashing con temperaturas, enzimas y cantidades
    """
    if cereal_type not in MASH_PROFILES:
        available = list(MASH_PROFILES.keys())
        raise ValueError(f"Cereal '{cereal_type}' no reconocido. Disponibles: {available}")
    if amount_kg <= 0 or water_liters <= 0:
        raise ValueError("amount_kg y water_liters deben ser positivos")

    profile = MASH_PROFILES[cereal_type].copy()
    ratio = water_liters / amount_kg

    # Calcular cantidades reales de enzimas
    enzyme_amounts = []
    for enzyme in profile["enzyme_additions"]:
        dose_grams = enzyme["dose_g_per_kg"] * amount_kg
        enzyme_amounts.append({
            **enzyme,
            "total_dose_grams": round(dose_grams, 1),
        })

    return {
        "cereal": cereal_type,
        "amount_kg": amount_kg,
        "water_liters": water_liters,
        "water_grain_ratio": round(ratio, 2),
        "gelatinization_temp_c": profile["gelatinization_temp_c"],
        "saccharification_temp_c": profile["saccharification_temp_c"],
        "enzyme_additions": enzyme_amounts,
        "ph_range": profile["ph_range"],
        "notes": profile["notes"],
        "validation": _validate_mash_params(ratio, profile),
    }


def _validate_mash_params(
    water_grain_ratio: float, profile: dict[str, Any]
) -> list[str]:
    """Validación de rangos del mash."""
    warnings: list[str] = []
    if water_grain_ratio < 2.5:
        warnings.append("⚠️ Ratio agua/grano < 2.5 L/kg: puede resultar muy espeso.")
    if water_grain_ratio > 6.0:
        warnings.append("⚠️ Ratio agua/grano > 6.0 L/kg: lavado muy diluido, baja OG.")
    ph_min, ph_max = profile["ph_range"]
    warnings.append(f"Ajustar pH entre {ph_min} y {ph_max} antes del macerado.")
    return warnings
