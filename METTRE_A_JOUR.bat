@echo off
title Mise a jour de Gestion-Stock
setlocal

echo ===========================================
echo   MISE A JOUR DE L'APPLICATION (FRONTEND)
echo ===========================================
echo.
echo [1/2] Nettoyage et Reconstruction...
echo.

:: Utiliser le node.exe local si present pour le build si besoin
if exist "%~dp0node.exe" (
    set "PATH=%~dp0;%PATH%"
    echo [INFO] Utilisation de Node.js portable pour le build
)

:: Lancer le build via npm (qui utilise le node du path)
call npm run build

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERREUR] La reconstruction a echoue.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===========================================
echo   MISE A JOUR TERMINEE !
echo   Vous pouvez maintenant relancer l'app 
echo   via "start.bat" sur votre bureau.
echo ===========================================
echo.
pause
