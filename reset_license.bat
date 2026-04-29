@echo off
title Reinitialisation de la Licence
setlocal

echo ===========================================
echo   REINITIALISATION DE LA LICENCE
echo ===========================================
echo.
echo Cette action va supprimer la licence actuelle de cet ordinateur.
echo Vous devrez entrer une nouvelle cle au prochain demarrage.
echo.
set /p CONFIRM="Voulez-vous continuer ? (O/N) : "

if /i "%CONFIRM%" neq "O" (
    echo.
    echo Operation annulee.
    pause
    exit /b
)

:: Chemin vers le dossier de licence
set "LICENSE_DIR=%APPDATA%\GestionStock"

if exist "%LICENSE_DIR%" (
    rd /s /q "%LICENSE_DIR%"
    echo.
    echo [SUCCES] La licence a ete reinitialisee avec succes.
) else (
    echo.
    echo [INFO] Aucune licence active n'a ete trouvee.
)

echo.
echo Vous pouvez maintenant relancer "start.bat" pour activer une nouvelle licence.
echo.
pause
