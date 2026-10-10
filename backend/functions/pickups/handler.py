"""
Handler for /pickups endpoints.
- POST /pickups/{id}/complete: Completes pickup with actual weights, calculates payout and estimate error
- GET /pickups/{id}:           Returns pickup details
- GET /pickups:                Returns pickups for a given collector
"""

import json
import logging
import os
from typing import Any, Dict, List

try:
    from common.db import (
        get_pickup_by_id, get_pickups_by_collector, complete_pickup,
        update_listing_status, get_rates_map,
    )
    from common.errors import api_response, error_response
    from common.schema import VALID_MATERIALS
except ImportError:
    from backend.common.db import (
        get_pickup_by_id, get_pickups_by_collector, complete_pickup,
        update_listing_status, get_rates_map,
    )
    from backend.common.errors import api_response, error_response
    from backend.common.schema import VALID_MATERIALS

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handle_complete_pickup(event, context, pickup_id: str):
    """
    POST /pickups/{id}/complete
    Body: {"actualItems": [{"material": "newspaper_paper", "actual_kg": 6.5}]}
    Calculates payout, estimate error %, updates status to COMPLETED.
    """
    request_id = getattr(context, "aws_request_id", "local-request")

    try:
        body_raw = event.get("body", "{}")
        body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
        actual_items = body.get("actualItems", [])

        if not actual_items or not isinstance(actual_items, list):
            return error_response(400, "INVALID_INPUT", "actualItems is required and must be a non-empty array", request_id)

        # Validate materials and weights
        for idx, item in enumerate(actual_items):
            if not isinstance(item, dict):
                return error_response(400, "INVALID_INPUT", f"actualItems[{idx}] must be an object", request_id)
            mat = item.get("material")
            if not mat or mat not in VALID_MATERIALS:
                return error_response(400, "INVALID_MATERIAL", f"actualItems[{idx}].material '{mat}' is invalid", request_id)
            try:
                kg = float(item.get("actual_kg", -1))
                if kg <= 0 or kg > 500:
                    return error_response(400, "INVALID_WEIGHT", f"actualItems[{idx}].actual_kg must be between 0.1 and 500", request_id)
            except (ValueError, TypeError):
                return error_response(400, "INVALID_WEIGHT", f"actualItems[{idx}].actual_kg must be a number", request_id)

        # Fetch pickup
        pickup = get_pickup_by_id(pickup_id)
        if not pickup:
            return error_response(404, "NOT_FOUND", f"Pickup {pickup_id} not found", request_id)

        if pickup.get("status") != "ACCEPTED":
            return error_response(400, "INVALID_STATUS", f"Pickup is in {pickup.get('status')} state, must be ACCEPTED", request_id)

        # Rates map for payout calculation
        rates_map = get_rates_map()

        # Complete pickup in DynamoDB
        result = complete_pickup(
            pickup_id=pickup_id,
            actual_items=actual_items,
            rates_map=rates_map,
        )

        # Update corresponding listing status to COMPLETED
        listing_id = pickup.get("listingId")
        if listing_id:
            try:
                update_listing_status(
                    listing_id=listing_id,
                    new_status="COMPLETED",
                    extra_attrs={"completedPickupId": pickup_id},
                )
            except Exception as e:
                logger.warning(f"Could not update listing {listing_id} to COMPLETED: {e}")

        logger.info(f"Pickup {pickup_id} completed: Payout ₹{result['payout']}, error {result['estimateErrorPct']}%")
        return api_response(200, result)

    except ValueError as ve:
        return error_response(400, "VALIDATION_ERROR", str(ve), request_id)
    except json.JSONDecodeError:
        return error_response(400, "INVALID_JSON", "Request body must be valid JSON", request_id)
    except Exception as e:
        logger.exception(f"Failed to complete pickup {pickup_id}: {e}")
        return error_response(500, "PICKUP_COMPLETE_ERROR", "Failed to complete pickup", request_id)


def handle_get_pickup(event, context, pickup_id: str):
    """GET /pickups/{id} — Returns details for a single pickup."""
    request_id = getattr(context, "aws_request_id", "local-request")
    try:
        pickup = get_pickup_by_id(pickup_id)
        if not pickup:
            return error_response(404, "NOT_FOUND", f"Pickup {pickup_id} not found", request_id)
        return api_response(200, pickup)
    except Exception as e:
        logger.exception(f"Failed to get pickup {pickup_id}: {e}")
        return error_response(500, "PICKUP_FETCH_ERROR", "Failed to retrieve pickup", request_id)


def handle_get_pickups_list(event, context):
    """GET /pickups?collectorId=... — Returns all pickups for a collector."""
    request_id = getattr(context, "aws_request_id", "local-request")
    query_params = event.get("queryStringParameters") or {}
    collector_id = query_params.get("collectorId")

    if not collector_id:
        return error_response(400, "MISSING_PARAM", "collectorId query parameter is required", request_id)

    try:
        pickups = get_pickups_by_collector(collector_id)
        return api_response(200, pickups)
    except Exception as e:
        logger.exception(f"Failed to get pickups for {collector_id}: {e}")
        return error_response(500, "PICKUPS_FETCH_ERROR", "Failed to list pickups", request_id)


def lambda_handler(event, context):
    request_id = getattr(context, "aws_request_id", "local-request")
    http_method = event.get("requestContext", {}).get("http", {}).get("method", event.get("httpMethod", "GET"))
    path = event.get("rawPath", event.get("path", ""))

    logger.info(f"Pickups handler: {http_method} {path}")

    # POST /pickups/{id}/complete
    if http_method == "POST" and "/pickups/" in path and path.endswith("/complete"):
        parts = path.split("/pickups/")[-1].split("/")
        pickup_id = parts[0]
        if pickup_id:
            return handle_complete_pickup(event, context, pickup_id)

    # GET /pickups/{id}
    if http_method == "GET" and "/pickups/" in path and not path.endswith("/pickups"):
        parts = path.split("/pickups/")[-1].split("/")
        pickup_id = parts[0]
        if pickup_id:
            return handle_get_pickup(event, context, pickup_id)

    # GET /pickups
    if http_method == "GET" and (path.endswith("/pickups") or path == "/pickups"):
        return handle_get_pickups_list(event, context)

    return error_response(404, "NOT_FOUND", f"Route not found: {http_method} {path}", request_id)
