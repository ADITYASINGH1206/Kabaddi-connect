"""
DynamoDB access functions for Rates, Listings, Collectors, Pickups, and Analysis Cache.
"""

import os
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
try:
    import boto3
    from boto3.dynamodb.conditions import Key, Attr
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    Key = None
    Attr = None
    class ClientError(Exception):
        pass


def get_dynamodb_resource(region_name: Optional[str] = None):
    return boto3.resource("dynamodb", region_name=region_name or os.environ.get("AWS_REGION", "ap-south-1"))


# ─── Rates ───────────────────────────────────────────────────────────────────

def get_all_rates(table_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetches all material rates from the Rates table."""
    table_name = table_name or os.environ.get("RATES_TABLE", "KabadiConnect-Rates-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)
    response = table.scan()
    items = response.get("Items", [])
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


def get_rates_map(table_name: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
    """Returns rates indexed by material name for O(1) lookup."""
    rates = get_all_rates(table_name)
    return {r["material"]: r for r in rates}


# ─── Analysis Cache ──────────────────────────────────────────────────────────

def get_cached_analysis(image_hash: str, table_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Checks DynamoDB for previously analyzed image result by hash."""
    table_name = table_name or os.environ.get("LISTINGS_TABLE", "KabadiConnect-Listings-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)
    cache_key = f"CACHE#{image_hash}"
    try:
        response = table.get_item(Key={"listingId": cache_key})
        item = response.get("Item")
        if item and "analysis" in item:
            return item["analysis"]
    except Exception:
        pass
    return None


def save_cached_analysis(image_hash: str, analysis: Dict[str, Any], table_name: Optional[str] = None):
    """Saves analyzed image result into DynamoDB for fast repeated demos."""
    table_name = table_name or os.environ.get("LISTINGS_TABLE", "KabadiConnect-Listings-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)
    cache_key = f"CACHE#{image_hash}"
    try:
        table.put_item(
            Item={
                "listingId": cache_key,
                "analysis": analysis,
                "createdAt": int(time.time()),
            }
        )
    except Exception:
        # Cache write failures should never block the user flow
        pass


# ─── Collectors ──────────────────────────────────────────────────────────────

def get_all_collectors(table_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetches all collectors from the Collectors table."""
    table_name = table_name or os.environ.get("COLLECTORS_TABLE", "KabadiConnect-Collectors-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)
    response = table.scan()
    items = response.get("Items", [])
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


def get_collector_by_id(collector_id: str, table_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetches a single collector by ID."""
    table_name = table_name or os.environ.get("COLLECTORS_TABLE", "KabadiConnect-Collectors-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)
    try:
        response = table.get_item(Key={"collectorId": collector_id})
        return response.get("Item")
    except Exception:
        return None


# ─── Listings ────────────────────────────────────────────────────────────────

def _to_decimal(obj):
    """Recursively convert floats to Decimals for DynamoDB."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_decimal(x) for x in obj]
    return obj


def create_listing(listing_data: Dict[str, Any], table_name: Optional[str] = None) -> Dict[str, Any]:
    """Creates a new listing in DynamoDB. Returns the created item."""
    table_name = table_name or os.environ.get("LISTINGS_TABLE", "KabadiConnect-Listings-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)

    listing_id = f"listing-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    item = _to_decimal(listing_data)
    item["listingId"] = listing_id
    item["status"] = "OPEN"
    item["createdAt"] = now

    table.put_item(Item=item)
    return item


def get_listing_by_id(listing_id: str, table_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetches a single listing by ID."""
    table_name = table_name or os.environ.get("LISTINGS_TABLE", "KabadiConnect-Listings-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)
    try:
        response = table.get_item(Key={"listingId": listing_id})
        return response.get("Item")
    except Exception:
        return None


def get_open_listings(table_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetches all OPEN listings using the status-createdAt GSI."""
    table_name = table_name or os.environ.get("LISTINGS_TABLE", "KabadiConnect-Listings-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)
    try:
        response = table.query(
            IndexName="status-createdAt-index",
            KeyConditionExpression=Key("status").eq("OPEN"),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = table.query(
                IndexName="status-createdAt-index",
                KeyConditionExpression=Key("status").eq("OPEN"),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return items
    except Exception:
        return []


def update_listing_status(
    listing_id: str,
    new_status: str,
    extra_attrs: Optional[Dict[str, Any]] = None,
    expected_status: Optional[str] = None,
    table_name: Optional[str] = None,
) -> bool:
    """
    Atomically updates a listing's status.
    If expected_status is set, uses a conditional write (for race-safe accept).
    Returns True on success, False on condition failure.
    """
    table_name = table_name or os.environ.get("LISTINGS_TABLE", "KabadiConnect-Listings-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)

    update_expr = "SET #s = :new_status"
    expr_names = {"#s": "status"}
    expr_values = {":new_status": new_status}

    if extra_attrs:
        for i, (key, value) in enumerate(extra_attrs.items()):
            alias = f"#a{i}"
            val_alias = f":v{i}"
            update_expr += f", {alias} = {val_alias}"
            expr_names[alias] = key
            expr_values[val_alias] = _to_decimal(value)

    kwargs = {
        "Key": {"listingId": listing_id},
        "UpdateExpression": update_expr,
        "ExpressionAttributeNames": expr_names,
        "ExpressionAttributeValues": expr_values,
    }

    if expected_status:
        kwargs["ConditionExpression"] = Attr("status").eq(expected_status)

    try:
        table.update_item(**kwargs)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


# ─── Pickups ─────────────────────────────────────────────────────────────────

def create_pickup(
    listing_id: str,
    collector_id: str,
    listing_data: Dict[str, Any],
    table_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Creates a Pickup record when a collector accepts a listing."""
    table_name = table_name or os.environ.get("PICKUPS_TABLE", "KabadiConnect-Pickups-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)

    pickup_id = f"pickup-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    item = _to_decimal({
        "pickupId": pickup_id,
        "listingId": listing_id,
        "collectorId": collector_id,
        "status": "ACCEPTED",
        "acceptedAt": now,
        "sellerName": listing_data.get("sellerName", ""),
        "sellerPhone": listing_data.get("sellerPhone", ""),
        "address": listing_data.get("address", ""),
        "lat": listing_data.get("lat", 0),
        "lng": listing_data.get("lng", 0),
        "items": listing_data.get("items", []),
        "estimate": listing_data.get("estimate", {}),
    })

    table.put_item(Item=item)
    return item


def get_pickup_by_id(pickup_id: str, table_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetches a single pickup by ID."""
    table_name = table_name or os.environ.get("PICKUPS_TABLE", "KabadiConnect-Pickups-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)
    try:
        response = table.get_item(Key={"pickupId": pickup_id})
        return response.get("Item")
    except Exception:
        return None


def get_pickups_by_collector(collector_id: str, table_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetches all pickups for a collector using the collectorId-date GSI."""
    table_name = table_name or os.environ.get("PICKUPS_TABLE", "KabadiConnect-Pickups-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)
    try:
        response = table.query(
            IndexName="collectorId-date-index",
            KeyConditionExpression=Key("collectorId").eq(collector_id),
        )
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = table.query(
                IndexName="collectorId-date-index",
                KeyConditionExpression=Key("collectorId").eq(collector_id),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))
        return items
    except Exception:
        return []


def complete_pickup(
    pickup_id: str,
    actual_items: List[Dict[str, Any]],
    rates_map: Dict[str, Dict[str, Any]],
    table_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Completes a pickup with actual weights.
    Calculates payout and estimate error percentage.
    Returns the updated pickup data.
    """
    table_name = table_name or os.environ.get("PICKUPS_TABLE", "KabadiConnect-Pickups-dev")
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(table_name)

    pickup = get_pickup_by_id(pickup_id, table_name)
    if not pickup:
        raise ValueError(f"Pickup {pickup_id} not found")
    if pickup.get("status") != "ACCEPTED":
        raise ValueError(f"Pickup {pickup_id} is not in ACCEPTED status (current: {pickup.get('status')})")

    # Calculate payout: sum(actual_kg * midpoint(rate_low, rate_high))
    payout = Decimal("0")
    actual_total_kg = Decimal("0")
    for actual in actual_items:
        mat = actual.get("material", "")
        actual_kg = Decimal(str(actual.get("actual_kg", 0)))
        actual_total_kg += actual_kg

        rate = rates_map.get(mat, {})
        r_low = Decimal(str(rate.get("rate_low", 0)))
        r_high = Decimal(str(rate.get("rate_high", 0)))
        midpoint = (r_low + r_high) / 2
        payout += actual_kg * midpoint

    # Estimate error %: |actual_total - estimated_mid_total| / actual_total * 100
    estimated_items = pickup.get("items", [])
    estimated_mid_total = Decimal("0")
    for item in estimated_items:
        w_low = Decimal(str(item.get("weight_kg_low", 0)))
        w_high = Decimal(str(item.get("weight_kg_high", 0)))
        estimated_mid_total += (w_low + w_high) / 2

    if actual_total_kg > 0:
        estimate_error_pct = abs(actual_total_kg - estimated_mid_total) / actual_total_kg * 100
    else:
        estimate_error_pct = Decimal("0")

    now = datetime.now(timezone.utc).isoformat()

    table.update_item(
        Key={"pickupId": pickup_id},
        UpdateExpression="SET #s = :status, actualItems = :actual, payout = :payout, "
                         "estimateErrorPct = :error, completedAt = :completed",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":status": "COMPLETED",
            ":actual": _to_decimal(actual_items),
            ":payout": payout,
            ":error": estimate_error_pct,
            ":completed": now,
        },
        ConditionExpression=Attr("status").eq("ACCEPTED"),
    )

    return {
        "pickupId": pickup_id,
        "status": "COMPLETED",
        "payout": float(payout),
        "estimateErrorPct": float(estimate_error_pct),
        "actualItems": actual_items,
        "completedAt": now,
    }
