/**
 * Manual test script for archive-builder.
 *
 * Usage:
 *   npx tsx scripts/test-build.ts --package <path/to/package.json> --version <X.X.X.X>
 *
 * Optional overrides:
 *   --src-dir    <path>   Override SRC_DIR from .env.local
 *   --output-dir <path>   Override OUTPUT_DIR from .env.local
 *
 * Example:
 *   npx tsx scripts/test-build.ts --package data/packages/3.3.3/standard.json --version 3.3.3.1
 */

import fs from "fs/promises"
import path from "path"
import { buildPackage } from "../lib/archive-builder"
import { BuildLogger } from "../lib/build-logger"
import type { PackageDefinition } from "../types/package-schema"

// ─── Load .env.local ──────────────────────────────────────────────────────────

async function loadEnvLocal(): Promise<Record<string, string>> {
  const envPath = path.resolve(process.cwd(), ".env.local")
  const vars: Record<string, string> = {}
  try {
    const content = await fs.readFile(envPath, "utf-8")
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      vars[key] = val
    }
  } catch {
    // no .env.local — will rely on process.env or CLI args
  }
  return vars
}

// ─── Parse CLI args ───────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith("--")) {
        result[key] = next
        i++
      }
    }
  }
  return result
}

// ─── Console logger ───────────────────────────────────────────────────────────

const RESET = "\x1b[0m"
const COLORS = {
  log: "\x1b[37m",      // white
  warning: "\x1b[33m",  // yellow
  error: "\x1b[31m",    // red
  progress: "\x1b[36m", // cyan
  done: "\x1b[32m",     // green
}

function attachConsoleLogger(logger: BuildLogger): void {
  logger.subscribe((entry) => {
    const color = COLORS[entry.type] ?? RESET
    const time = new Date(entry.timestamp).toLocaleTimeString()
    if (entry.type === "progress" && entry.progress) {
      const { current, total } = entry.progress
      const pct = Math.round((current / total) * 100)
      const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5))
      console.log(`${color}[${time}] [progress] [${bar}] ${pct}% (${current}/${total})${RESET}`)
    } else {
      console.log(`${color}[${time}] [${entry.type}] ${entry.message}${RESET}`)
    }
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const envVars = await loadEnvLocal()

  // Merge: CLI args > process.env > .env.local
  const srcDir =
    args["src-dir"] ??
    process.env.SRC_DIR ??
    envVars.SRC_DIR

  const outputDir =
    args["output-dir"] ??
    process.env.OUTPUT_DIR ??
    envVars.OUTPUT_DIR

  const packageArg = args["package"]
  const version = args["version"]

  // Validate required args
  const missing: string[] = []
  if (!packageArg) missing.push("--package")
  if (!version) missing.push("--version")
  if (!srcDir) missing.push("SRC_DIR (--src-dir or .env.local)")
  if (!outputDir) missing.push("OUTPUT_DIR (--output-dir or .env.local)")

  if (missing.length > 0) {
    console.error(`\x1b[31mMissing required arguments:\x1b[0m\n  ${missing.join("\n  ")}`)
    process.exit(1)
  }

  // Load package JSON
  const packagePath = path.resolve(process.cwd(), packageArg!)
  let packageDef: PackageDefinition
  try {
    const raw = await fs.readFile(packagePath, "utf-8")
    packageDef = JSON.parse(raw) as PackageDefinition
  } catch (err) {
    console.error(`\x1b[31mFailed to load package JSON "${packagePath}": ${err}\x1b[0m`)
    process.exit(1)
  }

  console.log(`\x1b[36m`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  test-build`)
  console.log(`  package : ${packagePath}`)
  console.log(`  version : ${version}`)
  console.log(`  src-dir : ${srcDir}`)
  console.log(`  out-dir : ${outputDir}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`\x1b[0m`)

  const logger = new BuildLogger()
  attachConsoleLogger(logger)

  try {
    // resolvedVersion = version without last segment if 4-part, otherwise as-is
    // (simplified: pass the same version for both; adjust if you use version-resolver)
    const resolvedVersion = version!.split(".").slice(0, 3).join(".")

    await buildPackage(
      packageDef,
      resolvedVersion,
      version!,
      srcDir!,
      outputDir!,
      logger,
      "test-build"
    )
    logger.done()
    console.log(`\n\x1b[32mDone.\x1b[0m`)
  } catch (err) {
    console.error(`\n\x1b[31mBuild failed: ${err}\x1b[0m`)
    process.exit(1)
  }
}

main()
