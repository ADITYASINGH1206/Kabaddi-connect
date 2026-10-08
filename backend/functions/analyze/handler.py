"""
Handler for POST /analyze:
Fetches photo from S3, checks image-hash cache in DynamoDB,
calls Bedrock Converse API with multimodal vision, validates and sanitizes
against the scrap taxonomy, retries on throttling, and gracefully falls back.
"""

import json
import logging
import os
import time
from typing import Any, Dict, Optional
import boto3
from botocore.exceptions import ClientError

try:
    from common.db import get_cached_analysis, save_cached_analysis
    from common.errors import api_response, error_response
    from common.s3 import calculate_image_hash, fetch_image_bytes
    from common.schema import (
        BEDROCK_SYSTEM_PROMPT,
        sanitize_and_parse_json,
        validate_vision_response,
    )
except ImportError:
    from backend.common.db import get_cached_analysis, save_cached_analysis
    from backend.common.errors import api_response, error_response
    from backend.common.s3 import calculate_image_hash, fetch_image_bytes
    from backend.common.schema import (
        BEDROCK_SYSTEM_PROMPT,
        sanitize_and_parse_json,
        validate_vision_response,
    )

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Default Bedrock model and region (overridable via environment variables)
DEFAULT_MODEL_ID = "apac.amazon.nova-lite-v1:0"
DEFAULT_BEDROCK_REGION = "ap-south-1"


def get_bedrock_runtime_client(region_name: str):
    return boto3.client("bedrock-runtime", region_name=region_name)


def call_bedrock_converse_with_retries(
    image_bytes: bytes,
    model_id: str,
    region_name: str,
    max_retries: int = 2
) -> Dict[str, Any]:
    """
    Invokes Amazon Bedrock Converse API with raw JPEG bytes and retries on throttling.
    """
    client = get_bedrock_runtime_client(region_name)

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "image": {
                        "format": "jpeg",
                        "source": {"bytes": image_bytes},
                    }
                },
                {
                    "text": "Identify all recyclable scrap items, estimate weights, assess photo quality, and note any hazards in the specified JSON schema."
                },
            ],
        }
    ]

    system = [{"text": BEDROCK_SYSTEM_PROMPT}]
    inference_config = {"temperature": 0.1, "maxTokens": 1024}

    attempt = 0
    backoff_seconds = 1.0

    while attempt <= max_retries:
        try:
            logger.info(f"Calling Bedrock Converse API with model {model_id} in {region_name} (attempt {attempt + 1})...")
            response = client.converse(
                modelId=model_id,
                system=system,
                messages=messages,
                inferenceConfig=inference_config,
            )

            # Extract response text
            output_content = response.get("output", {}).get("message", {}).get("content", [])
            text_blocks = [blk.get("text", "") for blk in output_content if "text" in blk]
            combined_text = "".join(text_blocks)
            logger.info(f"Bedrock raw output: {combined_text}")

            parsed_data = sanitize_and_parse_json(combined_text)
            return validate_vision_response(parsed_data)

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            logger.warning(f"Bedrock ClientError ({error_code}): {e}")

            if error_code in ["ThrottlingException", "ModelNotReadyException", "TooManyRequestsException"]:
                attempt += 1
                if attempt <= max_retries:
                    logger.info(f"Throttled by Bedrock. Retrying in {backoff_seconds}s...")
                    time.sleep(backoff_seconds)
                    backoff_seconds *= 2.0
                    continue
            raise e
        except Exception as e:
            logger.error(f"Error during Bedrock invocation or parsing: {e}")
            raise e

    raise RuntimeError("Exceeded maximum retries for Bedrock Converse API")


def lambda_handler(event, context):
    request_id = getattr(context, "aws_request_id", "local-request")
    logger.info(f"Processing analyze request: {request_id}")

    photos_bucket = os.environ.get("PHOTOS_BUCKET")
    if not photos_bucket:
        return error_response(500, "CONFIG_ERROR", "PHOTOS_BUCKET is not set", request_id)

    model_id = os.environ.get("BEDROCK_MODEL_ID", DEFAULT_MODEL_ID)
    bedrock_region = os.environ.get("BEDROCK_REGION", DEFAULT_BEDROCK_REGION)
    s3_region = os.environ.get("AWS_REGION", "ap-south-1")

    # Parse input body
    body = event.get("body")
    if not body:
        return error_response(400, "BAD_REQUEST", "Missing request body", request_id)

    try:
        if isinstance(body, str):
            body = json.loads(body)
    except Exception:
        return error_response(400, "BAD_REQUEST", "Invalid JSON body", request_id)

    image_key = body.get("imageKey")
    lang = body.get("lang", "en")

    if not image_key:
        return error_response(400, "MISSING_IMAGE_KEY", "Missing 'imageKey' in request", request_id)

    # 1. Fetch image bytes from S3
    try:
        image_bytes = fetch_image_bytes(photos_bucket, image_key, s3_region)
    except Exception as e:
        logger.exception(f"Failed to fetch image from S3 ({image_key}): {e}")
        return error_response(404, "IMAGE_NOT_FOUND", f"Could not find or read image: {image_key}", request_id)

    # 2. Check cache by image hash
    image_hash = calculate_image_hash(image_bytes)
    cached_result = get_cached_analysis(image_hash)
    if cached_result:
        logger.info(f"Cache hit for image hash {image_hash}")
        cached_result["cached"] = True
        return api_response(200, cached_result)

    # 3. Call Bedrock with retries, or fallback gracefully
    try:
        analysis_result = call_bedrock_converse_with_retries(
            image_bytes=image_bytes,
            model_id=model_id,
            region_name=bedrock_region,
            max_retries=2,
        )
        analysis_result["cached"] = False

        # Cache valid analysis
        save_cached_analysis(image_hash, analysis_result)
        return api_response(200, analysis_result)

    except Exception as e:
        logger.warning(f"Vision analysis failed, returning graceful fallback: {e}")
        # Graceful fallback: allows user to select materials manually
        fallback_response = {
            "photo_quality_ok": True,
            "retake_reason": None,
            "items": [],
            "hazards": [],
            "fallback": True,
            "cached": False,
            "fallback_message": "Vision assistant temporarily unavailable. Please select your scrap materials manually below.",
        }
        return api_response(200, fallback_response)
