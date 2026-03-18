# Résolution de version

## Problème

L'opérateur saisit une version complète comme `3.3.3.1`, mais le dossier de packages peut n'exister qu'en `3.3.3` (sans le 4ème segment). La résolution consiste à trouver le dossier existant le plus précis.

## Algorithme (`lib/version-resolver.ts`)

```
version = "3.3.3.1"
segments = ["3", "3", "3", "1"]

Essai 1 : candidate = "3.3.3.1" → PACKAGES_DIR/3.3.3.1/ → n'existe pas
Essai 2 : candidate = "3.3.3"   → PACKAGES_DIR/3.3.3/   → existe ✓
```

Le code itère de `len = segments.length` à `len = 1`, construit le candidat en joignant les N premiers segments, et vérifie via `fs.stat()` si le dossier existe.

Retourne `{ folder: string, resolvedVersion: string }` ou `null` si aucun dossier trouvé.

## Distinction version saisie / version résolue

Deux valeurs circulent dans toute la chaîne :

| Variable | Exemple | Usage |
|---|---|---|
| `inputVersion` | `"3.3.3.1"` | Passé aux placeholders (voir [placeholder-resolver.md](./placeholder-resolver.md)) |
| `resolvedVersion` | `"3.3.3"` | Localise le dossier de packages dans PACKAGES_DIR |

`buildPackage()` reçoit les deux. Les placeholders utilisent `inputVersion` pour que `{version}` reflète ce que l'opérateur a saisi.

## Validation

Avant de lancer l'algorithme, la version est validée par regex :
```ts
/^\d+(\.\d+)*$/.test(version)
```
Accepte : `3`, `3.3`, `3.3.3`, `3.3.3.1`. Refuse toute chaîne avec lettres ou caractères spéciaux.

## Utilisation dans l'API

`GET /api/packages?version=3.3.3.1` et `POST /api/build` utilisent tous les deux `resolvePackageFolder()`. La réponse expose `resolvedVersion` pour que l'UI puisse l'afficher à l'opérateur.
