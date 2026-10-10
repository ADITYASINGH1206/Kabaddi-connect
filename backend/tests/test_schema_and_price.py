"""
Unit tests for schema validation, material taxonomy filtering,
malformed model output recovery, and price calculation.
Uses standard unittest.TestCase so it runs in any standard Python environment.
"""

import unittest
from backend.common.schema import (
    VALID_MATERIALS,
    calculate_price_estimate,
    sanitize_and_parse_json,
    validate_vision_response,
)


class TestSchemaValidation(unittest.TestCase):
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
        self.assertTrue(res["photo_quality_ok"])
        self.assertIsNone(res["retake_reason"])
        self.assertEqual(len(res["items"]), 2)
        self.assertEqual(res["items"][0]["material"], "newspaper_paper")
        self.assertEqual(res["items"][0]["weight_kg_low"], 5.0)
        self.assertEqual(res["items"][0]["weight_kg_high"], 8.0)
        self.assertFalse(res["fallback"])

    def test_drops_materials_not_in_taxonomy(self):
        raw = {
            "photo_quality_ok": True,
            "items": [
                {"material": "newspaper_paper", "weight_kg_low": 3.0, "weight_kg_high": 5.0},
                {"material": "uranium_fuel_rod", "weight_kg_low": 1.0, "weight_kg_high": 2.0},
                {"material": "gold_jewelry", "weight_kg_low": 0.5, "weight_kg_high": 0.6},
                {"material": "pet_bottles", "weight_kg_low": 1.0, "weight_kg_high": 2.0},
            ],
            "hazards": [],
        }
        res = validate_vision_response(raw)
        materials = [item["material"] for item in res["items"]]
        self.assertIn("newspaper_paper", materials)
        self.assertIn("pet_bottles", materials)
        self.assertNotIn("uranium_fuel_rod", materials)
        self.assertNotIn("gold_jewelry", materials)
        self.assertEqual(len(res["items"]), 2)

    def test_photo_quality_false_with_retake_reason(self):
        raw = {
            "photo_quality_ok": False,
            "retake_reason": "Image is too dark and blurry to detect items",
            "items": [],
            "hazards": [],
        }
        res = validate_vision_response(raw)
        self.assertFalse(res["photo_quality_ok"])
        self.assertIn("too dark", res["retake_reason"])
        self.assertEqual(len(res["items"]), 0)

    def test_hazard_detection(self):
        raw = {
            "photo_quality_ok": True,
            "items": [
                {"material": "ewaste_battery_or_crt", "weight_kg_low": 1.0, "weight_kg_high": 2.0},
            ],
            "hazards": ["Corroded lead acid battery case"],
        }
        res = validate_vision_response(raw)
        self.assertGreaterEqual(len(res["hazards"]), 1)
        self.assertTrue(any("battery" in h.lower() for h in res["hazards"]))

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
        self.assertIsInstance(parsed, dict)
        self.assertTrue(parsed["photo_quality_ok"])
        self.assertEqual(len(parsed["items"]), 1)

    def test_malformed_json_raises_value_error(self):
        malformed = "This is not JSON: { photo_quality: True, items: [ "
        with self.assertRaises(Exception):
            sanitize_and_parse_json(malformed)

    def test_malformed_weights_and_confidence_sanitization(self):
        raw = {
            "photo_quality_ok": True,
            "items": [
                {
                    "material": "aluminium",
                    "weight_kg_low": "not_a_number",
                    "weight_kg_high": -10,
                    "confidence": 1.5,
                }
            ],
        }
        res = validate_vision_response(raw)
        item = res["items"][0]
        self.assertEqual(item["material"], "aluminium")
        self.assertGreaterEqual(item["weight_kg_low"], 0)
        self.assertGreaterEqual(item["weight_kg_high"], item["weight_kg_low"])
        self.assertTrue(0.0 <= item["confidence"] <= 1.0)


class TestPriceCalculation(unittest.TestCase):
    def setUp(self):
        self.sample_rates = {
            "newspaper_paper": {"rate_low": 12.0, "rate_high": 16.0},
            "cardboard": {"rate_low": 8.0, "rate_high": 12.0},
            "copper": {"rate_low": 420.0, "rate_high": 520.0},
            "pet_bottles": {"rate_low": 15.0, "rate_high": 22.0},
        }

    def test_basic_price_calculation(self):
        items = [
            {"material": "newspaper_paper", "weight_kg_low": 10.0, "weight_kg_high": 10.0},
            {"material": "copper", "weight_kg_low": 2.0, "weight_kg_high": 3.0},
        ]
        p_low, p_high = calculate_price_estimate(items, self.sample_rates)
        self.assertEqual(p_low, 960.0)
        self.assertEqual(p_high, 1720.0)

    def test_empty_items_yields_zero(self):
        p_low, p_high = calculate_price_estimate([], self.sample_rates)
        self.assertEqual(p_low, 0.0)
        self.assertEqual(p_high, 0.0)

    def test_missing_material_in_rates_handled_safely(self):
        items = [
            {"material": "unknown_future_material", "weight_kg_low": 5.0, "weight_kg_high": 10.0}
        ]
        p_low, p_high = calculate_price_estimate(items, self.sample_rates)
        self.assertEqual(p_low, 0.0)
        self.assertEqual(p_high, 0.0)


if __name__ == "__main__":
    unittest.main()
