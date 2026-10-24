@echo off
rem Lance ChromAssist en local (Windows). Necessite Node.js.
cd /d "%~dp0"
echo Ouvrez http://localhost:8080 dans le navigateur. Fermez cette fenetre pour arreter.
node server.mjs %*
pause
