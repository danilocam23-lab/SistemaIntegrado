@echo off
setlocal enabledelayedexpansion
title MongoDB 6.0 - Crear Base de Datos: tecnoinsights_unificado

REM  ================================================================
REM  crear-bd.bat
REM  Crea la base de datos "tecnoinsights_unificado" en MongoDB 6.0
REM  con todas las colecciones e indices del Sistema Integrado HITSS.
REM
REM  Usa el shell "mongo" de MongoDB Server 6.0.
REM  Requisitos: MongoDB 6.0 corriendo en localhost:27017.
REM  Uso:  crear-bd.bat           (interactivo, con pausa final)
REM        crear-bd.bat auto      (sin pausa; lo usa arrancar.bat)
REM  ================================================================

set "MODO=%~1"
set "DB_NAME=tecnoinsights_unificado"
set "RAIZ=%~dp0"
set "MONGO_BIN=C:\Program Files\MongoDB\Server\6.0\bin"
set "MONGO_SHELL=%MONGO_BIN%\mongo.exe"
set "JS_SCRIPT=%RAIZ%scripts\crear_bd.js"

echo.
echo  ============================================================
echo   Creacion de BD: %DB_NAME%  (MongoDB 6.0)
echo  ============================================================
echo.

REM -- 1. Verificar mongo shell ----------------------------------------
echo  [1/3] Verificando mongo shell...
if not exist "%MONGO_SHELL%" (
    REM Intentar en PATH
    where mongo >nul 2>&1
    if !errorlevel! equ 0 (
        set "MONGO_SHELL=mongo"
    ) else (
        echo  [ERROR] No se encontro mongo.exe en:
        echo         %MONGO_BIN%
        echo         ni en el PATH del sistema.
        echo.
        if /i not "%MODO%"=="auto" pause
        exit /b 1
    )
)
echo         [OK] mongo shell encontrado

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

REM -- 3. Ejecutar script JS -------------------------------------------
echo  [3/3] Creando base de datos, colecciones e indices...
echo.

"%MONGO_SHELL%" --quiet "localhost:27017/%DB_NAME%" "%JS_SCRIPT%"
set "RESULT=%errorlevel%"

echo.
if %RESULT% equ 0 (
    echo  ============================================================
    echo   [OK] Base de datos "%DB_NAME%" creada exitosamente
    echo  ============================================================
    echo.
    echo   Colecciones: 19
    echo   Indices:     22  ^(5 unicos, 17 compuestos^)
    echo.
    echo   Siguiente paso: ejecuta arrancar.bat para iniciar el sistema.
    echo   El bootstrap creara automaticamente:
    echo     - Aplicacion inicial: epm-hitss
    echo     - Usuario superadmin: admin@hitss.com / Admin123*
    echo     - Categorias y configuracion base
    echo  ============================================================
) else (
    echo  [ERROR] Fallo la ejecucion del script. Codigo: %RESULT%
    echo         Revisa que MongoDB este corriendo en localhost:27017.
)

echo.
if /i not "%MODO%"=="auto" pause
endlocal
