@echo off
setlocal
set "target=%~dp0start.bat"
set "icon=%~dp0icon.ico"
set "linkname=Gestion-Stock"
set "script=%temp%\CreateShortcut.vbs"

echo Set oWS = CreateObject("WScript.Shell") > "%script%"
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\%linkname%.lnk" >> "%script%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%script%"
echo oLink.TargetPath = "%target%" >> "%script%"
echo oLink.WorkingDirectory = "%~dp0" >> "%script%"
echo oLink.Description = "Logiciel de Gestion de Stock" >> "%script%"
if exist "%icon%" (
    echo oLink.IconLocation = "%icon%" >> "%script%"
)
echo oLink.Save >> "%script%"

cscript /nologo "%script%"
del "%script%"

echo ===========================================
echo   FACILITATEUR DE RACCOURCI BUREAU
echo ===========================================
echo.
echo [SUCCES] Un raccourci "Gestion-Stock" est apparu sur votre bureau.
echo.
pause
exit
