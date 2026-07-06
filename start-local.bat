@echo off
setlocal

set "ROOT=%~dp0"

echo Iniciando Sistema Web de Reporte Diario...
echo.
echo Backend:  http://localhost:4000
echo Frontend: http://localhost:5173
echo.

start "Reporte Diario - Backend" cmd /k "cd /d ""%ROOT%backend"" && npm.cmd start"

if exist "%ROOT%frontend\dist\index.html" (
  start "Reporte Diario - Frontend" cmd /k "cd /d ""%ROOT%frontend"" && node serve-dist-local.cjs"
) else (
  start "Reporte Diario - Frontend" cmd /k "cd /d ""%ROOT%frontend"" && npm.cmd run dev"
)

echo Listo. Se abrieron dos ventanas: Backend y Frontend.
echo Si es primera vez en este equipo, ejecuta npm.cmd install en backend y frontend antes de usar este archivo.
echo.
pause
