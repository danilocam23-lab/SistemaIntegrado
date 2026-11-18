@echo off
setlocal
title Sistema Integrado HITSS - Instalacion completa

REM  ================================================================
REM  instalar-todo.bat
REM  Instalacion completa en una maquina nueva:
REM    1. instalar-requisitos.bat   (Python, Node, Git, MongoDB)
REM    2. instalar-aplicacion.bat   (venv, dependencias, .env, BD)
REM  Si en el paso 1 se instalo Python/Node/Git por primera vez, hay que
REM  abrir una consola nueva y ejecutar instalar-aplicacion.bat.
REM  ================================================================

set "BAT_DIR=%~dp0"

echo.
echo  ============================================================
echo   Sistema Integrado HITSS - Instalacion completa
echo  ============================================================
echo.

call "%BAT_DIR%instalar-requisitos.bat" auto

where python >nul 2>&1 && where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [INFO] Python/Node recien instalados: Windows aun no los ve en esta consola.
    echo         Cierra esta ventana, abre una nueva y ejecuta:
    echo           bat\instalar-aplicacion.bat
    echo.
    pause
    exit /b 0
)

call "%BAT_DIR%instalar-aplicacion.bat" auto
if %errorlevel% neq 0 (
    pause
    exit /b 1
)

echo.
echo  Instalacion completa. Ejecuta bat\arrancar.bat para iniciar el sistema.
echo.
pause
endlocal
