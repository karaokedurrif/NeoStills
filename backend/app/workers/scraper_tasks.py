# backend/app/workers/scraper_tasks.py
"""Celery tasks for price scraping."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Comprehensive ingredient queries covering malts, hops, yeasts, and adjuncts
DEFAULT_QUERIES = [
    # ─── Base Malts ──────────────────────────────────
    "malta pilsen",
    "malta pale ale",
    "malta vienna",
    "malta munich",
    "malta maris otter",
    "malta trigo",
    "malta wheat",
    "malta centeno",
    "malta ahumada",
    "malta smoked",
    # ─── Specialty / Crystal Malts ────────────────────
    "malta caramelo",
    "malta crystal",
    "malta cara",
    "malta chocolate",
    "malta black",
    "malta negra",
    "malta tostada",
    "malta roasted barley",
    "malta biscuit",
    "malta melanoidin",
    "malta especial",
    "malta abbey",
    "malta acidulada",
    # ─── Hops (Lúpulo) - American ────────────────────
    "lupulo cascade",
    "lupulo centennial",
    "lupulo citra",
    "lupulo mosaic",
    "lupulo simcoe",
    "lupulo amarillo",
    "lupulo chinook",
    "lupulo columbus",
    "lupulo magnum",
    "lupulo nugget",
    "lupulo warrior",
    "lupulo el dorado",
    "lupulo galaxy",
    "lupulo nelson sauvin",
    "lupulo sabro",
    "lupulo idaho",
    "lupulo strata",
    "lupulo azacca",
    # ─── Hops - European ─────────────────────────────
    "lupulo hallertau",
    "lupulo saaz",
    "lupulo tettnanger",
    "lupulo perle",
    "lupulo fuggle",
    "lupulo east kent goldings",
    "lupulo styrian goldings",
    "lupulo northern brewer",
    "lupulo challenger",
    "lupulo spalter",
    # ─── Hops - New World ────────────────────────────
    "lupulo vic secret",
    "lupulo motueka",
    "lupulo riwaka",
    "lupulo wai-iti",
    # ─── Yeasts (Levadura) - Ale ─────────────────────
    "levadura safale us-05",
    "levadura safale s-04",
    "levadura safale s-33",
    "levadura safale be-256",
    "levadura safale be-134",
    "levadura nottingham",
    "levadura windsor",
    "levadura london ale",
    "levadura kveik",
    "levadura lallemand",
    "levadura verdant",
    "levadura mangrove jack",
    # ─── Yeasts - Lager ──────────────────────────────
    "levadura w34/70",
    "levadura saflager s-23",
    "levadura saflager w-34",
    "levadura lager",
    "levadura diamond lager",
    # ─── Yeasts - Wheat / Belgian ────────────────────
    "levadura safbrew wb-06",
    "levadura trigo",
    "levadura belgian",
    "levadura abbey",
    "levadura wit",
    # ─── Adjuncts / Extras ───────────────────────────
    "copos avena destilado",
    "copos trigo destilado",
    "copos cebada destilado",
    "arroz destilado",
    "maiz destilado",
    "azucar destilado",
    "miel destilado",
    "lactosa destilado",
    "dextrosa destilado",
    # ─── Water Treatment / Clarifiers ────────────────
    "sulfato calcio destilado",
    "acido lactico destilado",
    "irish moss destilado",
    "gelatina destilado",
    "whirlfloc destilado",
    "yeso destilado",
    # ─── Equipment searches ──────────────────────────
    "fermentador destilado",
    "kit destilado artesanal",
    "olla destilado",
    "molino malta",
    "densimetro destilado",
    "refractometro destilado",
    "chapadora destilado",
    "botellas destilado",
    "barril destilado",
    "serpentin enfriador",
    "airlock destilado",
    "sanitizante destilado",
    # ─── Bulk searches ───────────────────────────────
    "saco 25kg malta",
    "saco malta pilsen",
    "saco malta pale",
    "lupulo 1kg",
    "levadura bloque",
    # ─── Generic category searches ───────────────────
    "malta destilado",
    "lupulo destilado",
    "levadura destilado",
    "extracto malta",
    "dry malt extract",
]


@celery_app.task(name="app.workers.scraper_tasks.scrape_ingredient", bind=True, max_retries=3)
def scrape_ingredient(self, query: str) -> dict:
    """Scrape a single ingredient across all shops and save to DB."""
    try:
        from app.services.scraper_service import search_all_shops
        from app.core.database import AsyncSessionLocal
        from app.models.price import PriceRecord

        async def _run():
            results = await search_all_shops(query)
            now = datetime.now(timezone.utc)
            async with AsyncSessionLocal() as session:
                for r in results:
                    record = PriceRecord(
                        ingredient_name=r.ingredient_name,
                        shop_name=r.shop_name,
                        shop_url=r.shop_url,
                        product_url=r.product_url,
                        product_name=r.product_name,
                        price=r.price,
                        unit=r.unit,
                        price_per_kg=r.price_per_kg,
                        in_stock=r.in_stock,
                        scraped_at=now,
                    )
                    session.add(record)
                await session.commit()
            return results

        results = asyncio.run(_run())
        logger.info("Scraped %d results for '%s' and saved to DB", len(results), query)
        return {
            "query": query,
            "count": len(results),
            "shops": list({r.shop_name for r in results}),
        }

    except Exception as exc:
        logger.error("Scrape task failed for '%s': %s", query, exc)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@celery_app.task(name="app.workers.scraper_tasks.scrape_all_shops")
def scrape_all_shops() -> dict:
    """Fan-out scraping for all default queries."""
    logger.info("Starting full price scrape (%d queries)", len(DEFAULT_QUERIES))
    results = []
    for query in DEFAULT_QUERIES:
        task = scrape_ingredient.delay(query)
        results.append({"query": query, "task_id": task.id})
    return {"dispatched": len(results), "tasks": results}


@celery_app.task(name="app.workers.scraper_tasks.scrape_recipe_ingredients")
def scrape_recipe_ingredients(recipe_id: int) -> dict:
    """Scrape prices for all ingredients in a specific recipe."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.recipe import Recipe

        async def _load_recipe():
            async with AsyncSessionLocal() as session:
                return await session.get(Recipe, recipe_id)

        recipe = asyncio.run(_load_recipe())
        if not recipe:
            return {"recipe_id": recipe_id, "status": "not_found"}

        queries: list[str] = []
        if recipe.fermentables:
            queries += [f["name"] for f in recipe.fermentables if f.get("name")]
        if recipe.hops:
            queries += [f["name"] for f in recipe.hops if f.get("name")]
        if recipe.yeasts:
            queries += [f["name"] for f in recipe.yeasts if f.get("name")]

        tasks = []
        for q in queries[:20]:
            task = scrape_ingredient.delay(q)
            tasks.append({"query": q, "task_id": task.id})

        logger.info("Dispatched %d scrape tasks for recipe %d", len(tasks), recipe_id)
        return {"recipe_id": recipe_id, "status": "dispatched", "tasks": tasks}
    except Exception as exc:
        logger.error("Recipe scrape error for recipe %d: %s", recipe_id, exc)
        return {"recipe_id": recipe_id, "status": "error", "detail": str(exc)}
