# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser chat client for [Reigner](https://github.com/Construct-Lab/reigner) agents served with `reigner serve --http` (FastAPI, SSE). It is also a reference implementation that other developers copy, so the event-handling code must stay readable. The repo is an early scaffold: `src/App.tsx` only renders the logo.

## Commands

Use npm (`package-lock.json` is the lockfile).

- `npm run dev`: Vite dev server at http://localhost:5173
- `npm run build`: `tsc -b` type-check, then `vite build` into `dist/`
- `npm run lint`: oxlint (config in `.oxlintrc.json`)
- `npm run preview`: serve the production build

There is no test runner yet. `npm run build` is the type-check.

To run against a real backend, start a Reigner project with:

```bash
reigner serve --http --cors-origin http://localhost:5173
```

The origin must match exactly, with no trailing slash. A browser cannot tell a CORS rejection apart from a server that is down, so "unreachable" with a running server usually means a missing `--cors-origin`.

### Local test backend

`dev/` is gitignored and holds Reigner projects used for testing. `dev/indialaw/` is a copy of the India-law project from the Reigner repo, already ingested, with saved sessions. Its `.env` holds real API keys. Start it with the Reigner checkout's virtualenv (it has the `server` extra):

```bash
cd dev/indialaw && ../../../reigner/.venv/bin/reigner serve --http --port 8000 --cors-origin http://localhost:5173
```

`/health`, `/sessions` and `/sessions/{id}/events` make no model calls. `POST /run` calls a paid model (`openai/gpt-5.5`), so ask the user before sending one.

## Key references

- `docs/frontend-client-handoff.md`: the HTTP API (`/health`, `POST /run`, `/sessions`, `/sessions/{id}/events`), the event protocol, the v1 feature list, and the server's known gaps. The real source of truth is in the [Reigner repo](https://github.com/Construct-Lab/reigner): [`reigner/server/fastapi_app.py`](https://github.com/Construct-Lab/reigner/blob/main/reigner/server/fastapi_app.py) for the endpoints and [`reigner/harness/events.py`](https://github.com/Construct-Lab/reigner/blob/main/reigner/harness/events.py) for the event types. Read them with `gh api repos/Construct-Lab/reigner/contents/<path> --jq .content | base64 -d`. Per-tool step summaries to port live in [`reigner/cli/_tool_summary.py`](https://github.com/Construct-Lab/reigner/blob/main/reigner/cli/_tool_summary.py).
- `docs/design/mockup.html`: the interactive design. Layout, color tokens, type and component states come from here. `src/index.css` holds the same tokens.

## Architecture

From the handoff brief:

- **Event layer, independent of React.** A typed `Event` union (discriminated on `type`), an SSE parser over `fetch` (`EventSource` can't POST), and a pure reducer `(rounds, event) → rounds`. Live streams and replayed `/sessions/{id}/events` go through the same reducer and renderer.
- **Streams are not token streams.** The answer arrives whole in `final_answer`. Liveness comes from `tool_call` / `tool_result` / `citation` events. Pair calls and results by `call_id`, never by order. Ignore unknown event types.
- **Stop = abort the fetch.** The server stops the run on disconnect. Never send two `/run` requests for the same `session_id` at once, because the server has no lock.
- **Multiple backends.** One server is one agent. Users add backends by URL; the list lives in browser storage, each entry is polled via `/health`, and sessions are scoped to their backend (planned URL shape `/b/{backendId}/s/{sessionId}`).
- **Pseudo-tools** (`register_citation`, `request_clarification`, `escalate_to_oracle`, `stop`, `save_note`) are hidden from the activity trace unless a verbose mode is on.

## Working rules

- For a feature you haven't built before (SSE parsing, Markdown rendering, routing), search GitHub and npm for existing implementations first. Compare two or three approaches in a short note, then build. Prefer a maintained library over hand-rolled code unless the dependency cost is higher than the code.
- When two approaches are both correct, choose the one that is better for the end user, then for the developer who maintains it, then for the next agent that reads it (greppable names, one obvious entry point, scripts instead of steps that live only in someone's head). If those pull in different directions, name the trade-off in your reply. "Don't break anything" means `npm run build` and `npm run lint` pass, and saved backends, stored data and URL shapes stay compatible unless the task says otherwise.
- Before saying a task is done, run `npm run build` and `npm run lint` and report what ran and what passed. If you could not run a check, say so plainly. Never write "should work" in place of a result.
- Change only what the task needs. No drive-by refactors, renames, reformatting, or dependency bumps. If you spot an unrelated problem, mention it at the end of your reply instead of fixing it.
- If a requirement can be read two ways and the readings lead to different code, ask one question before building. If the choice is low-stakes or easy to reverse, pick the conventional option and say which one you picked.
- Write the simplest code that solves the task. No abstractions, config options, or fallback paths for cases the task doesn't have. Three similar lines are better than a premature helper.
- Cut taglines, helper text, and secondary labels. If a screen needs them to make sense, fix the layout instead. Every visible string must be the label, the data, or the error.
- Never edit this file to make it match what you just did. If a rule here is wrong or blocks the task, stop and propose the change to the user.

## Don't touch

- `dist/`: build output, regenerate with `npm run build`.
- `docs/frontend-client-handoff.md` mirrors the Reigner repo. Update it from upstream instead of editing the contract here.
