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
