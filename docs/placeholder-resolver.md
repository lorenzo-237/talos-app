# Résolution des placeholders

## Syntaxe

Les valeurs dans les JSON de packages peuvent contenir des placeholders qui sont résolus au moment du build.

| Placeholder | Résultat pour `3.3.3.1` |
|---|---|
| `{version}` | `3.3.3.1` |
| `{version-1}` | `3` |
| `{version-2}` | `3.3` |
| `{version-3}` | `3.3.3` |
| `{version-4}` | `3.3.3.1` |

`{version-N}` = les N premiers segments joints par `.`.

## Implémentation (`lib/placeholder-resolver.ts`)

```ts
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
```

Tous les remplacements sont globaux (flag `g`). L'ordre importe peu car les patterns sont distincts.

## Où les placeholders sont résolus

| Contexte | Champ concerné |
|---|---|
| `DirectoryNode.name` | Nom du sous-dossier dans la destination |
| `DllsEntry.name` | Nom du dossier dans `SRC_DIR/dlls/` |
| `files[]` | Chemin du fichier dans `SRC_DIR/files/` |
| `IniKey.value` | Valeur à patcher dans le fichier INI |
| `InstallSection.files[]` | Fichiers de la section install |

## Chemins Windows après résolution

Après `resolvePlaceholders()`, les chemins peuvent contenir des `\\` hérités du JSON. Le code systématiquement appelle :

```ts
path.join(destDir, ...path.normalize(resolvedName).split(path.sep))
```

pour reconstruire un chemin correct sur la plateforme hôte.

## Version utilisée : inputVersion

Les placeholders utilisent toujours la **version saisie par l'opérateur** (`inputVersion = "3.3.3.1"`), pas la version résolue (`resolvedVersion = "3.3.3"`). Cela permet d'inclure le 4ème segment dans les noms de dossiers si nécessaire.
