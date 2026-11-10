import hashlib
import io
import logging
import mimetypes
import uuid
from pathlib import Path

from backend.core.config import settings

log = logging.getLogger("verity.storage")


class StorageError(RuntimeError):
    """Raised when an original document cannot be stored or retrieved."""


def _validate_backend() -> None:
    if settings.storage_backend not in {"local", "s3"}:
        raise StorageError(f"Unsupported storage backend: {settings.storage_backend}")
    if settings.storage_backend == "s3" and (
        not settings.storage_bucket
        or not settings.storage_access_key_id
        or not settings.storage_secret_access_key
    ):
        raise StorageError("S3 storage requires bucket and access credentials")


def _s3_client():
    try:
        import boto3
    except ImportError as exc:
        raise StorageError("S3 storage requires boto3 to be installed") from exc
    return boto3.client(
        "s3",
        endpoint_url=settings.storage_endpoint_url,
        aws_access_key_id=settings.storage_access_key_id,
        aws_secret_access_key=settings.storage_secret_access_key,
        region_name=settings.storage_region,
    )


def _storage_key(filename: str) -> str:
    suffix = Path(filename).suffix.lower()[:16]
    return f"documents/{uuid.uuid4().hex}{suffix}"


def put_bytes(data: bytes, filename: str, content_type: str | None = None) -> tuple[str, str]:
    """Store bytes and return a stable object key plus SHA-256 checksum."""
    _validate_backend()
    checksum = hashlib.sha256(data).hexdigest()
    key = _storage_key(filename)
    content_type = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"

    if settings.storage_backend == "local":
        path = Path(settings.storage_dir) / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    else:
        _s3_client().upload_fileobj(
            io.BytesIO(data),
            settings.storage_bucket,
            key,
            ExtraArgs={"ContentType": content_type, "Metadata": {"sha256": checksum}},
        )
    return key, checksum


def read_bytes(key: str) -> bytes:
    _validate_backend()
    if settings.storage_backend == "local":
        try:
            return (Path(settings.storage_dir) / key).read_bytes()
        except OSError as exc:
            raise StorageError(f"Stored document is unavailable: {key}") from exc

    buffer = io.BytesIO()
    try:
        _s3_client().download_fileobj(settings.storage_bucket, key, buffer)
    except Exception as exc:
        raise StorageError(f"Stored document is unavailable: {key}") from exc
    return buffer.getvalue()


def delete(key: str) -> None:
    _validate_backend()
    if settings.storage_backend == "local":
        try:
            (Path(settings.storage_dir) / key).unlink()
        except FileNotFoundError:
            return
        except OSError as exc:
            raise StorageError(f"Could not delete stored document: {key}") from exc
    else:
        _s3_client().delete_object(Bucket=settings.storage_bucket, Key=key)
