export interface PlaceholderContext {
  buildId?: string
  defaultOutput?: string
  cwdData?: string
  directories?: string
}

export function resolvePlaceholders(
  input: string,
  version: string,
  context?: PlaceholderContext
): string {
  const segments = version.split(".")
  let result = input
  result = result.replace(/\{version\}/g, version)
  for (let n = 1; n <= 4; n++) {
    result = result.replace(
      new RegExp(`\\{version-${n}\\}`, "g"),
      segments.slice(0, n).join(".")
    )
  }
  if (context?.buildId !== undefined) {
    result = result.replace(/\{buildId\}/g, context.buildId)
  }
  if (context?.defaultOutput !== undefined) {
    result = result.replace(/\{default_output\}/g, context.defaultOutput)
  }
  if (context?.cwdData !== undefined) {
    result = result.replace(/\{cwd_data\}/g, context.cwdData)
  }
  if (context?.directories !== undefined) {
    result = result.replace(/\{directories\}/g, context.directories)
  }
  return result
}
