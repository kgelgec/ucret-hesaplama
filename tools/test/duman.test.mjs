// Duman testi: ilk kurulumdan sonra her yıl × grup × ekran açılır; hiçbir ekran "görüntülenemedi" kutusu,
// sayfa / konsol hatası, HTTP hatası ya da hata bildirimi vermemeli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kur } from './ortak.mjs';

for (const kip of ['ornek', 'bos']) {
  test(`bütün ekranlar açılıyor (${kip === 'ornek' ? 'örnek veri' : 'boş kurulum'})`, async () => {
    const o = await kur({ kip });
    try {
      const r = await o.s.evaluate(() => {
        const bildirim = [], ekran = [];
        const eski = U.bildir;
        U.bildir = (m, t) => { if (t === 'hata') bildirim.push(m); return eski(m, t); };
        const moduller = [...new Set(APP.gorunurModuller().map(m => m.id).concat(['performans', 'mesai', 'kilavuz']))];
        const gruplar = API.gorunurGruplar().map(g => g.kod);
        const yillar = [...new Set(API.calismaListe().map(c => c.yil))];
        let acilan = 0;
        (yillar.length ? yillar : [new Date().getFullYear()]).forEach(y =>
          (gruplar.length > 1 ? gruplar.concat(['TUMU']) : gruplar.length ? gruplar : [null]).forEach(g => {
            APP.secimYap(y, g);
            moduller.forEach(id => {
              try { APP.git(id); acilan++; } catch (e) { ekran.push(`${y}/${g}/${id}: ${e.message}`); }
              const h = [...document.querySelectorAll('#icerik .uyari-hata')].find(x => /görüntülenemedi/.test(x.textContent));
              if (h) ekran.push(`${y}/${g}/${id}: ${h.textContent.replace(/\s+/g, ' ').trim().slice(0, 200)}`);
              C.kipHepsiniKapat();
            });
          }));
        U.bildir = eski;
        return { acilan, ekran, bildirim, calisma: API.calismaListe().length };
      });
      assert.ok(r.acilan > 10, 'açılan ekran sayısı: ' + r.acilan);
      if (kip === 'ornek') assert.equal(r.calisma, 4, 'örnek veride 4 bütçe çalışması olmalı');
      assert.deepEqual(r.ekran, []);
      assert.deepEqual(r.bildirim, []);
      assert.deepEqual(o.hatalar, []);
    } finally { await o.kapat(); }
  });
}
