"""
Handler for /listings and /rates endpoints.
Handles GET /rates for M1, with stubs for POST /listings and GET /listings/{id} (M2).
"""

import json
import logging
import os
try:
    from common.db import get_all_rates
    from common.errors import api_response, error_response
except ImportError:
    from backend.common.db import get_all_rates
    from backend.common.errors import api_response, error_response

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handle_get_rates(event, context):
    request_id = getattr(context, "aws_request_id", "local-request")
    try:
        rates = get_all_rates()
        if rates:
            return api_response(200, rates)
    except Exception as e:
        logger.warning(f"Could not read from DynamoDB Rates table ({e}); falling back to seed config.")

    try:
        # Fallback to local taxonomy/seed
        current_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(current_dir, "..", "..", "..", "config", "rates.seed.json"),
            os.path.join(current_dir, "..", "..", "config", "rates.seed.json"),
            os.path.join(os.getcwd(), "config", "rates.seed.json")
        ]
        for config_path in candidates:
            if os.path.exists(config_path):
                with open(config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return api_response(200, data.get("rates", []))

        return error_response(500, "RATES_NOT_FOUND", "No rate card available", request_id)
    except Exception as e:
        logger.exception(f"Failed to load rates fallback: {e}")
        return error_response(500, "RATES_FETCH_ERROR", "Failed to retrieve rate card", request_id)


def lambda_handler(event, context):
    request_id = getattr(context, "aws_request_id", "local-request")
    http_method = event.get("requestContext", {}).get("http", {}).get("method", event.get("httpMethod", "GET"))
    path = event.get("rawPath", event.get("path", ""))

    logger.info(f"Listings handler: {http_method} {path}")

    if path.endswith("/rates") or path == "/rates":
        return handle_get_rates(event, context)

    if http_method == "POST" and (path.endswith("/listings") or path == "/listings"):
        # Stub for M2
        return api_response(200, {
            "listingId": "stub-listing-id",
            "status": "OPEN",
            "message": "Listing created (M2 stub)",
            "estimate": {"price_low": 100, "price_high": 200},
            "matches": []
        })

    if http_method == "GET" and "/listings/" in path:
        listing_id = path.split("/listings/")[-1]
        return api_response(200, {
            "listingId": listing_id,
            "status": "OPEN",
            "message": "Listing details (M2 stub)"
        })

    return error_response(404, "NOT_FOUND", f"Route not found: {http_method} {path}", request_id)
