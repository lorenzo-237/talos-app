# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

**talos-app** is an internal Next.js tool for generating versioned `.7z` archives (packages) for the Medoc software. The operator enters a version number (e.g. `3.3.3.1`), the app resolves the matching package folder, lists available JSON package definitions, and builds `.7z` archives from source resources.

## Rules

When you need a shadcn components, list them and the I will download them manually

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
SRC_DIR=C:/path/to/src          # Source resources directory
OUTPUT_DIR=C:/path/to/output    # Where generated archives are saved
PACKAGES_DIR=C:/path/to/packages # Package definition JSON files
```

These are validated at runtime via Zod in `lib/env.ts`. All paths must use forward slashes or be normalized with `path.normalize()`.

## Architecture

### Routing (Next.js App Router only — never mix with Pages Router)

- `/` — Build page (version input + package selection + real-time logs)
- `/packages` — JSON package editor (Monaco Editor)
- `/explorer` — SRC_DIR file browser
- `/history` — Build history

### API Routes (`app/api/`)

| Route                               | Method         | Purpose                                              |
| ----------------------------------- | -------------- | ---------------------------------------------------- |
| `/api/versions`                     | GET            | List available versions in PACKAGES_DIR              |
| `/api/packages`                     | GET            | Resolve version + list packages (`?version=3.3.3.1`) |
| `/api/packages/[version]/[package]` | GET/PUT/DELETE | Read/edit/delete a package JSON                      |
| `/api/build`                        | POST           | Start a build, returns `buildId` immediately         |
| `/api/build-stream`                 | GET            | SSE stream of build logs (`?buildId=xxx`)            |
| `/api/history`                      | GET            | List past builds                                     |
| `/api/explorer`                     | GET/DELETE     | Browse/delete files in SRC_DIR                       |

### Core Library (`lib/`)

- **`env.ts`** — Zod-validated env vars export
- **`version-resolver.ts`** — Resolves `3.3.3.1` → `3.3.3` by progressively dropping version segments until a matching folder in PACKAGES_DIR is found
- **`placeholder-resolver.ts`** — Resolves `{version}`, `{version-1}` through `{version-4}` in strings; `{version-N}` = first N segments joined with dots
- **`archive-builder.ts`** — Main build orchestrator: creates temp dir, builds archives recursively, processes install section, cleans up
- **`source-resolver.ts`** — Resolves source file paths in SRC_DIR
- **`ini-generator.ts`** — Copies `.ini` from `SRC_DIR/files/inis/`, then patches specific keys using the `ini` npm package (preserves unchanged keys)
- **`build-logger.ts`** — In-memory log accumulator (Map<buildId, LogEntry[]>) that feeds SSE; entries cleaned after 1h

### Types (`types/`)

- **`package-schema.ts`** — Full TypeScript types for package JSON: `PackageDefinition`, `ArchiveDefinition`, `DirectoryNode`, `IniDefinition`, etc.
- **`build.ts`** — Build state and log entry types

### Key Build Logic

**Version resolution**: Splits version by `.`, tries full version first, then progressively drops the last segment until a matching directory is found in PACKAGES_DIR.

**Placeholder resolution**: `{version-3}` on version `3.3.3.1` → `3.3.3`. Windows path separators (`\\`) in JSON must be normalized via `path.join()` after resolution.

**Archive building** (recursive): nested archives are built first and included in the parent. `processDirectoryNode` applies sources in order: base directory copy → wdlls → dlls → files → inis → recursive child directories.

**`onlyContent: true`**: skips creating a subdirectory; copies source content directly into the current destination. Can be combined with `name` (reads from that source path) or without `name` (operates at current root).

**INI files**: copied from `SRC_DIR/files/inis/` then specific keys are patched. Only listed keys are modified; the rest of the file is preserved.

**SSE streaming**: `POST /api/build` starts the build in the background and returns a `buildId`. Client connects to `GET /api/build-stream?buildId=xxx` to receive log events (`log`, `warning`, `error`, `progress`, `done`).

### UI Components

- **`BuildForm`** — Version input (regex `X.X.X` or `X.X.X.X`) + package checkboxes + generate button
- **`BuildLogs`** — Scrollable log panel with color-coded types + progress bar
- **`PackageEditor`** — Monaco Editor with real-time JSON + Zod schema validation
- **`FileExplorer`** — SRC_DIR browser with breadcrumb, upload, delete, create folder
- **`BuildHistory`** — Past builds list with log replay

## Key Conventions

- **Path handling**: Always use `path.join()` / `path.resolve()`, never string concatenation. Validate explorer paths stay within SRC_DIR to prevent path traversal.
- **Async only**: Use `fs/promises` exclusively — no synchronous `fs` calls.
- **Temp directories**: Write to `OUTPUT_DIR/TEMP_{uuid}/` during build, then move atomically. Always clean up in `try/finally`.
- **Build concurrency**: Prevent two simultaneous builds for the same package using a `Set<string>` of active build IDs.
- **Zod validation**: Validate all API inputs and all JSON read from disk.
- **External dependency**: `7z` CLI must be installed and in PATH (Windows: install 7-Zip and add `C:\Program Files\7-Zip\` to system PATH). Called via `execa`.
- **No auth**: App is local-network only, no authentication required.
- **Formatting**: No semicolons, double quotes, trailing commas (ES5). 80-char line width. Run `npm run format` before committing.
