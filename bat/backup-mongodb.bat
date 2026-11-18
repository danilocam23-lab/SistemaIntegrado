@echo off
setlocal enabledelayedexpansion
title Sistema Integrado HITSS - Backup de MongoDB

REM  ================================================================
REM  backup-mongodb.bat
REM  Genera un backup comprimido (.gz) de la base de datos con mongodump
REM  y borra los backups mas antiguos que DIAS_RETENER.
REM
REM  Uso:  backup-mongodb.bat                       (interactivo)
REM        backup-mongodb.bat auto                  (sin pausa: Programador de tareas)
REM        backup-mongodb.bat auto "D:\Respaldos"   (carpeta destino distinta)
REM
REM  Lee MONGO_URL y MONGO_DB de api\.env (si no estan, usa localhost y
REM  tecnoinsights_unificado).
REM  Requiere MongoDB Database Tools:  winget install -e --id MongoDB.DatabaseTools
REM  ================================================================

set "MODO=%~1"
set "DESTINO=%~2"
if not defined DESTINO set "DESTINO=C:\Backups\SistemaIntegrado"
set "DIAS_RETENER=14"

pushd "%~dp0.."
set "RAIZ=%CD%\"
popd
set "ENV_FILE=%RAIZ%api\.env"

set "MONGO_URL=mongodb://localhost:27017"
set "MONGO_DB=tecnoinsights_unificado"
if exist "%ENV_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"MONGO_URL=" "%ENV_FILE%"`) do set "MONGO_URL=%%b"
    for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"MONGO_DB=" "%ENV_FILE%"`) do set "MONGO_DB=%%b"
)

echo.
echo  ============================================================
echo   Backup de MongoDB: !MONGO_DB!
echo  ============================================================
echo.

REM -- 1. Localizar mongodump ------------------------------------------
echo  [1/4] Buscando mongodump...
set "MONGODUMP="
where mongodump >nul 2>&1 && set "MONGODUMP=mongodump"
if not defined MONGODUMP if exist "C:\MongoDBTools" (
    for /f "delims=" %%f in ('dir /s /b "C:\MongoDBTools\mongodump.exe" 2^>nul') do if not defined MONGODUMP set "MONGODUMP=%%f"
)
if not defined MONGODUMP (
    for /d %%d in ("C:\Program Files\MongoDB\Tools\*") do if exist "%%d\bin\mongodump.exe" set "MONGODUMP=%%d\bin\mongodump.exe"
)
if defined MONGODUMP echo         [OK] !MONGODUMP!
if not defined MONGODUMP (
    echo         No encontrado. Instalando MongoDB Database Tools...
    call "%~dp0instalar-mongodb-tools.bat" auto
    if exist "C:\MongoDBTools\bin\mongodump.exe" set "MONGODUMP=C:\MongoDBTools\bin\mongodump.exe"
    if not defined MONGODUMP for /d %%d in ("C:\Program Files\MongoDB\Tools\*") do if exist "%%d\bin\mongodump.exe" set "MONGODUMP=%%d\bin\mongodump.exe"
)
if not defined MONGODUMP (
    echo  [ERROR] No se pudo instalar mongodump. Ver bat\instalar-mongodb-tools.bat
    if /i not "%MODO%"=="auto" pause
    exit /b 1
)
echo         [OK] mongodump encontrado

REM -- 2. Carpeta destino ----------------------------------------------
echo  [2/4] Carpeta destino: %DESTINO%
if not exist "%DESTINO%" mkdir "%DESTINO%"
if not exist "%DESTINO%" (
    echo  [ERROR] No se pudo crear la carpeta destino.
    if /i not "%MODO%"=="auto" pause
    exit /b 1
)

REM -- 3. Backup -------------------------------------------------------
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "FECHA=%%t"
set "ARCHIVO=%DESTINO%\backup_!MONGO_DB!_!FECHA!.gz"
echo  [3/4] Generando backup...
"!MONGODUMP!" --uri="!MONGO_URL!" --db="!MONGO_DB!" --gzip --archive="!ARCHIVO!"
if !errorlevel! neq 0 (
    echo  [ERROR] mongodump fallo. Revisa que MongoDB este corriendo y MONGO_URL.
    if exist "!ARCHIVO!" del "!ARCHIVO!"
    if /i not "%MODO%"=="auto" pause
    exit /b 1
)
for %%s in ("!ARCHIVO!") do echo         [OK] !ARCHIVO!  ^(%%~zs bytes^)

REM -- 4. Limpiar backups antiguos -------------------------------------
echo  [4/4] Borrando backups de mas de %DIAS_RETENER% dias...
forfiles /p "%DESTINO%" /m "backup_*.gz" /d -%DIAS_RETENER% /c "cmd /c del @path && echo         Borrado: @file" 2>nul

echo.
echo  ============================================================
echo   [OK] Backup completado
echo.
echo   Copia el archivo fuera del servidor. api\.env NO esta incluido:
echo   guardalo aparte.
echo  ============================================================
echo.
if /i not "%MODO%"=="auto" pause
endlocal
