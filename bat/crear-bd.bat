@echo off
setlocal enabledelayedexpansion
title MongoDB - Crear Base de Datos: tecnoinsights_unificado

REM  ================================================================
REM  crear-bd.bat
REM  Crea la base de datos "tecnoinsights_unificado" con todas las
REM  colecciones e indices del Sistema Integrado HITSS.
REM
REM  Usa scripts\crear_bd.py con el Python del venv del backend (PyMongo),
REM  asi funciona con cualquier version de MongoDB (no necesita mongo.exe).
REM  Requisitos: backend instalado (api\.venv) y MongoDB en localhost:27017.
REM  Uso:  crear-bd.bat           (interactivo, con pausa final)
REM        crear-bd.bat auto      (sin pausa; lo usa instalar-aplicacion.bat)
REM  ================================================================

set "MODO=%~1"
set "DB_NAME=tecnoinsights_unificado"
pushd "%~dp0.."
set "RAIZ=%CD%\"
popd
set "PYTHON_VENV=%RAIZ%api\.venv\Scripts\python.exe"
set "PY_SCRIPT=%RAIZ%scripts\crear_bd.py"

echo.
echo  ============================================================
echo   Creacion de BD: %DB_NAME%
echo  ============================================================
echo.

REM -- 1. Verificar Python del venv ------------------------------------
echo  [1/3] Verificando entorno del backend...
if not exist "%PYTHON_VENV%" (
    echo  [ERROR] No existe api\.venv. Ejecuta instalar-aplicacion.bat primero.
    if /i not "%MODO%"=="auto" pause
    exit /b 1
)
echo         [OK] Python del venv encontrado

REM -- 2. Verificar que MongoDB este corriendo -------------------------
echo  [2/3] Verificando conexion a MongoDB...
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('localhost',27017); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] MongoDB no responde en localhost:27017.
    echo         Ejecuta iniciar-mongodb.bat primero.
    echo.
    if /i not "%MODO%"=="auto" pause
    exit /b 1
)
echo         [OK] MongoDB responde en localhost:27017

REM -- 3. Ejecutar script ----------------------------------------------
echo  [3/3] Creando base de datos, colecciones e indices...
echo.

"%PYTHON_VENV%" "%PY_SCRIPT%"
set "RESULT=%errorlevel%"

echo.
if %RESULT% equ 0 (
    echo  ============================================================
    echo   [OK] Base de datos "%DB_NAME%" lista
    echo.
    echo   Siguiente paso: ejecuta arrancar.bat para iniciar el sistema.
    echo   El bootstrap creara automaticamente la aplicacion epm-hitss
    echo   y el usuario superadmin ^(ver SUPERADMIN_* en api\.env^).
    echo  ============================================================
) else (
    echo  [ERROR] Fallo la ejecucion del script. Codigo: %RESULT%
)

echo.
if /i not "%MODO%"=="auto" pause
endlocal & exit /b %RESULT%
