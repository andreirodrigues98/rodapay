@echo off
cd /d "%~dp0"
echo Abrindo as duas janelas de desenvolvimento do RodaPay...
start "RodaPay Firebase" "%ComSpec%" /k ""%~dp0INICIAR-EMULADORES.cmd""
start "RodaPay Site" "%ComSpec%" /k ""%~dp0INICIAR-SITE.cmd""
echo.
echo Emuladores: http://127.0.0.1:4000
echo Site: http://127.0.0.1:5500
echo.
echo Use o botao 'Verificar emuladores' na tela de login.
pause
