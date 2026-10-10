#!/usr/bin/env python3
"""
scripts/smoke_test.py
End-to-end smoke test against the deployed KabadiConnect API Gateway.
Per spec §5.2:
Verifies full flow:
  1. GET /health
  2. GET /rates
  3. GET /collectors
  4. POST /listings (create listing with Bedrock-detected materials)
  5. GET /listings/{id}
  6. GET /collectors/{id}/requests
  7. POST /listings/{id}/accept
  8. POST /collectors/{id}/route
  9. POST /pickups/{id}/complete
 10. GET /impact
Exits non-zero on any failure.
"""

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


def http_request(url: str, method: str = "GET", data: dict = None) -> dict:
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    body_bytes = None
    if data is not None:
        body_bytes = json.dumps(data).encode("utf-8")

    try:
        with urllib.request.urlopen(req, data=body_bytes, timeout=15) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            return {"status": status, "data": json.loads(content) if content else {}}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            err_data = json.loads(content)
        except Exception:
            err_data = {"error": content}
        return {"status": e.code, "data": err_data}


def run_smoke_test(api_url: str):
    base_url = api_url.rstrip("/")
    print(f"=== Starting KabadiConnect Smoke Test on {base_url} ===\n")

    # 1. Health check
    print("[1/10] Testing GET /health...")
    res = http_request(f"{base_url}/health")
    if res["status"] != 200:
        print(f"[FAIL] /health returned {res['status']}: {res['data']}")
        sys.exit(1)
    print(f" [PASS] Health check OK: {res['data']}")

    # 2. Rates
    print("\n[2/10] Testing GET /rates...")
    res = http_request(f"{base_url}/rates")
    if res["status"] != 200 or not res["data"]:
        print(f"[FAIL] /rates returned {res['status']}")
        sys.exit(1)
    rates_count = len(res["data"])
    print(f" [PASS] Retrieved {rates_count} material rates")

    # 3. Active Collectors
    print("\n[3/10] Testing GET /collectors...")
    res = http_request(f"{base_url}/collectors")
    if res["status"] != 200 or not res["data"]:
        print(f"[FAIL] /collectors returned {res['status']}")
        sys.exit(1)
    collectors = res["data"]
    collector_id = collectors[0]["collectorId"]
    print(f" [PASS] Found {len(collectors)} active collectors. Selected demo collector: {collector_id}")

    # 4. Create Listing (POST /listings)
    print("\n[4/10] Testing POST /listings...")
    listing_payload = {
        "sellerName": "Smoke Test User",
        "sellerPhone": "+919876500000",
        "address": "Rohini Sector 3, New Delhi",
        "lat": 28.7160,
        "lng": 77.1215,
        "pickupWindow": {"preferredDate": "2026-10-10", "slot": "morning"},
        "items": [
            {"material": "newspaper_paper", "weight_kg_low": 5.0, "weight_kg_high": 8.0, "weight_kg_user": 6.5},
            {"material": "cardboard", "weight_kg_low": 2.0, "weight_kg_high": 4.0, "weight_kg_user": 3.0},
        ],
    }
    res = http_request(f"{base_url}/listings", method="POST", data=listing_payload)
    if res["status"] not in (200, 201):
        print(f"[FAIL] POST /listings returned {res['status']}: {res['data']}")
        sys.exit(1)
    listing_id = res["data"].get("listingId")
    matches = res["data"].get("matches", [])
    print(f" [PASS] Created listing: {listing_id} with {len(matches)} matched collectors")

    # 5. Fetch Listing (GET /listings/{id})
    print(f"\n[5/10] Testing GET /listings/{listing_id}...")
    res = http_request(f"{base_url}/listings/{listing_id}")
    if res["status"] != 200:
        print(f"[FAIL] GET /listings/{listing_id} returned {res['status']}")
        sys.exit(1)
    print(f" [PASS] Listing status: {res['data'].get('status')}")

    # 6. Collector Requests (GET /collectors/{id}/requests)
    print(f"\n[6/10] Testing GET /collectors/{collector_id}/requests...")
    res = http_request(f"{base_url}/collectors/{collector_id}/requests")
    if res["status"] != 200:
        print(f"[FAIL] GET /collectors/{collector_id}/requests returned {res['status']}")
        sys.exit(1)
    print(f" [PASS] Found {len(res['data'])} eligible open requests for {collector_id}")

    # 7. Accept Listing (POST /listings/{id}/accept)
    print(f"\n[7/10] Testing POST /listings/{listing_id}/accept...")
    accept_payload = {"collectorId": collector_id}
    res = http_request(f"{base_url}/listings/{listing_id}/accept", method="POST", data=accept_payload)
    if res["status"] != 200:
        print(f"[FAIL] Accept listing returned {res['status']}: {res['data']}")
        sys.exit(1)
    pickup_id = res["data"].get("pickupId")
    print(f" [PASS] Listing accepted! Pickup created: {pickup_id}")

    # 8. Route Optimization (POST /collectors/{id}/route)
    print(f"\n[8/10] Testing POST /collectors/{collector_id}/route...")
    route_payload = {"start": {"lat": 28.7501, "lng": 77.1177}}
    res = http_request(f"{base_url}/collectors/{collector_id}/route", method="POST", data=route_payload)
    if res["status"] != 200:
        print(f"[FAIL] Route optimization returned {res['status']}")
        sys.exit(1)
    route = res["data"]
    print(f" [PASS] Optimized route generated: {route.get('stopsCount', len(route.get('stops', [])))} stops, {route.get('totalKm')} km")

    # 9. Complete Pickup (POST /pickups/{id}/complete)
    print(f"\n[9/10] Testing POST /pickups/{pickup_id}/complete...")
    complete_payload = {
        "actualItems": [
            {"material": "newspaper_paper", "actual_kg": 6.8},
            {"material": "cardboard", "actual_kg": 3.2},
        ]
    }
    res = http_request(f"{base_url}/pickups/{pickup_id}/complete", method="POST", data=complete_payload)
    if res["status"] != 200:
        print(f"[FAIL] Complete pickup returned {res['status']}: {res['data']}")
        sys.exit(1)
    payout = res["data"].get("payout")
    err_pct = res["data"].get("estimateErrorPct")
    print(f" [PASS] Pickup completed! Seller Payout: ₹{payout}, Estimation Error: {err_pct}%")

    # 10. Impact Dashboard (GET /impact)
    print("\n[10/10] Testing GET /impact...")
    res = http_request(f"{base_url}/impact")
    if res["status"] != 200:
        print(f"[FAIL] GET /impact returned {res['status']}")
        sys.exit(1)
    impact = res["data"]
    print(f" [PASS] Impact metrics: {impact.get('total_kg_diverted')} kg diverted, ₹{impact.get('collector_income_facilitated_inr')} income, {impact.get('co2e_avoided_kg')} kg CO2e avoided")

    print("\n=======================================================")
    print("[ALL 10 SMOKE TESTS PASSED CLEANLY] End-to-end pipeline verified!")
    print("=======================================================")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="KabadiConnect End-to-End API Smoke Test")
    parser.add_argument("--api-url", default="http://localhost:3000", help="HTTP API Gateway base URL")
    args = parser.parse_args()
    run_smoke_test(args.api_url)
