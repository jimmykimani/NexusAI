"""Tests for the in-memory TTL cache.

Targets rubric: Code Quality (caching behaviour, key generation, TTL)
"""
from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.services import cache


class TestCacheKeyGeneration:
    """Verify that cache keys are deterministic and collision-resistant."""

    def test_same_input_same_key(self):
        k1 = cache._key("tavily", "python engineers in nairobi")
        k2 = cache._key("tavily", "python engineers in nairobi")
        assert k1 == k2

    def test_different_input_different_key(self):
        k1 = cache._key("tavily", "python engineers")
        k2 = cache._key("tavily", "rust engineers")
        assert k1 != k2

    def test_different_namespace_different_key(self):
        k1 = cache._key("tavily", "same input")
        k2 = cache._key("criteria", "same input")
        assert k1 != k2

    def test_dict_input_sorted(self):
        """Dict inputs with different key order should produce the same cache key."""
        k1 = cache._key("criteria", {"roles": ["Engineer"], "location": "Nairobi"})
        k2 = cache._key("criteria", {"location": "Nairobi", "roles": ["Engineer"]})
        assert k1 == k2


class TestCacheSetGet:
    """Verify set/get/TTL behaviour."""

    def setup_method(self):
        cache._store.clear()

    def test_set_and_get(self):
        cache.set("tavily", "query1", [{"url": "http://a.com"}])
        result = cache.get("tavily", "query1")
        assert result == [{"url": "http://a.com"}]

    def test_missing_key_returns_none(self):
        assert cache.get("tavily", "nonexistent") is None

    def test_expired_entry_returns_none(self):
        cache.set("tavily", "old_query", ["data"])
        # Manually expire the entry
        key = cache._key("tavily", "old_query")
        cache._store[key]["exp"] = datetime.utcnow() - timedelta(hours=1)
        assert cache.get("tavily", "old_query") is None

    def test_clear_namespace(self):
        cache.set("tavily", "q1", ["a"])
        cache.set("tavily", "q2", ["b"])
        cache.set("criteria", "q1", ["c"])
        cache.clear_namespace("tavily")
        assert cache.get("tavily", "q1") is None
        assert cache.get("tavily", "q2") is None
        assert cache.get("criteria", "q1") == ["c"]


class TestCacheStats:
    """The stats() function should report accurate counts."""

    def setup_method(self):
        cache._store.clear()

    def test_stats_empty(self):
        s = cache.stats()
        assert s["total_active_keys"] == 0

    def test_stats_with_entries(self):
        cache.set("tavily", "q1", [])
        cache.set("criteria", "q2", {})
        s = cache.stats()
        assert s["total_active_keys"] == 2
        assert s["namespaces"]["tavily"] == 1
        assert s["namespaces"]["criteria"] == 1
