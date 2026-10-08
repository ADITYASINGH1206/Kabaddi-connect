#!/usr/bin/env python3
"""
Seed script for KabadiConnect.
Populates the DynamoDB Rates table from config/rates.seed.json.
Can also optionally seed collectors, listings, and ewaste points when available.
"""

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
import boto3

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT_DIR / "config"
SEED_DIR = ROOT_DIR / "seed"


def parse_floats_to_decimals(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: parse_floats_to_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [parse_floats_to_decimals(x) for x in obj]
    return obj


def seed_rates(table_name: str, region_name: str = "ap-south-1"):
    rates_file = CONFIG_DIR / "rates.seed.json"
    if not rates_file.exists():
        print(f"Error: {rates_file} does not exist", file=sys.stderr)
        return False

    with open(rates_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    rates = data.get("rates", [])
    print(f"Loading {len(rates)} indicative rates into DynamoDB table: {table_name} (region: {region_name})...")

    dynamodb = boto3.resource("dynamodb", region_name=region_name)
    table = dynamodb.Table(table_name)

    with table.batch_writer() as batch:
        for rate in rates:
            item = parse_floats_to_decimals(rate)
            batch.put_item(Item=item)
            print(f"  ✓ Seeded {item['material']} (₹{item['rate_low']} - ₹{item['rate_high']}/{item.get('unit', 'kg')})")

    print("\nNote: Seeded rates are INDICATIVE. Verify with local scrap vendors before production/demo use.")
    print("Rates seeded successfully!")
    return True


def main():
    parser = argparse.ArgumentParser(description="Seed DynamoDB tables for KabadiConnect")
    parser.add_argument(
        "--rates-table",
        default=os.environ.get("RATES_TABLE", "KabadiConnect-Rates-dev"),
        help="Name of the Rates DynamoDB table"
    )
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION", "ap-south-1"),
        help="AWS Region (default: ap-south-1)"
    )
    args = parser.parse_args()

    success = seed_rates(args.rates_table, args.region)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
