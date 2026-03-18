Voilà ce qui a été créé :

scripts/test-build.ts — le script de test

Lance-le en ligne de commande :

npx tsx scripts/test-build.ts \
 --package data/packages/3.3.3/standard.json \
 --version 3.3.3.1
Il lit .env.local automatiquement pour SRC_DIR et OUTPUT_DIR. Tu peux overrider avec --src-dir et --output-dir si besoin.

.vscode/launch.json — deux configurations de debug VSCode

test-build (debug) — te demande le chemin du package et la version à chaque lancement via une prompt
test-build (hardcoded) — valeurs fixes à modifier directement dans le JSON pour itérer vite
Pour débugger : ouvre l'onglet Run & Debug (Ctrl+Shift+D), choisis la config, pose tes breakpoints dans archive-builder.ts ou n'importe quel lib, et lance avec F5.

tsx est requis. S'il n'est pas installé : npm install -D tsx
