# Logs et streaming SSE

## Vue d'ensemble

Le système de logs repose sur deux éléments : un accumulateur en mémoire (`BuildLogger`) et une route SSE (`/api/build-stream`) qui diffuse les entrées en temps réel au client.

## Flux complet

```
POST /api/build
  → crée un BuildLogger
  → l'enregistre dans buildRegistry sous un buildId (UUID)
  → lance le build en arrière-plan (sans await)
  → retourne immédiatement { buildId }

Client
  → se connecte à GET /api/build-stream?buildId=xxx
  → reçoit les entrées déjà accumulées en replay
  → puis reçoit les nouvelles entrées en temps réel via SSE
  → ferme la connexion à la réception de l'entrée type="done"
```

## BuildLogger (`lib/build-logger.ts`)

Classe par instance de build. Elle expose :

| Méthode | LogType émis |
|---|---|
| `log(message)` | `"log"` |
| `warn(message)` | `"warning"` |
| `error(message)` | `"error"` |
| `progress(current, total)` | `"progress"` |
| `done()` | `"done"` — marque isDone=true |

Chaque entrée est une `LogEntry` :
```ts
{ type, message, timestamp: ISO8601, progress?: { current, total } }
```

Les entrées sont stockées dans un tableau interne `entries[]` **et** diffusées immédiatement aux `listeners[]` abonnés.

`subscribe(listener)` retourne une fonction de désabonnement — le pattern observer classique.

## buildRegistry — registre global

```ts
const registry = new Map<string, BuildLogger>()
```

Partagé entre les appels de routes API au sein du même processus Next.js. À chaque `set()`, les loggers âgés de plus d'une heure sont purgés automatiquement.

> **Contrainte Next.js** : le registre est en mémoire de processus. En production avec plusieurs workers (PM2 cluster, plusieurs instances), chaque worker a son propre registre. Avec Turbopack dev (`npm run dev`), un seul processus — pas de problème.

## Route SSE (`app/api/build-stream/route.ts`)

Utilise la Web Streams API (`ReadableStream`) plutôt que `node:stream` pour rester compatible avec l'Edge Runtime de Next.js.

```
start(controller)
  1. Replay : enqueue toutes les entries déjà présentes dans logger.allEntries
  2. Si logger.isDone → close() et retour (build déjà terminé)
  3. Sinon : logger.subscribe() pour enqueuer les futures entries
     → à la réception de type="done" : unsubscribe + close()
```

Format SSE standard :
```
data: {"type":"log","message":"...","timestamp":"..."}\n\n
```

Headers requis : `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.

## Côté client

Le client crée un `EventSource` pointant sur `/api/build-stream?buildId=xxx`. Chaque message est parsé via `JSON.parse(event.data)` pour obtenir une `LogEntry` affichée en temps réel dans le panneau de logs.

## Cycle de vie d'un buildId

1. Créé par `POST /api/build` → UUID v4
2. Enregistré dans `buildRegistry` au démarrage du build
3. Conservé 1h maximum (nettoyage lazy au prochain `set()`)
4. L'historique (`lib/history.ts`) persiste le `buildId` sur disque pour le rejouer depuis `/history`
