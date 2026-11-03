# Reigner frontend client: handoff brief

Context for building a web frontend for Reigner in a separate repo. It covers what
Reigner is, the exact HTTP contract the server exposes (as of v0.12.0, the minimum
version the client supports), and
the screens and behaviors a reference client needs.

Source of truth for anything here: `reigner/server/fastapi_app.py` and
`reigner/harness/events.py` in the main repo. Docs: https://construct-lab.github.io/reigner/

---

## 1. What Reigner is

Reigner is a Python library (a harness) for **question-answering agents over your own
documents**, with bounded context, bounded cost, and every claim cited.

The flow:

1. **Ingest (one time).** Raw documents (PDF, text, HTML) are compiled by an LLM
   extractor into a structured store of *artifacts*, for example
   `AAPL/2024/metadata.json`, `AAPL/2024/sections/risk_factors`. The schema of what
   gets extracted is defined per project.
2. **Ask.** A single retrieval agent answers questions over that store. It never
   reads the raw files at query time. It calls bounded read tools (`bm25_search`,
   `get_section`, `get_json_field`, ...) and registers a **citation** for every
   factual claim before answering.
3. **Persist.** Every conversation is a durable *session*: an append-only JSONL log
   of typed events on disk. Sessions can be resumed, forked, and replayed.

A Reigner project is a folder: `REIGNER.md` (the agent's instructions), `reigner.yaml`
(model, tools, skills, budgets), a schema, and optional custom tools and plugins.
The same folder is reached three ways:

- **CLI** (`reigner chat`): the terminal UI for developers and power users.
- **HTTP** (`reigner serve --http`): a FastAPI server that streams events over SSE.
  **This is what the frontend talks to.**
- **MCP**: planned, not implemented.

What Reigner is not: a chat product, a multi-agent orchestrator, or a coding agent.
One agent, one corpus, read-only at runtime.

### Concepts the UI has to express

| Concept | What it means for the UI |
|---|---|
| **Session** | A conversation thread. Identified by `session_id`. Has a list of rounds. |
| **Round** | One user query and everything the agent did to answer it. Starts with a `user_query` event. |
| **Tool call / result** | The agent's retrieval steps. Paired by `call_id`. Results are bounded and may be truncated. |
| **Citation** | `source` (artifact path) + `locator` (where inside it) + `value` (the cited fact). The core trust signal. |
| **Clarification** | The agent stops and asks the user to disambiguate, optionally with candidate answers. The round ends; the user's reply is the next query. |
| **Oracle escalation** | The cheap default model hands one turn to a stronger model. Worth surfacing (it costs more). |
| **Compaction** | History was compressed to stay inside the context budget. Informational. |
| **Steering** | A mid-run user message. CLI only today; not reachable over HTTP. |
| **Profile** | Tool gating for a new session: `full`, `read_only`, or `eval`. |

---

## 2. The server

Start it inside a Reigner project:

```console
$ reigner serve --http                 # 127.0.0.1:8000
$ reigner serve --http --host 0.0.0.0 --port 8080 -c path/to/reigner.yaml
```

Needs `reigner[server]>=0.12` (0.12 adds `--cors-origin`):
`uv add "reigner[server]>=0.12"`.

**No auth, no rate limiting.** Deliberate. CORS is off by default; allow the
frontend's origin explicitly:

```console
$ reigner serve --http --cors-origin http://localhost:5173
```

The origin must be exact `scheme://host[:port]`, with no trailing slash (startup
rejects one). Repeat the flag for several origins. `*` works but prints a warning.
Credentials are not allowed, so don't send cookies or `Authorization`. A dev-server
proxy (Vite `server.proxy`, Next rewrites) is the alternative and needs no flag.

One server = one agent (one project, one model config). All requests share one
immutable harness; each request gets its own session object.

---

## 3. Endpoints

### `GET /health`

```json
{ "status": "ok", "name": "my-agent", "model": "anthropic/claude-sonnet-4-6" }
```

Use for the connection indicator and the header (agent name, model).

### `POST /run`

Runs one query and streams the agent's events as Server-Sent Events.

Request body:

```json
{
  "query": "What was Apple's 2024 revenue?",
  "session_id": null,
  "profile": "full",
  "state": {}
}
```

| Field | Type | Notes |
|---|---|---|
| `query` | string, required, non-empty | Empty → 422 before any work. |
| `session_id` | string or null | Null mints a new session. A value resumes that session; unknown → 404. |
| `profile` | `"full"` \| `"read_only"` \| `"eval"` | Only applies to **new** sessions. A resumed session always runs at `full` (known v0 limit). |
| `state` | object | Initial state for a new session. Leave `{}` unless you know you need it. |

Response: `Content-Type: text/event-stream`. Each frame:

```
event: tool_call
data: {"type":"tool_call","seq":3,"session_id":"...","turn":1,"ts":"...","name":"bm25_search","args":{...},"call_id":"toolu_01..."}

```

- The event type is both in the `event:` line and in `data.type`. Dispatch on `data.type`.
- **`EventSource` cannot be used** (it only does GET). Use `fetch()` with a
  `ReadableStream` reader and parse frames yourself (split on blank lines, read the
  `data:` line, `JSON.parse`). `@microsoft/fetch-event-source` or `eventsource-parser`
  work fine.
- **New sessions:** read `session_id` off the first frame (it is a `user_query`
  event) and store it. Every later frame carries the same id.
- **No token streaming.** The answer arrives whole in one `final_answer` event. The
  live part of the UI is the retrieval activity (tool calls, results, citations),
  not typing text.
- If the client disconnects, the server stops the run (no more model calls).
  Aborting the `fetch` is therefore the "stop" button. Events already emitted are
  saved; the round is left without a terminal event.
- A failure after the stream opens arrives as an `error` frame with `seq: -1`,
  `turn: -1`, `recoverable: false`, then the stream closes.

Pre-stream errors: `422` (validation), `404` (unknown `session_id`).

**Do not run two `/run` requests on the same `session_id` at once.** The server does
not lock sessions. Disable the composer while a run is in flight.

### `GET /sessions`

```json
{
  "sessions": [
    {
      "session_id": "3f9c2a7e1b...(uuid4 hex)",
      "parent_id": null,
      "title": null,
      "created": "2026-11-03T10:12:00+00:00",
      "last_updated": "2026-11-03T10:14:31+00:00",
      "event_count": 42,
      "schema_version": 2
    }
  ]
}
```

- `parent_id` is set when a session was forked from another (fork tree).
- `title` is usually null: it is only set via the CLI. The client should derive a
  display title from the first `user_query` (needs a fetch of events) or fall back
  to the created date.
- No pagination, no sort guarantee. Sort by `last_updated` client-side.

### `GET /sessions/{id}/events?limit=N`

```json
{
  "session_id": "3f9c2a7e1b...(uuid4 hex)",
  "total": 42,
  "truncated": false,
  "events": [ { "type": "user_query", ... }, ... ]
}
```

- Same event envelopes as `/run` frames, in write order. Rebuild the thread from
  these on reload or when opening a session from the sidebar. The renderer for live
  and replayed events must be the same code.
- `limit` returns the last N events; `total` still counts everything; `truncated`
  says you got a suffix. A suffix can start mid-round (no leading `user_query`), so
  render that case defensively or fetch the whole thing.
- `404` for unknown or malformed ids (indistinguishable on purpose). `422` if the
  stored transcript is corrupt.

---

## 4. Event protocol

Every event has the envelope:

| Field | Type | Notes |
|---|---|---|
| `type` | string | Discriminator, see below. |
| `seq` | int | Monotonic per session. Use as React key. `-1` on server-synthesized errors. |
| `session_id` | string | |
| `turn` | int | Loop iteration within the current round. `0` on `user_query`. Resets each round, so it is not a round number. Count `user_query` events to number rounds. |
| `ts` | ISO-8601 string | UTC. |

Event types (schema version 2):

| `type` | Payload | Render as |
|---|---|---|
| `user_query` | `query: str` | User message bubble. Starts a round. |
| `tool_call` | `name: str`, `args: object`, `call_id: str` | A step in the activity trace. Pending until its result arrives. |
| `tool_result` | `call_id: str`, `result: any`, `truncated: bool`, `cached: bool` | Completes the step with matching `call_id`. Show a summary, expandable raw JSON. Badges for `truncated` and `cached`. |
| `citation` | `source: str`, `locator: object`, `value: any` | Add to the round's numbered Sources list. |
| `clarification` | `question: str`, `candidates: list` | Question card with candidate chips. Clicking a chip sends it as the next query on the same session. Round ends here. |
| `final_answer` | `text: str`, `metadata: object` | The answer (Markdown). Round ends here. |
| `error` | `error: str`, `recoverable: bool` | Inline error card. Round ends here. |
| `oracle` | `reason: str`, `from_model: str`, `to_model: str` | Small badge/notice in the trace: "escalated to X: reason". `to_model` may be `"(unconfigured)"`. |
| `compaction` | `level: int`, `tokens_freed: int` | Subtle notice in the trace. |
| `steering` | `message: str`, `mode: str` | Only appears in sessions created by the CLI. Render as a small user interjection. |
| `status` | `message: str` | Progress text. Not emitted by the chat loop today; handle it anyway. |

Unknown `type` values: ignore, don't crash. The protocol will grow.

### Ordering within a round

```
user_query
  ( tool_call → tool_result
  | tool_call(register_citation) → citation → tool_result
  | tool_call(request_clarification) → clarification → tool_result   [terminal]
  | tool_call(escalate_to_oracle) → oracle → tool_result
  | compaction | steering )*
  final_answer | clarification | error                                 [terminal]
```

- When the model makes several read calls in one turn they run in parallel. You may
  see several `tool_call` events, then their `tool_result` events in any order.
  Pair by `call_id`, never by position.
- Pseudo-tools also emit a `tool_call`. These are bookkeeping, not retrieval, and the
  CLI hides them from the activity trace: `register_citation`,
  `request_clarification`, `escalate_to_oracle`, `stop`, `save_note`. Show them only
  in a verbose/debug mode. `load_skill` is a real tool worth showing ("loaded skill X").
- A round can end with no terminal event if the client aborted. On replay, treat a
  round with no terminal event as "interrupted".

### `final_answer.metadata`

```json
{
  "usage": { "prompt": 1200, "completion": 300, "cached": 8000,
             "cache_read": 8000, "cache_write": 0, "total": 9500 },
  "stop_reason": "end_turn",
  "no_progress": true,   // only when the model ended with no text and no calls
  "stop": true           // only when the model ended via the stop tool
}
```

`usage` is the whole round's token total. Plugins can add keys; treat the object as
open. Cost in dollars is **not** sent; the CLI computes it from a local pricing table
(`reigner/pricing.py`) and the `/health` model string. Either skip cost in v1 or port
that table.

### Tool results

Built-in tools return bounded, self-describing objects. Common keys a summary line
can use: `has_more`, `truncated`, `available_keys`, `total`, plus tool-specific
lists (hits, matches, entries). Shapes are not formally typed and custom tools can
return anything JSON, so: show a one-line summary when you recognize the tool,
otherwise fall back to collapsed JSON.

Built-in tool names you will see (depends on project config):

- Search: `bm25_search`, `filtered_search`, `section_search`
- Artifacts: `list_documents`, `list_versions`, `get_section`, `get_json_field`,
  `grep_artifact`, `read_artifact_file`
- Filesystem (code_navigator style projects): `fs_ls`, `fs_glob`, `fs_grep`, `fs_read`
- Skills: `load_skill`
- Pseudo: `register_citation`, `request_clarification`, `escalate_to_oracle`,
  `save_note`, `stop`

The CLI's per-tool summaries live in `reigner/cli/_tool_summary.py`; port its logic
for human-readable step lines.

### Citations

```json
{ "type": "citation", "source": "AAPL/2024/metadata.json",
  "locator": { "field": "revenue" }, "value": 391035000000 }
```

- `locator` is free-form. Common shapes: `{"field": ...}`, `{"line": 42}`,
  `{"section": "sections/risks"}`. Render as compact `k=v` pairs, keys sorted,
  empty values dropped (that is what the CLI does).
- Citations are deduplicated by `(source, locator)` in the agent state, but the
  event can still be emitted again for a repeat. Dedupe client-side on
  `source + canonical JSON of locator`.
- The answer text does **not** contain inline citation markers that map to
  citation events. Sources are a list attached to the round, shown after the answer.
- There is no endpoint to fetch the artifact a citation points to. `value` is the
  best preview available today.

---

## 5. Frontend: what to build

Target user: someone who ran `reigner serve` and wants a usable chat client, and a
developer who wants a readable reference implementation to copy from. Readability of
the event-handling code matters as much as the UI.

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ reigner · my-agent        anthropic/claude-sonnet-4-6        ● online │
├───────────────┬──────────────────────────────────────────────────────┤
│ + New session │  You: What was Apple's 2024 revenue?                  │
│               │                                                      │
│ Today         │  ▸ Retrieved · 4 steps · 2.1s       [expand]         │
│  Apple rev..  │     bm25_search "revenue 2024"   → 8 hits            │
│  Risk fac..   │     get_json_field AAPL/2024/... → 1 field  cached    │
│ Yesterday     │     ⤴ escalated to opus: conflicting figures          │
│  ↳ fork of..  │                                                      │
│               │  Apple's 2024 revenue was $391.0B [1].                │
│               │                                                      │
│               │  Sources                                             │
│               │   1  AAPL/2024/metadata.json  field=revenue          │
│               │      391035000000                                    │
│               │                                                      │
│               │  9.5k tokens · end_turn                              │
├───────────────┴──────────────────────────────────────────────────────┤
│ [ Ask a question…                                   ] [Send] / [Stop] │
└──────────────────────────────────────────────────────────────────────┘
```

### Must-have (v1)

1. **Connection + identity.** Configurable server base URL. Poll `/health`; show
   name, model, online/offline.
2. **Session sidebar.** `GET /sessions`, sorted by `last_updated`. New session
   button. Show fork lineage via `parent_id` (indent or "fork of" label). Derived
   titles (first query) cached client-side.
3. **Thread view.** Load with `GET /sessions/{id}/events`, group into rounds by
   `user_query`. Same renderer for live and replayed events.
4. **Composer.** Send → `POST /run` with current `session_id` (null for new).
   Disabled while running. Stop button aborts the fetch.
5. **Live activity trace.** Collapsed by default to one line ("Retrieving…" while
   running, "Retrieved · N steps · Xs" when done), expandable to per-step lines
   with args summary, result summary, `truncated` / `cached` badges, and raw JSON on
   demand. Pseudo-tools hidden unless verbose.
6. **Answer.** Markdown rendering of `final_answer.text`. Flag `no_progress`
   answers (empty or degenerate).
7. **Sources.** Numbered, deduped citation list per round: source path, locator,
   value. Prominent; this is the product's trust signal.
8. **Clarification.** Question card with candidate buttons and free-text reply,
   both sent as the next query on the same session.
9. **Errors.** Pre-stream HTTP errors (404, 422, network) as toasts; in-stream
   `error` events inline in the round. Interrupted rounds marked as such.
10. **Usage line.** Token totals from `final_answer.metadata.usage`.
11. **URL state.** `/s/{session_id}` deep link so reload restores the thread.

### Nice-to-have (v2)

- Verbose/debug toggle: show pseudo-tools, raw events, `seq`/`turn`, compaction details.
- Cost estimate (port `reigner/pricing.py`).
- Profile selector on new sessions (`full` / `read_only` / `eval`).
- Session search/filter in the sidebar.
- Export a session as JSONL or Markdown.
- Fork tree visualization.
- Citation hover: highlight the answer sentence that asserts the cited `value`
  (string match on the value; heuristic, since there are no inline markers).

### Engineering notes

- Keep the event layer framework-agnostic: a typed `Event` union (TypeScript
  discriminated union on `type`), an SSE parser over `fetch`, and a pure reducer
  `(roundsState, event) → roundsState`. Live and replay both feed the reducer. This
  is the part people will copy.
- Generate or hand-write the TS types from `reigner/harness/events.py`; it's small.
  The server's OpenAPI schema (`/openapi.json`) covers request/response bodies but
  types `events` as `dict`, so event types must come from the Python source.
- Either run the server with `--cors-origin <dev origin>` or use a dev proxy.
- Don't assume one session per tab: users will switch sessions mid-run. Scope the
  in-flight run to its session id.

---

## 6. Server gaps the client will hit

Things the current HTTP API does not provide. Worth deciding per item whether the
client works around it or the server grows an endpoint (would be a change in the
main reigner repo):

| Gap | Workaround today | Possible server change |
|---|---|---|
| No auth | Gateway | Out of scope by design; document a gateway recipe |
| No session titles over HTTP | Derive from first query | `PATCH /sessions/{id}` for title |
| No fork / replay over HTTP | Not available in UI | `POST /sessions/{id}/fork?at_turn=N` |
| No steering over HTTP | Not available in UI | A steering endpoint keyed by session |
| No delete session | Not available in UI | `DELETE /sessions/{id}` |
| No artifact read for a citation | Show `value` only | `GET /artifacts/{path}` (read-only, bounded) |
| No cost in events | Port pricing table | Add cost to `final_answer.metadata` |
| No project introspection (tools, skills, schema) | Hardcode tool names | `GET /info` mirroring `reigner inspect` |
| Resume ignores `profile` | Only set profile on new sessions | Persist profile in session meta |
| No per-session run lock | Client never double-sends | Server-side lock returning 409 |
| No token streaming | Activity trace carries liveness | Adapter-level streaming (large change) |

---

## 7. Quick smoke test

```console
$ curl -s localhost:8000/health
$ curl -N -X POST localhost:8000/run \
    -H 'content-type: application/json' \
    -d '{"query":"What documents do you have?"}'
$ curl -s localhost:8000/sessions | jq '.sessions[0]'
$ curl -s "localhost:8000/sessions/<id>/events?limit=5" | jq '.events[].type'
```

Use a project scaffolded with `reigner init --recipe document_qa` and ingested
(`reigner ingest`) as the reference backend during development.
