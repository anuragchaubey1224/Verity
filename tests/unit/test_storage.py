from pathlib import Path

from backend.core import storage


def test_local_storage_round_trip(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "storage_dir", str(tmp_path))

    key, checksum = storage.put_bytes(b"hello verity", "paper.txt", "text/plain")

    assert key.startswith("documents/")
    assert storage.read_bytes(key) == b"hello verity"
    assert len(checksum) == 64

    storage.delete(key)
    assert not (Path(tmp_path) / key).exists()
