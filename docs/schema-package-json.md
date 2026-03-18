# Schéma des fichiers package JSON

## Structure complète

```ts
PackageDefinition {
  output: string              // Dossier de sortie dans OUTPUT_DIR
  install?: InstallSection    // Fichiers copiés hors archives
  archives: ArchiveDefinition[]
}
```

## ArchiveDefinition

```ts
ArchiveDefinition {
  name: string                // Nom de l'archive (sans extension)
  extension: "7z"
  wdlls?: WdllsEntry[]        // { version: number }
  dlls?: DllsEntry[]          // { name: string } — supporte placeholders
  directories?: DirectoryNode[]
  files?: string[]            // Chemins relatifs dans SRC_DIR/files/
  inis?: IniDefinition[]
  archives?: ArchiveDefinition[]  // Archives imbriquées (depth-first)
}
```

## DirectoryNode

Nœud réutilisé à la fois dans les archives et dans la section install.

```ts
DirectoryNode {
  name?: string           // Sous-dossier source + nom destination — supporte placeholders
  onlyContent?: boolean   // Si true, copie le contenu sans créer de sous-dossier
  wdlls?: WdllsEntry[]
  dlls?: DllsEntry[]
  files?: string[]
  inis?: IniDefinition[]
  directories?: DirectoryNode[]  // Enfants récursifs
}
```

## Exemple minimal

```json
{
  "output": "Medoc_3.3.3.1",
  "archives": [
    {
      "name": "Medoc",
      "extension": "7z",
      "directories": [
        {
          "name": "{version-3}\\Medoc",
          "wdlls": [{ "version": 14 }],
          "files": ["readme.txt"],
          "inis": [
            {
              "name": "config.ini",
              "sections": [
                {
                  "name": "General",
                  "keys": [{ "name": "Version", "value": "{version}" }]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "install": {
    "files": ["setup.exe"]
  }
}
```

## Structure SRC_DIR attendue

```
SRC_DIR/
  directories/          ← bases des DirectoryNode.name
    3.3.3/
      Medoc/
  wdlls/
    14/                 ← WdllsEntry.version
  dlls/
    MonDll/             ← DllsEntry.name (résolu)
  files/
    readme.txt          ← files[]
    inis/
      config.ini        ← IniDefinition.name
  install/
    files/
      setup.exe
```

## Validation à l'exécution

Les types TypeScript dans `types/package-schema.ts` servent de documentation. La validation Zod complète n'est pas appliquée sur les JSON lus depuis le disque (seulement un `JSON.parse`). Si une clé est manquante ou mal typée, le build échoue avec un `error` dans les logs.
