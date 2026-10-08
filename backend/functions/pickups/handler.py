"""
Handler for /pickups endpoints (M3).
"""

try:
    from common.errors import api_response
except ImportError:
    from backend.common.errors import api_response


def lambda_handler(event, context):
    return api_response(200, {
        "message": "Pickups endpoint stub (M3)"
    })
