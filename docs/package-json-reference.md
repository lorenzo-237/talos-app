# Référence — package JSON

Un fichier package JSON décrit tout ce que Talos doit assembler pour produire un **dossier de sortie** (le « package »).

---

## Structure racine

```json
{
  "output": "NOM_DU_DOSSIER",
  "install": { ... },
  "archives": [ ... ],
  "directories": [ ... ],
  "callbacks": { ... }
}
```

| Champ         | Obligatoire | Utilité                                                                       |
| ------------- | ----------- | ----------------------------------------------------------------------------- |
| `output`      | oui         | Nom du dossier de sortie créé dans le répertoire de l'environnement cible.    |
| `install`     | non         | Fichiers/wdlls copiés directement à la racine du package (section setup).     |
| `archives`    | non         | Liste des archives `.7z` à construire et déposer dans le package.             |
| `directories` | non         | Dossiers copiés directement à la racine du package (sans archivage).          |
| `callbacks`   | non         | Actions post-build : exécutables à lancer ou actions prédéfinies à appliquer. |

---

## Placeholders de version

Utilisables dans tous les champs `name`, `value`, `args`, etc.

| Placeholder   | Résultat sur `3.3.3.1`  | Utilité                                         |
| ------------- | ----------------------- | ----------------------------------------------- |
| `{version}`   | `3.3.3.1`               | Version complète telle que saisie.              |
| `{version-2}` | `3.3`                   | Les 2 premiers segments (majeur.mineur).        |
| `{version-3}` | `3.3.3`                 | Les 3 premiers segments (sans le patch final).  |
| `{version-4}` | `3.3.3.1`               | Identique à `{version}` (4 segments explicite). |

---

## Section `install`

```json
"install": {
  "files": [ "{version-2}\\InstallServeur.exe" ],
  "wdlls": [ { "version": 27 } ]
}
```

| Champ   | Utilité                                                                              |
| ------- | ------------------------------------------------------------------------------------ |
| `files` | Fichiers copiés depuis `SRC_DIR` directement à la racine du package (pas archivés). |
| `wdlls` | Runtimes WinDev (`.wdl`) de la version indiquée copiés à la racine du package.      |

---

## Section `archives`

Chaque entrée produit une archive `.7z` dans le package.

```json
{
  "name": "MonArchive",
  "extension": "7z",
  "wdlls": [ ... ],
  "dlls": [ ... ],
  "files": [ ... ],
  "inis": [ ... ],
  "directories": [ ... ],
  "archives": [ ... ]
}
```

| Champ         | Utilité                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| `name`        | Nom de l'archive (sans extension).                                                 |
| `extension`   | Toujours `"7z"`.                                                                   |
| `wdlls`       | Runtimes WinDev ajoutés à la racine de l'archive.                                  |
| `dlls`        | DLLs nommées copiées depuis `SRC_DIR/dlls/` à la racine de l'archive.             |
| `files`       | Fichiers copiés depuis `SRC_DIR` à la racine de l'archive.                         |
| `inis`        | Fichiers `.ini` copiés depuis `SRC_DIR/inis/` puis patchés (clés ciblées).         |
| `directories` | Dossiers inclus dans l'archive (voir DirectoryNode).                               |
| `archives`    | Archives imbriquées : construites en premier, incluses dans l'archive parente.     |

---

## DirectoryNode

Utilisable dans `archives[].directories`, `directories` racine, et récursivement dans d'autres `DirectoryNode`.

```json
{
  "name": "{version-3}\\Medoc",
  "onlyContent": true,
  "pickSubdir": { ... },
  "wdlls": [ ... ],
  "dlls": [ ... ],
  "files": [ ... ],
  "inis": [ ... ],
  "directories": [ ... ]
}
```

| Champ         | Utilité                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `name`        | Chemin relatif dans `SRC_DIR/directories/` (séparateur `\\`). Supporte les placeholders.          |
| `onlyContent` | Si `true`, copie le **contenu** du dossier source sans créer de sous-dossier intermédiaire.        |
| `pickSubdir`  | Sélection dynamique d'un sous-dossier versionné (voir ci-dessous).                                 |
| `wdlls`       | Runtimes WinDev ajoutés dans ce dossier de destination.                                            |
| `dlls`        | DLLs nommées copiées dans ce dossier de destination.                                               |
| `files`       | Fichiers individuels copiés dans ce dossier de destination.                                        |
| `inis`        | Fichiers `.ini` copiés depuis `SRC_DIR/inis/` puis patchés dans ce dossier de destination.         |
| `directories` | Sous-dossiers traités récursivement à l'intérieur de ce dossier de destination.                    |

### Ordre de traitement dans un DirectoryNode

1. Copie du dossier source de base (si `name` défini)
2. `wdlls`
3. `dlls`
4. `files`
5. `inis`
6. `directories` enfants (récursif)

### Combinaison `name` + `onlyContent: true`

```json
{ "name": "{version-3}\\Medoc", "onlyContent": true }
```

Lit depuis `SRC_DIR/directories/{version-3}/Medoc/` et copie le **contenu** directement dans le dossier parent de destination, sans créer de dossier `Medoc/`.

---

## `pickSubdir` — sélection d'un sous-dossier versionné

Permet de choisir dynamiquement un sous-dossier numérique à l'intérieur d'un répertoire source (ex. `TBL_CCAM/76/`).

```json
{
  "name": "TBL_CCAM",
  "pickSubdir": {
    "value": "$latest",
    "ini": "Version.ini",
    "section": "VERSION",
    "key": "MAJEUR",
    "destName": "TBL_CCAM"
  }
}
```

| Champ      | Utilité                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `value`    | Numéro de version entier (`"76"`) **ou** `"$latest"` pour prendre le sous-dossier le plus grand. |
| `ini`      | Fichier `.ini` situé **à l'intérieur** du sous-dossier sélectionné, utilisé pour vérification.   |
| `section`  | Section INI à lire pour la vérification.                                                          |
| `key`      | Clé INI dont la valeur doit correspondre au nom du sous-dossier (avertissement si différent).     |
| `destName` | Nom du dossier créé dans la destination.                                                          |

> **Note :** `name` est le chemin vers le dossier **parent** contenant les sous-dossiers versionnés (ex. `"TBL_CCAM"`). `pickSubdir` sélectionne ensuite l'un des sous-dossiers numériques à l'intérieur.

---

## `wdlls` — runtimes WinDev

```json
"wdlls": [ { "version": 27 } ]
```

| Champ     | Utilité                                                            |
| --------- | ------------------------------------------------------------------ |
| `version` | Numéro entier de la version WinDev ; copie les `.wdl` associés depuis `SRC_DIR`. |

---

## `dlls`

```json
"dlls": [ { "name": "core" }, { "name": "{version-3}" } ]
```

| Champ  | Utilité                                                                    |
| ------ | -------------------------------------------------------------------------- |
| `name` | Nom de la DLL (sans extension) à copier depuis `SRC_DIR/dlls/`. Supporte les placeholders. |

---

## `files`

```json
"files": [ "{version-2}\\Install.exe", "MessageMap.dll" ]
```

Chemins relatifs dans `SRC_DIR/`. Supporte les placeholders. Les séparateurs `\\` sont normalisés automatiquement.

---

## `inis` — fichiers de configuration patchés

```json
"inis": [
  {
    "name": "NEWVERSION.INI",
    "sections": [
      {
        "name": "MEDOC",
        "keys": [
          { "name": "VERSION", "value": "{version}" }
        ]
      }
    ]
  }
]
```

| Champ              | Utilité                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `name`             | Nom du fichier `.ini` copié depuis `SRC_DIR/inis/`.                                        |
| `sections[].name`  | Nom de la section INI à modifier (ex. `[MEDOC]`).                                          |
| `keys[].name`      | Clé à modifier dans la section.                                                            |
| `keys[].value`     | Nouvelle valeur à écrire ; supporte les placeholders. Les autres clés sont **préservées**. |

---

## Section `callbacks`

Actions déclenchées **après** la construction du package.

```json
"callbacks": {
  "exec": [
    {
      "name": "windev-forge.exe",
      "dir": "windows",
      "args": "-id={buildId} -action=generation-tables -output=\"{default_output}\""
    }
  ],
  "actions": [ "rename-minus" ]
}
```

### `exec`

| Champ  | Utilité                                                            |
| ------ | ------------------------------------------------------------------ |
| `name` | Nom de l'exécutable à lancer.                                      |
| `dir`  | Répertoire de travail (relatif à `SRC_DIR` ou chemin absolu).      |
| `args` | Arguments en ligne de commande. Supporte les placeholders spéciaux.|

### `actions`

| Valeur          | Utilité                                                |
| --------------- | ------------------------------------------------------ |
| `rename-minus`  | Action prédéfinie appliquée au dossier de sortie.      |

---

## Exemple minimal

```json
{
  "output": "MON_PACKAGE",
  "archives": [
    {
      "name": "Data",
      "extension": "7z",
      "files": [ "{version-2}\\Install.exe" ],
      "inis": [
        {
          "name": "VERSION.INI",
          "sections": [
            { "name": "MEDOC", "keys": [ { "name": "VERSION", "value": "{version}" } ] }
          ]
        }
      ]
    }
  ]
}
```

## Exemple avec `pickSubdir`

```json
{
  "output": "MON_PACKAGE",
  "archives": [
    {
      "name": "Data",
      "extension": "7z",
      "directories": [
        {
          "name": "TBL_CCAM",
          "pickSubdir": {
            "value": "$latest",
            "ini": "Version.ini",
            "section": "VERSION",
            "key": "MAJEUR",
            "destName": "TBL_CCAM"
          }
        }
      ]
    }
  ]
}
```
