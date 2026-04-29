@echo off
title Stop Gestion-Stock
setlocal

echo Arret de l'application en cours...

:: Arret du processus sur le port 3001 (Backend + UI)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

echo.
echo Application arretee.
timeout /t 3 > nul
exit
