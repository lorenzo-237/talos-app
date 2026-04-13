# Singleton partagé entre modules avec `globalThis`

## Problème

En Next.js avec Turbopack (dev), chaque route API est compilée comme un **module séparé**.
Un module-level singleton classique (ex. `const registry = new Map()`) crée donc
**une instance par module** — deux routes qui importent le même fichier peuvent se
retrouver avec deux Maps distinctes.

Cas concret dans ce projet : `/api/build` écrivait le `buildId` dans sa Map,
et `/api/build-stream` cherchait ce `buildId` dans la sienne → 404.

---

## Solution : ancrer sur `globalThis`

`globalThis` est l'objet global universel (= `window` en browser, `global` en Node.js).
Il est **vraiment partagé** entre tous les modules d'un même processus, y compris
après un hot-reload Turbopack.

```ts
const registry = globalThis.__buildRegistry ?? new Map()
globalThis.__buildRegistry = registry
```

- Première fois que le module charge : `__buildRegistry` est `undefined` → crée une
  nouvelle Map et l'attache à `globalThis`.
- Après un hot-reload : `__buildRegistry` existe déjà → réutilise la même Map.

---

## `declare global` (TypeScript)

TypeScript ne connaît pas les propriétés custom sur `globalThis` et lèverait une
erreur de type. `declare global` permet d'**augmenter** la définition du type global
sans émettre de JavaScript :

```ts
declare global {
  var __buildRegistry: Map<string, BuildLogger> | undefined
}
```

> Le mot-clé `var` est obligatoire ici (pas `let`/`const`) — c'est la syntaxe
> TypeScript pour déclarer une propriété sur le scope global.

---

## Pattern complet

```ts
declare global {
  var __monSingleton: MonType | undefined
}

const instance: MonType = globalThis.__monSingleton ?? new MonType()
globalThis.__monSingleton = instance

export { instance }
```

À utiliser dès qu'un module doit maintenir un état partagé (cache, registry,
connexion DB…) dans une app Next.js en développement.
