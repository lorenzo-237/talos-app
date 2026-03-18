# Génération et patch des fichiers INI

## Principe

Un fichier INI est d'abord **copié** depuis les sources, puis **patchés** uniquement les clés listées dans la définition. Toutes les autres clés et sections restent intactes.

## Flux (`lib/ini-generator.ts`)

```
1. Copie SRC_DIR/files/inis/{name} → destination
2. Lit le fichier copié
3. Parse via ini.parse() → objet JS { [section]: { [key]: value } }
4. Pour chaque section/clé dans la définition :
     - Crée la section si elle n'existe pas encore
     - Applique resolvePlaceholders() sur la valeur
     - Écrase la clé
5. Sérialise via ini.stringify() et écrit
```

## Définition JSON

```json
{
  "name": "config.ini",
  "sections": [
    {
      "name": "General",
      "keys": [
        { "name": "Version", "value": "{version}" },
        { "name": "BuildDate", "value": "2024-01-01" }
      ]
    }
  ]
}
```

Seules `General.Version` et `General.BuildDate` seront modifiées. Les autres clés du fichier INI source sont préservées.

## Bibliothèque `ini`

Le package npm `ini` parse et stringify le format INI standard (sections `[Section]`, paires `key=value`, commentaires `;` ou `#`). Il préserve la casse des clés. La sérialisation recrée les sections dans l'ordre de l'objet JS.

> **Limite** : `ini.stringify()` peut réordonner légèrement le fichier ou normaliser les espaces autour de `=`. Si la mise en forme exacte du fichier source est critique, envisager un patch par ligne plutôt qu'un parse/stringify complet.

## Placeholders dans les valeurs

Les valeurs INI supportent tous les placeholders standards :
```json
{ "name": "Version", "value": "{version-3}" }
```
Sur version `3.3.3.1` → `Version=3.3.3`
