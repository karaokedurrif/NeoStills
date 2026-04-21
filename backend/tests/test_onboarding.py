from __future__ import annotations

from tests.conftest import auth_headers


async def test_onboarding_status_reports_missing_still_fields(client, test_user):
    _user, _brewery, token = test_user

    response = await client.get("/api/v1/onboarding/status", headers=auth_headers(token))

    assert response.status_code == 200
    data = response.json()
    assert data["is_complete"] is False
    assert "still_type" in data["missing_fields"]
    assert "still_capacity_liters" in data["missing_fields"]


async def test_onboarding_setup_completes_home_distillery(client, test_user):
    _user, _brewery, token = test_user

    response = await client.post(
        "/api/v1/onboarding/setup",
        headers=auth_headers(token),
        json={
            "usage_type": "home",
            "still_type": "pot_still",
            "still_capacity_liters": 35,
            "distillery_name": "Mi alambique",
            "location": "Segovia",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["onboarding_complete"] is True
    assert data["distillery_name"] == "Mi alambique"


async def test_onboarding_setup_requires_dimensions_for_professional(client, test_user):
    _user, _brewery, token = test_user

    response = await client.post(
        "/api/v1/onboarding/setup",
        headers=auth_headers(token),
        json={
            "usage_type": "professional",
            "still_type": "column_still",
            "still_capacity_liters": 350,
            "distillery_name": "NeoStills Craft",
        },
    )

    assert response.status_code == 422
    assert "space_dimensions" in response.json()["detail"]


async def test_register_returns_tokens_and_uses_brewery_name(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "nuevo@neostills.es",
            "password": "Strong1234!",
            "full_name": "Neo Distiller",
            "brewery_name": "Destilería de prueba",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["brewery"]["name"] == "Destilería de prueba"