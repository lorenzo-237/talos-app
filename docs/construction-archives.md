# Construction des archives

## Vue d'ensemble

Le build d'un package est orchestré par `lib/archive-builder.ts`. Il prend une `PackageDefinition` (lue depuis un JSON) et produit un dossier de sortie contenant les archives `.7z` et les fichiers d'installation.

## Point d'entrée : `buildPackage()`

```
buildPackage(packageDef, resolvedVersion, inputVersion, srcDir, outputDir, logger)
  1. Crée un dossier temporaire : OUTPUT_DIR/TEMP_{uuid}/
  2. Itère sur packageDef.archives → buildArchive() pour chacun
  3. Si packageDef.install existe → processInstallSection()
  4. Déplace atomiquement TEMP_{uuid}/ → OUTPUT_DIR/{packageDef.output}/
  5. Nettoyage en try/finally (même en cas d'erreur)
```

## Récursion des archives : `buildArchive()`

Les archives peuvent être imbriquées (une archive contient d'autres archives). L'ordre de traitement est **depth-first** : les archives enfants sont construites en premier et leur `.7z` est placé dans le dossier de staging du parent.

```
buildArchive(archiveDef, ...)
  1. Crée TEMP/archiveDef.name/ (staging dir)
  2. Pour chaque archive imbriquée → buildArchive() récursif (résultat dans stagingDir)
  3. Remplit le staging dir via processDirectoryNode()
  4. Appelle 7z : 7z a archiveDef.name.7z stagingDir/*
  5. Supprime le staging dir
```

## Remplissage d'un dossier : `processDirectoryNode()`

Ordre d'application strict au sein de chaque nœud :

| Étape | Source dans SRC_DIR | Description |
|---|---|---|
| 1. Répertoire de base | `directories/{name}/` | Copie récursive du dossier source |
| 2. `wdlls` | `wdlls/{version}/` | DLLs Windows versionnées |
| 3. `dlls` | `dlls/{name}/` | DLLs spécifiques (nom avec placeholders) |
| 4. `files` | `files/{path}` | Fichiers individuels |
| 5. `inis` | `files/inis/{name}` | Fichiers INI copiés puis patchés |
| 6. `directories[]` | — | Nœuds enfants, récursion |

### Comportement de `onlyContent`

Par défaut, un nœud avec `name` crée un sous-dossier dans la destination. Avec `onlyContent: true`, le contenu est copié **directement dans le dossier courant** sans créer de sous-dossier intermédiaire.

```json
{ "name": "3.3.3\\Medoc", "onlyContent": true }
```
→ copie le contenu de `SRC_DIR/directories/3.3.3/Medoc/` directement dans destDir (pas de sous-dossier `Medoc`).

### Séparateurs Windows dans les noms

Les `name` dans le JSON peuvent contenir `\\` (chemins Windows). Le code normalise via `path.normalize()` puis `split(path.sep)` avant de passer à `path.join()`.

## Section `install`

Les fichiers d'installation ne sont **pas** compressés. Ils sont copiés directement dans `OUTPUT_DIR/{output}/` à côté des archives. La structure source est `SRC_DIR/install/` avec les mêmes sous-dossiers (`files/`, `wdlls/`, `directories/`).

## Appel à 7-Zip

```ts
await execa("7z", ["a", archivePath, path.join(stagingDir, "*")], { shell: true })
```

`shell: true` est nécessaire pour l'expansion du glob `*` sur Windows. `7z` doit être dans le PATH système.

## Gestion des erreurs

- Chaque copie de ressource (wdlls, dlls, files, inis, répertoire de base) est dans un try/catch individuel → erreur non bloquante loggée en `warning`
- L'échec d'une `buildArchive()` est bloquant pour le package courant → loggé en `error`, le status du build passe à `"partial"`
- Le dossier temporaire est toujours nettoyé dans le `finally`
