"""Patch legacy ``langchain.*`` globals expected by ``langchain_core``.

``langchain_core.globals`` reads ``langchain.debug``, ``langchain.verbose``, and
``langchain.llm_cache`` when the top-level ``langchain`` package is installed.
Newer ``langchain`` releases may omit those attributes, which raises
``AttributeError: module 'langchain' has no attribute 'debug'`` during graph
runs. Pre-define them when missing so LangGraph / LangChain keep working.

Import this module before any ``langgraph`` or ``langchain_core`` usage
(see ``main.py`` and ``agents/graph.py``).
"""
from __future__ import annotations


def ensure_langchain_legacy_attrs() -> None:
    try:
        import langchain
    except ImportError:
        return
    mod = langchain
    for attr, default in (("debug", False), ("verbose", False), ("llm_cache", None)):
        try:
            getattr(mod, attr)
        except AttributeError:
            setattr(mod, attr, default)


ensure_langchain_legacy_attrs()
