"""
Handler for /collectors endpoints.
- GET /collectors:                Active collectors for the demo picker
- GET /collectors/{id}/requests:  OPEN listings this collector is eligible for, ranked by score
- POST /collectors/{id}/route:    Route optimization (Haversine nearest-neighbour)
"""

import json
import logging
import os
from typing import Any, Dict, List

try:
    from common.db import (
        get_all_collectors, get_collector_by_id, get_all_rates,
        get_rates_map, get_open_listings, get_pickups_by_collector,
    )
    from common.errors import api_response, error_response
    from common.matching import is_eligible, compute_match_score, MIN_WORTHWHILE_VALUE_INR
    from common.geo import haversine_distance_km
    from common.schema import calculate_price_estimate
except ImportError:
    from backend.common.db import (
        get_all_collectors, get_collector_by_id, get_all_rates,
        get_rates_map, get_open_listings, get_pickups_by_collector,
    )
    from backend.common.errors import api_response, error_response
    from backend.common.matching import is_eligible, compute_match_score, MIN_WORTHWHILE_VALUE_INR
    from backend.common.geo import haversine_distance_km
    from backend.common.schema import calculate_price_estimate

logger = logging.getLogger()
logger.setLevel(logging.INFO)

MAX_ROUTE_STOPS = 10


def handle_get_collectors(event, context):
    """GET /collectors — Returns all active collectors for the demo picker."""
    request_id = getattr(context, "aws_request_id", "local-request")
    try:
        collectors = get_all_collectors()
        active = [
            {
                "collectorId": c["collectorId"],
                "name": c.get("name", ""),
                "areaName": c.get("areaName", ""),
                "lat": float(c.get("lat", 0)),
                "lng": float(c.get("lng", 0)),
                "accepts_ewaste": c.get("accepts_ewaste", False),
            }
            for c in collectors
            if c.get("active", False)
        ]
        return api_response(200, active)
    except Exception as e:
        logger.exception(f"Failed to fetch collectors: {e}")
        return error_response(500, "COLLECTORS_FETCH_ERROR", "Failed to retrieve collectors", request_id)


def handle_get_collector_requests(event, context, collector_id: str):
    """GET /collectors/{id}/requests — OPEN listings this collector can pick up, ranked."""
    request_id = getattr(context, "aws_request_id", "local-request")

    try:
        collector = get_collector_by_id(collector_id)
        if not collector:
            return error_response(404, "NOT_FOUND", f"Collector {collector_id} not found", request_id)

        if not collector.get("active", False):
            return error_response(400, "INACTIVE", "Collector is not active", request_id)

        # Get all OPEN listings
        open_listings = get_open_listings()
        rates_map = get_rates_map()

        col_lat = float(collector.get("lat", 0))
        col_lng = float(collector.get("lng", 0))

        # Filter eligible listings and score them
        eligible_listings = []
        for listing in open_listings:
            listing_materials = [item.get("material") for item in listing.get("items", [])]
            listing_lat = float(listing.get("lat", 0))
            listing_lng = float(listing.get("lng", 0))

            if not is_eligible(collector, listing_materials, listing_lat, listing_lng):
                continue

            # Calculate distance and value
            distance_km = haversine_distance_km((col_lat, col_lng), (listing_lat, listing_lng))
            estimate = listing.get("estimate", {})
            price_low = float(estimate.get("price_low", 0))
            price_high = float(estimate.get("price_high", 0))
            estimated_value_mid = (price_low + price_high) / 2

            # Weight range
            items = listing.get("items", [])
            total_kg_low = sum(float(i.get("weight_kg_low", 0)) for i in items)
            total_kg_high = sum(float(i.get("weight_kg_high", 0)) for i in items)

            # Build request card data
            request_info = {
                "listingId": listing["listingId"],
                "materials": listing_materials,
                "kgRange": {"low": round(total_kg_low, 1), "high": round(total_kg_high, 1)},
                "estimatedValue": {"low": price_low, "high": price_high},
                "distanceKm": round(distance_km, 2),
                "etaMin": round((distance_km / 20) * 60, 1),
                "worthIt": estimated_value_mid >= MIN_WORTHWHILE_VALUE_INR,
                "address": listing.get("address", ""),
                "pickupWindow": listing.get("pickupWindow", {}),
                "sellerName": listing.get("sellerName", ""),
                "score": round(
                    0.5 * max(0, 1 - distance_km / float(collector.get("max_radius_km", 5)))
                    + 0.3 * min(estimated_value_mid / 500.0, 1.0)
                    + 0.2 * min(float(collector.get("daily_capacity_kg", 200)) / 500.0, 1.0),
                    4
                ),
            }
            eligible_listings.append(request_info)

        # Sort by score descending
        eligible_listings.sort(key=lambda x: x["score"], reverse=True)

        return api_response(200, {
            "collectorId": collector_id,
            "requests": eligible_listings,
            "count": len(eligible_listings),
        })

    except Exception as e:
        logger.exception(f"Failed to fetch requests for collector {collector_id}: {e}")
        return error_response(500, "REQUESTS_FETCH_ERROR", "Failed to retrieve pickup requests", request_id)


def solve_route_haversine(start: tuple, accepted_pickups: List[Dict[str, Any]], collector_id: str) -> Dict[str, Any]:
    """
    Greedy nearest-neighbour solver with Haversine metrics.
    Enforces MAX_ROUTE_STOPS, calculates naive round-trip km and GeoJSON polyline.
    """
    start_lat, start_lng = start

    if not accepted_pickups:
        return {
            "collectorId": collector_id,
            "stopsCount": 0,
            "stops": [],
            "totalKm": 0,
            "totalMin": 0,
            "naiveKm": 0,
            "kmSaved": 0,
            "polyline": {"type": "LineString", "coordinates": [[start_lng, start_lat]]},
            "usedFallback": False,
        }

    # Enforce max stops
    pickups_to_route = list(accepted_pickups[:MAX_ROUTE_STOPS])

    # Greedy nearest-neighbour ordering
    remaining = list(pickups_to_route)
    ordered = []
    current_lat, current_lng = start_lat, start_lng

    while remaining:
        best_idx = 0
        best_dist = float("inf")
        for i, p in enumerate(remaining):
            p_lat = float(p.get("lat", 0))
            p_lng = float(p.get("lng", 0))
            d = haversine_distance_km((current_lat, current_lng), (p_lat, p_lng))
            if d < best_dist:
                best_dist = d
                best_idx = i

        chosen = remaining.pop(best_idx)
        chosen_lat = float(chosen.get("lat", 0))
        chosen_lng = float(chosen.get("lng", 0))
        ordered.append({
            "pickup": chosen,
            "distFromPrev": round(best_dist, 2),
        })
        current_lat, current_lng = chosen_lat, chosen_lng

    # Route metrics
    total_km = sum(s["distFromPrev"] for s in ordered)
    speed_kmh = 20
    total_min = round((total_km / speed_kmh) * 60, 1) if speed_kmh > 0 else 0

    # Naive km: sum of separate round trips from start to each stop
    naive_km = 0
    for s in ordered:
        p = s["pickup"]
        p_lat = float(p.get("lat", 0))
        p_lng = float(p.get("lng", 0))
        d = haversine_distance_km((start_lat, start_lng), (p_lat, p_lng))
        naive_km += 2 * d

    # GeoJSON LineString coordinates
    coordinates = [[start_lng, start_lat]]
    cumulative_km = 0
    stops = []
    for i, s in enumerate(ordered):
        p = s["pickup"]
        p_lat = float(p.get("lat", 0))
        p_lng = float(p.get("lng", 0))
        cumulative_km += s["distFromPrev"]

        coordinates.append([p_lng, p_lat])
        stops.append({
            "stopIndex": i + 1,
            "order": i + 1,
            "pickupId": p.get("pickupId"),
            "listingId": p.get("listingId"),
            "address": p.get("address", ""),
            "sellerName": p.get("sellerName", ""),
            "sellerPhone": p.get("sellerPhone", ""),
            "lat": p_lat,
            "lng": p_lng,
            "distanceFromPrevKm": s["distFromPrev"],
            "cumulativeKm": round(cumulative_km, 2),
            "etaMin": round((cumulative_km / speed_kmh) * 60, 1),
            "items": p.get("items", []),
            "navigateUrl": f"https://www.google.com/maps/dir/?api=1&destination={p_lat},{p_lng}",
        })

    km_saved = round(max(0.0, naive_km - total_km), 2)

    return {
        "collectorId": collector_id,
        "stopsCount": len(stops),
        "stops": stops,
        "totalKm": round(total_km, 2),
        "totalMin": total_min,
        "naiveKm": round(naive_km, 2),
        "kmSaved": km_saved,
        "polyline": {"type": "LineString", "coordinates": coordinates},
        "usedFallback": False,
    }


def handle_post_route(event, context, collector_id: str):
    """
    POST /collectors/{id}/route — Route optimization.
    Body: { "start": { "lat": ..., "lng": ... } }
    """
    request_id = getattr(context, "aws_request_id", "local-request")

    try:
        body = json.loads(event.get("body", "{}"))
    except (json.JSONDecodeError, TypeError):
        return error_response(400, "INVALID_JSON", "Request body must be valid JSON", request_id)

    start = body.get("start", {})
    start_lat = start.get("lat")
    start_lng = start.get("lng")
    if start_lat is None or start_lng is None:
        return error_response(400, "MISSING_START", "start.lat and start.lng are required", request_id)

    try:
        start_lat = float(start_lat)
        start_lng = float(start_lng)

        # Get this collector's ACCEPTED pickups
        pickups = get_pickups_by_collector(collector_id)
        accepted = [p for p in pickups if p.get("status") == "ACCEPTED"]

        route_result = solve_route_haversine((start_lat, start_lng), accepted, collector_id)
        return api_response(200, route_result)

    except Exception as e:
        logger.exception(f"Failed to compute route for collector {collector_id}: {e}")
        return error_response(500, "ROUTE_ERROR", "Failed to compute route", request_id)


def lambda_handler(event, context):
    request_id = getattr(context, "aws_request_id", "local-request")
    http_method = event.get("requestContext", {}).get("http", {}).get("method", event.get("httpMethod", "GET"))
    path = event.get("rawPath", event.get("path", ""))

    logger.info(f"Collectors handler: {http_method} {path}")

    # GET /collectors (list all active)
    if http_method == "GET" and (path == "/collectors" or path.endswith("/collectors")):
        return handle_get_collectors(event, context)

    # GET /collectors/{id}/requests
    if http_method == "GET" and "/collectors/" in path and path.endswith("/requests"):
        parts = path.split("/collectors/")[1].split("/requests")[0]
        collector_id = parts.strip("/")
        if collector_id:
            return handle_get_collector_requests(event, context, collector_id)

    # POST /collectors/{id}/route
    if http_method == "POST" and "/collectors/" in path and path.endswith("/route"):
        parts = path.split("/collectors/")[1].split("/route")[0]
        collector_id = parts.strip("/")
        if collector_id:
            return handle_post_route(event, context, collector_id)

    return error_response(404, "NOT_FOUND", f"Route not found: {http_method} {path}", request_id)
