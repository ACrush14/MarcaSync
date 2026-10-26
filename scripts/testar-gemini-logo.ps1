# Testa a chave do Gemini (cria 1 logo de exemplo). A chave é pedida aqui, sem aparecer na tela,
# fica só na memória deste processo e não é gravada em arquivo.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$segura = Read-Host "Cole a chave do Gemini (não aparece na tela) e aperte Enter" -AsSecureString
$ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
try {
  $env:GEMINI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro)
  node scripts/testar-gemini-logo.mjs
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
  Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
}
