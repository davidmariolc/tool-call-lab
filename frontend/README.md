# Asistente de IA · React + TypeScript + Vite+

This standalone frontend uses Vite+ 1.5.0 with React and TypeScript. The existing
FastAPI application in `../fastapi/` runs separately. Messages call its assistant
endpoint; replies combine an explanation with typed cards for notes, calculations,
weather, and tool errors.

## Setup

Use Node.js 24.13.0 (pinned in `.node-version`) and npm 11.21.0. Vite+ supports
Node.js `^22.18.0 || ^24.11.0 || >=26.0.0`. A global `vp` installation is optional.

```sh
cd frontend
npm ci
npm run check
npm test
npm run build
```

`npm run check` checks formatting, lint rules, and types. Tests use Vitest through
`vite-plus/test`, Testing Library, and jsdom. The interaction tests verify
suggestions, composing and sending messages, search, conversation history, privacy
preferences, and recovery from malformed browser storage.

## Development

Start the backend in a separate terminal. Set `GROQ_API_KEY` in
`fastapi/.env.local` (never in a frontend environment file):

```sh
cd fastapi
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 5001 --reload
```

Then start the frontend:

```sh
cd frontend
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:5001`. In production, route `/api` to
FastAPI on the same origin, or set `VITE_ASSISTANT_URL` to the full endpoint
URL and configure that backend to allow the frontend origin via CORS. Vite's dev
proxy is not part of the production build.

Open the local URL printed by Vite+. Edit `src/App.tsx` to start building the app.
Use `npm run test:watch` for watch mode and `npm run preview` to preview the
production build in `dist/` after building.

## Vite+ commands

Without a global CLI, invoke the local toolchain through npm:

```sh
npm exec -- vp toolchain
npm exec -- vp check
npm exec -- vp test
npm exec -- vp build
npm exec -- vp dev
npm exec -- vp run build
```

`vp dev`, `vp test`, and `vp build` run built-in tools. `vp run <task>` runs the
matching package script or configured task. In this project, `vp run build`
also runs the template's TypeScript build step (`tsc -b`) before bundling.
Use the `packageManager` field to select npm for `vp install`, `vp add`, and
`vp remove`. In a local-only setup, `npm ci` installs the locked dependencies.

Vite+, React, lint, formatting, and test configuration lives in `vite.config.ts`.
The Vite alias and Vitest override in `package.json` keep plugins and tests on
the same toolchain versions. When upgrading Vite+, review those versions together.

See the [Vite+ guide](https://viteplus.dev/guide) and
[local CLI documentation](https://viteplus.dev/guide/local-cli).

## Interface behavior

- Spanish interface with a desktop sidebar and a mobile drawer.
- Three tool shortcuts for calculations (`calculate`), weather (`get_weather`), and note searches (`search_notes`), each loading an editable example prompt.
- Enter sends a message; Shift+Enter inserts a line break.
- Conversations are stored locally using a versioned storage schema. Search opens
  from the sidebar or Ctrl/Cmd+K. Preferences can disable storage or erase history.
- The composer accepts text only; document uploads are not available.
- The chat shows a pending state, prevents duplicate sends, and handles request
  failures. Responses go to their original conversation even after navigation.
- Typed cards are saved with the conversation. Old text-only history remains
  compatible; unknown or invalid cards are ignored while the explanation renders.
- Authentication and cloud history are not connected. The backend currently
  processes each prompt independently; browser history is not model memory.

## Assistant response contract

`POST /api/v1/assistant/chat` accepts `{ "prompt": "..." }` and returns:

```json
{
  "response": "El resultado es 1200.",
  "data": [{ "type": "calculation", "expression": "150 * 8", "result": "1200" }],
  "tools_used": ["calculate"]
}
```

`data` is an array so one reply can include several tool results. Its variants are
`notes` (`items`), `calculation` (`expression`, `result`), `weather` (location,
measurement time, temperature, humidity, wind, units, source), and `error`
(`tool`, `message`). Plain chat returns `data: []`. The backend constructs cards
from tool results; the model writes the explanation without regenerating card data.
Notes currently come from the backend's fictional sample collection. FastAPI's
`/docs` exposes the full discriminated response schema.

`tools_used` lists unique tool names in first-call order, including failed calls.
The UI displays these names above the reply and saves them in history. An empty
list means a direct response without tools; older messages without this metadata
show that tool usage was not recorded.

Backend contract checks use real SDK serialization with controlled HTTP responses:

```sh
cd fastapi
uv run python -m unittest discover -s tests -v
```

The design uses the taste-skill paper-grey-brass palette, Instrument Sans and DM Mono served
locally with their OFL licenses, and the original system and motion CSS. Vendored skill
files and design reports are excluded from application formatting and linting.
See `.taste-skill/plan.md` and `.taste-skill/verification.md` for the design decisions
and visual QA results.
