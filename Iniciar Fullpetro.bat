@echo off
title Fullpetro - Iniciando...
echo ============================================
echo   Iniciando Fullpetro (backend + frontend)
echo ============================================
echo.

REM Con PM2 instalado ("Instalar inicio automatico.bat", 23/09/2026) el
REM sistema corre solo y sin ventanas: aqui solo se asegura de que este
REM encendido. Sin PM2, se abre como antes, con dos ventanas negras.
where pm2 >nul 2>nul
if %errorlevel%==0 (
  call pm2 resurrect >nul 2>nul
  call pm2 list
  timeout /t 3 /nobreak > nul
  start http://localhost:5173
  echo.
  echo Listo. El sistema corre solo: puedes cerrar esta ventana.
  echo.
  pause
  exit /b 0
)

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
