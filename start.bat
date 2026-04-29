@echo off
title Gestion-Stock Server
setlocal

:: --- VERIFICATION DE LA LICENCE ---
set "NODE_EXE=%~dp0node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

"%NODE_EXE%" "%~dp0license_check.cjs"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ECHEC] Activation requise pour continuer.
    pause
    exit /b
)
:: --- FIN VERIFICATION ---

echo ===========================================
echo   Demarrage de Gestion-Stock (PRODUCTION)
echo ===========================================
echo.

:: Ajouter le node.exe local au PATH si present
if exist "%~dp0node.exe" (
    set "PATH=%~dp0;%PATH%"
    echo [INFO] Utilisation de Node.js portable (local)
) else (
    echo [INFO] Utilisation de Node.js systeme
)

:: 1. Demarrage du Serveur
echo [1/2] Lancement du serveur...
start /b "GestionStock" cmd /c "cd /d "%~dp0server" && node index_mysql.js > "%~dp0server\server.log" 2>&1"

echo [2/2] Preparation des acces...
echo.

:: Detection dynamique de l'IP
for /f "usebackq" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' -and $_.InterfaceAlias -notlike '*vEthernet*' } | Select-Object -First 1).IPAddress"`) do set LOCAL_IP=%%i

echo Acces local  : http://localhost:3001
if not "%LOCAL_IP%"=="" (
    echo Acces reseau : http://%LOCAL_IP%:3001
)
echo Acces Nom    : http://%COMPUTERNAME%.local:3001
echo.
echo Pour arreter l'application, utilisez "stop.bat".
echo.

timeout /t 4 /nobreak > nul
start http://localhost:3001

echo ===========================================
echo   Application prete !
echo ===========================================
timeout /t 5 > nul
exit
