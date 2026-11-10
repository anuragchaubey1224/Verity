import uuid

import pytest

from backend.api.routes.research import _require_owned_document
from backend.memory import conversation_store


@pytest.mark.asyncio
async def test_document_ownership_rejects_invalid_or_unowned_document():
    class FakeDB:
        async def scalar(self, _query):
            return None

    with pytest.raises(Exception) as exc_info:
        await _require_owned_document(str(uuid.uuid4()), uuid.uuid4(), FakeDB())

    assert exc_info.value.status_code == 404


def test_conversation_cache_isolated_by_user():
    conversation_store._cache.clear()
    conversation_store._cache[("user-a", "shared-session")].append({"role": "user", "content": "A"})
    conversation_store._cache[("user-b", "shared-session")].append({"role": "user", "content": "B"})

    assert conversation_store.get_cached_history("shared-session", "user-a")[0]["content"] == "A"
    assert conversation_store.get_cached_history("shared-session", "user-b")[0]["content"] == "B"
