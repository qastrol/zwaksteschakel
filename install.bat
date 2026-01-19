@echo off
echo ========================================
echo DE ZWAKSTE SCHAKEL - Installatie
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is niet geinstalleerd!
    echo.
    echo Download en installeer Node.js van:
    echo https://nodejs.org/
    echo.
    echo Download de LTS versie (aanbevolen)
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js is geinstalleerd
node --version
npm --version
echo.

echo [INFO] Dependencies worden geinstalleerd...
echo.

call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Installatie mislukt!
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo [OK] Installatie voltooid!
echo ========================================
echo.
echo Je kunt nu de server starten met:
echo   start_server.bat
echo.
pause
