@echo off
setlocal
cd /d "%~dp0"
echo RODAPAY - Servidor web LOCAL
where py >nul 2>&1
if not errorlevel 1 (
  echo Acesse http://127.0.0.1:5500
  py -3 -m http.server 5500 --bind 127.0.0.1
  goto :end
)
where python >nul 2>&1
if not errorlevel 1 (
  echo Acesse http://127.0.0.1:5500
  python -m http.server 5500 --bind 127.0.0.1
  goto :end
)
echo ERRO: Python nao encontrado. Instale Python 3 e habilite PATH.
:end
pause
