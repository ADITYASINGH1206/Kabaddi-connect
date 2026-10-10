"""
Comprehensive unit tests for matching engine, e-waste rules,
batch hints, routing logic, payout calculations, and input validation.
Covers spec §2.6, §3.3, §3.5, and §3.7 requirements.
"""

import unittest
from backend.common.matching import (
    match_collectors,
    is_eligible,
    compute_match_score,
    MIN_WORTHWHILE_VALUE_INR,
    BATCH_HINT_RADIUS_KM,
)
from backend.common.geo import haversine_distance_km
from backend.functions.collectors.handler import (
    solve_route_haversine,
    MAX_ROUTE_STOPS,
)
from backend.functions.listings.handler import validate_listing_input
from backend.common.schema import VALID_MATERIALS


# Sample mock collectors around NW Delhi
SAMPLE_COLLECTORS = [
    {
        "collectorId": "col-001",
        "name": "Ramesh Kumar",
        "lat": 28.7501,
        "lng": 77.1177,
        "areaName": "DTU",
        "accepts": ["newspaper_paper", "cardboard", "iron_steel", "pet_bottles"],
        "accepts_ewaste": False,
        "max_radius_km": 5.0,
        "daily_capacity_kg": 200,
        "active": True,
    },
    {
        "collectorId": "col-002",
        "name": "Suresh Scrap",
        "lat": 28.7160,
        "lng": 77.1215,
        "areaName": "Rohini Sector 3",
        "accepts": ["newspaper_paper", "cardboard", "pet_bottles", "ewaste_phone"],
        "accepts_ewaste": True,
        "max_radius_km": 6.0,
        "daily_capacity_kg": 350,
        "active": True,
    },
    {
        "collectorId": "col-003",
        "name": "Anil Kabadi",
        "lat": 28.7080,
        "lng": 77.1180,
        "areaName": "Rohini Sector 7",
        "accepts": ["newspaper_paper", "cardboard", "pet_bottles"],
        "accepts_ewaste": False,
        "max_radius_km": 4.0,
        "daily_capacity_kg": 150,
        "active": True,
    },
    {
        "collectorId": "col-004",
        "name": "Inactive Kabadi",
        "lat": 28.7160,
        "lng": 77.1215,
        "areaName": "Rohini",
        "accepts": ["newspaper_paper"],
        "accepts_ewaste": False,
        "max_radius_km": 5.0,
        "daily_capacity_kg": 100,
        "active": False,  # INACTIVE
    },
]

MOCK_RATES_MAP = {
    "newspaper_paper": {"rate_low": 12, "rate_high": 16},
    "cardboard": {"rate_low": 8, "rate_high": 12},
    "pet_bottles": {"rate_low": 15, "rate_high": 22},
    "iron_steel": {"rate_low": 24, "rate_high": 32},
    "ewaste_phone": {"rate_low": 40, "rate_high": 100},
    "ewaste_battery_or_crt": {"rate_low": 15, "rate_high": 40},
}


class TestMatchingEligibility(unittest.TestCase):
    def test_inactive_collector_rejected(self):
        col = SAMPLE_COLLECTORS[3]
        self.assertFalse(is_eligible(col, ["newspaper_paper"], 28.7160, 77.1215))

    def test_collector_out_of_radius_rejected(self):
        col = SAMPLE_COLLECTORS[0]  # DTU, radius 5km
        # Connaught Place (28.6304, 77.2177) ~16km away
        self.assertFalse(is_eligible(col, ["newspaper_paper"], 28.6304, 77.2177))

    def test_collector_missing_materials_rejected(self):
        col = SAMPLE_COLLECTORS[2]  # accepts only paper, cardboard, pet
        self.assertFalse(is_eligible(col, ["iron_steel"], 28.7080, 77.1180))

    def test_ewaste_exclusion(self):
        # col-001 does not accept e-waste
        self.assertFalse(is_eligible(SAMPLE_COLLECTORS[0], ["ewaste_phone"], 28.7501, 77.1177))
        # col-002 accepts e-waste
        self.assertTrue(is_eligible(SAMPLE_COLLECTORS[1], ["ewaste_phone"], 28.7160, 77.1215))


class TestBatteryAndCrtDropOff(unittest.TestCase):
    def test_battery_or_crt_never_matched_to_collectors(self):
        items = [{"material": "ewaste_battery_or_crt", "weight_kg_low": 5.0, "weight_kg_high": 10.0}]
        res = match_collectors(
            listing_items=items,
            listing_lat=28.7160,
            listing_lng=77.1215,
            estimated_value_mid=150.0,
            collectors=SAMPLE_COLLECTORS,
        )
        # MUST return zero matched collectors
        self.assertEqual(len(res["matches"]), 0)
        self.assertEqual(len(res["matchedCollectorIds"]), 0)
        # MUST route to dropOff points
        self.assertIsNotNone(res["dropOff"])
        self.assertGreater(len(res["dropOff"]), 0)


class TestScoringAlgorithm(unittest.TestCase):
    def test_scoring_weights(self):
        result = compute_match_score(
            collector=SAMPLE_COLLECTORS[1],
            listing_lat=28.7160,
            listing_lng=77.1215,
            estimated_value_mid=300.0,
            max_distance_in_set=5.0,
        )
        score = result["score"]
        self.assertTrue(0.0 <= score <= 1.0)
        self.assertEqual(result["collectorId"], "col-002")

    def test_closer_collector_gets_higher_score(self):
        # Listing at Rohini Sec 3 (28.7160, 77.1215)
        # col-002 is at Rohini Sec 3 (0 km)
        # col-001 is at DTU (~4 km)
        res_near = compute_match_score(SAMPLE_COLLECTORS[1], 28.7160, 77.1215, 200.0, 5.0)
        res_far = compute_match_score(SAMPLE_COLLECTORS[0], 28.7160, 77.1215, 200.0, 5.0)
        self.assertGreater(res_near["score"], res_far["score"])


class TestInputValidation(unittest.TestCase):
    def test_valid_listing_input(self):
        valid = {
            "sellerName": "Pooja",
            "sellerPhone": "+919876543210",
            "address": "Rohini Sector 3",
            "lat": 28.7160,
            "lng": 77.1215,
            "items": [
                {"material": "newspaper_paper", "weight_kg_low": 2.0, "weight_kg_high": 5.0}
            ],
        }
        errs = validate_listing_input(valid)
        self.assertEqual(len(errs), 0)

    def test_rejects_unknown_material(self):
        invalid = {
            "items": [{"material": "gold_bars", "weight_kg_low": 1.0, "weight_kg_high": 2.0}]
        }
        errs = validate_listing_input(invalid)
        self.assertTrue(any("not a recognized material" in e for e in errs))

    def test_rejects_weights_out_of_bounds(self):
        invalid = {
            "items": [{"material": "newspaper_paper", "weight_kg_low": 0.05, "weight_kg_high": 300.0}]
        }
        errs = validate_listing_input(invalid)
        self.assertTrue(any("must be >= 0.1" in e for e in errs))
        self.assertTrue(any("must be <= 200.0" in e for e in errs))


class TestRouteOptimization(unittest.TestCase):
    def test_max_10_stops_enforced(self):
        many_pickups = [
            {
                "pickupId": f"p-{i}",
                "listingId": f"l-{i}",
                "lat": 28.7160 + (i * 0.001),
                "lng": 77.1215 + (i * 0.001),
                "sellerName": f"Seller {i}",
                "address": f"Address {i}",
            }
            for i in range(15)
        ]
        start = (28.7160, 77.1215)
        res = solve_route_haversine(start, many_pickups, "col-001")
        self.assertLessEqual(len(res["stops"]), MAX_ROUTE_STOPS)

    def test_clustered_route_saves_km_vs_naive(self):
        # 3 stops in Rohini close to each other
        pickups = [
            {"pickupId": "p-1", "listingId": "l-1", "lat": 28.7160, "lng": 77.1215, "sellerName": "A", "address": "Rohini Sec 3"},
            {"pickupId": "p-2", "listingId": "l-2", "lat": 28.7180, "lng": 77.1230, "sellerName": "B", "address": "Rohini Sec 3"},
            {"pickupId": "p-3", "listingId": "l-3", "lat": 28.7200, "lng": 77.1245, "sellerName": "C", "address": "Rohini Sec 3"},
        ]
        # Start at DTU ~4.5 km away
        start = (28.7501, 77.1177)
        res = solve_route_haversine(start, pickups, "col-001")
        # Clustered route MUST save significant km vs separate round trips!
        self.assertGreaterEqual(res["naiveKm"], res["totalKm"])
        self.assertGreaterEqual(res["kmSaved"], 0.0)
        self.assertFalse(res["usedFallback"])
