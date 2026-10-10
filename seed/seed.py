#!/usr/bin/env python3
"""
Seed script for KabadiConnect.
Populates DynamoDB tables (Rates, Collectors, Listings, Pickups) from seed/config files.
Idempotent: safe to run multiple times.
Supports --reset which clears Listings and Pickups then reloads everything.
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path
import boto3
from botocore.exceptions import ClientError

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT_DIR / "config"
SEED_DIR = ROOT_DIR / "seed"

# Ensure backend modules can be imported
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(ROOT_DIR / "backend") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "backend"))

try:
    from backend.common.schema import calculate_price_estimate
    from backend.common.matching import match_collectors
except ImportError:
    try:
        from common.schema import calculate_price_estimate
        from common.matching import match_collectors
    except ImportError:
        calculate_price_estimate = None
        match_collectors = None


def parse_floats_to_decimals(obj):
    """Recursively convert floats to Decimals for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: parse_floats_to_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [parse_floats_to_decimals(x) for x in obj]
    return obj


def clear_table(table, table_name: str, key_attr: str):
    """Delete all items from a DynamoDB table."""
    print(f"  Clearing all items from {table_name}...")
    scan_kwargs = {"ProjectionExpression": key_attr}
    count = 0
    while True:
        response = table.scan(**scan_kwargs)
        items = response.get("Items", [])
        for item in items:
            table.delete_item(Key={key_attr: item[key_attr]})
            count += 1
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
    print(f"  ✓ Deleted {count} items from {table_name}")


def seed_rates(dynamodb, table_name: str):
    """Seed the Rates table from config/rates.seed.json."""
    rates_file = CONFIG_DIR / "rates.seed.json"
    if not rates_file.exists():
        print(f"  Error: {rates_file} does not exist", file=sys.stderr)
        return False

    with open(rates_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    rates = data.get("rates", [])
    table = dynamodb.Table(table_name)

    with table.batch_writer() as batch:
        for rate in rates:
            item = parse_floats_to_decimals(rate)
            batch.put_item(Item=item)

    print(f"  ✓ Seeded {len(rates)} indicative rates into {table_name}")
    return True


def seed_collectors(dynamodb, table_name: str):
    """Seed the Collectors table from seed/collectors.json."""
    collectors_file = SEED_DIR / "collectors.json"
    if not collectors_file.exists():
        print(f"  Error: {collectors_file} does not exist", file=sys.stderr)
        return False

    with open(collectors_file, "r", encoding="utf-8") as f:
        collectors = json.load(f)

    table = dynamodb.Table(table_name)

    with table.batch_writer() as batch:
        for collector in collectors:
            item = dict(collector)
            item["seeded"] = True
            batch.put_item(Item=parse_floats_to_decimals(item))

    print(f"  ✓ Seeded {len(collectors)} collectors into {table_name}")
    return True


def seed_listings(dynamodb, table_name: str):
    """Seed the Listings table from seed/listings.json with relative dates and validated estimates/matches."""
    listings_file = SEED_DIR / "listings.json"
    rates_file = CONFIG_DIR / "rates.seed.json"
    collectors_file = SEED_DIR / "collectors.json"

    if not listings_file.exists():
        print(f"  Error: {listings_file} does not exist", file=sys.stderr)
        return False

    with open(listings_file, "r", encoding="utf-8") as f:
        listings = json.load(f)

    rates_map = {}
    if rates_file.exists():
        with open(rates_file, "r", encoding="utf-8") as f:
            rates_map = {r["material"]: r for r in json.load(f).get("rates", [])}

    collectors = []
    if collectors_file.exists():
        with open(collectors_file, "r", encoding="utf-8") as f:
            collectors = json.load(f)

    table = dynamodb.Table(table_name)
    now = datetime.now(timezone.utc)
    today = now.date()
    tomorrow = today + timedelta(days=1)

    with table.batch_writer() as batch:
        for i, listing in enumerate(listings):
            item = dict(listing)
            items = item.get("items", [])

            # Compute estimate dynamically from rates if helper is available
            if calculate_price_estimate and rates_map:
                p_low, p_high = calculate_price_estimate(items, rates_map)
                item["estimate"] = {"price_low": p_low, "price_high": p_high}
            elif "estimate" not in item:
                item["estimate"] = {"price_low": 0.0, "price_high": 0.0}

            # Match collectors dynamically if helper is available
            if match_collectors and collectors:
                p_low = float(item["estimate"].get("price_low", 0))
                p_high = float(item["estimate"].get("price_high", 0))
                mid = (p_low + p_high) / 2.0
                m_res = match_collectors(items, float(item.get("lat", 0)), float(item.get("lng", 0)), mid, collectors)
                item["matchedCollectorIds"] = m_res.get("matchedCollectorIds", [])

            # Generate relative dates so listings look fresh
            created_dt = now - timedelta(hours=min(12, i * 0.8))
            item["createdAt"] = created_dt.isoformat()

            # Set pickupWindow relative to today/tomorrow
            slot_date = str(today) if i % 2 == 0 else str(tomorrow)
            pw = item.get("pickupWindow", {})
            pw["preferredDate"] = slot_date
            item["pickupWindow"] = pw

            item["seeded"] = True
            batch.put_item(Item=parse_floats_to_decimals(item))

    print(f"  ✓ Seeded {len(listings)} listings into {table_name}")
    return True


def seed_ewaste_points(dynamodb, table_name: str):
    """Store e-waste points as special entries in the Listings table with EWASTE# prefix."""
    ewaste_file = SEED_DIR / "ewaste_points.json"
    if not ewaste_file.exists():
        print(f"  Error: {ewaste_file} does not exist", file=sys.stderr)
        return False

    with open(ewaste_file, "r", encoding="utf-8") as f:
        points = json.load(f)

    table = dynamodb.Table(table_name)

    with table.batch_writer() as batch:
        for point in points:
            item = parse_floats_to_decimals(point)
            item["listingId"] = f"EWASTE#{point['id']}"
            item["status"] = "EWASTE_POINT"
            item["createdAt"] = datetime.now(timezone.utc).isoformat()
            item["seeded"] = True
            batch.put_item(Item=item)

    print(f"  ✓ Seeded {len(points)} e-waste drop-off points into {table_name}")
    return True


def seed_pickups_history(dynamodb, table_name: str):
    """Seed Pickups table with completed history and active accepted pickups."""
    history_file = SEED_DIR / "pickups_history.json"
    rates_file = CONFIG_DIR / "rates.seed.json"

    if not history_file.exists():
        print(f"  Warning: {history_file} does not exist, skipping pickups seeding", file=sys.stderr)
        return False

    with open(history_file, "r", encoding="utf-8") as f:
        pickups = json.load(f)

    rates_map = {}
    if rates_file.exists():
        with open(rates_file, "r", encoding="utf-8") as f:
            rates_map = {r["material"]: r for r in json.load(f).get("rates", [])}

    table = dynamodb.Table(table_name)
    now = datetime.now(timezone.utc)

    with table.batch_writer() as batch:
        for i, pickup in enumerate(pickups):
            item = dict(pickup)
            status = item.get("status", "COMPLETED")

            if status == "COMPLETED":
                # Recalculate relative dates over last 7 days
                days_ago = min(6, (i % 6) + 1)
                comp_dt = now - timedelta(days=days_ago, hours=3)
                acc_dt = comp_dt - timedelta(hours=2)
                item["completedAt"] = comp_dt.isoformat()
                item["acceptedAt"] = acc_dt.isoformat()

                # Recompute payout and estimateErrorPct dynamically
                actual_items = item.get("actualItems", [])
                payout = 0.0
                actual_total_kg = 0.0
                for act in actual_items:
                    mat = act.get("material", "")
                    kg = float(act.get("actual_kg", 0))
                    actual_total_kg += kg
                    rate = rates_map.get(mat, {})
                    mid_rate = (float(rate.get("rate_low", 0)) + float(rate.get("rate_high", 0))) / 2.0
                    payout += kg * mid_rate

                est_items = item.get("items", [])
                est_mid_total = sum((float(it.get("weight_kg_low", 0)) + float(it.get("weight_kg_high", 0))) / 2.0 for it in est_items)
                if actual_total_kg > 0:
                    err_pct = round(abs(actual_total_kg - est_mid_total) / actual_total_kg * 100.0, 1)
                else:
                    err_pct = 0.0

                item["payout"] = round(payout, 2)
                item["estimateErrorPct"] = err_pct

            elif status == "ACCEPTED":
                # Relative acceptedAt within the last 3 hours
                acc_dt = now - timedelta(hours=1, minutes=(i * 20))
                item["acceptedAt"] = acc_dt.isoformat()

            item["seeded"] = True
            batch.put_item(Item=parse_floats_to_decimals(item))

    print(f"  ✓ Seeded {len(pickups)} pickups into {table_name}")
    return True


LOGICAL_TO_ARG = {
    "RatesTable": "rates_table",
    "CollectorsTable": "collectors_table",
    "ListingsTable": "listings_table",
    "PickupsTable": "pickups_table",
}


def resolve_tables_from_stack(region: str, stack_name: str) -> dict:
    """
    SAM generates table names such as "kabadiconnect-RatesTable-1I58...", so the
    old hard-coded defaults never match a real deployment. Look the names up from
    the CloudFormation stack instead. Returns {} if the stack cannot be read.
    """
    try:
        cfn = boto3.client("cloudformation", region_name=region)
        resolved = {}
        paginator = cfn.get_paginator("list_stack_resources")
        for page in paginator.paginate(StackName=stack_name):
            for res in page["StackResourceSummaries"]:
                arg = LOGICAL_TO_ARG.get(res["LogicalResourceId"])
                if arg and res["ResourceType"] == "AWS::DynamoDB::Table":
                    resolved[arg] = res["PhysicalResourceId"]
        return resolved
    except Exception as e:
        print(f"  Warning: could not read stack '{stack_name}' in {region}: {e}", file=sys.stderr)
        return {}


def main():
    parser = argparse.ArgumentParser(description="Seed DynamoDB tables for KabadiConnect")
    parser.add_argument(
        "--rates-table",
        default=os.environ.get("RATES_TABLE"),
        help="Name of the Rates DynamoDB table"
    )
    parser.add_argument(
        "--collectors-table",
        default=os.environ.get("COLLECTORS_TABLE"),
        help="Name of the Collectors DynamoDB table"
    )
    parser.add_argument(
        "--listings-table",
        default=os.environ.get("LISTINGS_TABLE"),
        help="Name of the Listings DynamoDB table"
    )
    parser.add_argument(
        "--pickups-table",
        default=os.environ.get("PICKUPS_TABLE"),
        help="Name of the Pickups DynamoDB table"
    )
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "ap-southeast-2",
        help="AWS Region of the deployed stack (default: $AWS_REGION, else ap-southeast-2)"
    )
    parser.add_argument(
        "--stack-name",
        default=os.environ.get("STACK_NAME", "kabadiconnect"),
        help="CloudFormation stack used to look up table names when they are not given"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Clear Listings and Pickups tables before seeding"
    )
    args = parser.parse_args()

    missing = [a for a in LOGICAL_TO_ARG.values() if getattr(args, a) is None]
    if missing:
        resolved = resolve_tables_from_stack(args.region, args.stack_name)
        for a in missing:
            if a in resolved:
                setattr(args, a, resolved[a])
    still_missing = [a for a in LOGICAL_TO_ARG.values() if getattr(args, a) is None]
    if still_missing:
        print(
            f"Error: could not determine table names for {still_missing} in region {args.region}.\n"
            f"Check --region and --stack-name ({args.stack_name}), or pass --rates-table etc. explicitly.",
            file=sys.stderr,
        )
        sys.exit(1)

    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    print(f"Seeding KabadiConnect tables (region: {args.region}, stack: {args.stack_name})...")
    for a in LOGICAL_TO_ARG.values():
        print(f"  {a}: {getattr(args, a)}")
    print()

    if args.reset:
        print("=== RESET MODE: Clearing tables ===")
        try:
            clear_table(dynamodb.Table(args.listings_table), args.listings_table, "listingId")
        except Exception as e:
            print(f"  Warning: Could not clear listings table: {e}")
        try:
            clear_table(dynamodb.Table(args.pickups_table), args.pickups_table, "pickupId")
        except Exception as e:
            print(f"  Warning: Could not clear pickups table: {e}")
        print()

    print("[1/5] Seeding Rates...")
    seed_rates(dynamodb, args.rates_table)

    print("[2/5] Seeding Collectors...")
    seed_collectors(dynamodb, args.collectors_table)

    print("[3/5] Seeding Listings...")
    seed_listings(dynamodb, args.listings_table)

    print("[4/5] Seeding E-Waste Drop-off Points...")
    seed_ewaste_points(dynamodb, args.listings_table)

    print("[5/5] Seeding Pickups History & Active Pickups...")
    seed_pickups_history(dynamodb, args.pickups_table)

    print("\n✅ All tables seeded successfully!")
    print("Note: Seeded rates are INDICATIVE. Verify with local scrap vendors before production/demo use.")
    print("Note: E-waste drop-off points are UNVERIFIED (verified: false). Check before demo.")


if __name__ == "__main__":
    main()
