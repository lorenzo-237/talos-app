# talos-app

Outil interne Next.js pour générer des archives `.7z` versionnées (packages) destinées au logiciel **Medoc**.

L'opérateur saisit un numéro de version, l'application résout le dossier de packages correspondant, liste les définitions JSON disponibles et produit les archives à partir des ressources sources.

---

## Prérequis

- **Node.js** ≥ 20
- **7-Zip** installé et présent dans le PATH système
  - Windows : installer [7-Zip](https://www.7-zip.org/) et ajouter `C:\Program Files\7-Zip\` au PATH
- Accès au serveur LDAP (API `LDAP_API_URL`)

---

## Installation

```bash
npm install
```

---

## Configuration

Créer un fichier `.env.local` à la racine :

```env
# Répertoire contenant les ressources sources (binaires, dlls, inis…)
SRC_DIR=C:/path/to/src

# Répertoire de sortie des archives générées
OUTPUT_DIR=C:/path/to/output

# Répertoire contenant les définitions JSON de packages, organisé par version
# Ex : PACKAGES_DIR/3.3.3/install_complete.json
PACKAGES_DIR=C:/path/to/packages

# URL de base de l'API LDAP d'authentification
LDAP_API_URL=https://ldap-api.example.com

# Secret HMAC pour signer le cookie des droits (min. 32 caractères)
RIGHTS_SECRET=changez-moi-par-une-chaine-aleatoire-longue
```

Pour générer un secret aléatoire :

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

> Toutes les variables sont validées au démarrage via Zod — l'application refuse de lancer si l'une d'elles est absente ou invalide.

---

## Démarrage

```bash
# Développement (Turbopack)
npm run dev

# Production
npm run build
npm run start
```

---

## Pages

| Route           | Rôle                                                          | Droit requis      |
| --------------- | ------------------------------------------------------------- | ----------------- |
| `/`             | Saisie de version, sélection de packages, build en temps réel | `canBuild`        |
| `/packages`     | Éditeur Monaco des fichiers JSON de packages                  | `canReadPackages` |
| `/explorer`     | Navigateur de fichiers dans `SRC_DIR`                         | `canReadExplorer` |
| `/history`      | Historique des builds passés                                  | `canViewHistory`  |
| `/login`        | Formulaire de connexion LDAP                                  | —                 |
| `/unauthorized` | Affiché si l'utilisateur n'a aucun droit Talos                | —                 |

---

## Authentification et droits

L'authentification passe par l'API LDAP (`LDAP_API_URL`). À la connexion, le profil utilisateur est récupéré et les droits sont dérivés des codes `adsion_droitsMps` :

| Code LDAP          | Droit activé                                   |
| ------------------ | ---------------------------------------------- |
| `talos-read`       | Droit de base — requis pour tout accès         |
| `talos-build`      | `canBuild` — lancer un build                   |
| `talos-pkg-read`   | `canReadPackages` — lire les JSON              |
| `talos-pkg-write`  | `canWritePackages` — modifier les JSON         |
| `talos-pkg-delete` | `canDeletePackages` — supprimer un JSON        |
| `talos-exp-read`   | `canReadExplorer` — parcourir `SRC_DIR`        |
| `talos-exp-write`  | `canWriteExplorer` — uploader dans `SRC_DIR`   |
| `talos-exp-delete` | `canDeleteExplorer` — supprimer dans `SRC_DIR` |
| `talos-history`    | `canViewHistory` — accéder à l'historique      |

Les admins (`isAdmin` / `isSuperuser` / profil API admin) obtiennent tous les droits sans restriction.

Trois cookies httpOnly sont posés à la connexion :

- `talos_token` — jeton d'accès (24 h)
- `talos_refresh` — jeton de rafraîchissement (7 j, si "Se souvenir de moi")
- `talos_rights` — droits signés HMAC-SHA256 (24 h)

> Les droits sont signés côté serveur avec `RIGHTS_SECRET`. Un cookie modifié manuellement est rejeté.

---

## Lancer un build

1. Saisir un numéro de version (ex. `3.3.3.1`) et cliquer **Rechercher**.
2. Sélectionner un ou plusieurs packages dans la liste.
3. Cliquer **Générer** — le build démarre en arrière-plan et les logs s'affichent en temps réel via SSE.
4. En cas de besoin, cliquer **Annuler** pour interrompre proprement le build entre deux packages.

Un seul build peut tourner à la fois. Toute tentative de lancer un doublon retourne une erreur 409.

### Résolution de version

Si le dossier `3.3.3.1` n'existe pas dans `PACKAGES_DIR`, l'application cherche `3.3.3`, puis `3.3`, etc. jusqu'à trouver un dossier existant. La version résolue est affichée dans l'UI (ex. `3.3.3.1 → 3.3.3`).

### Placeholders dans les JSON

Les chaînes des fichiers JSON peuvent contenir des placeholders résolus au moment du build :

| Placeholder   | Résultat pour `3.3.3.1` |
| ------------- | ----------------------- |
| `{version}`   | `3.3.3.1`               |
| `{version-1}` | `3`                     |
| `{version-2}` | `3.3`                   |
| `{version-3}` | `3.3.3`                 |
| `{version-4}` | `3.3.3.1`               |

---

## Définitions de packages (JSON)

Les packages sont des fichiers JSON dans `PACKAGES_DIR/<version>/`. Exemple minimal :

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

Voir [docs/schema-package-json.md](docs/schema-package-json.md) pour la référence complète du schéma.
Les JSON sont validés par un schéma Zod au démarrage de chaque build — une erreur de structure produit un message clair dans les logs plutôt qu'un crash en plein milieu.

### Structure attendue de SRC_DIR

```
SRC_DIR/
  directories/        ← bases copiées par DirectoryNode.name
    3.3.3/
      Medoc/
  wdlls/
    14/               ← WdllsEntry.version
  dlls/
    MonDll/           ← DllsEntry.name
  files/
    readme.txt
    inis/
      config.ini      ← IniDefinition.name
  install/
    files/
      setup.exe
```

---

## Structure du projet

```
app/
  api/                   ← Routes API Next.js
    auth/                ← login, logout, me, refresh
    build/               ← POST lancer un build, GET/DELETE build actif
    build-stream/        ← SSE flux de logs
    packages/            ← Lister / lire / écrire / supprimer les JSON
    explorer/            ← Navigateur SRC_DIR
    history/             ← Historique des builds
  (pages)/               ← /, /packages, /explorer, /history, /login, /unauthorized
components/
  build/                 ← PackageSelector, BuildLogs
  history/               ← Tableau d'historique
  ui/                    ← Composants shadcn/ui
contexts/
  auth-context.tsx       ← AuthProvider, useAuth, useRights
hooks/
  useBuildStream.ts      ← Gestion SSE + reconnexion + annulation
  usePackageSearch.ts    ← Fetch /api/packages
lib/
  api-auth.ts            ← requireAuth, sérialisation/vérification HMAC des droits
  api-fetch.ts           ← apiFetch — auto-refresh du token sur 401
  archive-builder.ts     ← Orchestrateur de build (archives, inis, callbacks)
  build-cancellation.ts  ← Registre coopératif d'annulation
  build-logger.ts        ← Accumulateur de logs en mémoire (singleton globalThis)
  env.ts                 ← Variables d'env validées par Zod
  history.ts             ← Lecture/écriture history.json
  ini-generator.ts       ← Copie + patch de fichiers INI
  placeholder-resolver.ts← Résolution {version}, {version-N}
  running-builds.ts      ← Registre fichier du build actif (data/running-build.json)
  source-resolver.ts     ← Résolution des chemins dans SRC_DIR
  version-resolver.ts    ← Résolution version saisie → dossier PACKAGES_DIR
types/
  build.ts               ← BuildRecord, BuildStatus, LogEntry
  package-schema.ts      ← Interfaces + schémas Zod du JSON de package
data/                    ← Persistance locale (gitignored)
  history.json
  running-build.json
  {buildId}/logs.json
docs/                    ← Documentation technique détaillée
exemples/                ← Exemples de fichiers JSON de packages
```

---

## API

| Route                               | Méthode        | Description                                           |
| ----------------------------------- | -------------- | ----------------------------------------------------- |
| `/api/auth/login`                   | POST           | Connexion LDAP, pose les cookies                      |
| `/api/auth/me`                      | GET            | Profil utilisateur depuis le cookie                   |
| `/api/auth/refresh`                 | POST           | Renouvelle le token via refresh_token                 |
| `/api/auth/logout`                  | POST           | Supprime les cookies                                  |
| `/api/versions`                     | GET            | Liste les versions disponibles dans PACKAGES_DIR      |
| `/api/packages`                     | GET            | Résout la version et liste les packages (`?version=`) |
| `/api/packages/[version]/[package]` | GET/PUT/DELETE | Lire / modifier / supprimer un JSON                   |
| `/api/build`                        | POST           | Lance un build, retourne `buildId` immédiatement      |
| `/api/build/active`                 | GET            | Build en cours (tous les clients)                     |
| `/api/build/active`                 | DELETE         | Annuler le build en cours (`{ buildId }`)             |
| `/api/build-stream`                 | GET            | Flux SSE de logs (`?buildId=`)                        |
| `/api/history`                      | GET/DELETE     | Lister / vider l'historique                           |
| `/api/history/[buildId]`            | GET            | Détail d'un build                                     |
| `/api/history/[buildId]/data-logs`  | GET            | Logs persistés d'un build terminé                     |
| `/api/explorer`                     | GET/DELETE     | Parcourir / supprimer des fichiers dans SRC_DIR       |

---

## Développement

```bash
npm run dev        # Serveur de dev avec Turbopack
npm run typecheck  # Vérification TypeScript (sans émission)
npm run lint       # ESLint
npm run format     # Prettier (modifie les fichiers)
npm run build      # Build de production
```

### Conventions

- **App Router exclusivement** — ne pas mélanger avec Pages Router.
- **`fs/promises` uniquement** — aucun appel `fs` synchrone.
- **`path.join()`** pour toute construction de chemin — jamais de concaténation de chaînes.
- **Singletons `globalThis`** pour tout état partagé entre routes API (voir `buildRegistry`, `activeBuilds`, `cancelledBuilds`).
- **Formatage** : pas de point-virgule, guillemets doubles, virgules finales ES5, 80 colonnes. Lancer `npm run format` avant de commiter.
- **Composants shadcn/ui** : lister les composants nécessaires pour les ajouter manuellement (`npx shadcn@latest add <composant>`).
