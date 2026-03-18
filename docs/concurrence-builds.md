# Concurrence des builds

## Problème

Le build est une opération longue qui écrit des fichiers dans `OUTPUT_DIR`. Si deux builds identiques (même version + mêmes packages) tournent en parallèle, ils écriront dans le même dossier de sortie et se corrompront mutuellement.

## Solution : Set de verrous en mémoire

```ts
// app/api/build/route.ts
const activeBuilds = new Set<string>()
```

La clé de verrou est construite ainsi :
```ts
const lockKey = `${resolved.resolvedVersion}:${packages.join(",")}`
// Exemple : "3.3.3:base,update"
```

Avant de démarrer le build :
```ts
if (activeBuilds.has(lockKey)) {
  logger.error("Build already running...")
  logger.done()
  return  // abandonne silencieusement
}
activeBuilds.add(lockKey)
```

La clé est supprimée dans le `finally` de la coroutine de build — même en cas d'erreur.

## Comportement observable

- Le second `POST /api/build` **réussit quand même** (status 200, retourne un `buildId`)
- Le build de ce second `buildId` se termine immédiatement avec une entrée `error` puis `done`
- L'historique enregistre le second build avec status `"error"`

## Limites

- **En mémoire** : le `Set` est réinitialisé à chaque redémarrage du processus. Un redémarrage en cours de build laissera des fichiers temporaires orphelins dans `OUTPUT_DIR/TEMP_*/`.
- **Mono-processus** : fonctionne uniquement si Next.js tourne dans un seul processus (dev avec Turbopack, ou production avec PM2 en mode `fork`). En cluster multi-workers, chaque worker a son propre `Set` — le verrou ne s'applique pas entre workers.
- **Builds différents en parallèle** : deux packages différents peuvent tourner en parallèle sans problème, chacun ayant sa propre `lockKey` et son propre dossier `TEMP_{uuid}`.

## Nettoyage des fichiers temporaires orphelins

En cas de crash, les dossiers `OUTPUT_DIR/TEMP_*/` peuvent persister. Il n'y a pas de nettoyage automatique au démarrage — à faire manuellement ou via un script de maintenance.
