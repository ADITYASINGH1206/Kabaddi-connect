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
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import boto3
from botocore.exceptions import ClientError

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT_DIR / "config"
SEED_DIR = ROOT_DIR / "seed"


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
            item = parse_floats_to_decimals(collector)
            batch.put_item(Item=item)

    print(f"  ✓ Seeded {len(collectors)} collectors into {table_name}")
    return True


def seed_listings(dynamodb, table_name: str):
    """Seed the Listings table from seed/listings.json."""
    listings_file = SEED_DIR / "listings.json"
    if not listings_file.exists():
        print(f"  Error: {listings_file} does not exist", file=sys.stderr)
        return False

    with open(listings_file, "r", encoding="utf-8") as f:
        listings = json.load(f)

    table = dynamodb.Table(table_name)

    with table.batch_writer() as batch:
        for listing in listings:
            item = parse_floats_to_decimals(listing)
            # Ensure createdAt is set for GSI
            if "createdAt" not in item:
                item["createdAt"] = datetime.now(timezone.utc).isoformat()
            item["seeded"] = True
            batch.put_item(Item=item)

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
            # Store with a special key so we can query them
            item["listingId"] = f"EWASTE#{point['id']}"
            item["status"] = "EWASTE_POINT"
            item["createdAt"] = datetime.now(timezone.utc).isoformat()
            batch.put_item(Item=item)

    print(f"  ✓ Seeded {len(points)} e-waste drop-off points into {table_name}")
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
        default=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "ap-south-1",
        help="AWS Region of the deployed stack (default: $AWS_REGION, else ap-south-1)"
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

    print("[1/4] Seeding Rates...")
    seed_rates(dynamodb, args.rates_table)

    print("[2/4] Seeding Collectors...")
    seed_collectors(dynamodb, args.collectors_table)

    print("[3/4] Seeding Listings...")
    seed_listings(dynamodb, args.listings_table)

    print("[4/4] Seeding E-Waste Drop-off Points...")
    seed_ewaste_points(dynamodb, args.listings_table)

    print("\n✅ All tables seeded successfully!")
    print("Note: Seeded rates are INDICATIVE. Verify with local scrap vendors before production/demo use.")
    print("Note: E-waste drop-off points are UNVERIFIED (verified: false). Check before demo.")


if __name__ == "__main__":
    main()
