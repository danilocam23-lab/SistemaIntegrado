@echo off
setlocal enabledelayedexpansion
title MongoDB - Verificar / Instalar / Arrancar

REM  Valida si MongoDB esta instalado y corriendo. Si no, lo instala
REM  (winget o Chocolatey) y arranca el servicio.
REM  Uso:  iniciar-mongodb.bat          (interactivo, con pausa final)
REM        iniciar-mongodb.bat auto     (sin pausa; lo usa arrancar.bat)

set "MODO=%~1"
set "SERVICIO=MongoDB"

REM -- Permisos de administrador (instalar/arrancar servicios lo requiere) --
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
echo   MongoDB - Verificacion, instalacion y arranque
echo  ============================================================
echo.

REM -- 1. Verificar si el servicio ya existe --------------------------
echo  [1/3] Verificando instalacion de MongoDB...
sc query "%SERVICIO%" >nul 2>&1
if %errorlevel% equ 0 (
    echo         MongoDB ya esta instalado.
    goto :ARRANCAR
)

REM -- 2. Instalar MongoDB --------------------------------------------
echo         MongoDB NO esta instalado. Instalando...
set "INSTALADO=0"

where winget >nul 2>&1
if !errorlevel! equ 0 (
    echo         Instalando con winget ^(MongoDB.Server^)...
    winget install -e --id MongoDB.Server --accept-source-agreements --accept-package-agreements
    set "INSTALADO=1"
)

if "!INSTALADO!"=="0" (
    where choco >nul 2>&1
    if !errorlevel! equ 0 (
        echo         Instalando con Chocolatey...
        choco install mongodb --yes
        set "INSTALADO=1"
    )
)

if "!INSTALADO!"=="0" (
    echo.
    echo  [ERROR] No se encontro winget ni Chocolatey para instalar MongoDB.
    echo  Descarga MongoDB Community manualmente:
    echo    https://www.mongodb.com/try/download/community
    echo.
    pause & exit /b 1
)

REM Re-verificar el servicio tras la instalacion
sc query "%SERVICIO%" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [AVISO] MongoDB se instalo pero el servicio "%SERVICIO%" aun no aparece.
    echo  Cierra esta ventana, abre una consola nueva y vuelve a ejecutar este bat.
    echo.
    pause & exit /b 1
)
echo         [OK] MongoDB instalado correctamente.

:ARRANCAR
REM -- 3. Arrancar el servicio ----------------------------------------
echo  [2/3] Arrancando el servicio MongoDB...
sc query "%SERVICIO%" | find "RUNNING" >nul 2>&1
if %errorlevel% equ 0 (
    echo         [OK] MongoDB ya esta corriendo.
) else (
    net start "%SERVICIO%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo         [OK] Servicio MongoDB arrancado.
    ) else (
        echo  [ERROR] No se pudo arrancar el servicio MongoDB.
        pause & exit /b 1
    )
)

REM Que arranque automaticamente con Windows
sc config "%SERVICIO%" start= auto >nul 2>&1

REM -- Verificar el puerto 27017 --------------------------------------
echo  [3/3] Verificando el puerto 27017...
powershell -NoProfile -Command "if ((Test-NetConnection -ComputerName localhost -Port 27017 -WarningAction SilentlyContinue).TcpTestSucceeded) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo         [OK] MongoDB responde en localhost:27017
) else (
    echo         [AVISO] El servicio esta activo pero el puerto 27017 aun no responde.
    echo         Espera unos segundos antes de arrancar la aplicacion.
)

echo.
echo  ============================================================
echo   MongoDB listo en localhost:27017
echo  ============================================================
echo.
if /i not "%MODO%"=="auto" pause
endlocal
