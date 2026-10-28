// Yerel sunucu güvenliği: başka bir sitenin sayfası veri dosyasına yazamamalı (köken denetimi), yabancı Host
// başlığı reddedilmeli (DNS rebinding); programın kendi sayfası ve tarayıcı dışı araç çalışmalı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sunucuAc, bosPort, tarayiciYolu, bekle } from './ortak.mjs';

const istek = (port, yol, yontem, basliklar, govde, host = 'localhost') => new Promise(res => {
  const q = request({ host, port, path: yol, method: yontem, headers: basliklar },
    r => { r.resume(); r.on('end', () => res(r.statusCode)); });
  q.on('error', e => res('hata ' + e.message)); if (govde) q.write(govde); q.end();
});

test('yerel sunucu başka kökenden yazmayı reddediyor', async () => {
  const veriKok = mkdtempSync(join(tmpdir(), 'ucret-guvenlik-'));
  mkdirSync(join(veriKok, 'veri'));
  const dosya = join(veriKok, 'veri', 'butce.db');
  // Kullanıcının verisini temsil eden, geçerli SQLite imzalı dosya
  const asil = Buffer.concat([Buffer.from('SQLite format 3\u0000'), Buffer.alloc(4096, 1)]);
  writeFileSync(dosya, asil);
  const sunucu = await sunucuAc(veriKok);
  const kotuPort = await bosPort();
  // "Başka site": farklı porttan sunulan sayfa, açılınca arka planda POST /veri gönderir
  const kotu = createServer((q, r) => {
    r.setHeader('Content-Type', 'text/html; charset=utf-8');
    r.end(`<script>
      const b = new Uint8Array(5000), imza = 'SQLite format 3\\u0000';
      for (let i = 0; i < imza.length; i++) b[i] = imza.charCodeAt(i);
      fetch('http://localhost:${sunucu.port}/veri', { method: 'POST', mode: 'no-cors', body: new Blob([b]) })
        .then(() => document.title = 'gonderildi', () => document.title = 'engellendi');
    </script>`);
  }).listen(kotuPort);
  const tarayici = await puppeteer.launch({ executablePath: tarayiciYolu(), headless: true, args: ['--no-sandbox'] });
  try {
    const s = await tarayici.newPage();
    await s.goto(`http://127.0.0.1:${kotuPort}/`, { waitUntil: 'load' });
    await bekle(1500);
    assert.ok(readFileSync(dosya).equals(asil), 'başka sitenin sayfası veri dosyasının üzerine yazdı');

    const gecerli = Buffer.concat([Buffer.from('SQLite format 3\u0000'), Buffer.alloc(3000, 7)]);
    assert.equal(await istek(sunucu.port, '/veri', 'POST', { Origin: 'null', 'Content-Type': 'application/octet-stream' }, gecerli), 403, '"null" köken');
    assert.equal(await istek(sunucu.port, '/veri', 'DELETE', { Origin: 'https://kotu-site.example' }), 403, 'yabancı kökenden silme');
    assert.ok(existsSync(dosya) && readFileSync(dosya).equals(asil), 'veri dosyası değişmemeli');
    assert.equal(await istek(sunucu.port, '/veri', 'GET', { Host: 'kotu-site.example:' + sunucu.port }, null, '127.0.0.1'), 400, 'yabancı Host başlığı');
    assert.equal(await istek(sunucu.port, '/kilit', 'POST', { 'Content-Type': 'application/json' }, JSON.stringify({ oturum: 'arac' })), 200, 'Origin\'siz (tarayıcı dışı) istek');

    const p = await tarayici.newPage();
    await p.goto(sunucu.adres, { waitUntil: 'load' });
    const kendi = await p.evaluate(async () => {
      const r = await fetch('/kilit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oturum: 'deneme-' + Date.now() }) });
      return { durum: r.status, beacon: navigator.sendBeacon('/kilit?birak=1&oturum=x', 'x') };
    });
    assert.deepEqual(kendi, { durum: 200, beacon: true }, 'programın kendi sayfası yazabilmeli');
  } finally {
    await tarayici.close(); kotu.close(); sunucu.kapat();
  }
});
