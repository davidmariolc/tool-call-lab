# Asistente de IA · React + TypeScript + Vite+

This standalone frontend uses Vite+ 1.5.0 with React and TypeScript. The existing
FastAPI application in `../fastapi/` runs separately; this interface does not yet
call its endpoints or an AI model. Responses are explicitly labeled as previews.

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

```sh
npm run dev
```

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
- Prompt suggestions for writing, brainstorming, learning, and coding.
- Enter sends a message; Shift+Enter inserts a line break.
- Conversations are stored locally using a versioned storage schema. Search opens
  from the sidebar or Ctrl/Cmd+K. Preferences can disable storage or erase history.
- Text attachments accept up to three `.txt` or `.md` files, up to 2 MB each. They
  remain local; no files or messages are sent to a server. The preview records file
  names with each message; it does not persist attachment contents.
- Assistant replies are fixed preview text. Real AI generation, authentication,
  cloud history, and document processing are not connected.

The design uses the taste-skill paper-grey-brass palette, Instrument Sans and DM Mono served
locally with their OFL licenses, and the original system and motion CSS. Vendored skill
files and design reports are excluded from application formatting and linting.
See `.taste-skill/plan.md` and `.taste-skill/verification.md` for the design decisions
and visual QA results.
