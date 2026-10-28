<#
  ÜCRET HESAPLAMA — Yerel Web Sunucusu
  ---------------------------------------------------------------
  Uygulamayı http://localhost:8764/ adresinden yayınlar.
  Yönetici yetkisi ve kurulum gerektirmez; sadece Windows PowerShell kullanır.

  Kullanım: BUTCE-BASLAT.bat dosyasına çift tıklayın.
  Durdurmak için siyah pencereyi kapatın (ya da Ctrl+C).

  VERİ NEREDE? Program klasörünün BİR ÜSTÜNDEKİ "veri\butce.db" dosyasında.
       Tarayıcıda değil: tarayıcı verisi silinse,
       profil bozulsa ya da başka tarayıcı kullanılsa bile kayıtlar durur.
       Her kayıttan önce "yedek" klasörüne kopya alınır (son 20, en çok
       10 dakikada bir). Veri parolası kurulduysa dosya ŞİFRELİ yazılır;
       sunucu şifreyi çözmez, anahtar hiçbir zaman buraya gelmez.

  DENEME İÇİN: -Port 8794 -VeriKok <geçici klasör> -Deneme
       Deneme sunucusu GERÇEK veri klasörüne dokunmaz ve tarayıcı açmaz.
#>
param(
  [int]$Port = 8764,
  [string]$VeriKok = '',
  [switch]$Deneme
)

$ErrorActionPreference = 'Stop'
$kok  = Split-Path -Parent $MyInvocation.MyCommand.Path
$adres = "http://localhost:$Port/"

# VERI KLASORU — program klasorunun BIR USTUNDE durur. Boylece program
# dosyalari guncellenirken (klasor degistirilirken) veri etkilenmez.
if (-not $VeriKok) { $VeriKok = Split-Path -Parent $kok }
$veriKlasor      = Join-Path $VeriKok 'veri'
$veriDosya       = Join-Path $veriKlasor 'butce.db'
$isaretDosya     = Join-Path $veriKlasor 'sifreleme-acik'
$veriYedekKlasor = Join-Path $VeriKok 'yedek'
$elleYedekKlasor = Join-Path $VeriKok 'yedek-elle'

$tipler = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.wasm' = 'application/wasm'
  '.db'   = 'application/x-sqlite3'
  '.ico'  = 'image/x-icon'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
}

# Gelen ikili veri bize ait mi?  'sifreli' | 'duz' | $null
#   sifreli : BTENC1 imzali paket (tarayicida AES-256-GCM ile sifrelenmis)
#   duz     : SQLite dosyasi
function Veri-Turu([byte[]]$b) {
  if (-not $b -or $b.Length -lt 64) { return $null }
  $imza = [Text.Encoding]::ASCII.GetString($b, 0, [Math]::Min(15, $b.Length))
  if ($imza.StartsWith('BTENC1')) { return 'sifreli' }
  if ($b.Length -ge 512 -and $imza -eq 'SQLite format 3') { return 'duz' }
  return $null
}

# SIFRELEME ACIKKEN DUZ VERI KABUL EDILMEZ
# Isaret dosyasi duruyorsa diske yalniz sifreli paket yazilir. Tarayicida
# bir hata ya da sekme kapanirken yapilan son kayit duz veri gondermeye
# kalkarsa, maaslar diskte bir an bile acik durmaz. Sifreleme BILEREK
# kaldirilirken once isaret silinir, sonra duz yazilir.
function Duz-Reddedilsin-Mi([string]$tur) {
  return ($tur -eq 'duz' -and (Test-Path -LiteralPath $isaretDosya))
}

function Json-Yanit($yanit, [string]$govde, [int]$kod) {
  $g = [Text.Encoding]::UTF8.GetBytes($govde)
  $yanit.StatusCode = $kod
  $yanit.ContentType = 'application/json; charset=utf-8'
  $yanit.Headers.Add('Cache-Control', 'no-store')
  $yanit.ContentLength64 = $g.Length
  $yanit.OutputStream.Write($g, 0, $g.Length)
  $yanit.OutputStream.Close()
}
function Json-Metin([string]$s) { return ($s -replace '\\', '\\' -replace '"', '\"') }

function Govde-Oku($istek) {
  $ms = New-Object System.IO.MemoryStream
  $istek.InputStream.CopyTo($ms)
  $b = $ms.ToArray()
  $ms.Dispose()
  return ,$b
}

function Imza-Sifreli([string]$dosya) {
  try {
    $fs = [IO.File]::OpenRead($dosya)
    $bas = New-Object byte[] 8
    [void]$fs.Read($bas, 0, 8)
    $fs.Close()
    return ([Text.Encoding]::ASCII.GetString($bas, 0, 6) -eq 'BTENC1')
  } catch { return $false }
}

# PROGRAM HEP AYNI ADRESTE ACILIR. Tarayici deposu ADRESE bagli oldugu icin
# (verinin tarayicidaki kopyasi oradadir) port mesgulse yeni sunucu ACILMAZ:
# program zaten calisiyor demektir, yalnizca tarayici o adrese yonlendirilir.
$dinleyici = $null
$zatenCalisiyor = $false
try {
  $d = New-Object System.Net.HttpListener
  $d.Prefixes.Add($adres)
  $d.Start()
  $dinleyici = $d
} catch {
  $sonHata = $_.Exception.Message
  try { $d.Close() } catch { }
  try {
    $y = Invoke-WebRequest -Uri $adres -UseBasicParsing -TimeoutSec 4
    if ($y.StatusCode -eq 200) { $zatenCalisiyor = $true }
  } catch { }
}

if ($zatenCalisiyor) {
  Write-Host ""
  Write-Host "  Ucret Hesaplama ZATEN CALISIYOR." -ForegroundColor Green
  Write-Host "  Adres: $adres" -ForegroundColor Cyan
  Write-Host ""
  if (-not $Deneme) {
    Write-Host "  Tarayicida aciliyor; bu pencereyi kapatabilirsiniz." -ForegroundColor DarkGray
    Write-Host "  Sunucuyu durdurmak icin ILK acilan siyah pencereyi kapatin." -ForegroundColor DarkGray
    Start-Process $adres
  }
  Start-Sleep -Seconds 3
  exit 0
}

if (-not $dinleyici) {
  Write-Host ""
  Write-Host "  Sunucu baslatilamadi." -ForegroundColor Red
  Write-Host "  Son hata: $sonHata" -ForegroundColor DarkGray
  Write-Host "  $Port portu baska bir program tarafindan kullaniliyor." -ForegroundColor Yellow
  Write-Host ""
  if (-not $Deneme) { Read-Host "  Kapatmak icin Enter'a basin" }
  exit 1
}

Write-Host ""
Write-Host ("  UCRET HESAPLAMA" + $(if ($Deneme) { '  (DENEME)' } else { '' })) -ForegroundColor Cyan
Write-Host "  ------------------------------------------"
Write-Host "  Adres  : $adres" -ForegroundColor Green
Write-Host "  Program: $kok"
Write-Host "  Veri   : $veriDosya"
Write-Host "  Bu pencereyi KAPATMAYIN; kapatinca program durur."
Write-Host ""

if (-not $Deneme) { Start-Process $adres | Out-Null }

try {
  while ($dinleyici.IsListening) {
    $baglam = $dinleyici.GetContext()
    $istek  = $baglam.Request
    $yanit  = $baglam.Response

    $yol = [Uri]::UnescapeDataString($istek.Url.AbsolutePath)
    if ($yol -eq '/' -or $yol -eq '') { $yol = '/index.html' }

    # HEAD isteginde govde yazilmaz (HttpListener izin vermez; yazilirsa sunucu duser)
    if ($istek.HttpMethod -eq 'HEAD') {
      $hYol = Join-Path $kok ($yol.TrimStart('/') -replace '/', '\')
      $hVar = $false
      try { $hVar = Test-Path -LiteralPath $hYol -PathType Leaf } catch { }
      $yanit.StatusCode = $(if ($hVar) { 200 } else { 404 })
      $yanit.OutputStream.Close()
      continue
    }

    # TEK BIR ISTEK SUNUCUYU DUSURMESIN: hata yazilir, o istege 500 donulur
    try {

    # ---------------------------------------------------------------
    #  ELLE YEDEK:  POST /yedek-kaydet   GET /yedek-listesi
    #  Yedekler program klasorunun DISINDA, "yedek-elle" klasorunde durur.
    # ---------------------------------------------------------------
    if ($yol -eq '/yedek-kaydet' -and $istek.HttpMethod -eq 'POST') {
      try {
        $bytes = Govde-Oku $istek
        $tur = Veri-Turu $bytes
        if (-not $tur) { throw 'Gelen veri bir Ucret Hesaplama veri dosyasi degil.' }
        if (Duz-Reddedilsin-Mi $tur) { throw 'Sifreleme acikken sifresiz yedek yazilmaz.' }
        if (-not (Test-Path -LiteralPath $elleYedekKlasor)) { New-Item -ItemType Directory -Path $elleYedekKlasor -Force | Out-Null }
        $ad = 'butce-yedek-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.db'
        [IO.File]::WriteAllBytes((Join-Path $elleYedekKlasor $ad), $bytes)
        # Son 30 elle yedek tutulur
        $eski = @(Get-ChildItem -LiteralPath $elleYedekKlasor -Filter 'butce-yedek-*.db' |
                  Sort-Object LastWriteTime -Descending | Select-Object -Skip 30)
        foreach ($e in $eski) { Remove-Item -LiteralPath $e.FullName -Force -ErrorAction SilentlyContinue }
        Json-Yanit $yanit ('{"basarili":true,"dosya":"' + $ad + '","klasor":"' + (Json-Metin $elleYedekKlasor) +
                           '","boyut":' + $bytes.Length + ',"sifreli":' + ($tur -eq 'sifreli').ToString().ToLower() + '}') 200
        Write-Host ("  200  elle yedek -> " + $ad) -ForegroundColor Green
      } catch {
        Json-Yanit $yanit ('{"basarili":false,"mesaj":"' + (Json-Metin $_.Exception.Message) + '"}') 500
        Write-Host ("  500  yedek kaydedilemedi: " + $_.Exception.Message) -ForegroundColor Red
      }
      continue
    }

    if ($yol -eq '/yedek-listesi') {
      $satirlar = @()
      if (Test-Path -LiteralPath $elleYedekKlasor) {
        foreach ($f in (Get-ChildItem -LiteralPath $elleYedekKlasor -Filter '*.db' | Sort-Object LastWriteTime -Descending)) {
          $satirlar += '{"ad":"' + (Json-Metin $f.Name) + '","boyut":' + $f.Length +
                       ',"tarih":"' + $f.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss') + '"' +
                       ',"sifreli":' + (Imza-Sifreli $f.FullName).ToString().ToLower() + '}'
        }
      }
      Json-Yanit $yanit ('{"basarili":true,"klasor":"' + (Json-Metin $elleYedekKlasor) + '","yedekler":[' + ($satirlar -join ',') + ']}') 200
      continue
    }

    # ---------------------------------------------------------------
    #  VERI:  GET /veri   POST /veri   DELETE /veri
    #  CAKISMA KORUMASI: surum = dosyanin son yazma zamani (ticks, METIN
    #  olarak X-Veri-Surum basliginda — JSON sayisi 19 basamagi yuvarlar).
    #  Yazarken surum uyusmuyorsa 409: baskasi bu arada yazmis demektir.
    # ---------------------------------------------------------------
    if ($yol -eq '/veri') {
      if ($istek.HttpMethod -eq 'GET') {
        if (Test-Path -LiteralPath $veriDosya) {
          $bytes = [IO.File]::ReadAllBytes($veriDosya)
          $surum = (Get-Item -LiteralPath $veriDosya).LastWriteTimeUtc.Ticks
          $yanit.StatusCode = 200
          $yanit.ContentType = 'application/octet-stream'
          $yanit.Headers.Add('X-Veri-Surum', [string]$surum)
          $yanit.Headers.Add('Cache-Control', 'no-store')
          $yanit.ContentLength64 = $bytes.Length
          $yanit.OutputStream.Write($bytes, 0, $bytes.Length)
          Write-Host ("  200  /veri okundu (" + [Math]::Round($bytes.Length / 1KB) + " KB)") -ForegroundColor DarkGray
        } else {
          $yanit.StatusCode = 204
          $yanit.Headers.Add('X-Veri-Surum', '0')
          Write-Host "  204  /veri henuz yok (ilk kurulum / tasima)" -ForegroundColor Yellow
        }
        $yanit.OutputStream.Close()
        continue
      }

      # Sifirlama: dosya SILINMEDEN once yedege kopyalanir
      if ($istek.HttpMethod -eq 'DELETE') {
        if (Test-Path -LiteralPath $veriDosya) {
          if (-not (Test-Path -LiteralPath $veriYedekKlasor)) { New-Item -ItemType Directory -Path $veriYedekKlasor -Force | Out-Null }
          $yAd = 'sifirlama-oncesi-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.db'
          Copy-Item -LiteralPath $veriDosya -Destination (Join-Path $veriYedekKlasor $yAd) -Force
          Remove-Item -LiteralPath $veriDosya -Force
          Write-Host ("  200  /veri SILINDI - yedegi: " + $yAd) -ForegroundColor Yellow
        }
        Json-Yanit $yanit '{"basarili":true}' 200
        continue
      }

      if ($istek.HttpMethod -eq 'POST') {
        $bytes = Govde-Oku $istek
        $tur = Veri-Turu $bytes
        if (-not $tur) {
          Json-Yanit $yanit '{"basarili":false,"mesaj":"Gelen veri bir Ucret Hesaplama veri dosyasi degil."}' 400
          continue
        }
        if (Duz-Reddedilsin-Mi $tur) {
          Json-Yanit $yanit '{"basarili":false,"sifreGerekli":true,"mesaj":"Sifreleme acik; sifresiz veri yazilmaz."}' 423
          Write-Host "  423  /veri REDDEDILDI - sifreleme acikken sifresiz veri geldi" -ForegroundColor Red
          continue
        }
        # --- Cakisma kontrolu (sendBeacon baslik koyamaz; surum sorgu dizesiyle de gelir) ---
        $bekleyen = $istek.Headers['X-Veri-Surum']
        if (-not $bekleyen) { $bekleyen = $istek.QueryString['surum'] }
        $mevcutSurum = 0
        if (Test-Path -LiteralPath $veriDosya) { $mevcutSurum = (Get-Item -LiteralPath $veriDosya).LastWriteTimeUtc.Ticks }
        if ($mevcutSurum -ne 0 -and $bekleyen -and ([string]$mevcutSurum) -ne ([string]$bekleyen)) {
          Json-Yanit $yanit ('{"basarili":false,"cakisma":true,"surum":"' + $mevcutSurum + '"}') 409
          Write-Host "  409  /veri CAKISMA - baskasi once yazmis" -ForegroundColor Yellow
          continue
        }
        # --- Yazmadan ONCE yedek (son 20, en cok 10 dakikada bir) ---
        if (Test-Path -LiteralPath $veriDosya) {
          if (-not (Test-Path -LiteralPath $veriYedekKlasor)) { New-Item -ItemType Directory -Path $veriYedekKlasor -Force | Out-Null }
          $sonYedek = Get-ChildItem -LiteralPath $veriYedekKlasor -Filter 'veri-*.db' -ErrorAction SilentlyContinue |
                      Sort-Object LastWriteTime -Descending | Select-Object -First 1
          if (-not $sonYedek -or ((Get-Date) - $sonYedek.LastWriteTime).TotalMinutes -ge 10) {
            $yAd = 'veri-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.db'
            Copy-Item -LiteralPath $veriDosya -Destination (Join-Path $veriYedekKlasor $yAd) -Force
            $eski = @(Get-ChildItem -LiteralPath $veriYedekKlasor -Filter 'veri-*.db' |
                      Sort-Object LastWriteTime -Descending | Select-Object -Skip 20)
            foreach ($e in $eski) { Remove-Item -LiteralPath $e.FullName -Force -ErrorAction SilentlyContinue }
          }
        }
        if (-not (Test-Path -LiteralPath $veriKlasor)) { New-Item -ItemType Directory -Path $veriKlasor -Force | Out-Null }
        # Once gecici dosyaya, sonra yerine: yazma yarida kesilirse mevcut veri bozulmaz
        $gecici = $veriDosya + '.yeni'
        [IO.File]::WriteAllBytes($gecici, $bytes)
        Move-Item -LiteralPath $gecici -Destination $veriDosya -Force
        $yeniSurum = (Get-Item -LiteralPath $veriDosya).LastWriteTimeUtc.Ticks
        $yanit.Headers.Add('X-Veri-Surum', [string]$yeniSurum)
        Json-Yanit $yanit ('{"basarili":true,"surum":"' + $yeniSurum + '","boyut":' + $bytes.Length + '}') 200
        Write-Host ("  200  /veri yazildi (" + [Math]::Round($bytes.Length / 1KB) + " KB, " + $tur + ")") -ForegroundColor Green
        continue
      }
    }

    # ---------------------------------------------------------------
    #  YAZMA KILIDI:  GET / POST / DELETE /kilit   (veri\kilit.json)
    #  Ayni anda yalniz bir kisi kayit yapar; 120 sn tazelenmeyen kilit
    #  dusmus sayilir. Kilit sunucu belleginde degil dosyada: ortak
    #  klasorde herkes kendi sunucusunu calistirir, ortak olan klasordur.
    # ---------------------------------------------------------------
    if ($yol -eq '/kilit') {
      $kilitDosya = Join-Path $veriKlasor 'kilit.json'
      $mevcut = $null
      if (Test-Path -LiteralPath $kilitDosya) {
        try { $mevcut = Get-Content -LiteralPath $kilitDosya -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $mevcut = $null }
      }
      $dusmus = $true
      if ($mevcut -and $mevcut.tazelendi) {
        try { $dusmus = (((Get-Date).ToUniversalTime() - [datetime]::Parse($mevcut.tazelendi).ToUniversalTime()).TotalSeconds -gt 120) } catch { $dusmus = $true }
      }
      if ($istek.HttpMethod -eq 'GET') {
        Json-Yanit $yanit (@{ basarili = $true; bos = [bool](-not $mevcut -or $dusmus); kilit = $mevcut } | ConvertTo-Json -Compress) 200
        continue
      }
      if ($istek.HttpMethod -eq 'POST') {
        if ($istek.QueryString['birak'] -eq '1') {   # sendBeacon daima POST gonderir
          $ot = $istek.QueryString['oturum']
          if ($mevcut -and $ot -and $mevcut.oturum -eq $ot) { Remove-Item -LiteralPath $kilitDosya -Force -ErrorAction SilentlyContinue }
          Json-Yanit $yanit '{"basarili":true}' 200
          continue
        }
        $gelen = $null
        try { $gelen = [Text.Encoding]::UTF8.GetString((Govde-Oku $istek)) | ConvertFrom-Json } catch { }
        if (-not $gelen -or -not $gelen.oturum) { Json-Yanit $yanit '{"basarili":false,"mesaj":"Oturum bilgisi eksik."}' 400; continue }
        $benimMi = ($mevcut -and $mevcut.oturum -eq $gelen.oturum)
        if ($mevcut -and -not $dusmus -and -not $benimMi) {
          Json-Yanit $yanit (@{ basarili = $true; sahip = $false; kilit = $mevcut } | ConvertTo-Json -Compress) 200
          continue
        }
        if (-not (Test-Path -LiteralPath $veriKlasor)) { New-Item -ItemType Directory -Path $veriKlasor -Force | Out-Null }
        $simdi = (Get-Date).ToUniversalTime().ToString('o')
        $alindi = $simdi
        if ($benimMi -and $mevcut.alindi) { $alindi = [string]$mevcut.alindi }
        $yeni = @{
          oturum = [string]$gelen.oturum; kullanici = [string]$gelen.kullanici; adSoyad = [string]$gelen.adSoyad
          bilgisayar = [string]$env:COMPUTERNAME; alindi = $alindi; tazelendi = $simdi
        }
        [IO.File]::WriteAllText($kilitDosya, ($yeni | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
        Json-Yanit $yanit (@{ basarili = $true; sahip = $true; kilit = $yeni } | ConvertTo-Json -Compress) 200
        continue
      }
      if ($istek.HttpMethod -eq 'DELETE') {
        $ot = $istek.QueryString['oturum']
        if ($mevcut -and $ot -and $mevcut.oturum -eq $ot) { Remove-Item -LiteralPath $kilitDosya -Force -ErrorAction SilentlyContinue }
        Json-Yanit $yanit '{"basarili":true}' 200
        continue
      }
    }

    # ---------------------------------------------------------------
    #  SIFRELEME ISARETI:  POST / DELETE / GET /sifre-isaret
    #  "Bu kurulumda sifreleme ACIK" bilgisi veritabaninin DISINDA durur;
    #  sifirlamadan sag cikar. Isaret varken sunucu duz veri yazmaz.
    # ---------------------------------------------------------------
    if ($yol -eq '/sifre-isaret') {
      if ($istek.HttpMethod -eq 'POST') {
        if (-not (Test-Path -LiteralPath $veriKlasor)) { New-Item -ItemType Directory -Path $veriKlasor -Force | Out-Null }
        [IO.File]::WriteAllText($isaretDosya,
          "Bu kurulumda veri sifrelemesi acik.`r`nKuruldugu an: " + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss') +
          "`r`nBu dosyayi SILMEYIN: program sifrelemenin dustugunu bundan anlar ve sifresiz veri yazilmasini engeller.`r`n",
          (New-Object Text.UTF8Encoding $false))
        Write-Host "  200  sifreleme isareti konuldu" -ForegroundColor Green
      } elseif ($istek.HttpMethod -eq 'DELETE') {
        Remove-Item -LiteralPath $isaretDosya -Force -ErrorAction SilentlyContinue
        Write-Host "  200  sifreleme isareti kaldirildi" -ForegroundColor Yellow
      }
      Json-Yanit $yanit ('{"basarili":true,"isaret":' + (Test-Path -LiteralPath $isaretDosya).ToString().ToLower() + '}') 200
      continue
    }

    if ($yol -eq '/veri-bilgi') {
      $var = Test-Path -LiteralPath $veriDosya
      $boyut = 0; $tarih = ''; $sifreli = $false
      if ($var) {
        $f = Get-Item -LiteralPath $veriDosya
        $boyut = $f.Length
        $tarih = $f.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss')
        $sifreli = Imza-Sifreli $veriDosya
      }
      # Sifresiz kalmis kopyalar sayilir: kullanici bunlari gorup silebilsin
      $yedekSayi = 0; $duzYedek = 0
      foreach ($k in @($veriYedekKlasor, $elleYedekKlasor)) {
        if (-not (Test-Path -LiteralPath $k)) { continue }
        foreach ($yf in @(Get-ChildItem -LiteralPath $k -Filter '*.db')) {
          if ($k -eq $veriYedekKlasor) { $yedekSayi++ }
          if (-not (Imza-Sifreli $yf.FullName)) { $duzYedek++ }
        }
      }
      Json-Yanit $yanit ('{"basarili":true,"var":' + $var.ToString().ToLower() +
        ',"yol":"' + (Json-Metin $veriDosya) + '","boyut":' + $boyut + ',"tarih":"' + $tarih + '"' +
        ',"sifreli":' + $sifreli.ToString().ToLower() +
        ',"yedekKlasor":"' + (Json-Metin $veriYedekKlasor) + '","elleYedekKlasor":"' + (Json-Metin $elleYedekKlasor) + '"' +
        ',"yedekSayisi":' + $yedekSayi + ',"duzYedek":' + $duzYedek +
        ',"sifreIsaret":' + (Test-Path -LiteralPath $isaretDosya).ToString().ToLower() + '}') 200
      continue
    }

    # ---------------------------------------------------------------
    #  STATIK DOSYALAR — program klasorunun disina cikilamaz
    #  (.ProviderPath: ag yolunda .Path saglayici onekiyle donuyor)
    # ---------------------------------------------------------------
    $tamYol = Join-Path $kok ($yol.TrimStart('/') -replace '/', '\')
    $cozulmus = $null
    try { $cozulmus = (Resolve-Path -LiteralPath $tamYol -ErrorAction Stop).ProviderPath } catch { }
    if ($cozulmus -and $cozulmus.StartsWith($kok, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $cozulmus -PathType Leaf)) {
      $uzanti = [IO.Path]::GetExtension($cozulmus).ToLower()
      $yanit.ContentType = if ($tipler.ContainsKey($uzanti)) { $tipler[$uzanti] } else { 'application/octet-stream' }
      $veri = [IO.File]::ReadAllBytes($cozulmus)
      $yanit.StatusCode = 200
      $yanit.Headers.Add('Cache-Control', 'no-store, no-cache, must-revalidate')
      $yanit.ContentLength64 = $veri.Length
      $yanit.OutputStream.Write($veri, 0, $veri.Length)
    } else {
      $yanit.StatusCode = 404
      $veri = [Text.Encoding]::UTF8.GetBytes('Dosya bulunamadi: ' + $yol)
      $yanit.ContentType = 'text/plain; charset=utf-8'
      $yanit.ContentLength64 = $veri.Length
      $yanit.OutputStream.Write($veri, 0, $veri.Length)
      Write-Host ("  404  " + $yol) -ForegroundColor Yellow
    }
    $yanit.OutputStream.Close()
    } catch {
      Write-Host ("  HATA  " + $yol + "  ->  " + $_.Exception.Message) -ForegroundColor Red
      try { $yanit.StatusCode = 500; $yanit.OutputStream.Close() } catch { }
    }
  }
} finally {
  $dinleyici.Stop()
  $dinleyici.Close()
  Write-Host "Sunucu durduruldu." -ForegroundColor Yellow
}
