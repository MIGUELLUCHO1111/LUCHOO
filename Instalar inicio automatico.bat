@echo off
title Fullpetro - Instalar inicio automatico
REM Se ejecuta UNA sola vez (pedido de Lguerra, 23/09/2026). Deja el backend y
REM el frontend corriendo con PM2 (sin ventanas, se levantan solos si se caen)
REM y hace que arranquen solos cada vez que se inicia sesion en Windows.
cd /d "%~dp0"
echo ============================================
echo   Fullpetro - Instalar inicio automatico
echo ============================================
echo.

echo [1/4] Instalando PM2 (solo la primera vez tarda un poco)...
where pm2 >nul 2>nul || call npm install -g pm2
where pm2 >nul 2>nul || (echo. & echo ERROR: no se pudo instalar PM2. Avisale a Claude. & pause & exit /b 1)

echo.
echo [2/4] Encendiendo backend y frontend...
call pm2 delete fullpetro-backend >nul 2>nul
call pm2 delete fullpetro-frontend >nul 2>nul
call pm2 delete ecosystem.windows >nul 2>nul
REM Apaga copias viejas abiertas con ventanas negras (puertos 3000 y 5173),
REM para que PM2 pueda usar esos mismos puertos.
powershell -NoProfile -Command "foreach ($p in 3000,5173) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
timeout /t 2 /nobreak > nul
call pm2 start ecosystem.windows.config.cjs
call pm2 save

echo.
echo [3/4] Activando el arranque automatico al iniciar sesion...
copy /y "scripts\windows\Fullpetro (inicio automatico).vbs" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\" >nul

echo.
echo [4/4] Estado:
call pm2 list

echo.
echo Listo. Ya puedes cerrar esta ventana: el sistema sigue corriendo solo.
echo Abre el navegador en http://localhost:5173
pause
