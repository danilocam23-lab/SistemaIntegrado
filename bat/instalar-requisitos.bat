@echo off
setlocal enabledelayedexpansion
title Sistema Integrado HITSS - Instalar requisitos

REM  ================================================================
REM  instalar-requisitos.bat
REM  Instala (si faltan) los programas que necesita la aplicacion:
REM    - Python 3.11+   (backend FastAPI)
REM    - Node.js LTS    (frontend React/Vite, incluye npm)
REM    - Git
REM    - MongoDB        (via iniciar-mongodb.bat)
REM  Orden de intento: winget -> Chocolatey -> descarga directa del
REM  instalador oficial (no requiere winget ni choco).
REM  Uso:  instalar-requisitos.bat          (interactivo, con pausa final)
REM        instalar-requisitos.bat auto     (sin pausa; lo usa instalar-todo.bat)
REM  ================================================================

set "MODO=%~1"
set "BAT_DIR=%~dp0"
set "NUEVO=0"
set "DESCARGAS=%TEMP%\sistema-integrado-instaladores"

REM URLs de descarga directa (instaladores oficiales)
set "URL_PYTHON=https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe"
set "URL_NODE=https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi"
set "URL_GIT=https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe"

REM -- Permisos de administrador --------------------------------------
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  Se requieren permisos de administrador. Solicitando elevacion...
    if defined MODO (
        powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%MODO%' -Verb RunAs -Wait"
    ) else (
        powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs -Wait"
    )
    exit /b
)

echo.
echo  ============================================================
echo   Sistema Integrado HITSS - Instalacion de requisitos
echo  ============================================================
echo.

REM -- Detectar gestores de paquetes (opcionales) ----------------------
set "WINGET="
where winget >nul 2>&1 && set "WINGET=winget"
if not defined WINGET if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe" set "WINGET=%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe"
set "CHOCO="
where choco >nul 2>&1 && set "CHOCO=choco"

if defined WINGET (echo  Gestor: winget) else if defined CHOCO (echo  Gestor: Chocolatey) else (echo  Gestor: ninguno - se descargaran los instaladores oficiales)
echo.

if not exist "%DESCARGAS%" mkdir "%DESCARGAS%"

REM -- 1. Python -------------------------------------------------------
echo  [1/4] Python 3.11+...
where python >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo         %%v ya instalado
) else (
    echo         Instalando Python 3.12...
    set "OK=0"
    if defined WINGET (
        "%WINGET%" install -e --id Python.Python.3.12 --scope machine --accept-source-agreements --accept-package-agreements
        if !errorlevel! equ 0 set "OK=1"
    )
    if "!OK!"=="0" if defined CHOCO (
        choco install python312 --yes
        if !errorlevel! equ 0 set "OK=1"
    )
    if "!OK!"=="0" (
        echo         Descargando instalador oficial...
        powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest '%URL_PYTHON%' -OutFile '%DESCARGAS%\python.exe'"
        if exist "%DESCARGAS%\python.exe" (
            "%DESCARGAS%\python.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
            if !errorlevel! equ 0 set "OK=1"
        )
    )
    if "!OK!"=="0" (echo  [ERROR] No se pudo instalar Python.) else (set "NUEVO=1")
)

REM -- 2. Node.js ------------------------------------------------------
echo  [2/4] Node.js LTS...
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo         Node %%v ya instalado
) else (
    echo         Instalando Node.js LTS...
    set "OK=0"
    if defined WINGET (
        "%WINGET%" install -e --id OpenJS.NodeJS.LTS --scope machine --accept-source-agreements --accept-package-agreements
        if !errorlevel! equ 0 set "OK=1"
    )
    if "!OK!"=="0" if defined CHOCO (
        choco install nodejs-lts --yes
        if !errorlevel! equ 0 set "OK=1"
    )
    if "!OK!"=="0" (
        echo         Descargando instalador oficial...
        powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest '%URL_NODE%' -OutFile '%DESCARGAS%\node.msi'"
        if exist "%DESCARGAS%\node.msi" (
            msiexec /i "%DESCARGAS%\node.msi" /qn /norestart
            if !errorlevel! equ 0 set "OK=1"
        )
    )
    if "!OK!"=="0" (echo  [ERROR] No se pudo instalar Node.js.) else (set "NUEVO=1")
)

REM -- 3. Git ----------------------------------------------------------
echo  [3/4] Git...
where git >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('git --version 2^>^&1') do echo         %%v ya instalado
) else (
    echo         Instalando Git...
    set "OK=0"
    if defined WINGET (
        "%WINGET%" install -e --id Git.Git --scope machine --accept-source-agreements --accept-package-agreements
        if !errorlevel! equ 0 set "OK=1"
    )
    if "!OK!"=="0" if defined CHOCO (
        choco install git --yes
        if !errorlevel! equ 0 set "OK=1"
    )
    if "!OK!"=="0" (
        echo         Descargando instalador oficial...
        powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest '%URL_GIT%' -OutFile '%DESCARGAS%\git.exe'"
        if exist "%DESCARGAS%\git.exe" (
            "%DESCARGAS%\git.exe" /VERYSILENT /NORESTART
            if !errorlevel! equ 0 set "OK=1"
        )
    )
    if "!OK!"=="0" (echo  [ERROR] No se pudo instalar Git.) else (set "NUEVO=1")
)

REM -- 4. MongoDB ------------------------------------------------------
echo  [4/4] MongoDB...
if exist "%BAT_DIR%iniciar-mongodb.bat" (
    call "%BAT_DIR%iniciar-mongodb.bat" auto
) else (
    echo         [AVISO] iniciar-mongodb.bat no encontrado; instala MongoDB manualmente.
)

echo.
echo  ============================================================
echo   Requisitos revisados
if "!NUEVO!"=="1" (
    echo.
    echo   Se instalaron programas nuevos: CIERRA esta ventana y abre una
    echo   consola nueva antes de ejecutar instalar-aplicacion.bat, para que
    echo   Windows reconozca Python / Node / Git en el PATH.
)
echo  ============================================================
echo.
if /i not "%MODO%"=="auto" pause
endlocal
