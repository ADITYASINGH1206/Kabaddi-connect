"""
Unit tests for schema validation, material taxonomy filtering,
malformed model output recovery, and price calculation.
"""

import pytest
from backend.common.schema import (
    VALID_MATERIALS,
    calculate_price_estimate,
    sanitize_and_parse_json,
    validate_vision_response,
)


class TestSchemaValidation:
    def test_valid_model_output(self):
        raw = {
            "photo_quality_ok": True,
            "retake_reason": None,
            "items": [
                {
                    "material": "newspaper_paper",
                    "weight_kg_low": 5.0,
                    "weight_kg_high": 8.0,
                    "confidence": 0.95,
                    "note": "Stack of Hindi daily newspapers",
                },
                {
                    "material": "cardboard",
                    "weight_kg_low": 2.0,
                    "weight_kg_high": 4.0,
                    "confidence": 0.88,
                    "note": "Corrugated delivery cartons",
                },
            ],
            "hazards": [],
        }
        res = validate_vision_response(raw)
        assert res["photo_quality_ok"] is True
        assert res["retake_reason"] is None
        assert len(res["items"]) == 2
        assert res["items"][0]["material"] == "newspaper_paper"
        assert res["items"][0]["weight_kg_low"] == 5.0
        assert res["items"][0]["weight_kg_high"] == 8.0
        assert res["fallback"] is False

    def test_drops_materials_not_in_taxonomy(self):
        raw = {
            "photo_quality_ok": True,
            "items": [
                {"material": "newspaper_paper", "weight_kg_low": 3.0, "weight_kg_high": 5.0},
                {"material": "uranium_fuel_rod", "weight_kg_low": 1.0, "weight_kg_high": 2.0},  # NOT IN TAXONOMY
                {"material": "gold_jewelry", "weight_kg_low": 0.5, "weight_kg_high": 0.6},      # NOT IN TAXONOMY
                {"material": "pet_bottles", "weight_kg_low": 1.0, "weight_kg_high": 2.0},
            ],
            "hazards": [],
        }
        res = validate_vision_response(raw)
        materials = [item["material"] for item in res["items"]]
        assert "newspaper_paper" in materials
        assert "pet_bottles" in materials
        assert "uranium_fuel_rod" not in materials
        assert "gold_jewelry" not in materials
        assert len(res["items"]) == 2

    def test_photo_quality_false_with_retake_reason(self):
        raw = {
            "photo_quality_ok": False,
            "retake_reason": "Image is too dark and blurry to detect items",
            "items": [],
            "hazards": [],
        }
        res = validate_vision_response(raw)
        assert res["photo_quality_ok"] is False
        assert "too dark" in res["retake_reason"]
        assert len(res["items"]) == 0

    def test_hazard_detection(self):
        raw = {
            "photo_quality_ok": True,
            "items": [
                {"material": "ewaste_battery_or_crt", "weight_kg_low": 1.0, "weight_kg_high": 2.0},
            ],
            "hazards": ["Corroded lead acid battery case"],
        }
        res = validate_vision_response(raw)
        assert len(res["hazards"]) >= 1
        assert any("battery" in h.lower() for h in res["hazards"])

    def test_json_sanitizer_with_code_fences(self):
        markdown_output = """```json
{
  "photo_quality_ok": true,
  "retake_reason": null,
  "items": [
    {"material": "iron_steel", "weight_kg_low": 10.0, "weight_kg_high": 15.0, "confidence": 0.9}
  ],
  "hazards": []
}
```"""
        parsed = sanitize_and_parse_json(markdown_output)
        assert isinstance(parsed, dict)
        assert parsed["photo_quality_ok"] is True
        assert len(parsed["items"]) == 1

    def test_malformed_json_raises_value_error(self):
        malformed = "This is not JSON: { photo_quality: True, items: [ "
        with pytest.raises(Exception):
            sanitize_and_parse_json(malformed)

    def test_malformed_weights_and_confidence_sanitization(self):
        raw = {
            "photo_quality_ok": True,
            "items": [
                {
                    "material": "aluminium",
                    "weight_kg_low": "not_a_number",
                    "weight_kg_high": -10,  # negative high
                    "confidence": 1.5,      # out of bounds > 1.0
                }
            ],
        }
        res = validate_vision_response(raw)
        item = res["items"][0]
        assert item["material"] == "aluminium"
        assert item["weight_kg_low"] >= 0
        assert item["weight_kg_high"] >= item["weight_kg_low"]
        assert 0.0 <= item["confidence"] <= 1.0


class TestPriceCalculation:
    @pytest.fixture
    def sample_rates(self):
        return {
            "newspaper_paper": {"rate_low": 12.0, "rate_high": 16.0},
            "cardboard": {"rate_low": 8.0, "rate_high": 12.0},
            "copper": {"rate_low": 420.0, "rate_high": 520.0},
            "pet_bottles": {"rate_low": 15.0, "rate_high": 22.0},
        }

    def test_basic_price_calculation(self, sample_rates):
        items = [
            {"material": "newspaper_paper", "weight_kg_low": 10.0, "weight_kg_high": 10.0},
            {"material": "copper", "weight_kg_low": 2.0, "weight_kg_high": 3.0},
        ]
        # Newspaper: 10*12=120 low, 10*16=160 high
        # Copper: 2*420=840 low, 3*520=1560 high
        # Total low = 120 + 840 = 960
        # Total high = 160 + 1560 = 1720
        p_low, p_high = calculate_price_estimate(items, sample_rates)
        assert p_low == 960.0
        assert p_high == 1720.0

    def test_empty_items_yields_zero(self, sample_rates):
        p_low, p_high = calculate_price_estimate([], sample_rates)
        assert p_low == 0.0
        assert p_high == 0.0

    def test_missing_material_in_rates_handled_safely(self, sample_rates):
        items = [
            {"material": "unknown_future_material", "weight_kg_low": 5.0, "weight_kg_high": 10.0}
        ]
        p_low, p_high = calculate_price_estimate(items, sample_rates)
        assert p_low == 0.0
        assert p_high == 0.0
