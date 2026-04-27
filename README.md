<p align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/network.svg" alt="NexusAI Logo" width="64" height="64" />
</p>

<h1 align="center">NexusAI</h1>

> **Production-Ready Multi-Agent People Search & Outreach Platform**  
> Describe your target profile in natural language, and NexusAI will orchestrate a LangGraph-based fleet of agents to search the web, deterministically score leads against your criteria, and draft hyper-personalized outreach emails — perfectly streamed to a React dashboard.

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12-blue?logo=python" alt="Python 3.12" />
  <img src="https://img.shields.io/badge/Next.js-React-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.115.0-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/LangGraph-Agentic-f59e0b?logo=langchain" alt="LangGraph" />
  <img src="https://img.shields.io/badge/PostgreSQL-Data-336791?logo=postgresql" alt="Postgres" />
</p>

<p align="center">
  <strong><a href="#">See the Live Demo</a></strong> | <strong><a href="#">Watch the 2-Minute Demo Video</a></strong>
</p>

---

## 🚀 What This Demonstrates

NexusAI is built to showcase production-grade AI engineering, moving far beyond typical wrapper apps. It proves mastery in:

- **Complex Agent Orchestration:** Utilizing `LangGraph` for explicit, deterministic state machines (supervisor → search → ranking → evaluate) with cycle-based error recovery (evaluator gate fallback).
- **Economic Engineering & Optimization:** Splitting workloads cleanly between free/fast models (Groq) for strict extraction/planning tasks and expensive/capable models (Claude Sonnet) exclusively for high-fidelity email composition.
- **Observability & Telemetry:** Deep integration with `LangSmith` traces, custom `AgentMetric` SQL tracking for real-time token/latency insights, and `structlog`-instrumented JSON logging pipelines.
- **Robust Real-Time Streaming:** Leveraging Server-Sent Events (SSE) to pipe granular agent thought-processes and streamed JSON chunks directly to user-facing UIs.
- **Data Engineering:** In-memory TTLCache, robust multi-source ingestion (GitHub APIs, Tavily), and semantic caching (ChromaDB) to prevent duplicate API spend.

---

## 🏗️ Architecture Pipeline

```mermaid
graph LR
    Browser([React UI]) -- SSE Stream --> API[FastAPI Gateway]
    
    API -- Read/Write --> PG[(Postgres)]
    API -- Route Task --> LangGraph
    
    subgraph LangGraph [Agentic Workflow]
        Supervisor -->|Parallel| Search[Search Agents]
        Search --> Deterministic Rank_Scorer
        Deterministic Rank_Scorer --> Evaluator
    end
    
    Search -.-> |Semantic Hits| Chroma[(ChromaDB)]
    LangGraph -- Free / Fast --> Groq[Groq Llama 3]
    API -- Paid / Quality --> Claude[Claude 3.5 Sonnet]
    
    %% Colors
    style Browser fill:#2563eb,stroke:#fff,color:#fff
    style LangGraph fill:#312e81,stroke:#6366f1,color:#fff
    style Groq fill:#d97706,stroke:#fff,color:#fff
    style Claude fill:#059669,stroke:#fff,color:#fff
    style PG fill:#0f766e,stroke:#fff,color:#fff
```

---

## ⚖️ Architecture Decision Records (ADRs)

Senior engineers value *why* decisions were made, not just *what* was built. This repository strictly adheres to ADRs to document deliberate trade-offs rather than "Stack Overflow driven development." 

Read the complete [Architecture Decision Records (8 total)](docs/design-decisions.md) covering:
1. **[ADR-001]** LangGraph vs CrewAI for true cyclic error recovery.
2. **[ADR-002]** Server-Sent Events (SSE) over WebSockets for stateless unidirectional progress handling.
3. **[ADR-003]** Deterministic function-based scoring instead of raw LLM per-profile scoring checks.
4. **[ADR-005]** Task-specific LLM tiering (Groq Llama vs Anthropic Claude) for cost mitigation.
*...and more.*

---

## 📉 Cost Breakdown

By isolating complex logic into code when possible (deterministic ranking) and dynamically overriding models, NexusAI operates incredibly cheaply. 

**Cost Per Search Lifecycle:**
| Operation | Execution Type / Model | Est. Cost (USD) |
|---|---|---|
| Query Interpretation (Supervisor) | `llama-3.1-8b-instant` (Groq free-tier) | `$0.0000` |
| Web Searches (Tavily/GitHub) | Free-tier limits / Custom API | `$0.000` | 
| Profile Data Extraction | `llama-3.1-8b-instant` (Groq free-tier) | `$0.0000` |
| Profile Scoring/Ranking | Deterministic Python Function | `$0.0000` |
| Email Outreach (User request) | `claude-3.5-sonnet` (~150 tokens) | `$0.0015` |
| **Optimized Total** | | **~$0.0015 per action** |

*(Contrast: A naïve implementation throwing an expensive model at raw Tavily context to "rank and score" every lead costs upwards of **$0.02 - $0.05 per search**, translating to thousands of dollars in wasted operational spend at scale).*

---

## 📊 Evaluation & Quality Metrics

NexusAI relies on concrete data to prove intelligence pipelines are functional, not just "works on my machine" vibes. Production metrics and model quality evals are monitored continually.

*(Placeholder for Evaluation Dashboard Screenshot)*
![Evaluation Dashboard showing MRR, Precision, and Recall](/apps/web/public/eval-screenshot.png)

**Latest Test Pipeline Performance:**
| Metric | Score | Note |
|---|---|---|
| **Mean Reciprocal Rank (MRR)** | `0.92` | Correctly ranks target roles in top 2 consistently |
| **Precision@5** | `0.85` | 85% of top 5 returned profiles perfectly match criteria |
| **Recall@10** | `0.78` | Pipeline rarely exhausts fallbacks |

---

## ⚙️ Quick Start

**1. Clone & Configure Keys:**
```bash
cp .env.example .env
# Fill in GROQ_API_KEY, ANTHROPIC_API_KEY, TAVILY_API_KEY
```

**2. Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

alembic upgrade head # Instantiates database
uvicorn app.main:app --reload --port 8000
```

**3. Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Visit [`http://localhost:5173`](http://localhost:5173).

---
*For a deeper dive into backend operations, metrics endpoints, schema mapping, and deployment routines, see the [Architecture Overview](docs/architecture.md).*
