from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "online"
    assert body["binary_size"] == 512 * 1024
    assert body["profile_confidence"] == "demo"


def test_health_alias_avoids_404_for_monitors(client):
    for path in ("/health", "/healthz"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.json()["status"] == "online"


def test_ai_status_endpoint(client):
    response = client.get("/api/ai/status")
    assert response.status_code == 200
    body = response.json()
    assert "online" in body
    assert "base_url" in body
    assert isinstance(body["models"], list)
    assert "preferred_models" in body


def test_profile_and_maps(client):
    profile = client.get("/api/ecu/profile")
    assert profile.status_code == 200
    assert "boost" in profile.json()["maps"]
    maps = client.get("/api/maps")
    assert {item["key"] for item in maps.json()["maps"]} >= {
        "boost",
        "driver_wish",
        "smoke_limiter",
        "torque_limiter",
    }


def test_map_matrix(client):
    response = client.get("/api/map/boost")
    assert response.status_code == 200
    body = response.json()
    assert len(body["matrix"]) == 16
    assert len(body["matrix"][0]) == 16
    assert body["stats"]["shape"] == [16, 16]


def test_unknown_map_returns_404(client):
    assert client.get("/api/map/turbo_secret").status_code == 404


def test_validate_safe_and_unsafe(client):
    safe = client.post(
        "/api/validate",
        json={"turbo": 12, "injection": 5, "throttle": 12},
    )
    assert safe.status_code == 200
    assert safe.json()["allowed"] is True

    unsafe = client.post(
        "/api/validate",
        json={"turbo": 30, "injection": 0, "throttle": 0},
    )
    assert unsafe.status_code == 200
    assert unsafe.json()["allowed"] is False


def test_tune_json_seals_checksum(client):
    response = client.post(
        "/api/tune",
        json={"turbo": 10, "injection": 4, "throttle": 8},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["checksum_verification"]["overall_status"] == "VALID"
    assert len(body["change_reports"]) == 3

    verify = client.get("/api/checksum/verify").json()
    assert verify["overall_status"] == "VALID"


def test_unsafe_tune_returns_422_safety_payload(client):
    response = client.post(
        "/api/tune",
        json={"turbo": 25, "injection": 0, "throttle": 0},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "SAFETY_VIOLATION"
    assert body["safety"]["code"] == "MECHANICAL_LIMIT"
    assert "reddedildi" in body["detail"]


def test_export_returns_checksum_headers(client):
    response = client.get("/api/download?turbo=10&injection=4&throttle=8")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"
    assert response.headers["x-checksum-status"] == "VALID"
    assert len(response.content) == 512 * 1024
    assert "attachment" in response.headers["content-disposition"]


def test_export_rejects_unsafe_query(client):
    response = client.get("/api/download?turbo=25")
    assert response.status_code == 422
    assert response.json()["error"] == "SAFETY_VIOLATION"


def test_upload_accepts_demo_bin(client, demo_bin):
    response = client.post(
        "/api/ecu/upload",
        files={"file": ("demo.bin", io.BytesIO(demo_bin), "application/octet-stream")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["identity"]["profile_id"] == "bosch-edc15p-19tdi-demo"


def test_upload_rejects_unknown_ecu(client):
    response = client.post(
        "/api/ecu/upload",
        files={"file": ("random.bin", io.BytesIO(b"\x00" * 1024), "application/octet-stream")},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "UNSUPPORTED_ECU"


def test_versions_are_listed(client):
    response = client.get("/api/versions")
    assert response.status_code == 200
    assert len(response.json()["versions"]) >= 1
    first = response.json()["versions"][0]
    assert "sha256_prefix" in first
    assert "data" not in first


def test_rag_chat(client):
    response = client.post("/api/rag/chat", data={"prompt": "Arabam yokuşta bayılıyor"})
    assert response.status_code == 200
    body = response.json()
    assert body["matched_intent"] == "hill_climb_torque"
    assert "0x4F080" in " ".join(body["target_ecu_maps"])
    assert body["guardrail_check"]["allowed"] is True


def test_presets_are_guardrail_checked(client):
    response = client.get("/api/presets")
    assert response.status_code == 200
    presets = response.json()["presets"]
    assert len(presets) == 4
    assert all("allowed" in preset for preset in presets)
