from __future__ import annotations

from tests.conftest import auth_headers


async def test_create_inventory_item_persists_for_distillery(client, test_user):
    _user, _distillery, token = test_user

    response = await client.post(
        "/api/v1/inventory",
        headers=auth_headers(token),
        json={
            "name": "Maiz laminado",
            "category": "cereal_base",
            "quantity": 8,
            "unit": "kg",
            "min_stock": 2,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Maiz laminado"
    assert data["category"] == "cereal_base"
    assert data["distillery_id"]


async def test_create_recipe_uses_current_distillery_scope(client, test_user):
    _user, _distillery, token = test_user

    response = await client.post(
        "/api/v1/recipes",
        headers=auth_headers(token),
        json={
            "name": "Whiskey de maiz inicial",
            "spirit_type": "whisky",
            "distillation_method": "pot_still",
            "stripping_run_enabled": True,
            "wash_volume_liters": 25,
            "batch_size_liters": 3.5,
            "og": 1.068,
            "fg": 1.01,
            "wash_abv": 7.6,
            "target_abv": 63,
            "cereals": [
                {"name": "Maiz laminado", "amount_kg": 6.0, "type": "base"},
                {"name": "Centeno", "amount_kg": 1.2, "type": "spice"}
            ],
            "fermentation_yeasts": [
                {"name": "Levadura de destileria", "lab": "Lallemand"}
            ]
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Whiskey de maiz inicial"
    assert data["distillery_id"]
    assert data["cereals"][0]["name"] == "Maiz laminado"