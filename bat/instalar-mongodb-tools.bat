@echo off
setlocal enabledelayedexpansion
title Instalar MongoDB Database Tools

REM  ================================================================
REM  instalar-mongodb-tools.bat
REM  Instala mongodump / mongorestore (MongoDB Database Tools).
REM  Orden: ya instaladas -> winget -> descarga del .zip oficial en
REM  C:\MongoDBTools\bin (no necesita winget ni administrador).
REM  Uso:  instalar-mongodb-tools.bat          (interactivo)
REM        instalar-mongodb-tools.bat auto     (sin pausa; lo usan backup/restaurar)
REM  Codigo de salida: 0 = herramientas disponibles, 1 = fallo.
REM  ================================================================

set "MODO=%~1"
set "URL_ZIP=https://fastdl.mongodb.org/tools/db/mongodb-database-tools-windows-x86_64-100.10.0.zip"
set "TMP_DIR=%TEMP%\mongodb-tools-instalador"
set "DEST=C:\MongoDBTools"

echo.
echo  Instalando MongoDB Database Tools...

call :BUSCAR
if defined MONGODUMP (
    echo         Ya instaladas: !MONGODUMP!
    goto :LISTO
)

REM -- winget ----------------------------------------------------------
set "WINGET="
where winget >nul 2>&1 && set "WINGET=winget"
if not defined WINGET if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe" set "WINGET=%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe"
if defined WINGET (
    echo         Probando con winget...
    "!WINGET!" install -e --id MongoDB.DatabaseTools --accept-source-agreements --accept-package-agreements
    call :BUSCAR
    if defined MONGODUMP goto :LISTO
)

REM -- Descarga directa ------------------------------------------------
echo         Descargando el paquete oficial...
if exist "%TMP_DIR%" rmdir /s /q "%TMP_DIR%"
mkdir "%TMP_DIR%"
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest '%URL_ZIP%' -OutFile '%TMP_DIR%\tools.zip'; Expand-Archive '%TMP_DIR%\tools.zip' -DestinationPath '%TMP_DIR%\x' -Force"
if not exist "%DEST%\bin" mkdir "%DEST%\bin"
for /d %%d in ("%TMP_DIR%\x\*") do copy /Y "%%d\bin\*.exe" "%DEST%\bin\" >nul 2>&1
call :BUSCAR
if defined MONGODUMP goto :LISTO

echo  [ERROR] No se pudo instalar. Descargalas manualmente:
echo          https://www.mongodb.com/try/download/database-tools
if /i not "%MODO%"=="auto" pause
exit /b 1

:LISTO
echo         [OK] mongodump listo: !MONGODUMP!
if /i not "%MODO%"=="auto" pause
endlocal
exit /b 0

:BUSCAR
set "MONGODUMP="
where mongodump >nul 2>&1 && (set "MONGODUMP=mongodump" & exit /b 0)
if exist "C:\MongoDBTools\bin\mongodump.exe" (set "MONGODUMP=C:\MongoDBTools\bin\mongodump.exe" & exit /b 0)
for /d %%d in ("C:\Program Files\MongoDB\Tools\*") do if exist "%%d\bin\mongodump.exe" set "MONGODUMP=%%d\bin\mongodump.exe"
exit /b 0
