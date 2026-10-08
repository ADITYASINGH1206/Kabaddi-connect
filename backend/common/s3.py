"""
S3 operations for photo uploads and retrieval.
"""

import hashlib
import os
import uuid
from typing import Dict, Optional, Tuple
import boto3
from botocore.config import Config

S3_CLIENT_CONFIG = Config(signature_version="s3v4")


def get_s3_client(region_name: Optional[str] = None):
    return boto3.client("s3", region_name=region_name, config=S3_CLIENT_CONFIG)


def generate_presigned_upload_url(
    bucket_name: str,
    content_type: str = "image/jpeg",
    expires_in: int = 300,
    region_name: Optional[str] = None
) -> Tuple[str, str]:
    """
    Generates a presigned PUT URL for image upload.
    Enforces image/jpeg content type.
    Returns (uploadUrl, imageKey).
    """
    if content_type != "image/jpeg":
        raise ValueError("Only 'image/jpeg' is allowed")

    image_key = f"uploads/{uuid.uuid4().hex}.jpg"
    s3_client = get_s3_client(region_name)

    presigned_url = s3_client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": bucket_name,
            "Key": image_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )

    return presigned_url, image_key


def fetch_image_bytes(bucket_name: str, image_key: str, region_name: Optional[str] = None) -> bytes:
    """Fetches raw image bytes from S3."""
    s3_client = get_s3_client(region_name)
    response = s3_client.get_object(Bucket=bucket_name, Key=image_key)
    return response["Body"].read()


def calculate_image_hash(image_bytes: bytes) -> str:
    """Computes SHA-256 hash of image bytes for caching analysis results."""
    return hashlib.sha256(image_bytes).hexdigest()
