export function resolvePlaceholders(input: string, version: string): string {
  const segments = version.split(".")
  let result = input
  result = result.replace(/\{version\}/g, version)
  for (let n = 1; n <= 4; n++) {
    result = result.replace(
      new RegExp(`\\{version-${n}\\}`, "g"),
      segments.slice(0, n).join(".")
    )
  }
  return result
}
