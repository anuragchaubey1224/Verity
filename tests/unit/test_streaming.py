"""Guard the async streaming path.

The sync generator used to block the event loop for the whole answer. These
tests pin the contract of the async replacement: it yields tokens without
blocking and always closes the upstream stream.
"""

import pytest

from backend.agents import nodes


class _FakeStream:
    def __init__(self, tokens: list[str]):
        self._tokens = iter(tokens)
        self.closed = False

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            token = next(self._tokens)
        except StopIteration:
            raise StopAsyncIteration
        return _FakeChunk(token)

    async def close(self):
        self.closed = True


class _FakeChunk:
    def __init__(self, token: str):
        self.choices = [_FakeChoice(token)]


class _FakeChoice:
    def __init__(self, token: str):
        self.delta = type("Delta", (), {"content": token})()


class _FakeCompletions:
    def __init__(self, stream: _FakeStream):
        self._stream = stream
        self.calls = 0

    async def create(self, **kwargs):
        self.calls += 1
        return self._stream


class _FakeChat:
    def __init__(self, completions: _FakeCompletions):
        self.completions = completions


class _FakeLLM:
    def __init__(self, completions: _FakeCompletions):
        self.chat = _FakeChat(completions)


def _state() -> dict:
    return {
        "query": "what is rag?",
        "domain": "ml",
        "chunks": [],
        "conversation_history": [],
    }


@pytest.mark.asyncio
async def test_async_stream_yields_tokens_and_closes_upstream(monkeypatch):
    stream = _FakeStream(["Hello", " world"])
    completions = _FakeCompletions(stream)
    monkeypatch.setattr(nodes, "_async_llm", _FakeLLM(completions))

    tokens = [token async for token in nodes.stream_generator_node_async(_state())]

    assert tokens == ["Hello", " world"]
    assert completions.calls == 1
    assert stream.closed is True
