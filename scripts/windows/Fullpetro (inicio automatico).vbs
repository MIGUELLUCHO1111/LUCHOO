' Arranque automatico de Fullpetro al iniciar sesion en Windows (pedido de
' Lguerra, 23/09/2026). "Instalar inicio automatico.bat" copia este archivo a
' la carpeta de Inicio de Windows. Levanta, sin ventanas, los procesos que se
' guardaron con "pm2 save" (backend y frontend, ver ecosystem.windows.config.cjs).
' Para desactivarlo: borrar este archivo de la carpeta de Inicio
' (Windows + R, escribir  shell:startup  y Enter).
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c pm2 resurrect", 0, False
