# backend/app/services/scraper_service.py
"""
Price scrapers for Spanish home distilling shops.
Uses httpx (async HTTP) + BeautifulSoup4.
Each scraper returns a list of PriceResult dicts.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Callable

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class ScraperError(Exception):
    """Base exception for scraper failures."""
    pass

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-ES,es;q=0.9",
}


@dataclass
class PriceResult:
    ingredient_name: str
    shop_name: str
    shop_url: str
    product_url: str
    product_name: str
    price: float
    unit: str
    price_per_kg: float | None
    in_stock: bool


def _parse_price(text: str) -> float | None:
    text = text.strip().replace("\xa0", "").replace(" ", "")
    m = re.search(r"(\d+[\.,]\d+|\d+)", text.replace(",", "."))
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


def _extract_weight(text: str) -> tuple[float | None, str | None]:
    """Extract weight/volume from product name. Returns (qty_kg, unit_str)."""
    text_lower = text.lower()
    # Match patterns like "25 kg", "500 g", "125g", "1 kg", "5kg"
    m = re.search(r"(\d+[\.,]?\d*)\s*(kg|g|gr|ml|l)\b", text_lower)
    if not m:
        return None, None
    qty = float(m.group(1).replace(",", "."))
    unit = m.group(2)
    if unit in ("g", "gr"):
        return qty / 1000, f"{m.group(1)}{unit}"
    elif unit == "ml":
        return qty / 1000, f"{m.group(1)}{unit}"
    elif unit == "l":
        return qty, f"{m.group(1)}{unit}"
    else:  # kg
        return qty, f"{m.group(1)}{unit}"


def _compute_price_per_kg(price: float, product_name: str) -> float | None:
    """Compute price per kg from product name weight info."""
    qty_kg, _ = _extract_weight(product_name)
    if qty_kg and qty_kg > 0:
        return round(price / qty_kg, 2)
    return None


def _detect_stock(card) -> bool:
    """Check if product appears to be in stock based on card HTML."""
    text = card.get_text(strip=True).lower()
    out_of_stock = ["agotado", "sin stock", "no disponible", "out of stock", "sold out"]
    return not any(phrase in text for phrase in out_of_stock)


# ─── La Tienda del destilador ────────────────────────────────────────────────

async def scrape_latiendadeldestilador(query: str) -> list[PriceResult]:
    url = f"https://www.latiendadeldestilador.com/buscar?controller=search&s={query.replace(' ', '+')}"
    results: list[PriceResult] = []
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for card in soup.select(".product-miniature")[:15]:
            name_el = card.select_one(".product-title a")
            price_el = card.select_one(".price")
            if not (name_el and price_el):
                continue
            name = name_el.get_text(strip=True)
            price = _parse_price(price_el.get_text(strip=True))
            if price is None:
                continue
            # Get product link - try multiple selectors
            link = name_el.get("href", "")
            if not link:
                link_el = card.select_one("a.thumbnail") or card.select_one("a")
                link = link_el.get("href", url) if link_el else url
            # Get unit from weight in product name
            qty_kg, unit_str = _extract_weight(name)
            unit = unit_str or "unit"
            results.append(
                PriceResult(
                    ingredient_name=query,
                    shop_name="La Tienda del destilador",
                    shop_url="https://www.latiendadeldestilador.com",
                    product_url=str(link),
                    product_name=name,
                    price=price,
                    unit=unit,
                    price_per_kg=_compute_price_per_kg(price, name),
                    in_stock=_detect_stock(card),
                )
            )
    except httpx.HTTPError as exc:
        logger.warning("latiendadeldestilador HTTP error for %s: %s", query, exc)
    except (ValueError, KeyError, AttributeError) as exc:
        logger.warning("latiendadeldestilador parse error for %s: %s", query, exc)
    return results


# ─── Unified search ───────────────────────────────────────────────────────────

SCRAPERS: list[Callable[[str], object]] = [
    scrape_latiendadeldestilador,
]


async def search_all_shops(query: str) -> list[PriceResult]:
    """Run all scrapers in parallel and return merged, sorted results."""
    import asyncio

    tasks = [s(query) for s in SCRAPERS]
    all_results = await asyncio.gather(*tasks, return_exceptions=True)
    merged: list[PriceResult] = []
    for r in all_results:
        if isinstance(r, list):
            merged.extend(r)
        elif isinstance(r, Exception):
            logger.warning("Scraper failed: %s", r)
    merged.sort(key=lambda p: p.price)
    return merged
