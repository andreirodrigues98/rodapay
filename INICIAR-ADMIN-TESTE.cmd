@echo off
setlocal
cd /d "%~dp0"
echo [VORA] Inicie INICIAR-EMULADORES.cmd primeiro.
set "RODAPAY_ADMIN_MODE=emulator"
set "RODAPAY_ADMIN_PROJECT=demo-rodapay"
if not exist "node_modules\firebase-admin" (
  echo Instalando dependencias de administracao...
  call npm install
  if errorlevel 1 (pause & exit /b 1)
)
call npm run admin
pause
