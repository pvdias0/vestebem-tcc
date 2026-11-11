@echo off
setlocal EnableDelayedExpansion
rem Analise estatica das 9 aplicacoes com o CodeQL CLI (bundle oficial, suite security-extended)
set "AQUI=%~dp0"
set "RAIZ=%~dp0..\.."
set "TOOLS=%~dp0ferramenta"
set "CQL=%TOOLS%\codeql\codeql.exe"
if not exist "%CQL%" (
  if not exist "%TOOLS%" mkdir "%TOOLS%"
  echo [1/3] Baixando o CodeQL bundle mais recente ^(cerca de 500 MB^)...
  gh release download --repo github/codeql-action --pattern codeql-bundle-win64.tar.gz --dir "%TOOLS%" --clobber || goto :erro
  echo [2/3] Extraindo...
  tar -xzf "%TOOLS%\codeql-bundle-win64.tar.gz" -C "%TOOLS%" || goto :erro
)
"%CQL%" version --format=json > "%AQUI%versao-codeql.json"
type "%AQUI%versao-codeql.json"
if not exist "%AQUI%resultados" mkdir "%AQUI%resultados"
if not exist "%TOOLS%\db" mkdir "%TOOLS%\db"
echo [3/3] Analisando as 9 aplicacoes...
for %%M in (claude-opus-5.5 gpt-6.1-sol gemini-3.8-flash) do (
  for %%R in (r1 r2 r3) do (
    echo ===== %%M %%R =====
    "%CQL%" database create "%TOOLS%\db\%%M-%%R" --language=javascript-typescript --source-root "%RAIZ%\apps\%%M\%%R" --overwrite --threads=0 || goto :erro
    "%CQL%" database analyze "%TOOLS%\db\%%M-%%R" codeql/javascript-queries:codeql-suites/javascript-security-extended.qls --format=sarif-latest --sarif-category=%%M-%%R --output "%AQUI%resultados\%%M-%%R.sarif" --threads=0 || goto :erro
  )
)
echo.
echo Concluido. Resultados em: %AQUI%resultados
pause
exit /b 0
:erro
echo.
echo ERRO: copie a mensagem acima e envie para o Claude.
pause
exit /b 1
