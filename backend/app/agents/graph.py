"""Compile the NexusAI LangGraph pipeline."""
from __future__ import annotations

import app.langchain_compat  # noqa: F401 — before langgraph touches langchain_core globals

from langgraph.graph import END, StateGraph

from app.agents.ranking_agent import ranking_node
from app.agents.search_agent import search_node
from app.agents.research_agent import research_node
from app.agents.eval_agent import evaluate_node
from app.agents.state import NexusState
from app.agents.supervisor import supervisor_node


def route_after_supervisor(state: NexusState) -> str:
    """Route to search if criteria exist; abort on error."""
    if state.get("error"):
        return "end"
    if state.get("criteria"):
        return "search"
    return "end"


def route_after_evaluate(state: NexusState) -> str:
    """If we have a pending retry, go back to supervisor. Otherwise end."""
    events = state.get("events", [])
    if events and events[-1].get("type") == "searching" and events[-1].get("data", {}).get("mode") == "retry":
        return "retry"
    return "end"


def build_graph():
    """Build the Supervisor -> Search -> Ranking -> Research -> Eval (Loop) LangGraph."""
    graph = StateGraph(NexusState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("search", search_node)
    graph.add_node("ranking", ranking_node)
    graph.add_node("research", research_node)
    graph.add_node("evaluate", evaluate_node)

    graph.set_entry_point("supervisor")
    graph.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {"search": "search", "end": END},
    )
    graph.add_edge("search", "ranking")
    graph.add_edge("ranking", "research")
    graph.add_edge("research", "evaluate")
    
    graph.add_conditional_edges(
        "evaluate",
        route_after_evaluate,
        {"retry": "supervisor", "end": END},
    )

    return graph.compile()


nexus_graph = build_graph()
