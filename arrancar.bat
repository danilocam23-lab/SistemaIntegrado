@echo off
setlocal enabledelayedexpansion
title Sistema Integrado HITSS - Arranque local
color 0A

echo.
echo  ============================================================
echo   Sistema Integrado HITSS - Arranque en desarrollo
echo  ============================================================
echo.

set "RAIZ=%~dp0"
set "API_DIR=%RAIZ%api"
set "WEB_DIR=%RAIZ%web"
set "PYTHON_VENV=%API_DIR%\.venv\Scripts\python.exe"
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=5173"

REM -- 1. Verificar Python y Node -------------------------------------
echo  [1/7] Verificando requisitos...
where python >nul 2>&1 || (echo  [ERROR] Python no encontrado. Instala Python 3.11+ & pause & exit /b 1)
where npm >nul 2>&1 || (echo  [ERROR] Node.js/npm no encontrado. Instala Node 18+ & pause & exit /b 1)

REM Verificar versiones
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo         %%v detectado
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo         Node %%v detectado
for /f "tokens=*" %%v in ('npm --version 2^>^&1') do echo         npm %%v detectado

REM -- 2. Backend: entorno virtual + dependencias ---------------------
echo  [2/7] Preparando el backend...
if not exist "%PYTHON_VENV%" (
    echo         Creando entorno virtual ^(primera vez^)...
    python -m venv "%API_DIR%\.venv"
    if !errorlevel! neq 0 (echo  [ERROR] No se pudo crear el entorno virtual. & pause & exit /b 1)
    echo         Instalando dependencias del backend...
    "%PYTHON_VENV%" -m pip install --quiet --upgrade pip
    "%PYTHON_VENV%" -m pip install --quiet -e "%API_DIR%"
    if !errorlevel! neq 0 (echo  [ERROR] Fallo la instalacion del backend. & pause & exit /b 1)
    echo         [OK] Backend instalado
) else (
    echo         Entorno virtual existente
)

REM -- 3. Backend: archivo .env ---------------------------------------
if not exist "%API_DIR%\.env" (
    copy /Y "%API_DIR%\.env.example" "%API_DIR%\.env" >nul
    echo         [INFO] api\.env creado desde .env.example - revisa MONGO_URL y JWT_SECRET
)

REM -- 4. Frontend: dependencias --------------------------------------
echo  [3/7] Preparando el frontend...
if not exist "%WEB_DIR%\node_modules" (
    echo         Instalando dependencias del frontend ^(npm install, primera vez^)...
    pushd "%WEB_DIR%"
    call npm install --silent
    set "NPM_ERR=!errorlevel!"
    popd
    if !NPM_ERR! neq 0 (echo  [ERROR] Fallo npm install. & pause & exit /b 1)
    echo         [OK] Frontend instalado
) else (
    echo         node_modules existente
)

REM -- 5. Verificar / instalar / arrancar MongoDB --------------------
echo  [4/7] Verificando MongoDB...
if exist "%RAIZ%iniciar-mongodb.bat" (
    call "%RAIZ%iniciar-mongodb.bat" auto
) else (
    echo         [AVISO] iniciar-mongodb.bat no encontrado; verifica MongoDB manualmente.
)

REM -- Esperar a que MongoDB responda en el puerto 27017 -------------
echo         Esperando conexion a MongoDB (puerto 27017)...
set "MONGO_OK=0"
for /L %%i in (1,1,15) do (
    if "!MONGO_OK!"=="0" (
        powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('localhost',27017); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            echo         [OK] MongoDB responde en localhost:27017
            set "MONGO_OK=1"
        ) else (
            echo         Intento %%i/15 - esperando...
            timeout /t 2 /nobreak >nul
        )
    )
)
if "!MONGO_OK!"=="0" (
    echo  [ERROR] MongoDB no responde en el puerto 27017 despues de 30 segundos.
    echo         Verifica que el servicio MongoDB este instalado y corriendo.
    pause & exit /b 1
)

REM -- 6. Matar procesos previos en los puertos ----------------------
echo  [5/7] Liberando puertos...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%BACKEND_PORT% " ^| findstr "LISTENING" 2^>nul') do (
    echo         Cerrando proceso previo en puerto %BACKEND_PORT% ^(PID %%p^)
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%FRONTEND_PORT% " ^| findstr "LISTENING" 2^>nul') do (
    echo         Cerrando proceso previo en puerto %FRONTEND_PORT% ^(PID %%p^)
    taskkill /PID %%p /F >nul 2>&1
)
echo         [OK] Puertos libres

REM -- 7. Lanzar backend ---------------------------------------------
echo  [6/7] Iniciando backend (uvicorn)...
start "Sistema Integrado - Backend" /d "%API_DIR%" cmd /k "title Backend - uvicorn :8000 && color 0E && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port %BACKEND_PORT%"

REM -- Esperar a que el backend responda ------------------------------
echo         Esperando que el backend este listo (puerto %BACKEND_PORT%)...
set "API_OK=0"
for /L %%i in (1,1,30) do (
    if "!API_OK!"=="0" (
        powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%BACKEND_PORT%/api/health' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('localhost',%BACKEND_PORT%); $c.Close(); exit 0 } catch { exit 1 } }" >nul 2>&1
        if !errorlevel! equ 0 (
            echo         [OK] Backend respondiendo en localhost:%BACKEND_PORT%
            set "API_OK=1"
        ) else (
            if %%i equ 10 echo         Aun esperando... ^(puede tardar en la primera carga^)
            if %%i equ 20 echo         Casi listo...
            timeout /t 2 /nobreak >nul
        )
    )
)
if "!API_OK!"=="0" (
    echo  [AVISO] El backend aun no responde. Puede estar cargando.
    echo         Revisa la ventana del backend para ver errores.
    echo         Continuando con el frontend de todas formas...
)

REM -- 8. Lanzar frontend --------------------------------------------
echo  [7/7] Iniciando frontend (Vite)...
start "Sistema Integrado - Frontend" /d "%WEB_DIR%" cmd /k "title Frontend - Vite :5173 && color 0B && npm run dev"

REM -- Esperar a que el frontend responda ----------------------------
echo         Esperando que el frontend este listo (puerto %FRONTEND_PORT%)...
set "WEB_OK=0"
for /L %%i in (1,1,15) do (
    if "!WEB_OK!"=="0" (
        powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('localhost',%FRONTEND_PORT%); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            echo         [OK] Frontend respondiendo en localhost:%FRONTEND_PORT%
            set "WEB_OK=1"
        ) else (
            timeout /t 2 /nobreak >nul
        )
    )
)

REM -- Abrir el navegador automaticamente ----------------------------
if "!WEB_OK!"=="1" (
    echo.
    echo         Abriendo el navegador...
    start "" "http://localhost:%FRONTEND_PORT%"
)

echo.
echo  ============================================================
echo   [OK] Sistema Integrado arrancado correctamente
echo  ============================================================
echo.
echo   Backend  : http://localhost:%BACKEND_PORT%      ^(API docs: /docs^)
echo   Frontend : http://localhost:%FRONTEND_PORT%
echo.
echo   Login: admin@hitss.com / Admin123*
echo.
echo   Para detener: cierra las ventanas "Backend" y "Frontend"
echo   o ejecuta: taskkill /FI "WINDOWTITLE eq Sistema Integrado*" /F
echo  ============================================================
echo.
pause
endlocal
