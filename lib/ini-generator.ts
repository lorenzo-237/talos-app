import fs from "fs/promises"
import path from "path"
import ini from "ini"
import { resolvePlaceholders } from "./placeholder-resolver"
import type { IniDefinition } from "@/types/package-schema"

export async function processIni(
  iniDef: IniDefinition,
  version: string,
  srcDir: string,
  destPath: string
): Promise<void> {
  const sourcePath = path.join(srcDir, "inis", iniDef.name)

  // Copy source INI to destination
  await fs.mkdir(path.dirname(destPath), { recursive: true })
  await fs.copyFile(sourcePath, destPath)

  // Parse and patch
  const raw = await fs.readFile(destPath, "utf-8")
  const parsed = ini.parse(raw) as Record<string, Record<string, string>>

  for (const section of iniDef.sections) {
    if (!parsed[section.name]) {
      parsed[section.name] = {}
    }
    for (const key of section.keys) {
      parsed[section.name][key.name] = resolvePlaceholders(key.value, version)
    }
  }

  await fs.writeFile(destPath, ini.stringify(parsed), "utf-8")
}
