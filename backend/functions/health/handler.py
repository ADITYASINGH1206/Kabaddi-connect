"""
Health check handler for KabadiConnect.
"""

try:
    from common.errors import api_response
except ImportError:
    from backend.common.errors import api_response


def lambda_handler(event, context):
    return api_response(200, {
        "status": "healthy",
        "service": "kabadiconnect-api",
        "version": "1.0.0",
        "env": "production"
    })
