@echo off
setlocal enabledelayedexpansion
title Sistema Integrado HITSS - Restaurar MongoDB

REM  ================================================================
REM  restaurar-mongodb.bat
REM  Restaura un backup .gz generado por backup-mongodb.bat.
REM  ATENCION: usa --drop; reemplaza las colecciones actuales.
REM
REM  Uso:  restaurar-mongodb.bat                      (usa el backup mas reciente)
REM        restaurar-mongodb.bat "D:\ruta\backup.gz"  (un archivo concreto)
REM  ================================================================

set "ARCHIVO=%~1"
set "DESTINO=C:\Backups\SistemaIntegrado"

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
echo   Restaurar MongoDB: !MONGO_DB!
echo  ============================================================
echo.

REM -- 1. mongorestore -------------------------------------------------
set "MONGORESTORE="
where mongorestore >nul 2>&1 && set "MONGORESTORE=mongorestore"
if not defined MONGORESTORE if exist "C:\MongoDBTools" (
    for /f "delims=" %%f in ('dir /s /b "C:\MongoDBTools\mongorestore.exe" 2^>nul') do if not defined MONGORESTORE set "MONGORESTORE=%%f"
)
if not defined MONGORESTORE (
    for /d %%d in ("C:\Program Files\MongoDB\Tools\*") do if exist "%%d\bin\mongorestore.exe" set "MONGORESTORE=%%d\bin\mongorestore.exe"
)
if not defined MONGORESTORE (
    echo         No encontrado. Instalando MongoDB Database Tools...
    call "%~dp0instalar-mongodb-tools.bat" auto
    if exist "C:\MongoDBTools\bin\mongorestore.exe" set "MONGORESTORE=C:\MongoDBTools\bin\mongorestore.exe"
    if not defined MONGORESTORE for /d %%d in ("C:\Program Files\MongoDB\Tools\*") do if exist "%%d\bin\mongorestore.exe" set "MONGORESTORE=%%d\bin\mongorestore.exe"
)
if not defined MONGORESTORE (
    echo  [ERROR] No se pudo instalar mongorestore. Ver bat\instalar-mongodb-tools.bat
    pause & exit /b 1
)

REM -- 2. Elegir archivo (el mas reciente si no se indico) -------------
if not defined ARCHIVO (
    for %%D in ("%DESTINO%" "%~dp0" "%RAIZ%") do (
        if not defined ARCHIVO (
            for /f "delims=" %%f in ('dir /b /a-d /o-d "%%~D\backup_*" 2^>nul') do (
                if not defined ARCHIVO set "ARCHIVO=%%~D\%%f"
            )
        )
    )
)
if not defined ARCHIVO (
    echo  [ERROR] No hay backups en %DESTINO%, en bat\ ni en la raiz del repo.
    echo          Indica el archivo como argumento.
    pause & exit /b 1
)
if not exist "!ARCHIVO!" (
    echo  [ERROR] No existe: !ARCHIVO!
    pause & exit /b 1
)

echo   Archivo : !ARCHIVO!
echo   Base    : !MONGO_DB!
echo.
echo   Esto REEMPLAZA los datos actuales de la base.
choice /c SN /n /m "  Continuar? (S/N): "
if errorlevel 2 (echo   Cancelado. & pause & exit /b 0)

REM -- 3. Restaurar ----------------------------------------------------
echo.
"!MONGORESTORE!" --uri="!MONGO_URL!" --gzip --archive="!ARCHIVO!" --nsInclude="!MONGO_DB!.*" --drop
if !errorlevel! neq 0 (
    echo  [ERROR] mongorestore fallo.
    pause & exit /b 1
)

echo.
echo  ============================================================
echo   [OK] Restauracion completada
echo  ============================================================
echo.
pause
endlocal
