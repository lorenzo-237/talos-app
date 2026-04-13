# Logs et streaming en temps réel

## C'est quoi SSE ?

SSE (Server-Sent Events) est une connexion HTTP qui reste **ouverte** après la
requête. Le serveur peut y envoyer des messages au fur et à mesure, sans que le
client ait besoin de re-demander. C'est plus simple qu'un WebSocket : c'est
unidirectionnel (serveur → client uniquement), et ça utilise une URL classique.

---

## Comment ça marche dans ce projet

### Étape 1 — Lancer le build

Le client envoie `POST /api/build`. Le serveur :

1. Crée un `BuildLogger` (l'objet qui va collecter tous les logs)
2. L'enregistre dans un registre global sous un identifiant unique (`buildId`)
3. Lance le build **en arrière-plan** (sans attendre qu'il finisse)
4. Répond immédiatement avec le `buildId`

### Étape 2 — Se connecter au stream

Le client ouvre une connexion SSE vers `GET /api/build-stream?buildId=xxx`.

La route récupère le `BuildLogger` depuis le registre et **s'y abonne** : elle
enregistre un callback qui sera appelé à chaque nouveau log. Ce callback écrit
le log dans la connexion HTTP ouverte vers le client.

Si le client se connecte avec du retard (ex. rechargement de page), tous les logs
déjà enregistrés lui sont renvoyés d'un coup en "replay", puis les nouveaux arrivent
en temps réel.

### Étape 3 — Recevoir les logs

Le client lit les messages via `EventSource.onmessage`. Chaque message est un log
au format JSON :

```ts
{ type: "log" | "warning" | "error" | "progress" | "done", message: "...", timestamp: "..." }
```

Quand le client reçoit `type: "done"`, il ferme la connexion.

---

## Le pattern Observer (publish/subscribe)

C'est le mécanisme interne du `BuildLogger`. Il permet à plusieurs parties du code
de réagir aux logs sans se connaître.

```
buildPackage → logger.log("Compression...")
                  → emit()
                     → notifie chaque listener enregistré
                          → [listener de build-stream] → écrit dans le stream HTTP
                               → EventSource.onmessage → affiché dans le browser
```

- **`logger.subscribe(callback)`** — ajoute un listener (un abonné)
- **`logger.log/warn/error/...`** — publie un message à tous les abonnés
- Le callback retourné par `subscribe()` sert à se désabonner

Si deux clients SSE se connectent au même `buildId`, il y a deux listeners dans
le tableau — chacun reçoit tous les logs.

---

## Le registre global (`buildRegistry`)

C'est une `Map` qui associe chaque `buildId` à son `BuildLogger`. Elle est
partagée entre toutes les routes API du même processus Node.js.

```ts
buildRegistry.set(buildId, logger)  // dans /api/build
buildRegistry.get(buildId)          // dans /api/build-stream
```

Les loggers sont purgés automatiquement après 1h.

> **Pourquoi `globalThis` ?** Avec Turbopack en dev, chaque route API peut être
> compilée comme un module séparé, ce qui crée plusieurs instances de la Map.
> Ancrer le registre sur `globalThis` garantit qu'il n'en existe qu'une seule,
> peu importe les rechargements. Voir [globalThis-singleton.md](./globalThis-singleton.md).

---

## Cycle de vie d'un build

```
POST /api/build
  → buildId créé (UUID)
  → BuildLogger créé et enregistré
  → build démarre en arrière-plan

GET /api/build-stream?buildId=xxx
  → logger récupéré depuis le registre
  → stream SSE ouvert, logs envoyés en temps réel

event type="done" reçu
  → client ferme la connexion SSE
  → logger conservé encore 1h puis purgé
```
