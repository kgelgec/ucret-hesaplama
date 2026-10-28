// Kutu hizası denetimi: her ekran (tek grup ve Tümü), sekmeler ve iletişim pencereleri için aynı satırdaki kutuların
// yükseklik / dikey hiza farkı, etiketin içindeki kutunun alta düşmesi, tablo satırında farklı boyda kutular, kart
// başlığında sağa yaslanmayan düğme. Bulgu varsa çıkış kodu 1. Ekran görüntüleri: <tmp>/ucret-hiza/
// Kullanım: npm run hiza            (1366 px)   ·   node hiza.mjs 1024
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { kur, bekle } from './ortak.mjs';

const genislik = Number(process.argv[2] || 1366);
const cikti = join(tmpdir(), 'ucret-hiza');
rmSync(cikti, { recursive: true, force: true }); mkdirSync(cikti, { recursive: true });
const bulgular = [];

/* Sayfada çalışır: kök içindeki sorunları döndürür */
function denetle(kokSecici) {
  const kok = document.querySelector(kokSecici);
  if (!kok) return [];
  const gor = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const ad = e => (e.id ? '#' + e.id : '') + ' «' + ((e.tagName === 'SELECT' ? (e.selectedOptions[0] || {}).text : e.value || e.textContent) || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '»';
  const out = [];
  const kontrol = [...kok.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), select, button.btn')]
    .filter(e => gor(e) && !e.closest('table') && !e.closest('.gezi-perde'));
  // Aynı kapta (kart / pencere / bölüm) ve aynı görsel satırda olanlar
  const kap = e => e.closest('.kip-alt, .kip-govde, .kip-ust, .kart-baslik, .kart, .ust, .uyari') || kok;
  const satirlar = [];
  kontrol.forEach(e => {
    const r = e.getBoundingClientRect(), k = kap(e);
    const s = satirlar.find(x => x.kap === k && Math.min(x.alt, r.bottom) - Math.max(x.ust, r.top) > Math.min(x.alt - x.ust, r.height) * 0.5);
    if (s) { s.ogeler.push(e); s.ust = Math.min(s.ust, r.top); s.alt = Math.max(s.alt, r.bottom); }
    else satirlar.push({ kap: k, ust: r.top, alt: r.bottom, ogeler: [e] });
  });
  satirlar.filter(s => s.ogeler.length > 1).forEach(s => {
    const rr = s.ogeler.map(e => e.getBoundingClientRect());
    const h = rr.map(r => Math.round(r.height)), m = rr.map(r => (r.top + r.bottom) / 2);
    const hf = Math.max(...h) - Math.min(...h), mf = Math.max(...m) - Math.min(...m);
    if (hf > 2 || mf > 2.5)
      out.push(`${hf > 2 ? 'yükseklik ' + h.join('/') : ''}${hf > 2 && mf > 2.5 ? ', ' : ''}${mf > 2.5 ? 'dikey kayma ' + mf.toFixed(1) + 'px' : ''}: ` +
        s.ogeler.map(ad).join(' | '));
  });
  // Etiket içindeki kutu alt satıra düşmüş (yan yana olması gereken satır içi etiket)
  kok.querySelectorAll('label.satir, .suzgec-satir > label').forEach(l => {
    const c = l.querySelector('input:not([type=checkbox]):not([type=radio]), select');
    if (!c || !gor(c) || l.closest('table')) return;
    const lr = l.getBoundingClientRect(), cr = c.getBoundingClientRect();
    if (cr.top - lr.top > 10) out.push(`etiket üstte kaldı: «${l.textContent.trim().split('\n')[0].slice(0, 30)}» ${ad(c)}`);
  });
  // Tablo satırında farklı boyda kutular (tablo başına bir kez)
  const tablolar = new Set();
  kok.querySelectorAll('tr').forEach(tr => {
    const t = tr.closest('table'); if (tablolar.has(t)) return;
    const c = [...tr.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), select, button.btn')].filter(gor);
    if (c.length < 2) return;
    const h = c.map(e => Math.round(e.getBoundingClientRect().height));
    if (Math.max(...h) - Math.min(...h) > 2) { tablolar.add(t); out.push(`tablo satırında yükseklik ${h.join('/')}: ` + c.map(ad).join(' | ')); }
  });
  // Kart başlığında düğme sağa yaslanmamış
  kok.querySelectorAll('.kart-baslik').forEach(b => {
    if (!gor(b)) return;
    const br = b.getBoundingClientRect();
    [...b.children].slice(1).forEach(ch => {
      if (!gor(ch) || !(ch.matches('button, .btn, .sag, .btn-satir') || ch.querySelector('button'))) return;
      const r = ch.getBoundingClientRect();
      const sagBosluk = br.right - r.right;
      if (sagBosluk > 24 && r.top < br.top + 60) out.push(`başlık düğmesi sağa yaslı değil (${Math.round(sagBosluk)}px boşluk): «${ch.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)}» — ${(b.querySelector('h2,h3') || {}).textContent || ''}`);
    });
  });
  return out;
}

const o = await kur({ kip: 'ornek', genislik });
const s = o.s, hatalar = o.hatalar;
s.on('filechooser', fc => fc.cancel && fc.cancel());
try {
  const moduller = await s.evaluate(() => APP.gorunurModuller().map(m => m.id).concat(['kilavuz']));
  const kaydet = (yer, liste) => liste.forEach(b => bulgular.push(`[${yer}] ${b}`));
  let no = 0;
  const foto = async ad => { await s.screenshot({ path: join(cikti, `${String(++no).padStart(3, '0')}-${ad}.png`) }); };
  for (const grup of ['OFIS', 'TUMU']) {
    for (const m of moduller) {
      await s.evaluate((g, m) => { C.kipHepsiniKapat(); APP.secimYap(2027, g); APP.git(m); window.scrollTo(0, 0); }, grup, m);
      await bekle(250);
      const yer = `${m}/${grup}`;
      kaydet(yer, await s.evaluate(denetle, 'main'));
      await foto(`${m}-${grup}`);
      if (grup === 'TUMU') continue;
      // Sekmeler
      const sekmeSay = await s.evaluate(() => document.querySelectorAll('#icerik .sekme-cubuk button').length);
      for (let i = 1; i < sekmeSay; i++) {
        const ad = await s.evaluate(i => { const b = document.querySelectorAll('#icerik .sekme-cubuk button')[i]; b.click(); return b.textContent.trim(); }, i);
        await bekle(250);
        kaydet(`${yer} › ${ad}`, await s.evaluate(denetle, 'main'));
        await foto(`${m}-sekme${i}`);
      }
      if (sekmeSay) { await s.evaluate(m => APP.git(m), m); await bekle(200); }
      // Pencere açan düğmeler: "+ …", "…" ile biten, "Aralıkları Düzenle", ilk düzenle kalemi
      const acicilar = await s.evaluate(() => {
        const b = [...document.querySelectorAll('#icerik button')].filter(x => x.getBoundingClientRect().width > 0);
        const metin = x => x.textContent.trim();
        const sec = b.filter(x => /^\+ /.test(metin(x)) || /…$/.test(metin(x)) || metin(x) === 'Aralıkları Düzenle')
          .filter(x => !/Sıfırla|Sil|Yükle|al…|Excel/i.test(metin(x)));
        const kalem = b.find(x => (x.title || '').includes('Düzenle') || x.classList.contains('satir-duzenle'));
        const liste = sec.map(metin); if (kalem) liste.push('KALEM');
        return [...new Set(liste)];
      });
      for (const a of acicilar) {
        await s.evaluate(a => {
          const b = [...document.querySelectorAll('#icerik button')].filter(x => x.getBoundingClientRect().width > 0);
          const h = a === 'KALEM' ? b.find(x => (x.title || '').includes('Düzenle') || x.classList.contains('satir-duzenle'))
                                  : b.find(x => x.textContent.trim() === a);
          if (h) h.click();
        }, a);
        await bekle(350);
        const kipVar = await s.evaluate(() => !!document.querySelector('.kip'));
        if (kipVar) {
          kaydet(`${yer} ⧉ ${a}`, await s.evaluate(denetle, '.kip-perde:last-child'));
          await foto(`${m}-pencere-${a.replace(/[^\wçğıöşüÇĞİÖŞÜ]+/g, '_').slice(0, 24)}`);
        }
        await s.evaluate(() => C.kipHepsiniKapat());
      }
    }
  }
  // Kişi kartı (personel satırına tıklama)
  await s.evaluate(() => { APP.secimYap(2027, 'OFIS'); APP.git('personel'); });
  await bekle(300);
  await s.evaluate(() => { const t = document.querySelector('#icerik table tbody tr td a, #icerik table tbody tr [data-tc]'); if (t) t.click(); });
  await bekle(400);
  if (await s.evaluate(() => !!document.querySelector('.kip'))) {
    kaydet('personel ⧉ kişi kartı', await s.evaluate(denetle, '.kip-perde:last-child'));
    await foto('personel-kisi-karti');
  }
  console.log(bulgular.length ? bulgular.join('\n') : 'Hiza bulgusu yok.');
  console.log(`Toplam ${bulgular.length} bulgu (${genislik} px). Görüntüler: ${cikti}`);
  if (hatalar.length) console.log('HATALAR: ' + JSON.stringify(hatalar));
  if (bulgular.length || hatalar.length) process.exitCode = 1;
} finally { await o.kapat(); }
