@echo off
title Fullpetro - Iniciando...
echo ============================================
echo   Iniciando Fullpetro (backend + frontend)
echo ============================================
echo.
echo No cierres las dos ventanas negras que se van a abrir.
echo Minimizalas si quieres, pero dejalas abiertas mientras uses el sistema.
echo.

start "Fullpetro - Backend" cmd /k "cd /d "%~dp0backend" && node main.js"
timeout /t 4 /nobreak > nul

start "Fullpetro - Frontend" cmd /k "cd /d "%~dp0frontend" && pnpm run dev"
timeout /t 5 /nobreak > nul

start http://localhost:5173

echo.
echo Listo. Se deberia haber abierto tu navegador solo.
echo Si no se abrio, entra tu mismo a: http://localhost:5173
echo.
pause
