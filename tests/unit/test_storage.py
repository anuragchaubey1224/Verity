from pathlib import Path

from backend.core import storage


def test_local_storage_round_trip(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "storage_backend", "local")
    monkeypatch.setattr(storage.settings, "storage_dir", str(tmp_path))

    key, checksum = storage.put_bytes(b"hello verity", "paper.txt", "text/plain")

    assert key.startswith("documents/")
    assert storage.read_bytes(key) == b"hello verity"
    assert len(checksum) == 64

    storage.delete(key)
    assert not (Path(tmp_path) / key).exists()


def test_invalid_s3_configuration_fails_before_network_call(monkeypatch):
    monkeypatch.setattr(storage.settings, "storage_backend", "s3")
    monkeypatch.setattr(storage.settings, "storage_bucket", None)

    try:
        storage.put_bytes(b"data", "paper.txt")
    except storage.StorageError as exc:
        assert "requires bucket" in str(exc)
    else:
        raise AssertionError("Invalid S3 configuration should fail")
