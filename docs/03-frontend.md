# 03 · Frontend Architecture

## Layout
Three-panel desktop layout:

- **Sidebar** (240px, fixed) — search history + new search button.
- **Chat panel** (420px, fixed) — streaming agent messages + search input at bottom.
- **Results panel** (flex-1) — live lead table grouped by match status.

## State (Zustand)

- `searchStore` — sessions, active session, query, stream events, leads, selections, actions.
- `authStore` — user, token (persisted in `localStorage`).
- `uiStore` — sidebar open state, modal state.

## Hooks

- `useSSE(sessionId)` — subscribes to `/api/v1/search/{id}/stream`, pushes events into the store.
- `useSearch()` — creates a session, triggers backend, wires up SSE.
- `useOutreach()` — compose + send email requests.

## Color Tokens

See `frontend/tailwind.config.ts`:

```
nexus.bg       #0a0c10
nexus.surface  #0f1219
nexus.card     #141820
nexus.border   #1e2330
nexus.muted    #4a5568
```
