"""
Handler for POST /uploads: Generates a presigned S3 PUT URL for uploading scrap photos.
Enforces JPEG format and 5MB limit.
"""

import json
import logging
import os
try:
    from common.errors import api_response, error_response
    from common.s3 import generate_presigned_upload_url
except ImportError:
    from backend.common.errors import api_response, error_response
    from backend.common.s3 import generate_presigned_upload_url

logger = logging.getLogger()
logger.setLevel(logging.INFO)

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def lambda_handler(event, context):
    request_id = getattr(context, "aws_request_id", "local-request")
    logger.info(f"Processing upload request: {request_id}")

    photos_bucket = os.environ.get("PHOTOS_BUCKET")
    if not photos_bucket:
        logger.error("PHOTOS_BUCKET environment variable is not configured")
        return error_response(500, "CONFIG_ERROR", "Server photo storage not configured", request_id)

    # Parse request body if present
    content_type = "image/jpeg"
    body = event.get("body")
    if body:
        try:
            if isinstance(body, str):
                body = json.loads(body)
            content_type = body.get("contentType", "image/jpeg")
        except Exception:
            return error_response(400, "BAD_REQUEST", "Invalid JSON request body", request_id)

    if content_type != "image/jpeg":
        return error_response(
            400,
            "INVALID_CONTENT_TYPE",
            "Only 'image/jpeg' content type is supported. Please resize and convert to JPEG before upload.",
            request_id,
        )

    try:
        region = os.environ.get("AWS_REGION", "ap-south-1")
        upload_url, image_key = generate_presigned_upload_url(
            bucket_name=photos_bucket,
            content_type=content_type,
            expires_in=300,
            region_name=region,
        )

        return api_response(200, {
            "uploadUrl": upload_url,
            "imageKey": image_key,
            "maxSizeBytes": MAX_FILE_SIZE_BYTES,
            "contentType": "image/jpeg",
        })
    except Exception as e:
        logger.exception(f"Failed to generate presigned upload URL: {e}")
        return error_response(500, "PRESIGN_FAILED", "Could not generate upload URL", request_id)
