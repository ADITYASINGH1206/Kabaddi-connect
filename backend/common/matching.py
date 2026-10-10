"""
Collector matching engine for KabadiConnect listings.
Implements scoring algorithm per spec §4.4:
  score = 0.5 * proximity + 0.3 * tripValue + 0.2 * capacity
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from common.geo import haversine_distance_km
    from common.schema import HAZARDOUS_MATERIALS
except ImportError:
    from backend.common.geo import haversine_distance_km
    from backend.common.schema import HAZARDOUS_MATERIALS

# Materials that must NEVER be matched to a collector — drop-off only
DROP_OFF_ONLY_MATERIALS = {"ewaste_battery_or_crt"}

# Default speed for ETA calculation (km/h)
DEFAULT_SPEED_KMH = 20

# Minimum-worthwhile value threshold (INR)
MIN_WORTHWHILE_VALUE_INR = 50

# Maximum search radius for batchHint (km)
BATCH_HINT_RADIUS_KM = 1.0


def is_eligible(
    collector: Dict[str, Any],
    listing_materials: List[str],
    listing_lat: float,
    listing_lng: float,
) -> bool:
    """
    Check if a collector is eligible for a listing:
    - Must be active
    - Must be within their max_radius_km of the listing
    - Must accept ALL of the listing's materials
    - E-waste rules: if listing has ewaste items, collector must accepts_ewaste
    """
    if not collector.get("active", False):
        return False

    col_lat = float(collector.get("lat", 0))
    col_lng = float(collector.get("lng", 0))
    max_radius = float(collector.get("max_radius_km", 5))

    distance = haversine_distance_km((col_lat, col_lng), (listing_lat, listing_lng))
    if distance > max_radius:
        return False

    accepted_materials = set(collector.get("accepts", []))
    for mat in listing_materials:
        if mat in DROP_OFF_ONLY_MATERIALS:
            continue  # These are never matched to collectors
        if mat not in accepted_materials:
            return False

    # E-waste materials (non-battery/CRT) require accepts_ewaste
    ewaste_materials = {"ewaste_phone", "ewaste_laptop", "ewaste_small_appliance"}
    has_ewaste = any(m in ewaste_materials for m in listing_materials)
    if has_ewaste and not collector.get("accepts_ewaste", False):
        return False

    return True


def compute_match_score(
    collector: Dict[str, Any],
    listing_lat: float,
    listing_lng: float,
    estimated_value_mid: float,
    max_distance_in_set: float,
) -> Dict[str, Any]:
    """
    Score = 0.5 * proximity_score + 0.3 * trip_value_score + 0.2 * capacity_score

    proximity_score: 1 - (distance / max_distance_in_set), clamped [0,1]
    trip_value_score: min(estimated_value_mid / 500, 1.0) — higher value = more attractive
    capacity_score: daily_capacity_kg / 500, clamped [0,1]
    """
    col_lat = float(collector.get("lat", 0))
    col_lng = float(collector.get("lng", 0))
    distance_km = haversine_distance_km((col_lat, col_lng), (listing_lat, listing_lng))

    # Proximity score (closer = higher)
    if max_distance_in_set > 0:
        proximity = 1.0 - (distance_km / max_distance_in_set)
    else:
        proximity = 1.0
    proximity = max(0.0, min(1.0, proximity))

    # Trip value score (higher estimated value = more attractive trip)
    trip_value = min(estimated_value_mid / 500.0, 1.0)

    # Capacity score (higher capacity = can handle more)
    daily_cap = float(collector.get("daily_capacity_kg", 200))
    capacity = min(daily_cap / 500.0, 1.0)

    score = 0.5 * proximity + 0.3 * trip_value + 0.2 * capacity

    # ETA based on configurable speed
    eta_min = round((distance_km / DEFAULT_SPEED_KMH) * 60, 1) if DEFAULT_SPEED_KMH > 0 else 0

    return {
        "collectorId": collector["collectorId"],
        "name": collector.get("name", ""),
        "phone": collector.get("phone", ""),
        "areaName": collector.get("areaName", ""),
        "distanceKm": round(distance_km, 2),
        "etaMin": eta_min,
        "score": round(score, 4),
        "accepts_ewaste": collector.get("accepts_ewaste", False),
    }


def has_drop_off_only_items(items: List[Dict[str, Any]]) -> bool:
    """Check if listing contains materials that require authorized drop-off (battery/CRT)."""
    return any(
        item.get("material") in DROP_OFF_ONLY_MATERIALS
        for item in items
    )


def get_ewaste_drop_points() -> List[Dict[str, Any]]:
    """
    Load e-waste drop-off points. In AWS these are read from DynamoDB (seed.py
    stores them there), because the Lambda package does not include seed/.
    Falls back to the local seed file for local runs and tests.
    """
    if os.environ.get("LISTINGS_TABLE"):  # set in Lambda; unset in local runs/tests
        try:
            try:
                from common.db import get_ewaste_points_from_db
            except ImportError:
                from backend.common.db import get_ewaste_points_from_db
            points = get_ewaste_points_from_db()
            if points:
                return sorted(points, key=lambda p: str(p.get("id", "")))
        except Exception:
            pass  # table unreachable: use the seed file below

    current_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(current_dir, "..", "..", "seed", "ewaste_points.json"),
        os.path.join(current_dir, "..", "seed", "ewaste_points.json"),
        os.path.join(os.getcwd(), "seed", "ewaste_points.json"),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                points = json.load(f)
                return points
    return []


def match_collectors(
    listing_items: List[Dict[str, Any]],
    listing_lat: float,
    listing_lng: float,
    estimated_value_mid: float,
    collectors: List[Dict[str, Any]],
    top_n: int = 3,
) -> Dict[str, Any]:
    """
    Main matching function. Returns:
    {
        "matches": [...top_n scored collectors...],
        "dropOff": [...e-waste drop points if battery/CRT...] or None,
        "batchHint": count of other OPEN listings within 1km (if below min value),
        "matchedCollectorIds": [list of matched collector IDs]
    }
    """
    listing_materials = [item.get("material") for item in listing_items]

    # Battery/CRT items are NEVER matched to a collector — return drop-off only
    needs_drop_off = has_drop_off_only_items(listing_items)
    drop_off_response = None
    if needs_drop_off:
        points = get_ewaste_drop_points()
        drop_off_response = []
        for p in points:
            entry = {
                "id": p.get("id"),
                "name": p.get("name"),
                "address": p.get("address"),
                "phone": p.get("phone"),
                "instructions": p.get("instructions"),
                "verified": p.get("verified", False),
            }
            if not entry["verified"]:
                entry["warning"] = "This location is UNVERIFIED. Please check before visiting."
            drop_off_response.append(entry)

    # Filter out drop-off-only materials for collector matching
    matchable_materials = [m for m in listing_materials if m not in DROP_OFF_ONLY_MATERIALS]

    # If ALL materials are drop-off-only, return no collector matches
    if not matchable_materials:
        return {
            "matches": [],
            "dropOff": drop_off_response,
            "batchHint": None,
            "matchedCollectorIds": [],
        }

    # Find eligible collectors
    eligible = []
    for col in collectors:
        if is_eligible(col, matchable_materials, listing_lat, listing_lng):
            eligible.append(col)

    if not eligible:
        return {
            "matches": [],
            "dropOff": drop_off_response,
            "batchHint": None,
            "matchedCollectorIds": [],
        }

    # Calculate distances for normalization
    distances = []
    for col in eligible:
        col_lat = float(col.get("lat", 0))
        col_lng = float(col.get("lng", 0))
        d = haversine_distance_km((col_lat, col_lng), (listing_lat, listing_lng))
        distances.append(d)
    max_distance = max(distances) if distances else 1.0

    # Score all eligible collectors
    scored = []
    for col in eligible:
        match_info = compute_match_score(
            col, listing_lat, listing_lng, estimated_value_mid, max_distance
        )
        scored.append(match_info)

    # Sort by score descending, take top N
    scored.sort(key=lambda x: x["score"], reverse=True)
    top_matches = scored[:top_n]

    return {
        "matches": top_matches,
        "dropOff": drop_off_response,
        "batchHint": None,  # Set by the handler after querying OPEN listings
        "matchedCollectorIds": [m["collectorId"] for m in top_matches],
    }
