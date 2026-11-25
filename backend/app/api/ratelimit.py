import time
from collections import defaultdict, deque
from threading import Lock


class SlidingWindowLimiter:
    """Tiny in-process limiter (per worker). Swap for Redis in multi-worker deployments."""

    def __init__(self, max_hits: int, window_s: int) -> None:
        self.max_hits, self.window_s = max_hits, window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window_s:
                q.popleft()
            if len(q) >= self.max_hits:
                return False
            q.append(now)
            return True

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)
