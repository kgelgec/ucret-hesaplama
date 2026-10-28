<#
  ÜCRET HESAPLAMA — DENEME SUNUCUSU (port 8794)
  ---------------------------------------------------------------
  Geliştirme sırasında programı denemek içindir. GERÇEK veri klasörüne
  DOKUNMAZ: veri, yedek ve kilit dosyaları geçici klasörde
  (%TEMP%\butce-deneme) tutulur. Tarayıcı açmaz.
#>
$veriKok = Join-Path $env:TEMP 'butce-deneme'
if (-not (Test-Path -LiteralPath $veriKok)) { New-Item -ItemType Directory -Path $veriKok -Force | Out-Null }
& (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'Sunucuyu-Baslat.ps1') -Port 8794 -VeriKok $veriKok -Deneme
