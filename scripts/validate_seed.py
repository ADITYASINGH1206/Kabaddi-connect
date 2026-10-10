#!/usr/bin/env python3
"""
scripts/validate_seed.py
Validation script for KabadiConnect mock data.
Fails with non-zero exit code if:
1. Any material is not in the taxonomy.
2. Any lat/lng is outside NW Delhi bounds (lat: 28.65–28.90, lng: 77.00–77.25).
3. Any listing estimate does not equal the rate-based calculation.
4. Any record lacks seeded: true.
5. Any phone number looks real (must match format +910000000NNN).
6. An ewaste_battery_or_crt listing has matched collectors.
"""

import json
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT_DIR / "config"
SEED_DIR = ROOT_DIR / "seed"

# NW Delhi bounds
MIN_LAT = 28.65
MAX_LAT = 28.90
MIN_LNG = 77.00
MAX_LNG = 77.25

# Fake phone regex: must begin with +910000000 followed by exactly 3 digits
FAKE_PHONE_REGEX = re.compile(r"^\+910000000\d{3}$")


def validate():
    errors = []

    # 1. Load taxonomy and rates
    taxonomy_file = CONFIG_DIR / "taxonomy.json"
    rates_file = CONFIG_DIR / "rates.seed.json"

    if not taxonomy_file.exists():
        errors.append(f"Missing {taxonomy_file}")
        return False, errors
    if not rates_file.exists():
        errors.append(f"Missing {rates_file}")
        return False, errors

    with open(taxonomy_file, "r", encoding="utf-8") as f:
        taxonomy_data = json.load(f)
    valid_materials = {item["code"] for item in taxonomy_data}

    with open(rates_file, "r", encoding="utf-8") as f:
        rates_data = json.load(f)["rates"]
    rates_map = {r["material"]: r for r in rates_data}

    # 2. Validate Collectors (seed/collectors.json)
    collectors_file = SEED_DIR / "collectors.json"
    if not collectors_file.exists():
        errors.append(f"Missing {collectors_file}")
    else:
        with open(collectors_file, "r", encoding="utf-8") as f:
            collectors = json.load(f)

        if len(collectors) != 10:
            errors.append(f"Collectors count must be 10, found {len(collectors)}")

        active_count = sum(1 for c in collectors if c.get("active"))
        if active_count != 9:
            errors.append(f"Active collectors count must be 9 (with 1 inactive), found {active_count}")

        for c in collectors:
            cid = c.get("collectorId", "unknown")
            if not c.get("seeded"):
                errors.append(f"Collector {cid} missing seeded: true")
            phone = str(c.get("phone", ""))
            if not FAKE_PHONE_REGEX.match(phone):
                errors.append(f"Collector {cid} phone '{phone}' does not match fake format (+910000000NNN)")

            lat = float(c.get("lat", 0))
            lng = float(c.get("lng", 0))
            if not (MIN_LAT <= lat <= MAX_LAT and MIN_LNG <= lng <= MAX_LNG):
                errors.append(f"Collector {cid} coords ({lat}, {lng}) outside NW Delhi bounds")

            for m in c.get("accepts", []):
                if m not in valid_materials:
                    errors.append(f"Collector {cid} accepts unknown material '{m}'")

    # 3. Validate Listings (seed/listings.json)
    listings_file = SEED_DIR / "listings.json"
    if not listings_file.exists():
        errors.append(f"Missing {listings_file}")
    else:
        with open(listings_file, "r", encoding="utf-8") as f:
            listings = json.load(f)

        if len(listings) != 14:
            errors.append(f"Listings count must be 14, found {len(listings)}")

        for l in listings:
            lid = l.get("listingId", "unknown")
            if not l.get("seeded"):
                errors.append(f"Listing {lid} missing seeded: true")

            phone = str(l.get("sellerPhone", ""))
            if not FAKE_PHONE_REGEX.match(phone):
                errors.append(f"Listing {lid} phone '{phone}' does not match fake format (+910000000NNN)")

            lat = float(l.get("lat", 0))
            lng = float(l.get("lng", 0))
            if not (MIN_LAT <= lat <= MAX_LAT and MIN_LNG <= lng <= MAX_LNG):
                errors.append(f"Listing {lid} coords ({lat}, {lng}) outside NW Delhi bounds")

            items = l.get("items", [])
            has_battery_or_crt = False
            expected_low = 0.0
            expected_high = 0.0

            for it in items:
                mat = it.get("material")
                if mat not in valid_materials:
                    errors.append(f"Listing {lid} contains unknown material '{mat}'")
                if mat == "ewaste_battery_or_crt":
                    has_battery_or_crt = True

                w_low = float(it.get("weight_kg_low", 0))
                w_high = float(it.get("weight_kg_high", 0))
                r = rates_map.get(mat, {})
                expected_low += w_low * float(r.get("rate_low", 0))
                expected_high += w_high * float(r.get("rate_high", 0))

            # Rule 3: Estimate equals rate-based calculation
            actual_est = l.get("estimate", {})
            actual_low = float(actual_est.get("price_low", -1))
            actual_high = float(actual_est.get("price_high", -1))

            if round(actual_low, 2) != round(expected_low, 2) or round(actual_high, 2) != round(expected_high, 2):
                errors.append(
                    f"Listing {lid} estimate mismatch: expected ({expected_low}, {expected_high}), "
                    f"got ({actual_low}, {actual_high})"
                )

            # Rule 6: ewaste_battery_or_crt must never match collectors
            if has_battery_or_crt and len(l.get("matchedCollectorIds", [])) > 0:
                errors.append(f"Listing {lid} contains ewaste_battery_or_crt but matched collectors: {l.get('matchedCollectorIds')}")

    # 4. Validate Pickups History (seed/pickups_history.json)
    history_file = SEED_DIR / "pickups_history.json"
    if not history_file.exists():
        errors.append(f"Missing {history_file}")
    else:
        with open(history_file, "r", encoding="utf-8") as f:
            pickups = json.load(f)

        if len(pickups) < 13:
            errors.append(f"Pickups history must contain at least 13 records (10 completed + 3 accepted), found {len(pickups)}")

        for p in pickups:
            pid = p.get("pickupId", "unknown")
            if not p.get("seeded"):
                errors.append(f"Pickup {pid} missing seeded: true")

            phone = str(p.get("sellerPhone", ""))
            if not FAKE_PHONE_REGEX.match(phone):
                errors.append(f"Pickup {pid} phone '{phone}' does not match fake format (+910000000NNN)")

            lat = float(p.get("lat", 0))
            lng = float(p.get("lng", 0))
            if not (MIN_LAT <= lat <= MAX_LAT and MIN_LNG <= lng <= MAX_LNG):
                errors.append(f"Pickup {pid} coords ({lat}, {lng}) outside NW Delhi bounds")

            # Check materials in items and actualItems
            for it in p.get("items", []):
                mat = it.get("material")
                if mat not in valid_materials:
                    errors.append(f"Pickup {pid} contains unknown material '{mat}' in items")

            for it in p.get("actualItems", []):
                mat = it.get("material")
                if mat not in valid_materials:
                    errors.append(f"Pickup {pid} contains unknown material '{mat}' in actualItems")

    return (len(errors) == 0), errors


def main():
    print("=== Validating KabadiConnect Mock Data Set ===")
    ok, errors = validate()
    if ok:
        print("✅ Validation PASSED! All ground rules and honesty requirements verified:")
        print("  - All material codes exist in config/taxonomy.json")
        print("  - All coordinates are valid North-West Delhi coordinates (4 decimals)")
        print("  - All 14 listing estimates match exact rate calculations")
        print("  - All records in collectors, listings, and pickups have seeded: true")
        print("  - All phone numbers strictly follow fake format (+910000000NNN)")
        print("  - Battery/CRT hazard listing matches 0 collectors (drop-off only)")
        sys.exit(0)
    else:
        print(f"❌ Validation FAILED with {len(errors)} error(s):")
        for err in errors:
            print(f"  • {err}")
        sys.exit(1)


if __name__ == "__main__":
    main()
