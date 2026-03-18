# Cahier des Charges — Application de Génération de Packages

> **Projet** : Outil interne de génération d'archives `.7z` versionnées
> **Stack** : Next.js (App Router), TypeScript, Node.js backend
> **Réseau** : Local uniquement — pas d'authentification requise
> **Date** : Mars 2026

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique](#2-stack-technique)
3. [Configuration environnement](#3-configuration-environnement)
4. [Structure du projet Next.js](#4-structure-du-projet-nextjs)
5. [Structure du répertoire source (SRC_DIR)](#5-structure-du-répertoire-source-src_dir)
6. [Format des fichiers JSON de packages](#6-format-des-fichiers-json-de-packages)
7. [Algorithme de résolution de version](#7-algorithme-de-résolution-de-version)
8. [Algorithme de résolution des placeholders](#8-algorithme-de-résolution-des-placeholders)
9. [Algorithme de construction des archives](#9-algorithme-de-construction-des-archives)
10. [API Routes (Backend)](#10-api-routes-backend)
11. [Interface utilisateur (Frontend)](#11-interface-utilisateur-frontend)
12. [Logs en temps réel](#12-logs-en-temps-réel)
13. [Bonnes pratiques](#13-bonnes-pratiques)
14. [Exemples annotés](#14-exemples-annotés)

---

## 1. Vue d'ensemble

L'application permet de générer automatiquement des archives `.7z` versionnées pour le logiciel **Medoc**. L'opérateur saisit un numéro de version (ex. `3.3.3.1`), l'application résout le dossier de packages correspondant, lit les fichiers JSON de définition, puis construit chaque archive en allant chercher les ressources dans un répertoire source configuré.

### Flux principal

```
[Opérateur saisit "3.3.3.1"]
        │
        ▼
[Résolution de version]
  3.3.3.1 → packages/3.3.3.1/ ? non
  3.3.3   → packages/3.3.3/   ? oui ✓
        │
        ▼
[Liste des packages disponibles]
  install_complete.json
  install_distante.json
  maj_auto.json
  maj_manuelle.json
        │
        ▼
[Sélection par l'opérateur]
        │
        ▼
[Construction des archives]
  → Résolution des placeholders
  → Copie des sources (files, directories, wdlls, dlls)
  → Génération des .ini
  → Création des archives imbriquées (7z)
  → Création de l'archive parente (7z)
  → Copie des fichiers install/ dans OUTPUT_DIR
        │
        ▼
[Archives disponibles dans OUTPUT_DIR]
```

---

## 2. Stack technique

| Couche            | Technologie                                    | Justification                                      |
| ----------------- | ---------------------------------------------- | -------------------------------------------------- |
| Framework         | **Next.js (App Router)**                       | SSR + API Routes dans un seul projet               |
| Langage           | **TypeScript strict**                          | Typage fort pour les schémas JSON complexes        |
| UI                | **Tailwind CSS + shadcn/ui**                   | Composants accessibles, rapides à intégrer         |
| Éditeur JSON      | **Monaco Editor** (via `@monaco-editor/react`) | Coloration syntaxique, validation JSON             |
| Compression       | appel CLI `7z` via `execa`                     | Création d'archives `.7z`                          |
| Logs temps réel   | **Server-Sent Events (SSE)**                   | Simple, natif HTTP, pas besoin de WebSocket        |
| Gestion d'état    | **Zustand** ou `useState`/`useContext`         | Léger, suffisant pour ce cas d'usage               |
| Validation schéma | **Zod**                                        | Validation des JSON de packages et des entrées API |
| INI files         | **ini** (npm package)                          | Sérialisation/lecture de fichiers `.ini`           |
| Gestion fichiers  | **fs/promises** (Node.js natif)                | Lecture/écriture/suppression de fichiers           |

> **Note** : Utiliser exclusivement l'**App Router** de Next.js. Ne pas mélanger Pages Router et App Router.

---

## 3. Configuration environnement

### Fichier `.env.local`

```env
# Répertoire contenant les ressources sources
SRC_DIR=C:/chemin/vers/src

# Répertoire de sortie des archives générées
OUTPUT_DIR=C:/chemin/vers/output

# Répertoire contenant les dossiers de packages JSON
PACKAGES_DIR=C:/chemin/vers/packages
```

> **Règle** : Toutes les variables d'environnement sensibles aux chemins doivent utiliser des **slashes forward** (`/`) ou être normalisées avec `path.normalize()` au moment de leur lecture. Ne jamais faire confiance à la valeur brute de `process.env` pour des opérations de fichiers.

### Validation au démarrage

Créer un fichier `src/lib/env.ts` qui valide et exporte les variables d'environnement via **Zod** :

```ts
// src/lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  SRC_DIR: z.string().min(1),
  OUTPUT_DIR: z.string().min(1),
  PACKAGES_DIR: z.string().min(1),
});

export const env = envSchema.parse({
  SRC_DIR: process.env.SRC_DIR,
  OUTPUT_DIR: process.env.OUTPUT_DIR,
  PACKAGES_DIR: process.env.PACKAGES_DIR,
});
```

---

## 4. Structure du projet Next.js

```
src/
├── app/
│   ├── layout.tsx                  # Layout racine
│   ├── page.tsx                    # Page principale (build)
│   ├── history/
│   │   └── page.tsx                # Historique des builds
│   ├── packages/
│   │   └── page.tsx                # Gestion des fichiers JSON
│   ├── explorer/
│   │   └── page.tsx                # Explorateur SRC_DIR
│   └── api/
│       ├── versions/
│       │   └── route.ts            # GET  — liste des versions disponibles
│       ├── packages/
│       │   ├── route.ts            # GET  — liste des packages d'une version
│       │   ├── [version]/
│       │   │   └── [package]/
│       │   │       └── route.ts    # GET/PUT/DELETE — lecture/édition/suppression d'un JSON
│       ├── build/
│       │   └── route.ts            # POST — lancer un build
│       ├── build-stream/
│       │   └── route.ts            # GET  — SSE stream de logs d'un build
│       ├── history/
│       │   └── route.ts            # GET  — historique des builds
│       └── explorer/
│           └── route.ts            # GET/POST/DELETE — navigation SRC_DIR
│
├── lib/
│   ├── env.ts                      # Variables d'environnement validées
│   ├── version-resolver.ts         # Algorithme de résolution de version
│   ├── placeholder-resolver.ts     # Résolution des {version-N}
│   ├── archive-builder.ts          # Orchestrateur principal de build
│   ├── source-resolver.ts          # Résolution des chemins sources
│   ├── ini-generator.ts            # Génération de fichiers .ini
│   └── build-logger.ts             # Système de logs avec SSE
│
├── types/
│   ├── package-schema.ts           # Types TypeScript du schéma JSON
│   └── build.ts                    # Types pour les builds et logs
│
└── components/
    ├── BuildForm.tsx               # Formulaire version + sélection packages
    ├── BuildLogs.tsx               # Affichage logs temps réel
    ├── PackageEditor.tsx           # Éditeur Monaco JSON
    ├── FileExplorer.tsx            # Explorateur de fichiers SRC_DIR
    └── BuildHistory.tsx            # Liste des builds passés
```

---

## 5. Structure du répertoire source (SRC_DIR)

```
SRC_DIR/
├── wdlls/
│   ├── 24/          # Contenu copié entièrement quand wdlls[].version = 24
│   └── 27/          # Contenu copié entièrement quand wdlls[].version = 27
│
├── dlls/
│   ├── core/        # Contenu copié entièrement quand dlls[].name = "core"
│   └── 3.3.3/       # Contenu copié entièrement quand dlls[].name = "{version-3}" résolu
│
├── directories/
│   ├── Modeles/           # Dossier commun (toutes versions)
│   ├── Medoc/             # Base commune, écrasée par la version spécifique
│   ├── Tbl_Paramètres/    # Base commune
│   ├── 3.3/               # Ressources spécifiques à la version 3.3.x
│   ├── 3.3.2/             # Ressources spécifiques à la version 3.3.2.x
│   └── 3.3.3/
│       ├── Medoc/         # Override version-spécifique de Medoc/
│       ├── Tbl_Paramètres/
│       └── Geographie/
│
├── files/
│   ├── JournalEvenement.wdk   # Fichier sans préfixe version
│   ├── MessageMap.dll
│   ├── 3.3/
│   │   ├── Install.exe
│   │   ├── InstallMaj.exe
│   │   └── _HFCS.ZIP
│   └── inis/                  # Fichiers .ini de référence (non utilisés en template)
│       ├── InstallMaj.ini
│       ├── NEWVERSION.ini
│       └── VERSION.ini
│
└── install/                   # Sources pour la section "install" du JSON
    ├── directories/
    ├── files/
    └── wdlls/
```

### Règles de résolution des sources

| Type                 | Chemin dans SRC_DIR     | Résolution                                  |
| -------------------- | ----------------------- | ------------------------------------------- |
| `wdlls[].version`    | `wdlls/{version}/`      | Copier **tout le contenu** du dossier       |
| `dlls[].name`        | `dlls/{name}/`          | Copier **tout le contenu** du dossier       |
| `directories[].name` | `directories/{name}/`   | Voir section 9                              |
| `files[]`            | `files/{chemin_résolu}` | Copier le fichier à la destination courante |
| `install.*`          | `install/{type}/`       | Voir section 9.4                            |

> **Important** : Les placeholders `{version-N}` dans les noms/chemins sont résolus **avant** toute opération sur le système de fichiers.

---

## 6. Format des fichiers JSON de packages

### Schéma TypeScript complet

```ts
// src/types/package-schema.ts

export interface PackageDefinition {
  /** Nom de l'output — utilisé comme nom de dossier dans OUTPUT_DIR */
  output: string;

  /** Fichiers/dossiers à copier directement dans le dossier output (hors archives) */
  install?: InstallSection;

  /** Tableau d'archives à construire */
  archives: ArchiveDefinition[];
}

export interface InstallSection {
  files?: string[];
  wdlls?: WdllsEntry[];
  directories?: DirectoryNode[];
}

export interface ArchiveDefinition {
  /** Nom de l'archive (sans extension) */
  name: string;

  /** Extension de l'archive : toujours "7z" */
  extension: "7z";

  /** Contenu wdlls à inclure à la racine de cette archive */
  wdlls?: WdllsEntry[];

  /** Contenu dlls à inclure à la racine de cette archive */
  dlls?: DllsEntry[];

  /** Arborescence de dossiers à construire dans l'archive */
  directories?: DirectoryNode[];

  /** Fichiers individuels à copier à la racine de l'archive */
  files?: string[];

  /** Fichiers .ini à générer à la racine de l'archive */
  inis?: IniDefinition[];

  /** Archives imbriquées — construites EN PREMIER, incluses dans cette archive */
  archives?: ArchiveDefinition[];
}

export interface DirectoryNode {
  /**
   * Nom/chemin du dossier.
   * - Définit le nom du dossier DANS l'archive
   * - Définit aussi le chemin SOURCE dans SRC_DIR/directories/{name}/
   * - Peut contenir des placeholders : {version}, {version-2}, etc.
   * - Peut être absent si onlyContent: true (→ racine courante)
   */
  name?: string;

  /**
   * Si true :
   * - Ne crée PAS un sous-dossier dans l'archive
   * - Le contenu de SRC_DIR/directories/{name}/ est copié à la DESTINATION COURANTE
   * - Si name est absent, s'applique directement à la racine
   */
  onlyContent?: boolean;

  /** Sous-dossiers récursifs */
  directories?: DirectoryNode[];

  /** Contenu wdlls à ajouter dans ce dossier */
  wdlls?: WdllsEntry[];

  /** Contenu dlls à ajouter dans ce dossier */
  dlls?: DllsEntry[];

  /** Fichiers individuels à copier dans ce dossier */
  files?: string[];

  /** Fichiers .ini à générer dans ce dossier */
  inis?: IniDefinition[];
}

export interface WdllsEntry {
  /** Numéro de version du dossier wdlls : SRC_DIR/wdlls/{version}/ */
  version: number;
}

export interface DllsEntry {
  /** Nom du dossier dlls : SRC_DIR/dlls/{name}/ */
  name: string;
}

export interface IniDefinition {
  /** Nom du fichier .ini à générer */
  name: string;
  sections: IniSection[];
}

export interface IniSection {
  name: string;
  keys: IniKey[];
}

export interface IniKey {
  name: string;
  /** Peut contenir des placeholders {version}, {version-N} */
  value: string;
}
```

### Exemples de cas particuliers

#### `onlyContent: true` avec `name`

```json
{ "name": "{version-3}\\Medoc", "onlyContent": true }
```

→ Résolution : `{version-3}` = `3.3.3`
→ Source : `SRC_DIR/directories/3.3.3/Medoc/`
→ Les fichiers sont copiés **dans le dossier courant** (pas dans `3.3.3/Medoc/`)

#### `onlyContent: true` sans `name`

```json
{ "onlyContent": true, "directories": [...] }
```

→ Pas de dossier cible créé, les éléments enfants sont traités **à la racine courante**

#### Dossier avec base commune + override versionné

```json
{
  "name": "Medoc",
  "wdlls": [{ "version": 27 }],
  "directories": [{ "name": "{version-3}\\Medoc", "onlyContent": true }],
  "dlls": [{ "name": "core" }, { "name": "{version-3}" }]
}
```

→ Ordre de traitement dans `Medoc/` :

1. Copier `SRC_DIR/directories/Medoc/` (base commune)
2. Ajouter le contenu de `SRC_DIR/wdlls/27/`
3. Ajouter le contenu de `SRC_DIR/dlls/core/`
4. Ajouter le contenu de `SRC_DIR/dlls/3.3.3/`
5. Copier le **contenu** de `SRC_DIR/directories/3.3.3/Medoc/` (écrase les fichiers communs)

---

## 7. Algorithme de résolution de version

```ts
// src/lib/version-resolver.ts

/**
 * Résout le dossier de packages pour une version donnée.
 * Exemple : "3.3.3.1" → tente 3.3.3.1, 3.3.3, 3.3, 3 dans cet ordre.
 * Retourne le premier dossier trouvé, ou null si aucun.
 */
async function resolvePackageFolder(
  version: string, // Ex: "3.3.3.1"
  packagesDir: string, // PACKAGES_DIR du .env
): Promise<{ folder: string; resolvedVersion: string } | null>;
```

### Logique pas à pas

```
version = "3.3.3.1"
segments = ["3", "3", "3", "1"]

Tentative 1 : join("3","3","3","1") = "3.3.3.1" → dossier existe ? non
Tentative 2 : join("3","3","3")     = "3.3.3"   → dossier existe ? oui ✓
              → retourner { folder: "PACKAGES_DIR/3.3.3", resolvedVersion: "3.3.3" }

Si aucun trouvé → retourner null (erreur à remonter au client)
```

> **Cas limite** : Si la version saisie contient un segment non numérique (ex: `3.3.3-beta`), retourner une erreur de validation avant d'entrer dans la boucle.

---

## 8. Algorithme de résolution des placeholders

```ts
// src/lib/placeholder-resolver.ts

/**
 * Résout les placeholders {version}, {version-1}, {version-2}, {version-3}, {version-4}
 * dans une chaîne donnée.
 *
 * {version}   → version complète            ex: "3.3.3.1"
 * {version-1} → 1 premier segment           ex: "3"
 * {version-2} → 2 premiers segments joints  ex: "3.3"
 * {version-3} → 3 premiers segments joints  ex: "3.3.3"
 * {version-4} → 4 premiers segments joints  ex: "3.3.3.1"
 */
function resolvePlaceholders(input: string, version: string): string;
```

### Table de résolution pour `version = "3.3.3.1"`

| Placeholder   | Résultat  |
| ------------- | --------- |
| `{version}`   | `3.3.3.1` |
| `{version-1}` | `3`       |
| `{version-2}` | `3.3`     |
| `{version-3}` | `3.3.3`   |
| `{version-4}` | `3.3.3.1` |

> **Attention aux séparateurs Windows** : Les chemins dans les JSON utilisent `\\` (ex: `{version-3}\\Medoc`). Après résolution des placeholders, normaliser avec `path.join()` ou `path.normalize()` avant utilisation.

---

## 9. Algorithme de construction des archives

### 9.1 Orchestrateur principal

```ts
// src/lib/archive-builder.ts

async function buildPackage(
  packageDef: PackageDefinition,
  version: string, // version résolue (ex: "3.3.3")
  inputVersion: string, // version saisie par l'opérateur (ex: "3.3.3.1")
  srcDir: string,
  outputDir: string,
  logger: BuildLogger,
): Promise<void>;
```

**Étapes :**

1. Créer un répertoire temporaire de travail : `OUTPUT_DIR/TEMP_{uuid}/`
2. Pour chaque archive dans `packageDef.archives` → appeler `buildArchive()`
3. Traiter la section `install` → appeler `processInstallSection()`
4. Nettoyer le répertoire temporaire
5. Logger la fin du build

### 9.2 Construction d'une archive (`buildArchive`)

```
buildArchive(archiveDef, version, srcDir, tempDir, logger)
  │
  ├── 1. Si archiveDef.archives[] non vide :
  │       Pour chaque archive imbriquée :
  │         → buildArchive(nestedArchive, ...) [récursif]
  │         → Le .7z résultant est placé dans tempDir/{archiveDef.name}/
  │
  ├── 2. Créer tempDir/{archiveDef.name}/ (dossier de staging)
  │
  ├── 3. processDirectoryNode(archiveDef, version, srcDir, stagingDir)
  │       (traite wdlls, dlls, directories, files, inis du niveau archive)
  │
  └── 4. Créer l'archive 7z :
          7z a {archiveDef.name}.{extension} {stagingDir}/*
          → Placer le .7z dans tempDir/
```

### 9.3 Traitement d'un nœud de répertoire (`processDirectoryNode`)

```
processDirectoryNode(node, version, srcDir, destDir, logger)
  │
  ├── A. Résoudre le placeholder dans node.name → resolvedName
  │
  ├── B. Déterminer la destination cible :
  │     - Si node.onlyContent = true OU node.name absent → target = destDir
  │     - Sinon → target = destDir/resolvedName
  │       Créer le dossier target si nécessaire
  │
  ├── C. Copier la source de base (si node.name défini) :
  │     sourcePath = SRC_DIR/directories/{resolvedName}/
  │     Si sourcePath existe → copyDir(sourcePath, target)
  │     [Note: les fichiers seront écrasés par les étapes suivantes]
  │
  ├── D. Traiter node.wdlls[] :
  │     Pour chaque { version: v } :
  │       sourcePath = SRC_DIR/wdlls/{v}/
  │       copyDir(sourcePath, target)
  │
  ├── E. Traiter node.dlls[] :
  │     Pour chaque { name: n } :
  │       resolvedDllName = resolvePlaceholders(n, version)
  │       sourcePath = SRC_DIR/dlls/{resolvedDllName}/
  │       copyDir(sourcePath, target)
  │
  ├── F. Traiter node.files[] :
  │     Pour chaque filePath :
  │       resolvedFilePath = resolvePlaceholders(filePath, version)
  │       sourcePath = SRC_DIR/files/{resolvedFilePath}
  │       fileName = path.basename(resolvedFilePath)
  │       copyFile(sourcePath, target/fileName)
  │
  ├── G. Traiter node.inis[] :
  │     Pour chaque iniDef :
  │       contenu = generateIni(iniDef, version)
  │       écrire dans target/{iniDef.name}
  │
  └── H. Traiter node.directories[] [récursif] :
        Pour chaque childNode :
          processDirectoryNode(childNode, version, srcDir, target, logger)
```

### 9.4 Section `install`

La section `install` décrit les fichiers/dossiers à copier **à côté** des archives (dans le dossier final de sortie), **non compressés**.

```
processInstallSection(installSection, version, srcDir, outputDir)
  │
  ├── destDir = OUTPUT_DIR/{output}/   (ex: OUTPUT_DIR/INSTALL COMPLETE/)
  │
  ├── Traiter install.files[] :
  │     sourcePath = SRC_DIR/install/files/{resolvedPath}
  │     copyFile(sourcePath, destDir/basename)
  │
  ├── Traiter install.wdlls[] :
  │     sourcePath = SRC_DIR/install/wdlls/{version}/
  │     copyDir(sourcePath, destDir)
  │
  └── Traiter install.directories[] :
        Pour chaque node :
          processDirectoryNode(node, version, SRC_DIR/install, destDir)
          [note: srcDir de base est SRC_DIR/install pour cette section]
```

### 9.5 Traitement des fichiers `.ini`

Les fichiers `.ini` **ne sont pas générés de zéro**. Ils sont **copiés depuis `SRC_DIR/files/inis/`** puis les valeurs définies dans le JSON sont **remplacées dans le fichier copié**. Le reste du fichier (clés fixes, sections non mentionnées) est conservé tel quel.

```ts
// src/lib/ini-generator.ts

async function processIni(
  iniDef: IniDefinition,
  version: string,
  srcDir: string,
  destPath: string
): Promise<void> {
  // 1. Copier SRC_DIR/files/inis/{iniDef.name} vers destPath
  // 2. Lire le fichier copié et le parser (package npm `ini`)
  // 3. Pour chaque section/clé définie dans iniDef.sections :
  //      - Résoudre les placeholders dans la valeur
  //      - Remplacer uniquement cette clé dans l'objet parsé
  // 4. Re-sérialiser et réécrire le fichier
  // Les clés absentes du JSON restent inchangées
}
```

**Exemple** : `SRC_DIR/files/inis/NEWVERSION.INI` contient :

```ini
[MEDOC]
VERSION=0.0.0.0
PATCH=0
SERVEUR=1

[HFSQL]
MAJEUR=29
MINEUR=0
```

Après traitement avec `{ "name": "VERSION", "value": "{version}" }` dans la section `MEDOC` :

```ini
[MEDOC]
VERSION=3.3.3.1   ← remplacé
PATCH=0           ← conservé tel quel
SERVEUR=1         ← conservé tel quel

[HFSQL]
MAJEUR=29         ← conservé tel quel
MINEUR=0          ← conservé tel quel
```

> **Note** : Utiliser le package `ini` pour parser/sérialiser afin de préserver la structure du fichier. Attention aux quotes automatiques selon les implémentations — valider que le format de sortie correspond bien au format attendu par l'application cible.

### 9.6 Gestion des erreurs de build

Chaque étape doit attraper les erreurs et les envoyer au logger **sans interrompre les autres packages**. Le build d'un package échoue proprement et log l'erreur. Les autres packages continuent.

Types d'erreurs à gérer :

- Fichier source introuvable → warning + log, continuer
- Dossier source introuvable → warning + log, continuer
- Erreur 7z → erreur fatale pour ce package
- Erreur d'écriture disque → erreur fatale pour ce package

---

## 10. API Routes (Backend)

Toutes les routes sont dans `src/app/api/`. Utiliser des **Route Handlers** Next.js (`route.ts`).

### `GET /api/versions`

Retourne la liste des versions disponibles dans `PACKAGES_DIR`.

```ts
// Response
{
  versions: string[]  // ["2.4.2", "2.4.3", "3.3.1", "3.3.2", "3.3.3"]
}
```

---

### `GET /api/packages?version=3.3.3.1`

Résout la version, retourne les packages disponibles.

```ts
// Response
{
  resolvedVersion: string,          // "3.3.3"  (version réellement trouvée)
  inputVersion: string,             // "3.3.3.1" (version saisie)
  packages: {
    name: string,                   // "install_complete"
    filename: string,               // "install_complete.json"
    output: string,                 // "INSTALL COMPLETE"
  }[]
}
// Error 404 si aucune version trouvée
```

---

### `GET /api/packages/[version]/[package]`

Retourne le contenu JSON d'un package.

```ts
// Response : le JSON brut du fichier
```

---

### `PUT /api/packages/[version]/[package]`

Met à jour le contenu d'un fichier JSON de package.

```ts
// Body : le JSON à écrire
// Response : { success: true }
// Validation Zod du schéma avant écriture
```

---

### `DELETE /api/packages/[version]/[package]`

Supprime un fichier JSON de package.

```ts
// Response : { success: true }
```

---

### `POST /api/build`

Lance un build. Retourne immédiatement un `buildId`.

```ts
// Body
{
  version: string,           // "3.3.3.1"
  packages: string[]         // ["install_complete", "maj_auto"]
}

// Response
{
  buildId: string,           // UUID du build
  resolvedVersion: string    // "3.3.3"
}
```

Le build s'exécute **en arrière-plan**. Les logs sont accessibles via SSE.

---

### `GET /api/build-stream?buildId=xxx`

Stream SSE des logs d'un build en cours.

```ts
// Chaque événement SSE :
data: {
  type: 'log' | 'error' | 'warning' | 'done' | 'progress',
  message: string,
  timestamp: string,
  progress?: { current: number, total: number }  // pour type: 'progress'
}
```

---

### `GET /api/history`

Retourne l'historique des builds (persisté dans un fichier JSON local).

```ts
// Response
{
  builds: {
    buildId: string,
    version: string,
    resolvedVersion: string,
    packages: string[],
    status: 'success' | 'error' | 'partial',
    startedAt: string,
    endedAt: string,
    outputDir: string
  }[]
}
```

---

### `GET /api/explorer?path=relative/path`

Liste le contenu d'un répertoire dans `SRC_DIR`.

```ts
// Response
{
  path: string,
  entries: {
    name: string,
    type: 'file' | 'directory',
    size?: number,
    modifiedAt?: string
  }[]
}
```

---

### `DELETE /api/explorer`

Supprime un fichier ou dossier dans `SRC_DIR`.

```ts
// Body : { path: string }
// Response : { success: true }
```

> **Sécurité** : Toutes les routes `explorer` doivent valider que le chemin résolu reste **à l'intérieur de `SRC_DIR`** (protection contre path traversal). Utiliser `path.resolve()` et vérifier que le résultat commence par `SRC_DIR`.

---

## 11. Interface utilisateur (Frontend)

### Page principale — Build (`/`)

**Composant `BuildForm`** :

1. **Champ version** : input texte avec validation format `X.X.X` ou `X.X.X.X` (regex)
2. **Bouton "Rechercher"** : appelle `GET /api/packages?version=...`
   - Affiche un indicateur si la version a été réduite (ex: "3.3.3.1 → résolu en 3.3.3")
   - Affiche la liste des packages disponibles avec cases à cocher (tous cochés par défaut)
3. **Bouton "Générer"** : appelle `POST /api/build`, active le stream SSE

**Composant `BuildLogs`** (visible dès le lancement) :

- Zone de logs scrollable avec coloration par type (info / warning / erreur)
- Barre de progression globale
- Bouton "Ouvrir le dossier output" une fois terminé (si possible via shell)

---

### Page Packages (`/packages`)

Gestion des fichiers JSON de définition.

- Sélecteur de version (liste déroulante depuis `GET /api/versions`)
- Liste des fichiers JSON du dossier sélectionné
- Actions : **Éditer** / **Dupliquer** / **Supprimer**
- Éditeur Monaco pour modifier le JSON directement
  - Validation syntaxique JSON en temps réel
  - Validation du schéma (via Zod côté client)
  - Bouton "Sauvegarder" → `PUT /api/packages/[version]/[package]`

---

### Page Explorateur SRC_DIR (`/explorer`)

Navigation dans l'arborescence de `SRC_DIR`.

- Navigation par breadcrumb (chemin cliquable)
- Listing fichiers/dossiers avec icônes
- Upload de fichiers (glisser-déposer ou bouton)
- Suppression de fichiers/dossiers (avec confirmation)
- Création de dossiers
- Affichage de la taille et date de modification

---

### Page Historique (`/history`)

- Liste des builds avec version, date, packages, statut (succès / erreur / partiel)
- Bouton pour afficher les logs de chaque build passé
- Indication du chemin OUTPUT_DIR du build

---

## 12. Logs en temps réel

### Architecture SSE

```
Client                          Server
  │                               │
  │  GET /api/build-stream?id=xxx │
  │ ─────────────────────────────>│
  │                               │  Build en cours dans buildRegistry[id]
  │  data: {"type":"log",...}      │
  │ <─────────────────────────────│
  │  data: {"type":"progress",...} │
  │ <─────────────────────────────│
  │  data: {"type":"done",...}     │
  │ <─────────────────────────────│
  │         [connection fermée]    │
```

### `BuildLogger`

```ts
// src/lib/build-logger.ts

class BuildLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  progress(current: number, total: number): void;
  done(): void;
}
```

Les logs sont **accumulés en mémoire** (Map<buildId, LogEntry[]>) pour permettre la reconnexion SSE si le client se reconnecte. Nettoyer les entrées après 1h.

---

## 13. Bonnes pratiques

### TypeScript

- Mode `strict: true` dans `tsconfig.json`
- Typer **tous** les retours de fonctions (pas de `any`)
- Utiliser Zod pour valider toutes les entrées API et tous les JSON lus depuis le disque
- Créer des types explicites pour chaque structure (voir `src/types/`)

### Gestion des fichiers

- Toujours utiliser `path.join()` et `path.resolve()` — jamais de concaténation de chaînes pour les chemins
- Normaliser les séparateurs Windows (`\\`) via `path.normalize()` après résolution des placeholders
- Opérations asynchrones uniquement (`fs/promises`, jamais `fs` synchrone)
- Nettoyer systématiquement les dossiers temporaires (même en cas d'erreur : `try/finally`)

### API Routes

- Retourner des codes HTTP appropriés (400 validation, 404 not found, 500 erreur interne)
- Wrapper chaque handler avec un bloc `try/catch` global
- Logger les erreurs serveur dans la console (jamais exposer les stack traces au client)

### Build

- Ne jamais écrire directement dans `OUTPUT_DIR` pendant la construction — utiliser un dossier temporaire, puis déplacer à la fin (opération atomique)
- Valider l'existence de `SRC_DIR` et `OUTPUT_DIR` au démarrage du serveur
- Empêcher deux builds simultanés pour le même package (verrou simple par Set<buildId en cours>)

### UI

- Afficher un état de chargement pour toutes les opérations asynchrones
- Confirmer avant toute suppression (fichier ou package JSON)
- Désactiver le bouton "Générer" si un build est déjà en cours pour cette version

---

## 14. Exemples annotés

### Exemple complet : `maj_auto.json` avec version `3.3.3.1`

**Version résolue** : `3.3.3` (dossier `packages/3.3.3/` trouvé)
**Input version pour les placeholders** : `3.3.3.1`

```
OUTPUT_DIR/MAJ_AUTO/
├── PackageInstall.7z              ← archive parente
│   ├── InstallMAJ.7z              ← archive imbriquée (construite en premier)
│   │   ├── 3.3.3.1/               ← depuis directories[0].name = "{version}" = "3.3.3.1"
│   │   │   ├── Medoc/
│   │   │   │   ├── [contenu SRC_DIR/directories/Medoc/]        ← base commune
│   │   │   │   ├── [contenu SRC_DIR/wdlls/27/]                 ← wdlls version 27
│   │   │   │   ├── [contenu SRC_DIR/dlls/core/]                ← dlls core
│   │   │   │   ├── [contenu SRC_DIR/dlls/3.3.3/]               ← dlls {version-3}=3.3.3
│   │   │   │   └── [contenu SRC_DIR/directories/3.3.3/Medoc/]  ← override onlyContent
│   │   │   ├── Modeles/
│   │   │   │   └── [contenu SRC_DIR/directories/Modeles/]
│   │   │   ├── Tbl_Paramètres/
│   │   │   │   ├── [contenu SRC_DIR/directories/Tbl_Paramètres/]
│   │   │   │   └── [contenu SRC_DIR/directories/3.3.3/Tbl_Paramètres/] ← override
│   │   │   └── 3.3/_HFCS.ZIP → placé comme _HFCS.ZIP
│   │   ├── 3.3/Install.exe    → placé comme Install.exe
│   │   ├── JournalEvenement.wdk
│   │   ├── Maj_Calcul_Contrat.exe
│   │   ├── 3.3/Medoc_Service.exe  → placé comme Medoc_Service.exe
│   │   ├── 3.3/Medoc_Service_Gestion.exe
│   │   ├── MessageMap.dll
│   │   ├── NEWVERSION.INI         ← généré depuis inis[]
│   │   └── VERSION.INI            ← généré depuis inis[]
│   ├── [contenu SRC_DIR/wdlls/27/]
│   ├── 3.3/InstallMaj.exe     → placé comme InstallMaj.exe
│   ├── 3.3/InstallServeur.exe → placé comme InstallServeur.exe
│   └── InstallMaj.ini             ← généré depuis inis[]
│       [MEDOC]
│       VERSION=3.3.3.1
│       PATCH=0
│       SERVEUR=1
```

### Contenu des fichiers `.ini` générés

**`NEWVERSION.INI`** (version `3.3.3.1`) :

```ini
[MEDOC]
VERSION=3.3.3.1

[HFSQL]
MAJEUR=29
MINEUR=0
```

**`VERSION.INI`** :

```ini
[VERSION]
MEDOC=3.3.3.1
SERVEUR=90A290076c
MANTA=29.0.134.0

[HFSQL]
MAJEUR=29
MINEUR=0
```

---

## Annexe A — Variables d'environnement complètes

```env
# .env.local

# Chemin absolu vers le répertoire des sources
SRC_DIR=C:/adsion/src

# Chemin absolu vers le répertoire de sortie des archives
OUTPUT_DIR=C:/adsion/output

# Chemin absolu vers le répertoire des packages JSON
PACKAGES_DIR=C:/adsion/packages
```

## Annexe B — Scripts npm recommandés

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

## Annexe C — Dépendances npm

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.0",
    "ini": "^4.1.0",
    "execa": "^9.0.0",
    "@monaco-editor/react": "^4.6.0",
    "zustand": "^4.5.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "@types/ini": "^1.3.0",
    "@types/uuid": "^10.0.0"
  }
}
```

> **Note sur `7z`** : Le binaire `7z` doit être installé sur le serveur et accessible dans le PATH. Sous Windows, installer [7-Zip](https://www.7-zip.org/) et ajouter `C:\Program Files\7-Zip\` au PATH système. L'application appelle `7z` via `execa` (pas de binding natif).
