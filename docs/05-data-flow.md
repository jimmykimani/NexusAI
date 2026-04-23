# 05 · Data Flow

## Search (happy path)

```
User               Frontend            Backend           LangGraph          External
 │                    │                   │                 │                  │
 │ query ───────────► │                   │                 │                  │
 │                    │ POST /search ───► │                 │                  │
 │                    │◄── session_id ────│                 │                  │
 │                    │ SSE /stream ────► │                 │                  │
 │                    │                   │ invoke graph ──►│                  │
 │                    │                   │           [supervisor]             │
 │                    │◄── event: plan ───────────────────  │─► Claude Sonnet  │
 │                    │                   │           [search]                 │
 │                    │◄── event: searching ─────────────   │─► Tavily         │
 │                    │◄── event: found ─────────────────   │─► Claude Sonnet  │
 │                    │                   │           [ranking]                │
 │                    │◄── event: ranking ───────────────   │─► Claude Haiku   │
 │                    │◄── event: complete ──────────────   │                  │
 │                    │  (leads in payload)                 │                  │
 │                    │ persists to store                   │                  │
```

## Outreach

```
User        Frontend                  Backend             Claude
 │            │ select leads ───►     │                     │
 │            │ POST /outreach/compose─►│                   │
 │            │                        │ for each lead:     │
 │            │                        │   Sonnet prompt ───►│
 │            │                        │◄── email body ──── │
 │            │◄── { emails: [...] }   │                     │
 │            │ POST /outreach/send ──►│                     │
 │            │◄── { status: "sent" }  │                     │
```

## SSE Lifecycle

The server streams each agent event as `data: {json}\n\n`; the generator exhausts on `complete` or `error` and the browser's `EventSource` closes itself. In production, `nginx` disables buffering for `/api/v1/search/*/stream` so tokens ship in real time.
