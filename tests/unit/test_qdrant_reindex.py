import uuid

from backend.db.qdrant_client import deterministic_point_id


def test_qdrant_point_id_is_deterministic_and_uuid_compatible():
    chunk_id = uuid.uuid4()

    first = deterministic_point_id(chunk_id)
    second = deterministic_point_id(str(chunk_id))

    assert first == second
    assert uuid.UUID(first).version == 5
