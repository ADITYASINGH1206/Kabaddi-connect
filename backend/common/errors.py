"""
Standardized error and response utilities for KabadiConnect Lambda handlers.
"""

import json
from decimal import Decimal
from typing import Any, Dict, Optional


class DecimalEncoder(json.JSONEncoder):
    """Encodes Decimal objects to float/int for JSON serialization."""
    def default(self, o):
        if isinstance(o, Decimal):
            if o % 1 == 0:
                return int(o)
            return float(o)
        return super().default(o)


def api_response(status_code: int, body: Any, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Formats an API Gateway HTTP response with CORS headers."""
    response_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,x-api-key",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }
    if headers:
        response_headers.update(headers)

    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def error_response(status_code: int, code: str, error_message: str, request_id: str = "") -> Dict[str, Any]:
    """Returns a structured typed error object without leaking stack traces."""
    return api_response(
        status_code=status_code,
        body={
            "error": error_message,
            "code": code,
            "requestId": request_id,
        },
    )
