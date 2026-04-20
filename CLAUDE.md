# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

**talos-app** is an internal Next.js tool for generating versioned `.7z` archives (packages) for the Medoc software. The operator enters a version number (e.g. `3.3.3.1`), the app resolves the matching package folder, lists available JSON package definitions, and builds `.7z` archives from source resources.

## Rules

When you need a shadcn component, list it and I will download it manually.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run format       # Prettier (writes changes)
npm run typecheck    # TypeScript check (no emit)
```

## Environment Variables

Requires a `.env.local` file at the root:

```env
SRC_DIR=C:/path/to/src                # Source resources directory
OUTPUT_DIR_PROD=C:/path/to/output/prod # Where PROD archives are saved
OUTPUT_DIR_TEST=C:/path/to/output/test # Where TEST archives are saved
OUTPUT_DIR_DEV=C:/path/to/output/dev   # Where DEV archives are saved
PACKAGES_DIR=C:/path/to/packages       # Package definition JSON files
LDAP_API_URL=https://ldap-api...       # Base URL of the LDAP authentication API
```

These are validated at runtime via Zod in `lib/env.ts`.

## Architecture

### Routing (Next.js App Router only — never mix with Pages Router)

- `/` — Build page (version input + environment selector + package selection + real-time logs)
- `/packages` — JSON package editor (Monaco Editor)
- `/explorer` — SRC_DIR file browser
- `/history` — Build history
- `/releases` — Generated archives browser (list, move between envs, delete)
- `/login` — Login form (LDAP credentials)
- `/unauthorized` — Shown when user lacks required rights

### Middleware

`middleware.ts` protects all routes. Public paths: `/login`, `/unauthorized`, `/api/auth`, `/_next`, `/favicon.ico`. All others require a valid `talos_token` cookie or are redirected to `/login`.

### API Routes (`app/api/`)

| Route                                    | Method         | Purpose                                              |
| ---------------------------------------- | -------------- | ---------------------------------------------------- |
| `/api/auth/login`                        | POST           | LDAP login, sets auth + rights + refresh cookies     |
| `/api/auth/me`                           | GET            | Return current user profile from cookie              |
| `/api/auth/refresh`                      | POST           | Refresh access token using refresh_token cookie      |
| `/api/auth/logout`                       | POST           | Clear all auth cookies                               |
| `/api/versions`                          | GET            | List available versions in PACKAGES_DIR              |
| `/api/packages`                          | GET            | Resolve version + list packages (`?version=3.3.3.1`) |
| `/api/packages/[version]/[package]`      | GET/PUT/DELETE | Read/edit/delete a package JSON                      |
| `/api/build`                             | POST           | Start a build, returns `buildId` immediately         |
| `/api/build/active`                      | GET            | List currently running builds (cross-client)         |
| `/api/build-stream`                      | GET            | SSE stream of build logs (`?buildId=xxx`)            |
| `/api/history`                           | GET/DELETE     | List/delete past builds                              |
| `/api/history/[buildId]`                 | GET            | Get a single build record                            |
| `/api/history/[buildId]/data-logs`       | GET            | Get persisted logs for a completed build             |
| `/api/explorer`                          | GET/DELETE     | Browse/delete files in SRC_DIR                       |
| `/api/releases`                          | GET/DELETE     | List/delete package folders per env                  |
| `/api/releases/browse`                   | GET            | Browse output dir tree (`?env=&path=`)               |
| `/api/releases/move`                     | POST           | Move a package folder between environments           |

### Authentication & Rights (`lib/auth.ts`, `lib/api-auth.ts`)

Login proxies credentials to the LDAP API (`LDAP_API_URL`), fetches the user profile via `/api/v1/users/me`, and derives a `UserRights` object. Three cookies are set: `talos_token` (24h), `talos_refresh` (7d, optional), `talos_rights` (JSON-encoded rights, 24h).

Rights are derived from `adsion_droitsMps` LDAP attribute codes:
- `talos-read` — base access (required; without it all rights are false)
- `talos-build-prod`, `talos-build-test`, `talos-build-dev` — build per environment
- `talos-pkg-read/write/delete`, `talos-exp-read/write/delete`, `talos-history`
- `talos-releases-read`, `talos-releases-move`, `talos-releases-delete`

Admins (`isAdmin` / `isSuperuser` / `profiles.api[].isAdmin`) get all rights unconditionally.

API route protection uses `requireAuth(req, "canBuildTest")` from `lib/api-auth.ts`. It reads the `talos_token` and `talos_rights` cookies — no JWT decoding, rights are trusted from the cookie.

`lib/env.ts` exports `getOutputDir(env: Environment): string` to resolve the correct output directory for a given environment (`prod` | `test` | `dev`).

### Core Library (`lib/`)

- **`env.ts`** — Zod-validated env vars export; exports `Environment` type and `getOutputDir(env)`
- **`version-resolver.ts`** — Resolves `3.3.3.1` → `3.3.3` by progressively dropping version segments until a matching folder in PACKAGES_DIR is found
- **`placeholder-resolver.ts`** — Resolves `{version}`, `{version-1}` through `{version-4}` in strings; `{version-N}` = first N segments joined with dots
- **`archive-builder.ts`** — Main build orchestrator: creates temp dir, builds archives recursively, processes install section, cleans up
- **`source-resolver.ts`** — Resolves source file paths in SRC_DIR
- **`ini-generator.ts`** — Copies `.ini` from `SRC_DIR/inis/`, then patches specific keys using the `ini` npm package (preserves unchanged keys)
- **`build-logger.ts`** — In-memory log accumulator (`globalThis` singleton) that feeds SSE; entries cleaned after 1h
- **`running-builds.ts`** — File-based registry (`data/running-build.json`) of the active build; includes PID so stale files from prior server processes are auto-discarded
- **`history.ts`** — Reads/writes `data/history.json` and per-build `data/{buildId}/logs.json`
- **`log-colors.ts`** — Color utilities for log entry rendering

### Persistent State (`data/`)

`data/` is a local directory (gitignored) created at runtime:
- `data/history.json` — list of all `BuildRecord` objects
- `data/{buildId}/logs.json` — persisted log entries for each completed build
- `data/running-build.json` — currently active build (cleared on completion or server restart)

### Types (`types/`)

- **`package-schema.ts`** — Full TypeScript types for package JSON: `PackageDefinition`, `ArchiveDefinition`, `DirectoryNode`, `IniDefinition`, etc.
- **`build.ts`** — `BuildRecord`, `BuildState`, `LogEntry` types

### Key Build Logic

**Version resolution**: Splits version by `.`, tries full version first, then progressively drops the last segment until a matching directory is found in PACKAGES_DIR.

**Placeholder resolution**: `{version-3}` on version `3.3.3.1` → `3.3.3`. Windows path separators (`\\`) in JSON must be normalized via `path.join()` after resolution.

**Archive building** (recursive): nested archives are built first and included in the parent. `processDirectoryNode` applies sources in order: base directory copy → wdlls → dlls → files → inis → recursive child directories.

**`onlyContent: true`**: skips creating a subdirectory; copies source content directly into the current destination. Can be combined with `name` (reads from that source path) or without `name` (operates at current root).

**INI files**: copied from `SRC_DIR/inis/` then specific keys are patched. Only listed keys are modified; the rest of the file is preserved.

**SSE streaming**: `POST /api/build` starts the build in the background and returns a `buildId`. Client connects to `GET /api/build-stream?buildId=xxx` to receive log events (`log`, `warning`, `error`, `progress`, `done`). The in-memory log store (`build-logger.ts`) uses a `globalThis` singleton to survive Turbopack hot-reloads — see `docs/globalThis-singleton.md`.

## Key Conventions

- **Path handling**: Always use `path.join()` / `path.resolve()`, never string concatenation. Validate explorer paths stay within SRC_DIR to prevent path traversal.
- **Async only**: Use `fs/promises` exclusively — no synchronous `fs` calls.
- **Temp directories**: Write to `OUTPUT_DIR/TEMP_{uuid}/` during build, then move atomically. Always clean up in `try/finally`.
- **Build concurrency**: Only one build can run at a time; `running-builds.ts` enforces this across page reloads.
- **Zod validation**: Validate all API inputs and all JSON read from disk.
- **`globalThis` singletons**: Any module-level state shared across Next.js API routes must be anchored on `globalThis` (see `docs/globalThis-singleton.md`). Use `declare global { var __name: Type | undefined }` for TypeScript compatibility.
- **External dependency**: `7z` CLI must be installed and in PATH (Windows: install 7-Zip and add `C:\Program Files\7-Zip\` to system PATH). Called via `execa`.
- **Formatting**: No semicolons, double quotes, trailing commas (ES5). 80-char line width. Run `npm run format` before committing.
