# 04 · API Reference

Base URL: `http://localhost:8000/api/v1`

All endpoints except `/auth/*` require `Authorization: Bearer <token>`.

## Auth

### `POST /auth/register`
Request:
```json
{ "email": "you@example.com", "password": "secret12", "full_name": "You" }
```
Response `201`: `{ "id", "email", "full_name" }`

### `POST /auth/login`
Request:
```json
{ "email": "you@example.com", "password": "secret12" }
```
Response `200`: `{ "access_token", "token_type": "bearer", "expires_in": 86400 }`

### `GET /auth/me`
Returns the authenticated user.

## Search

### `POST /search`
Create a search session and start the agent graph. Returns immediately; consume events from the SSE endpoint.

Request: `{ "query": "Find senior React developers in Nairobi" }`
Response `201`: `{ "session_id", "status": "pending" }`

### `GET /search/{session_id}/stream`
Server-Sent Events stream. Event payloads:
```
data: {"type":"plan","message":"Analyzing your search request..."}
data: {"type":"plan","message":"Search plan created","data":{"criteria":{},"queries":[]}}
data: {"type":"searching","message":"Searching across the web..."}
data: {"type":"found","message":"Found 23 sources, extracting profiles..."}
data: {"type":"ranking","message":"Scoring 15 profiles..."}
data: {"type":"complete","message":"Found 10 fully matched, 5 partial","data":{"leads":[...]}}
data: {"type":"error","message":"..."}
```

### `GET /search/{session_id}`
Completed session with its leads.

### `GET /search`
List the authenticated user's sessions.

## Leads

### `GET /leads?session_id={id}`
Returns `{ "fully_matched": [...], "partially_matched": [...] }`.

### `PATCH /leads/{id}`
Update a lead (email, notes, etc.).

## Outreach

### `POST /outreach/compose`
```json
{ "lead_ids": ["..."], "context": "We're launching an AI product and need advisors" }
```
Returns `{ "emails": [{ "lead_id", "to_name", "subject", "body" }] }`.

### `POST /outreach/send` (mock)
Records the send and returns `{ "status": "sent", "message_id": "mock-..." }`.

## Health
### `GET /health`
`{ "status", "version", "db", "environment" }`

## Errors

| Status | Code | Meaning |
|---|---|---|
| 400 | INVALID_QUERY | Query too short or malformed |
| 401 | UNAUTHORIZED | Missing or invalid JWT |
| 404 | SESSION_NOT_FOUND | Session doesn't exist or not yours |
| 422 | VALIDATION_ERROR | Pydantic validation failed |
| 429 | RATE_LIMIT | Too many requests |
| 500 | AGENT_ERROR | LLM or search service failure |
