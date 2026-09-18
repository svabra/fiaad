from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import AsyncIterator
from uuid import uuid4

from daaif_backend.domain.models import QueryEvent


class TenantEventBroker:
    """In-process broker behind a replaceable event port.

    The public contract is tenant-scoped. A Redis/NATS adapter can replace this
    class when the orchestrator is deployed separately.
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[QueryEvent]]] = defaultdict(set)
        self._guard = asyncio.Lock()

    async def publish(self, tenant_id: str, topic: str, payload: dict[str, object]) -> None:
        event = QueryEvent(
            event_id=str(uuid4()),
            tenant_id=tenant_id,
            topic=topic,
            payload=payload,
        )
        async with self._guard:
            subscribers = tuple(self._subscribers.get(tenant_id, ()))
        for queue in subscribers:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(event)

    async def subscribe(self, tenant_id: str) -> AsyncIterator[QueryEvent | None]:
        queue: asyncio.Queue[QueryEvent] = asyncio.Queue(maxsize=100)
        async with self._guard:
            self._subscribers[tenant_id].add(queue)
        try:
            while True:
                try:
                    yield await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    yield None
        finally:
            async with self._guard:
                self._subscribers[tenant_id].discard(queue)
                if not self._subscribers[tenant_id]:
                    self._subscribers.pop(tenant_id, None)

