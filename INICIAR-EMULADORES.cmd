@echo off
setlocal
cd /d "%~dp0"
echo.
echo =============================================
echo RODAPAY - Auth ^+ Firestore de TESTE
 echo Projeto: demo-rodapay (nunca producao)
echo =============================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instale a versao LTS e reabra o terminal.
  goto :failed
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERRO: npm nao encontrado. Reinstale o Node.js.
  goto :failed
)
where java >nul 2>&1
if errorlevel 1 (
  echo ERRO: Java nao encontrado. Instale Java JDK 21 e configure o PATH.
  goto :failed
)
echo Node:
node --version
echo Java:
java -version
if not exist "node_modules\.bin\firebase.cmd" (
  echo.
  echo Instalando Firebase CLI para este projeto...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :failed
)
echo.
echo Iniciando emuladores em 9099 (Auth), 8080 (Firestore) e 4000 (UI)...
echo ESTA JANELA DEVE CONTINUAR ABERTA ENQUANTO VOCE USA O SITE.
echo.
if exist ".firebase-local-data\firebase-export-metadata.json" (
  echo Reutilizando os dados anteriores de teste.
  call "node_modules\.bin\firebase.cmd" emulators:start --only auth,firestore --project demo-rodapay --import ".firebase-local-data" --export-on-exit ".firebase-local-data"
) else (
  call "node_modules\.bin\firebase.cmd" emulators:start --only auth,firestore --project demo-rodapay --export-on-exit ".firebase-local-data"
)
if errorlevel 1 goto :failed
echo Os emuladores foram encerrados.
goto :end
:failed
echo.
echo Falha ao iniciar. Leia o erro acima e confira a porta em uso e o Java.
echo Se a instalacao falhar, rode manualmente: npm install
:end
echo.
pause
