@echo off
echo ========================================
echo DE ZWAKSTE SCHAKEL - Server Startup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is niet geinstalleerd!
    echo.
    echo Download Node.js van: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js gevonden: 
node --version
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Dependencies worden geinstalleerd...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Installatie mislukt!
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies geinstalleerd
    echo.
)

echo ========================================
echo Server wordt gestart...
echo ========================================
echo.
echo De server draait op poort 3000
echo.
echo Host toegang (spelleider):
echo   - http://localhost:3000/
echo.
echo Display toegang (kandidaten/toeschouwers):
echo   - http://localhost:3000/display
echo.
echo ========================================
echo.
echo TIP: Open de host pagina in een browser,
echo      en de display pagina in een andere
echo      browser/apparaat op hetzelfde netwerk.
echo.
echo Druk op Ctrl+C om de server te stoppen.
echo.
echo ========================================
echo.

REM Start the server
node server.js

REM If server stops, pause
pause
