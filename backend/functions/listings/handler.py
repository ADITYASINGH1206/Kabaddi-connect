"""
Handler for /listings and /rates endpoints.
- GET /rates:          Returns material rate card
- POST /listings:      Creates listing with validation, estimation, and collector matching
- GET /listings/{id}:  Returns listing details with matched collector info
"""

import json
import logging
import os
from typing import Any, Dict, List

try:
    from common.db import (
        get_all_rates, get_rates_map, get_all_collectors,
        create_listing, get_listing_by_id, get_open_listings,
        get_collector_by_id, update_listing_status, create_pickup,
    )
    from common.errors import api_response, error_response
    from common.schema import VALID_MATERIALS, calculate_price_estimate
    from common.matching import match_collectors, BATCH_HINT_RADIUS_KM, MIN_WORTHWHILE_VALUE_INR
    from common.geo import haversine_distance_km
except ImportError:
    from backend.common.db import (
        get_all_rates, get_rates_map, get_all_collectors,
        create_listing, get_listing_by_id, get_open_listings,
        get_collector_by_id, update_listing_status, create_pickup,
    )
    from backend.common.errors import api_response, error_response
    from backend.common.schema import VALID_MATERIALS, calculate_price_estimate
    from backend.common.matching import match_collectors, BATCH_HINT_RADIUS_KM, MIN_WORTHWHILE_VALUE_INR
    from backend.common.geo import haversine_distance_km

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Weight bounds for validation
MIN_WEIGHT_KG = 0.1
MAX_WEIGHT_KG = 200.0


CANONICAL_MATERIAL_ORDER = [
    "newspaper_paper",
    "cardboard",
    "books_notebooks",
    "pet_bottles",
    "hdpe_plastic",
    "mixed_plastic",
    "iron_steel",
    "aluminium",
    "copper",
    "brass",
    "glass_bottles",
    "ewaste_laptop",
    "ewaste_phone",
    "ewaste_small_appliance",
    "ewaste_large_appliance",
    "ewaste_battery_or_crt",
    "vehicle_scrap",
    "tyres_rubber",
]


def sort_rates_canonically(rates_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    order_map = {mat: i for i, mat in enumerate(CANONICAL_MATERIAL_ORDER)}
    return sorted(rates_list, key=lambda r: order_map.get(r.get("material", ""), 999))


def handle_get_rates(event, context):
    """GET /rates — Returns the current material rate card, canonically sorted."""
    request_id = getattr(context, "aws_request_id", "local-request")
    try:
        rates = get_all_rates()
        if rates:
            return api_response(200, sort_rates_canonically(rates))
    except Exception as e:
        logger.warning(f"Could not read from DynamoDB Rates table ({e}); falling back to seed config.")


    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(current_dir, "..", "..", "..", "config", "rates.seed.json"),
            os.path.join(current_dir, "..", "..", "config", "rates.seed.json"),
            os.path.join(os.getcwd(), "config", "rates.seed.json"),
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


def validate_listing_input(body: Dict[str, Any]) -> List[str]:
    """Validates POST /listings input. Returns list of error messages (empty if valid)."""
    errors = []

    # Items validation
    items = body.get("items", [])
    if not items or not isinstance(items, list):
        errors.append("items is required and must be a non-empty array")
        return errors

    for i, item in enumerate(items):
        if not isinstance(item, dict):
            errors.append(f"items[{i}] must be an object")
            continue

        material = item.get("material", "")
        if material not in VALID_MATERIALS:
            errors.append(f"items[{i}].material '{material}' is not a recognized material")

        for field in ["weight_kg_low", "weight_kg_high", "weight_kg_user"]:
            val = item.get(field)
            if val is not None:
                try:
                    val = float(val)
                    if val < MIN_WEIGHT_KG:
                        errors.append(f"items[{i}].{field} must be >= {MIN_WEIGHT_KG}")
                    if val > MAX_WEIGHT_KG:
                        errors.append(f"items[{i}].{field} must be <= {MAX_WEIGHT_KG}")
                except (ValueError, TypeError):
                    errors.append(f"items[{i}].{field} must be a number")

    # Location validation
    lat = body.get("lat")
    lng = body.get("lng")
    if lat is None or lng is None:
        errors.append("lat and lng are required")
    else:
        try:
            lat = float(lat)
            lng = float(lng)
            if not (6.0 <= lat <= 36.0 and 68.0 <= lng <= 98.0):
                errors.append("lat/lng must be within India's approximate bounds")
        except (ValueError, TypeError):
            errors.append("lat and lng must be numbers")

    # Seller info
    if not body.get("sellerName", "").strip():
        errors.append("sellerName is required")
    if not body.get("sellerPhone", "").strip():
        errors.append("sellerPhone is required")

    return errors


def handle_post_listing(event, context):
    """POST /listings — Creates a listing with matching."""
    request_id = getattr(context, "aws_request_id", "local-request")

    try:
        body = json.loads(event.get("body", "{}"))
    except (json.JSONDecodeError, TypeError):
        return error_response(400, "INVALID_JSON", "Request body must be valid JSON", request_id)

    # Validate input
    validation_errors = validate_listing_input(body)
    if validation_errors:
        return error_response(400, "VALIDATION_ERROR", "; ".join(validation_errors), request_id)

    try:
        # Get rates for price estimation
        rates_map = get_rates_map()

        # Calculate price estimate
        items = body["items"]
        price_low, price_high = calculate_price_estimate(items, rates_map)
        estimate = {"price_low": price_low, "price_high": price_high}
        estimated_value_mid = (price_low + price_high) / 2

        # Get all collectors for matching
        collectors = get_all_collectors()
        listing_lat = float(body["lat"])
        listing_lng = float(body["lng"])

        # Run matching algorithm
        match_result = match_collectors(
            listing_items=items,
            listing_lat=listing_lat,
            listing_lng=listing_lng,
            estimated_value_mid=estimated_value_mid,
            collectors=collectors,
        )

        # Calculate batchHint if below minimum value
        batch_hint = None
        if estimated_value_mid < MIN_WORTHWHILE_VALUE_INR:
            try:
                open_listings = get_open_listings()
                nearby_count = 0
                for ol in open_listings:
                    ol_lat = float(ol.get("lat", 0))
                    ol_lng = float(ol.get("lng", 0))
                    if haversine_distance_km((listing_lat, listing_lng), (ol_lat, ol_lng)) <= BATCH_HINT_RADIUS_KM:
                        nearby_count += 1
                batch_hint = nearby_count
            except Exception as e:
                logger.warning(f"Could not compute batchHint: {e}")

        # Build listing data
        listing_data = {
            "sellerName": body["sellerName"].strip(),
            "sellerPhone": body["sellerPhone"].strip(),
            "address": body.get("address", "").strip(),
            "lat": listing_lat,
            "lng": listing_lng,
            "pickupWindow": body.get("pickupWindow", {}),
            "imageKey": body.get("imageKey", ""),
            "items": items,
            "estimate": estimate,
            "visionUsed": body.get("visionUsed", False),
            "matchedCollectorIds": match_result["matchedCollectorIds"],
        }

        # Persist listing
        created = create_listing(listing_data)

        # Build response
        response = {
            "listingId": created["listingId"],
            "status": "OPEN",
            "estimate": estimate,
            "matches": match_result["matches"],
            "matchedCollectorIds": match_result["matchedCollectorIds"],
        }

        if match_result["dropOff"]:
            response["dropOff"] = match_result["dropOff"]
        if batch_hint is not None:
            response["batchHint"] = batch_hint

        logger.info(f"Created listing {created['listingId']} with {len(match_result['matches'])} matches")
        return api_response(201, response)

    except Exception as e:
        logger.exception(f"Failed to create listing: {e}")
        return error_response(500, "LISTING_CREATE_ERROR", "Failed to create listing", request_id)


def handle_get_listing(event, context, listing_id: str):
    """GET /listings/{id} — Returns listing details with matched collectors."""
    request_id = getattr(context, "aws_request_id", "local-request")

    try:
        listing = get_listing_by_id(listing_id)
        if not listing:
            return error_response(404, "NOT_FOUND", f"Listing {listing_id} not found", request_id)

        # Build response
        response = {
            "listingId": listing["listingId"],
            "status": listing.get("status", "OPEN"),
            "estimate": listing.get("estimate", {}),
            "items": listing.get("items", []),
            "address": listing.get("address", ""),
            "pickupWindow": listing.get("pickupWindow", {}),
            "matchedCollectorIds": listing.get("matchedCollectorIds", []),
            "createdAt": listing.get("createdAt", ""),
        }

        # If ACCEPTED or COMPLETED, include accepted collector details
        if listing.get("status") in ("ACCEPTED", "COMPLETED"):
            accepted_id = listing.get("acceptedCollectorId")
            if accepted_id:
                collector = get_collector_by_id(accepted_id)
                if collector:
                    response["acceptedCollector"] = {
                        "collectorId": collector["collectorId"],
                        "name": collector.get("name", ""),
                        "phone": collector.get("phone", ""),
                        "areaName": collector.get("areaName", ""),
                    }
                    # Calculate ETA
                    col_lat = float(collector.get("lat", 0))
                    col_lng = float(collector.get("lng", 0))
                    listing_lat = float(listing.get("lat", 0))
                    listing_lng = float(listing.get("lng", 0))
                    distance = haversine_distance_km((col_lat, col_lng), (listing_lat, listing_lng))
                    response["acceptedCollector"]["distanceKm"] = round(distance, 2)
                    response["acceptedCollector"]["etaMin"] = round((distance / 20) * 60, 1)

        return api_response(200, response)

    except Exception as e:
        logger.exception(f"Failed to get listing {listing_id}: {e}")
        return error_response(500, "LISTING_FETCH_ERROR", "Failed to retrieve listing", request_id)


def handle_accept_listing(event, context, listing_id: str):
    """
    POST /listings/{id}/accept
    Body: {"collectorId": "..."}
    Conditional update: only OPEN -> ACCEPTED.
    Second attempt returns 409 ALREADY_ACCEPTED.
    Creates the Pickup record.
    """
    request_id = getattr(context, "aws_request_id", "local-request")
    try:
        body_raw = event.get("body", "{}")
        body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
        collector_id = body.get("collectorId")
        if not collector_id:
            return error_response(400, "MISSING_FIELD", "collectorId is required", request_id)

        # Check collector exists and active
        collector = get_collector_by_id(collector_id)
        if not collector:
            return error_response(404, "COLLECTOR_NOT_FOUND", f"Collector {collector_id} not found", request_id)
        if not collector.get("active", False):
            return error_response(400, "INACTIVE", "Collector is not active", request_id)

        # Fetch listing
        listing = get_listing_by_id(listing_id)
        if not listing:
            return error_response(404, "NOT_FOUND", f"Listing {listing_id} not found", request_id)

        current_status = listing.get("status")
        if current_status != "OPEN":
            return error_response(409, "ALREADY_ACCEPTED", f"Listing is already {current_status}", request_id)

        # Attempt atomic conditional update OPEN -> ACCEPTED
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        updated = update_listing_status(
            listing_id=listing_id,
            new_status="ACCEPTED",
            extra_attrs={
                "acceptedCollectorId": collector_id,
                "acceptedAt": now,
            },
            expected_status="OPEN",
        )

        if not updated:
            # Race condition lost
            return error_response(409, "ALREADY_ACCEPTED", "Listing was just accepted by another collector", request_id)

        # Create corresponding Pickup record
        pickup = create_pickup(listing_id, collector_id, listing)

        return api_response(200, {
            "listingId": listing_id,
            "status": "ACCEPTED",
            "acceptedCollectorId": collector_id,
            "pickupId": pickup.get("pickupId"),
            "acceptedAt": now,
        })
    except json.JSONDecodeError:
        return error_response(400, "INVALID_JSON", "Request body must be valid JSON", request_id)
    except Exception as e:
        logger.exception(f"Failed to accept listing {listing_id}: {e}")
        return error_response(500, "ACCEPT_ERROR", "Failed to accept listing", request_id)


def lambda_handler(event, context):
    request_id = getattr(context, "aws_request_id", "local-request")
    http_method = event.get("requestContext", {}).get("http", {}).get("method", event.get("httpMethod", "GET"))
    path = event.get("rawPath", event.get("path", ""))

    logger.info(f"Listings handler: {http_method} {path}")

    # GET /rates
    if path.endswith("/rates") or path == "/rates":
        return handle_get_rates(event, context)

    # POST /listings
    if http_method == "POST" and (path.endswith("/listings") or path == "/listings"):
        return handle_post_listing(event, context)

    # POST /listings/{id}/accept
    if http_method == "POST" and "/listings/" in path and path.endswith("/accept"):
        parts = path.split("/listings/")[-1].split("/")
        listing_id = parts[0]
        if listing_id:
            return handle_accept_listing(event, context, listing_id)

    # GET /listings/{id}
    if http_method == "GET" and "/listings/" in path:
        listing_id = path.split("/listings/")[-1].strip("/")
        if listing_id:
            return handle_get_listing(event, context, listing_id)

    return error_response(404, "NOT_FOUND", f"Route not found: {http_method} {path}", request_id)
