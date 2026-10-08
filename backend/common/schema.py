"""
Material taxonomy and schema validation for Bedrock vision output and listings.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

VALID_MATERIALS = {
    "newspaper_paper",
    "cardboard",
    "books_notebooks",
    "pet_bottles",
    "hdpe_plastic",
    "mixed_plastic",
    "plastic_bags_film",
    "iron_steel",
    "aluminium",
    "copper",
    "brass",
    "glass_bottles",
    "ewaste_phone",
    "ewaste_laptop",
    "ewaste_small_appliance",
    "ewaste_battery_or_crt",
    "non_recyclable",
}

HAZARDOUS_MATERIALS = {
    "ewaste_battery_or_crt",
}

BEDROCK_SYSTEM_PROMPT = """You are a scrap-material assessor for an Indian recycling marketplace.
Look at the photo of household or shop scrap and identify the recyclable
materials visible. Use ONLY these material codes: newspaper_paper, cardboard, books_notebooks, pet_bottles, hdpe_plastic, mixed_plastic, plastic_bags_film, iron_steel, aluminium, copper, brass, glass_bottles, ewaste_phone, ewaste_laptop, ewaste_small_appliance, ewaste_battery_or_crt, non_recyclable.
For each material give an estimated weight RANGE in kilograms (low and
high), because weight from a photo is uncertain. Use common sense about
typical item sizes (a 1 L PET bottle is about 25 g, a bundle of newspapers
about 5 to 10 kg, etc.). Set confidence to a number from 0 to 1.
If the photo is too dark, blurry, or shows no scrap, set photo_quality_ok
to false and give a short retake_reason. Flag hazards (batteries, broken
CRT/glass, medical waste, chemicals).
Respond with JSON only, matching this schema:
{
  "photo_quality_ok": boolean,
  "retake_reason": string|null,
  "items": [{"material": code, "weight_kg_low": number,
             "weight_kg_high": number, "confidence": number,
             "note": string}],
  "hazards": [string]
}"""


def sanitize_and_parse_json(raw_text: str) -> Dict[str, Any]:
    """
    Parses JSON from model output, handling potential markdown code fences.
    Raises ValueError if JSON is malformed.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return json.loads(cleaned)


def validate_vision_response(data: Any) -> Dict[str, Any]:
    """
    Validates model output structure, filtering out items whose material
    is not in the taxonomy. Ensures proper types and sensible weight bounds.
    """
    if not isinstance(data, dict):
        raise ValueError("Model output must be a JSON object")

    photo_quality_ok = bool(data.get("photo_quality_ok", True))
    retake_reason = data.get("retake_reason")
    if retake_reason is not None and not isinstance(retake_reason, str):
        retake_reason = str(retake_reason)

    raw_items = data.get("items", [])
    if not isinstance(raw_items, list):
        raw_items = []

    validated_items: List[Dict[str, Any]] = []
    hazards: List[str] = []

    if isinstance(data.get("hazards"), list):
        for h in data["hazards"]:
            if isinstance(h, str) and h.strip():
                hazards.append(h.strip())

    for item in raw_items:
        if not isinstance(item, dict):
            continue

        material = str(item.get("material", "")).strip().lower()
        # Drop any item whose material is not in the taxonomy
        if material not in VALID_MATERIALS:
            continue

        try:
            w_low = float(item.get("weight_kg_low", 0.0))
            w_high = float(item.get("weight_kg_high", 0.0))
            if w_low < 0:
                w_low = 0.0
            if w_high < w_low:
                w_high = w_low
        except (ValueError, TypeError):
            w_low, w_high = 0.5, 1.0

        try:
            confidence = float(item.get("confidence", 0.8))
            confidence = max(0.0, min(1.0, confidence))
        except (ValueError, TypeError):
            confidence = 0.8

        note = str(item.get("note", ""))

        if material in HAZARDOUS_MATERIALS and "Contains hazardous material" not in hazards:
            hazards.append(f"Hazardous item detected: {material}. Must be directed to authorised channels.")

        validated_items.append({
            "material": material,
            "weight_kg_low": round(w_low, 2),
            "weight_kg_high": round(w_high, 2),
            "confidence": round(confidence, 2),
            "note": note,
        })

    return {
        "photo_quality_ok": photo_quality_ok,
        "retake_reason": retake_reason if not photo_quality_ok else None,
        "items": validated_items,
        "hazards": hazards,
        "fallback": False,
    }


def calculate_price_estimate(items: List[Dict[str, Any]], rates: Dict[str, Dict[str, Any]]) -> Tuple[float, float]:
    """
    Calculates estimated price range:
    price_low = sum(weight_low * rate_low)
    price_high = sum(weight_high * rate_high)
    """
    total_low = 0.0
    total_high = 0.0

    for item in items:
        mat = item.get("material")
        weight_low = float(item.get("weight_kg_low", 0.0))
        weight_high = float(item.get("weight_kg_high", 0.0))

        rate_info = rates.get(mat, {})
        r_low = float(rate_info.get("rate_low", 0.0))
        r_high = float(rate_info.get("rate_high", 0.0))

        total_low += weight_low * r_low
        total_high += weight_high * r_high

    return round(total_low, 2), round(total_high, 2)
