// Testlerin ortak yardımcıları: deneme sunucusunu geçici bir veri klasörüyle açar, tarayıcıyı başlatır,
// ilk kurulumu yapar ve sayfa hatalarını toplar. Gerçek veri klasörüne hiç dokunmaz (-Deneme -VeriKok).
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROGRAM = join(KOK, 'program');
export const bekle = ms => new Promise(r => setTimeout(r, ms));

/* Chrome ya da Edge: CHROME_YOLU ortam değişkeni, yoksa bilinen kurulum yerleri */
export function tarayiciYolu() {
  const adaylar = [process.env.CHROME_YOLU,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
  const y = adaylar.find(a => existsSync(a));
  if (!y) throw new Error('Chrome ya da Edge bulunamadı; CHROME_YOLU ortam değişkeniyle yolunu verin.');
  return y;
}

export function bosPort() {
  return new Promise((res, rej) => {
    const s = createServer(); s.unref(); s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

/* Deneme sunucusu: geçici veri klasörüyle. Dönüş: { port, veriKok, kapat() } */
export async function sunucuAc(veriKok) {
  const port = await bosPort();
  veriKok = veriKok || mkdtempSync(join(tmpdir(), 'ucret-test-'));
  const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    join(PROGRAM, 'Sunucuyu-Baslat.ps1'), '-Port', String(port), '-VeriKok', veriKok, '-Deneme'], { stdio: 'ignore' });
  let acildi = false;
  for (let i = 0; i < 120 && !acildi; i++) {
    try { acildi = (await fetch(`http://localhost:${port}/`)).ok; } catch (e) { await bekle(500); }
  }
  const kapat = () => {
    spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    for (let i = 0; i < 10; i++) { try { rmSync(veriKok, { recursive: true, force: true }); break; } catch (e) { spawnSync('cmd', ['/c', 'timeout /t 1 >nul']); } }
  };
  if (!acildi) { kapat(); throw new Error('Deneme sunucusu açılmadı (port ' + port + ').'); }
  return { port, veriKok, adres: `http://localhost:${port}/`, kapat };
}

/* Sunucu + tarayıcı + ilk kurulum. kip: 'ornek' | 'bos'.
   Dönüş: { s (sayfa), tarayici, sunucu, hatalar[], kapat() }. hatalar: sayfa hatası, konsol hatası, HTTP ≥ 400. */
export async function kur({ kip = 'ornek', genislik = 1440, yukseklik = 900, kullanici = 'deneme', parola = 'deneme-1234', ad = 'Deneme Yönetici' } = {}) {
  const sunucu = await sunucuAc();
  let tarayici;
  try {
    tarayici = await puppeteer.launch({ executablePath: tarayiciYolu(), headless: true, args: ['--no-sandbox'] });
    const s = await tarayici.newPage();
    await s.setViewport({ width: genislik, height: yukseklik });
    const hatalar = [];
    s.on('pageerror', e => hatalar.push('sayfa hatası: ' + e.message));
    s.on('console', m => { if (m.type() === 'error') hatalar.push('konsol: ' + m.text()); });
    s.on('response', r => { if (r.status() >= 400) hatalar.push('HTTP ' + r.status() + ' ' + r.url()); });
    await s.goto(sunucu.adres, { waitUntil: 'load' });
    await s.waitForSelector('#vkGec', { timeout: 60000 }); await s.click('#vkGec');
    await s.waitForSelector('#vkGecOnay'); await s.click('#vkGecOnay');
    await s.waitForSelector('#kurBtn', { timeout: 60000 });
    await s.type('#kurAd', ad); await s.type('#kurKullanici', kullanici);
    await s.type('#kurParola', parola); await s.type('#kurParola2', parola);
    await s.click(`input[name="kurBaslangic"][value="${kip}"]`);
    await s.click('#kurBtn');
    await s.waitForFunction(() => !document.getElementById('uygulama').classList.contains('gizli'), { timeout: 120000 });
    // İlk girişte açılan başlangıç gezisi tıklamaları yutar: kapat, odağı bırak
    await s.evaluate(() => { window.GEZI && GEZI.kapat(true); document.activeElement && document.activeElement.blur(); });
    await s.addStyleTag({ content: '.toast{display:none !important}' });
    await bekle(500);
    const kapat = async () => { try { await tarayici.close(); } catch (e) { } sunucu.kapat(); };
    return { s, tarayici, sunucu, hatalar, kapat };
  } catch (e) {
    try { if (tarayici) await tarayici.close(); } catch (e2) { }
    sunucu.kapat();
    throw e;
  }
}

/* Örnek verinin kişi kişi, ay ay sonuçları (docs/referans/ornek-veri-sonuclari.json biçimi). Tarayıcıda çalışır. */
export function referansSonuclari() {
  const r2 = x => (typeof x === 'number' ? Math.round(x * 100) / 100 : x);
  const KALEM = ['AM', 'AN', 'AP', 'AQ', 'AR', 'AS', 'AV', 'AZ', 'BB', 'BC', 'BD', 'BK', 'BL', 'BM', 'BX', 'CF', 'CQ',
                 'CV', 'CW', 'CX', 'CY', 'CZ', 'DA', 'DB', 'DC', 'DD', 'DE', 'DF', 'DG', 'DH', 'DI', 'DJ', 'DK', 'DL', 'DM'];
  const calismalar = API.calismaListe().slice().sort((a, b) => a.yil - b.yil || a.grup_kod.localeCompare(b.grup_kod)).map(c => {
    const h = API.calismaHesapla(c.id, { tazele: true });
    const kisiler = h.kisiler.map(s => ({
      tc: s.kp.tc_kimlik_no, ad: s.kp.ad_soyad, yaka: s.kp.yaka, butce_bolumu: s.kp.butce_bolumu,
      ise_giris: s.kp.onay_sabit ? s.kp.onay_giris : s.kp.ise_giris,
      isten_ayrilis: s.kp.onay_sabit ? s.kp.onay_cikis : s.kp.isten_ayrilis,
      hesap_turu: s.kp.hesap_turu, kanun: s.kp.kanun, maas_eski: s.kp.maas_eski, duzeltme: s.kp.duzeltme,
      zam_ayi: s.kp.zam_ayi, performans_carpani: s.kp.performans_carpani,
      zam: Object.fromEntries(Object.entries(s.zam).map(([k, v]) => [k, r2(v)])),
      yillik_maliyet: r2(s.yil.maliyet),
      aylar: s.yil.aylar.slice(1).map(a => Object.fromEntries(KALEM.map(k => [k, r2(a[k] || 0)]))),
    }));
    return {
      calisma: { yil: c.yil, grup_kod: c.grup_kod, grup_adi: c.grup_adi, ad: c.ad, durum: c.durum },
      kisi: kisiler.length,
      toplam_maliyet: r2(h.kisiler.reduce((t, s) => t + s.yil.maliyet, 0)),
      kisiler,
    };
  });
  return {
    aciklama: 'Ücret Hesaplama — ÖRNEK VERİ referans sonuçları (uydurma veri; bkz. tools/ornek-veri-uret.mjs). ' +
      'Tutarlar TL, 2 haneye yuvarlı. aylar[0] = Ocak. Kalem kodları motorun alan kodlarıdır (bkz. docs/02-hesap-motoru.md); ' +
      'DM = aylık toplam işveren maliyeti, DD = net ödeme, CV = brüt toplam.',
    calismalar,
  };
}

/* İki değeri karşılaştırır: sayılar toleransla, diğerleri birebir. Farkları yol ile listeler (en çok sinir kadar). */
export function farklar(a, b, tolerans = 0.011, yol = '', liste = [], sinir = 20) {
  if (liste.length >= sinir) return liste;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > tolerans) liste.push(`${yol}: ${b} (beklenen) ≠ ${a}`);
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) farklar(a[k], b[k], tolerans, yol + '.' + k, liste, sinir);
  } else if (a !== b) liste.push(`${yol}: ${JSON.stringify(b)} (beklenen) ≠ ${JSON.stringify(a)}`);
  return liste;
}
