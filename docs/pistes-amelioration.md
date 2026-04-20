# Pistes d'amélioration

## Bugs / Problèmes de logique

### 1. `activeBuilds` n'est pas un singleton `globalThis`

**Fichier :** `app/api/build/route.ts:16`

Le `Set<string>` est une variable module-level normale. Sous Turbopack en dev, chaque module peut avoir sa propre instance → le verrou de concurrence est inefficace. Il faudrait l'ancrer sur `globalThis` comme `buildRegistry`.

```ts
// Avant
const activeBuilds = new Set<string>()

// Après
declare global {
  var __activeBuilds: Set<string> | undefined
}
const activeBuilds: Set<string> = globalThis.__activeBuilds ?? new Set()
globalThis.__activeBuilds = activeBuilds
```

---

### 2. Code mort dans `processDirectoryNode`

**Fichier :** `archive-builder.ts:52-62`, `78-89`, `113-116`

Les branches `installMode ? ... : ...` calculent le même chemin dans les deux cas :

```ts
// Les deux branches sont identiques
const baseDir = installMode
  ? path.join(srcDir, "directories", ...)
  : path.join(srcDir, "directories", ...)
```

Le paramètre `installMode` dans `processDirectoryNode` ne sert à rien pour les répertoires de base, les wdlls et les files. Soit c'est du dead code à supprimer, soit la logique de chemin `install/` n'est jamais appliquée correctement.

---

### 3. `storage.ts` est vide

**Fichier :** `lib/storage.ts`

Le fichier exporte `const storage = {}` sans aucun contenu. Soit c'est du code prévu mais non implémenté à nettoyer, soit c'est un fichier à supprimer.

---

### 4. La vérification de concurrence arrive trop tard

**Fichier :** `app/api/build/route.ts:60-94`

Le build est d'abord inscrit dans l'historique (ligne 78) et dans `runningBuilds` (ligne 60), puis seulement ensuite le `activeBuilds.has(lockKey)` est testé (ligne 84). Si c'est un doublon, l'historique se retrouve avec un enregistrement "running" qui passe immédiatement à "error".

La vérification devrait être faite **avant** tout enregistrement.

---

## Sécurité

### 5. Les droits ne sont pas signés

**Fichier :** `lib/api-auth.ts`

Le cookie `talos_rights` contient le JSON des droits en clair, sans signature. `requireAuth` le lit et lui fait confiance sans vérification. Un utilisateur pourrait éditer ce cookie pour s'octroyer des droits (`canBuild: true`, etc.).

Solutions possibles :
- Signer le cookie avec un HMAC (secret côté serveur)
- Ne pas stocker les droits côté client et les re-dériver à partir du token à chaque requête API

---

### 6. Shell injection possible dans les callbacks exec

**Fichier :** `archive-builder.ts:312`

```ts
await execa(`"${exePath}" ${resolvedArgs}`, { shell: true })
```

`resolvedArgs` vient d'un fichier JSON contrôlé par les admins, donc le risque est limité. Mais passer `shell: true` avec une string interpolée est une mauvaise pratique. Préférable d'utiliser le tableau d'arguments sans shell :

```ts
await execa(exePath, parseArgs(resolvedArgs))
```

---

## Qualité / maintenabilité

### 7. `app/page.tsx` fait 610 lignes

Toute la logique est dans un seul composant : gestion SSE, recherche de version, sélection de packages, filtrage des logs. Découper en hooks et sous-composants rendrait le tout plus lisible et testable :

- Hook `useBuildStream(buildId)` — gestion SSE + reconnexion
- Hook `usePackageSearch(version)` — fetch `/api/packages`
- Composant `PackageSelector` — checkboxes + tout/rien
- Composant `BuildLogs` — zone de logs + filtres + barre de progression

---

### 8. Les logs en mémoire peuvent fuiter

**Fichier :** `lib/build-logger.ts`

Les logs sont nettoyés après 1h. Il n'y a pas de limite sur le nombre total d'entrées par build. Un build verbeux avec des milliers de fichiers peut consommer beaucoup de mémoire jusqu'au timer. Ajouter une taille max par build (ex. 10 000 lignes) éviterait un OOM.

---

### 9. Pas de retry ni heartbeat SSE

**Fichier :** `app/page.tsx:119-130`

Si la connexion SSE se coupe en milieu de build (réseau instable), le client reçoit `onerror` et marque le build comme terminé (`setBuildDone(true)`). Il n'y a pas de reconnexion automatique — l'opérateur doit naviguer vers `/history` pour voir l'état réel.

Pistes :
- Reconnexion automatique avec délai exponentiel sur `onerror`
- Heartbeat serveur (envoi d'un event `ping` toutes les 15s) pour détecter les connexions zombies

---

## Améliorations fonctionnelles

### 10. Pas d'annulation de build

Il n'existe pas d'endpoint `DELETE /api/build/active` ou équivalent. Si un build tourne indéfiniment ou part en erreur silencieuse, l'opérateur ne peut pas l'interrompre sans redémarrer le serveur.

---

### 11. Pas de validation Zod des package JSON au moment du build

**Fichier :** `app/api/build/route.ts:102`

```ts
const raw = await fs.readFile(pkgFile, "utf-8")
pkgDef = JSON.parse(raw) // aucune validation
```

Un JSON mal formé (mauvais type sur un champ) se propage et peut produire un message d'erreur cryptique en plein milieu du build. Utiliser `PackageDefinitionSchema.safeParse()` permettrait de détecter le problème dès le départ avec un message clair.

---

### 12. Pas de rafraîchissement automatique du token

**Fichier :** `contexts/auth-context.tsx` (ou équivalent fetch client)

Il n'y a pas de rafraîchissement automatique côté client. Si le token de 24h expire en cours de session, les appels API retournent 401 sans explication visible. Un intercepteur fetch qui tente `/api/auth/refresh` sur un 401 avant de rediriger vers `/login` améliorerait l'expérience.
