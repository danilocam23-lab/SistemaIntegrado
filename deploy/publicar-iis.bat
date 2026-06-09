@echo off
setlocal enabledelayedexpansion
title Sistema Integrado HITSS - Publicar en IIS

echo.
echo  ============================================================
echo   Sistema Integrado HITSS - Publicacion en IIS
echo  ============================================================
echo.

REM -- Configuracion --------------------------------------------------
set "SITE_NAME=IIS_PRD"
set "APP_NAME=SistemaIntegrado"
set "APP_POOL=IIS_PRD"
set "PUBLISH_DIR=E:\IIS_PRD\Sistema Integrado"
set "SOURCE_DIR=%~dp0.."
set "APPCMD=%windir%\system32\inetsrv\appcmd.exe"
set "PYTHON_EXE=%PUBLISH_DIR%\api\.venv\Scripts\python.exe"
REM Python base accesible por IIS (fuera de carpetas de usuario)
set "IIS_PYTHON_BASE=E:\Python313"

REM -- 1. Verificar Python --------------------------------------------
echo  [1/8] Verificando Python...
set "BASE_PYTHON="
if exist "%IIS_PYTHON_BASE%\python.exe" (
    set "BASE_PYTHON=%IIS_PYTHON_BASE%\python.exe"
    echo         Usando Python IIS-accesible: %IIS_PYTHON_BASE%
) else (
    for /f "tokens=*" %%p in ('where python 2^>nul') do (
        if not defined BASE_PYTHON set "BASE_PYTHON=%%p"
    )
    if not defined BASE_PYTHON (
        echo  [ERROR] Python no encontrado. Instala Python 3.11+ en %IIS_PYTHON_BASE%.
        pause & exit /b 1
    )
    echo  [AVISO] Python en: !BASE_PYTHON!  (si esta en C:\Users IIS no tendra acceso)
)

REM -- 2. Verificar Node, IIS y HttpPlatformHandler -------------------
echo  [2/8] Verificando Node.js, IIS y HttpPlatformHandler...
where npm >nul 2>&1 || (echo  [ERROR] Node.js/npm no encontrado. & pause & exit /b 1)
if not exist "%APPCMD%" (echo  [ERROR] IIS no detectado. & pause & exit /b 1)
"%APPCMD%" list modules /name:httpPlatformHandler >nul 2>&1
if %errorlevel% neq 0 (
    echo  [AVISO] HttpPlatformHandler no detectado. Instalalo con:
    echo          choco install httpplatformhandler --yes  ^&  iisreset
)
echo         OK

REM -- 3. Compilar el frontend ----------------------------------------
echo  [3/8] Compilando el frontend (Vite)...
pushd "%SOURCE_DIR%\web"
call npm install --silent
if %errorlevel% neq 0 (echo  [ERROR] npm install fallo. & popd & pause & exit /b 1)
set "VITE_APP_BASE=/%APP_NAME%/"
call npm run build
if %errorlevel% neq 0 (echo  [ERROR] npm run build fallo. & popd & pause & exit /b 1)
popd
echo         [OK] Frontend compilado en web\dist

REM -- 4. Copiar archivos --------------------------------------------
echo  [4/8] Publicando archivos en %PUBLISH_DIR%...
if not exist "%PUBLISH_DIR%\api" mkdir "%PUBLISH_DIR%\api"
if not exist "%PUBLISH_DIR%\web\dist" mkdir "%PUBLISH_DIR%\web\dist"
if not exist "%PUBLISH_DIR%\logs" mkdir "%PUBLISH_DIR%\logs"

xcopy /E /I /Y /Q "%SOURCE_DIR%\api\app" "%PUBLISH_DIR%\api\app" >nul
copy /Y "%SOURCE_DIR%\api\pyproject.toml" "%PUBLISH_DIR%\api\pyproject.toml" >nul
if exist "%SOURCE_DIR%\api\README.md" copy /Y "%SOURCE_DIR%\api\README.md" "%PUBLISH_DIR%\api\README.md" >nul
xcopy /E /I /Y /Q "%SOURCE_DIR%\web\dist" "%PUBLISH_DIR%\web\dist" >nul
if exist "%SOURCE_DIR%\scripts" xcopy /E /I /Y /Q "%SOURCE_DIR%\scripts" "%PUBLISH_DIR%\scripts" >nul

if exist "%PUBLISH_DIR%\api\.env" (
    echo         [OK] .env conservado
) else if exist "%SOURCE_DIR%\api\.env" (
    copy /Y "%SOURCE_DIR%\api\.env" "%PUBLISH_DIR%\api\.env" >nul
) else (
    copy /Y "%SOURCE_DIR%\api\.env.example" "%PUBLISH_DIR%\api\.env" >nul
    echo         [INFO] .env creado desde .env.example - REVISA MONGO_URL y JWT_SECRET
)
echo         Archivos copiados

REM -- 5. Entorno virtual y dependencias -----------------------------
echo  [5/8] Configurando entorno virtual...
if not exist "%PYTHON_EXE%" (
    echo         Creando entorno virtual...
    "!BASE_PYTHON!" -m venv "%PUBLISH_DIR%\api\.venv"
    if %errorlevel% neq 0 (echo  [ERROR] No se pudo crear el venv. & pause & exit /b 1)
)
"%PYTHON_EXE%" -m pip install --quiet --upgrade pip >nul 2>&1
echo         Instalando dependencias...
"%PYTHON_EXE%" -m pip install --quiet "%PUBLISH_DIR%\api"
if %errorlevel% neq 0 (echo  [ERROR] Fallo la instalacion de dependencias. & pause & exit /b 1)
echo         [OK] Dependencias instaladas

echo         Verificando importacion de la aplicacion...
pushd "%PUBLISH_DIR%\api"
"%PYTHON_EXE%" -c "import app.main; print('OK')" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] La aplicacion no se puede importar:
    "%PYTHON_EXE%" -c "import app.main"
    popd & pause & exit /b 1
)
popd
echo         [OK] Aplicacion verificada

REM -- 6. Generar web.config -----------------------------------------
echo  [6/8] Generando web.config...
(
echo ^<?xml version="1.0" encoding="utf-8"?^>
echo ^<configuration^>
echo   ^<system.webServer^>
echo     ^<handlers^>
echo       ^<add name="httpPlatformHandler" path="*" verb="*" modules="httpPlatformHandler" resourceType="Unspecified" /^>
echo     ^</handlers^>
echo     ^<httpPlatform processPath="%PUBLISH_DIR%\api\.venv\Scripts\python.exe"
echo                   arguments="-m uvicorn app.main:app --host 127.0.0.1 --port %%HTTP_PLATFORM_PORT%%"
echo                   stdoutLogEnabled="true"
echo                   stdoutLogFile="%PUBLISH_DIR%\logs\stdout"
echo                   startupTimeLimit="120" startupRetryCount="3" processesPerApplication="1"^>
echo       ^<environmentVariables^>
echo         ^<environmentVariable name="APP_ROOT_PATH" value="/%APP_NAME%" /^>
echo         ^<environmentVariable name="PYTHONPATH" value="%PUBLISH_DIR%\api" /^>
echo         ^<environmentVariable name="PYTHONUNBUFFERED" value="1" /^>
echo       ^</environmentVariables^>
echo     ^</httpPlatform^>
echo     ^<security^>
echo       ^<requestFiltering^>
echo         ^<requestLimits maxAllowedContentLength="52428800" /^>
echo         ^<hiddenSegments^>
echo           ^<add segment=".venv" /^>
echo           ^<add segment="logs" /^>
echo           ^<add segment=".git" /^>
echo         ^</hiddenSegments^>
echo         ^<fileExtensions allowUnlisted="true"^>
echo           ^<add fileExtension=".env" allowed="false" /^>
echo           ^<add fileExtension=".py" allowed="false" /^>
echo           ^<add fileExtension=".bat" allowed="false" /^>
echo           ^<add fileExtension=".toml" allowed="false" /^>
echo         ^</fileExtensions^>
echo       ^</requestFiltering^>
echo     ^</security^>
echo     ^<directoryBrowse enabled="false" /^>
echo     ^<httpProtocol^>
echo       ^<customHeaders^>
echo         ^<remove name="X-Powered-By" /^>
echo       ^</customHeaders^>
echo     ^</httpProtocol^>
echo   ^</system.webServer^>
echo ^</configuration^>
) > "%PUBLISH_DIR%\web.config"
echo         [OK] web.config generado

REM -- 7. Configurar IIS ---------------------------------------------
echo  [7/8] Configurando IIS...
"%APPCMD%" list site /name:"%SITE_NAME%" >nul 2>&1
if %errorlevel% neq 0 (echo  [ERROR] El sitio %SITE_NAME% no existe en IIS. & pause & exit /b 1)

"%APPCMD%" list apppool /name:"%APP_POOL%" >nul 2>&1
if %errorlevel% neq 0 (
    "%APPCMD%" add apppool /name:"%APP_POOL%" /managedRuntimeVersion:"" /managedPipelineMode:Integrated
)
"%APPCMD%" set apppool "%APP_POOL%" /managedRuntimeVersion:"" >nul 2>&1

"%APPCMD%" list app /app.name:"%SITE_NAME%/%APP_NAME%" >nul 2>&1
if %errorlevel% neq 0 (
    "%APPCMD%" add app /site.name:"%SITE_NAME%" /path:"/%APP_NAME%" /physicalPath:"%PUBLISH_DIR%"
) else (
    "%APPCMD%" set app "%SITE_NAME%/%APP_NAME%" /physicalPath:"%PUBLISH_DIR%" >nul
)
"%APPCMD%" set app "%SITE_NAME%/%APP_NAME%" /applicationPool:"%APP_POOL%" >nul

echo         Configurando permisos...
icacls "%PUBLISH_DIR%" /grant "IIS_IUSRS:(OI)(CI)RX" /T /Q >nul
icacls "%PUBLISH_DIR%" /grant "IIS AppPool\%APP_POOL%:(OI)(CI)RX" /T /Q >nul
icacls "%PUBLISH_DIR%\logs" /grant "IIS AppPool\%APP_POOL%:(OI)(CI)M" /T /Q >nul
for /f "tokens=2 delims== " %%v in ('findstr /i "^home" "%PUBLISH_DIR%\api\.venv\pyvenv.cfg" 2^>nul') do (
    icacls "%%v" /grant "IIS AppPool\%APP_POOL%:(OI)(CI)RX" /T /Q >nul 2>&1
)
echo         [OK] IIS configurado

"%APPCMD%" recycle apppool "%APP_POOL%" >nul 2>&1
"%APPCMD%" start site "%SITE_NAME%" >nul 2>&1

REM -- 8. Resumen ----------------------------------------------------
echo  [8/8] Listo.
for /f %%h in ('hostname') do set "HOST=%%h"
echo.
echo  ============================================================
echo   Publicacion completada
echo.
echo   URL:       http://!HOST!/%APP_NAME%
echo   Carpeta:   %PUBLISH_DIR%
echo   Logs:      %PUBLISH_DIR%\logs\stdout*.log
echo.
echo   RECUERDA:
echo    - El servicio de MongoDB debe estar corriendo (ver MONGO_URL en api\.env).
echo    - El superadmin y la aplicacion inicial se crean al primer arranque.
echo    - Credenciales iniciales: ver SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD en .env
echo  ============================================================
echo.
start "" "http://!HOST!/%APP_NAME%"
pause
endlocal
