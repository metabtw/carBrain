from __future__ import annotations

from backend.ollama_analyzer import (
    PREFERRED_MODELS,
    check_ollama_status,
    resolve_model,
)


def test_status_returns_structured_result():
    status = check_ollama_status()
    payload = status.as_dict()
    assert isinstance(payload["online"], bool)
    assert payload["base_url"].startswith("http")
    assert isinstance(payload["models"], list)
    if not payload["online"]:
        assert payload["error_code"] in {
            "OLLAMA_OFFLINE",
            "OLLAMA_TIMEOUT",
            "OLLAMA_UNREACHABLE",
            "OLLAMA_HTTP_ERROR",
            "OLLAMA_BAD_RESPONSE",
        }
        assert payload["guidance"]


def test_resolve_model_returns_installed_model():
    model, note = resolve_model("qwen2.5-coder:7b", ["qwen2.5-coder:7b"])
    assert model == "qwen2.5-coder:7b"
    assert note is None


def test_resolve_model_falls_back_to_preferred():
    model, note = resolve_model("gpt-oss:120b", ["llama3.1:8b"])
    assert model == "llama3.1:8b"
    assert note and "yüklü değil" in note


def test_resolve_model_handles_missing_tag():
    model, note = resolve_model("qwen2.5-coder", ["qwen2.5-coder:7b"])
    assert model == "qwen2.5-coder:7b"
    assert note and "kullanılıyor" in note


def test_resolve_model_without_any_model():
    model, note = resolve_model("qwen2.5-coder:7b", [])
    assert model is None
    assert note and "ollama pull" in note


def test_preferred_models_are_documented_options():
    assert "qwen2.5-coder:7b" in PREFERRED_MODELS
