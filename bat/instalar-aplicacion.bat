@echo off
setlocal enabledelayedexpansion
title Sistema Integrado HITSS - Instalar aplicacion

REM  ================================================================
REM  instalar-aplicacion.bat
REM  Prepara el proyecto (requiere Python, Node y MongoDB ya instalados;
REM  ver instalar-requisitos.bat):
REM    1. Entorno virtual + dependencias del backend  (api\.venv)
REM    2. api\.env desde .env.example (si no existe)
REM    3. Dependencias del frontend                   (web\node_modules)
REM    4. Base de datos / indices (crear-bd.bat, si hay mongo shell)
REM  Uso:  instalar-aplicacion.bat          (interactivo, con pausa final)
REM        instalar-aplicacion.bat auto     (sin pausa)
REM  Es idempotente: puede ejecutarse varias veces sin danos.
REM  ================================================================

set "MODO=%~1"
set "BAT_DIR=%~dp0"
pushd "%~dp0.."
set "RAIZ=%CD%\"
popd
set "API_DIR=%RAIZ%api"
set "WEB_DIR=%RAIZ%web"
set "PYTHON_VENV=%API_DIR%\.venv\Scripts\python.exe"

echo.
echo  ============================================================
echo   Sistema Integrado HITSS - Instalacion de la aplicacion
echo  ============================================================
echo.

REM -- 1. Verificar herramientas ---------------------------------------
echo  [1/5] Verificando herramientas...
where python >nul 2>&1 || (echo  [ERROR] Python no encontrado. Ejecuta instalar-requisitos.bat y abre una consola nueva. & goto :FALLO)
where npm >nul 2>&1 || (echo  [ERROR] Node.js/npm no encontrado. Ejecuta instalar-requisitos.bat y abre una consola nueva. & goto :FALLO)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo         %%v
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo         Node %%v

REM -- 2. Backend ------------------------------------------------------
echo  [2/5] Backend: entorno virtual y dependencias...
if not exist "%PYTHON_VENV%" (
    echo         Creando entorno virtual...
    python -m venv "%API_DIR%\.venv"
    if !errorlevel! neq 0 (echo  [ERROR] No se pudo crear el entorno virtual. & goto :FALLO)
)
"%PYTHON_VENV%" -m pip install --quiet --upgrade pip
"%PYTHON_VENV%" -m pip install --quiet -e "%API_DIR%[dev]"
if !errorlevel! neq 0 (echo  [ERROR] Fallo la instalacion del backend. & goto :FALLO)
echo         [OK] Backend instalado

REM -- 3. .env ---------------------------------------------------------
echo  [3/5] Configuracion api\.env...
if not exist "%API_DIR%\.env" (
    copy /Y "%API_DIR%\.env.example" "%API_DIR%\.env" >nul
    echo         [INFO] api\.env creado desde .env.example
    echo                Revisa MONGO_URL, JWT_SECRET y SUPERADMIN_* antes de produccion.
) else (
    echo         api\.env ya existe ^(no se modifica^)
)

REM -- 4. Frontend -----------------------------------------------------
echo  [4/5] Frontend: npm install...
pushd "%WEB_DIR%"
call npm install --no-audit --no-fund
set "NPM_ERR=!errorlevel!"
popd
if !NPM_ERR! neq 0 (echo  [ERROR] Fallo npm install. & goto :FALLO)
echo         [OK] Frontend instalado

REM -- 5. Base de datos ------------------------------------------------
echo  [5/5] Base de datos...
if exist "%BAT_DIR%crear-bd.bat" (
    call "%BAT_DIR%crear-bd.bat" auto
    if !errorlevel! neq 0 (
        echo         [AVISO] crear-bd.bat no se ejecuto ^(MongoDB apagado o fallo el script^).
        echo                 No es critico: el backend crea colecciones e indices al arrancar.
    )
)

echo.
echo  ============================================================
echo   [OK] Aplicacion instalada
echo.
echo   Siguiente paso: ejecuta bat\arrancar.bat
echo  ============================================================
echo.
if /i not "%MODO%"=="auto" pause
endlocal
exit /b 0

:FALLO
echo.
echo  La instalacion no se completo. Revisa el mensaje de arriba.
if /i not "%MODO%"=="auto" pause
endlocal
exit /b 1
