<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/assets/reigner-logo-dark.svg">
    <img alt="reigner" src="src/assets/reigner-logo-light.svg" width="300">
  </picture>
</p>

<p align="center"><strong>A reference chat client for <a href="https://github.com/Construct-Lab/reigner">Reigner</a> agents.</strong></p>

Reigner UI is a browser chat interface for any agent served with `reigner serve --http`.
Connect it to one or more Reigner servers, ask questions, watch the agent's retrieval
steps live, and check every answer against its cited sources.

It is also meant as a readable reference: if you are building your own frontend for
Reigner, the event-handling code here is written to be copied.

> **Status:** early scaffold. The design is in [`docs/design/mockup.html`](docs/design/mockup.html);
> the API contract the client targets is in [`docs/frontend-client-handoff.md`](docs/frontend-client-handoff.md).

## Features (planned for v1)

- Connect to several Reigner backends, switch between them, and see which are reachable
- Session sidebar with fork lineage and search
- Live retrieval trace: tool calls, results, cache and truncation badges
- Answers rendered as Markdown with a numbered, deduplicated source list
- Clarification questions with one-click candidate answers
- Stop a run mid-flight
- Token usage per answer
- Deep links to sessions, light and dark themes

## Requirements

- Node.js 20 or later
- A Reigner project served over HTTP, `reigner[server]>=0.12`

## Getting started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173.

### Connect a Reigner backend

In your Reigner project, start the server and allow the UI's origin:

```bash
reigner serve --http --cors-origin http://localhost:5173
```

Then add `http://localhost:8000` as a backend in the UI. Backends you add are saved in
your browser, so you can keep several agents and switch between them.

If a backend shows as unreachable while the server is running, the usual cause is a
missing or mismatched `--cors-origin`. The origin must match exactly, with no trailing
slash.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

## Project structure

```
reigner-ui/
├── docs/
│   ├── design/mockup.html          # Interactive design mockup
│   └── frontend-client-handoff.md  # Reigner HTTP API and event protocol
├── public/                         # Static files served as-is
├── src/
│   ├── assets/                     # Reigner logos
│   ├── App.tsx
│   ├── index.css                   # Design tokens
│   └── main.tsx
├── index.html
└── vite.config.ts
```

## Tech stack

[React](https://react.dev) 19, [TypeScript](https://www.typescriptlang.org),
[Vite](https://vite.dev), and [oxlint](https://oxc.rs).

## Related

- [Reigner](https://github.com/Construct-Lab/reigner): the agent harness this client talks to
- [Reigner documentation](https://construct-lab.github.io/reigner/)
