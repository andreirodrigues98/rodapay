@echo off
setlocal
cd /d "%~dp0"
cls
echo =========================================
echo   VORA - Administracao RodaPay (REAL)
echo =========================================
echo.
echo Este programa utiliza usuarios e dados de PRODUCAO.
echo Nao prossiga antes do backup e da revisao das regras.
echo.
set /p CONFIRM=Digite CONFIRMO-PRODUCAO-RODAPAY para continuar: 
if /I not "%CONFIRM%"=="CONFIRMO-PRODUCAO-RODAPAY" (
 echo Operacao cancelada.
 pause
 exit /b 1
)
set RODAPAY_ADMIN_MODE=production
set RODAPAY_ADMIN_PROJECT=rodapay-c5490
set RODAPAY_ADMIN_CONFIRM=CONFIRMO-PRODUCAO-RODAPAY
node admin/server.mjs
if errorlevel 1 (
 echo.
 echo O painel nao iniciou. Confira o acesso Google e as permissoes.
 pause
)
endlocal
