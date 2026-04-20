import { z } from "zod"

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const WdllsEntrySchema = z.object({
  version: z.number(),
})

export const DllsEntrySchema = z.object({
  name: z.string(),
})

export const IniKeySchema = z.object({
  name: z.string(),
  value: z.string(),
})

export const IniSectionSchema = z.object({
  name: z.string(),
  keys: z.array(IniKeySchema),
})

export const IniDefinitionSchema = z.object({
  name: z.string(),
  sections: z.array(IniSectionSchema),
})

// DirectoryNode is recursive — use z.lazy()
export const DirectoryNodeSchema: z.ZodType<DirectoryNode> = z.lazy(() =>
  z.object({
    name: z.string().optional(),
    onlyContent: z.boolean().optional(),
    wdlls: z.array(WdllsEntrySchema).optional(),
    dlls: z.array(DllsEntrySchema).optional(),
    files: z.array(z.string()).optional(),
    inis: z.array(IniDefinitionSchema).optional(),
    directories: z.array(DirectoryNodeSchema).optional(),
  })
)

// ArchiveDefinition is recursive — use z.lazy()
export const ArchiveDefinitionSchema: z.ZodType<ArchiveDefinition> = z.lazy(
  () =>
    z.object({
      name: z.string(),
      extension: z.literal("7z"),
      wdlls: z.array(WdllsEntrySchema).optional(),
      dlls: z.array(DllsEntrySchema).optional(),
      directories: z.array(DirectoryNodeSchema).optional(),
      files: z.array(z.string()).optional(),
      inis: z.array(IniDefinitionSchema).optional(),
      archives: z.array(ArchiveDefinitionSchema).optional(),
    })
)

export const ExecEntrySchema = z.object({
  name: z.string(),
  dir: z.string(),
  args: z.string(),
})

export const CallbacksDefinitionSchema = z.object({
  exec: z.array(ExecEntrySchema).optional(),
  actions: z.array(z.string()).optional(),
})

export const InstallSectionSchema = z.object({
  files: z.array(z.string()).optional(),
  wdlls: z.array(WdllsEntrySchema).optional(),
  directories: z.array(DirectoryNodeSchema).optional(),
})

export const PackageDefinitionSchema = z.object({
  output: z.string(),
  install: InstallSectionSchema.optional(),
  archives: z.array(ArchiveDefinitionSchema).optional(),
  directories: z.array(DirectoryNodeSchema).optional(),
  callbacks: CallbacksDefinitionSchema.optional(),
})

// ─── TypeScript interfaces ────────────────────────────────────────────────────

export interface PackageDefinition {
  output: string
  install?: InstallSection
  archives?: ArchiveDefinition[]
  directories?: DirectoryNode[]
  callbacks?: CallbacksDefinition
}

export interface CallbacksDefinition {
  exec?: ExecEntry[]
  actions?: string[]
}

export interface ExecEntry {
  name: string
  dir: string
  args: string
}

export interface InstallSection {
  files?: string[]
  wdlls?: WdllsEntry[]
  directories?: DirectoryNode[]
}

export interface ArchiveDefinition {
  name: string
  extension: "7z"
  wdlls?: WdllsEntry[]
  dlls?: DllsEntry[]
  directories?: DirectoryNode[]
  files?: string[]
  inis?: IniDefinition[]
  archives?: ArchiveDefinition[]
}

export interface DirectoryNode {
  name?: string
  onlyContent?: boolean
  directories?: DirectoryNode[]
  wdlls?: WdllsEntry[]
  dlls?: DllsEntry[]
  files?: string[]
  inis?: IniDefinition[]
}

export interface WdllsEntry {
  version: number
}

export interface DllsEntry {
  name: string
}

export interface IniDefinition {
  name: string
  sections: IniSection[]
}

export interface IniSection {
  name: string
  keys: IniKey[]
}

export interface IniKey {
  name: string
  value: string
}
