#!/bin/sh
# Lance ChromAssist en local (Linux / macOS / Termux). Nécessite Node.js.
cd "$(dirname "$0")" || exit 1
echo "Ouvrez http://localhost:8080 dans le navigateur. Ctrl+C pour arrêter."
exec node server.mjs "$@"
