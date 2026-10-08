"""
DynamoDB access functions for Rates, Listings, and Analysis Cache.
"""

import os
import time
from decimal import Decimal
from typing import Any, Dict, List, Optional
import boto3
from boto3.dynamodb.conditions import Key


def get_dynamodb_resource(region_name: Optional[str] = None):
    return boto3.resource("dynamodb", region_name=region_name or os.environ.get("AWS_REGION", "ap-south-1"))


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
