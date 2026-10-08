"""
Handler for GET /impact:
Aggregates recycling impact metrics. Stub for M0/M1; will calculate live aggregates in M4.
"""

try:
    from common.errors import api_response
except ImportError:
    from backend.common.errors import api_response


def lambda_handler(event, context):
    return api_response(200, {
        "total_kg_diverted": 1240.5,
        "diverted_by_material": {
            "newspaper_paper": 580.0,
            "cardboard": 320.0,
            "pet_bottles": 140.5,
            "iron_steel": 120.0,
            "ewaste_phone": 80.0
        },
        "collector_income_facilitated_inr": 18450.0,
        "trips_saved": 42,
        "km_saved": 118.4,
        "ewaste_items_redirected": 14,
        "weight_estimation_mape_pct": 14.8,
        "co2e_avoided_kg": 2180.2,
        "is_stub": True
    })
