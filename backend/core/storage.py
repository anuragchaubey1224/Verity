import hashlib
import mimetypes
import uuid
from pathlib import Path

from backend.core.config import settings

class StorageError(RuntimeError):
    """Raised when an original document cannot be stored or retrieved."""


def _storage_key(filename: str) -> str:
    suffix = Path(filename).suffix.lower()[:16]
    return f"documents/{uuid.uuid4().hex}{suffix}"


def put_bytes(data: bytes, filename: str, content_type: str | None = None) -> tuple[str, str]:
    """Store bytes and return a stable object key plus SHA-256 checksum."""
    checksum = hashlib.sha256(data).hexdigest()
    key = _storage_key(filename)
    content_type = content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    path = Path(settings.storage_dir) / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key, checksum


def read_bytes(key: str) -> bytes:
    try:
        return (Path(settings.storage_dir) / key).read_bytes()
    except OSError as exc:
        raise StorageError(f"Stored document is unavailable: {key}") from exc


def delete(key: str) -> None:
    try:
        (Path(settings.storage_dir) / key).unlink()
    except FileNotFoundError:
        return
    except OSError as exc:
        raise StorageError(f"Could not delete stored document: {key}") from exc
