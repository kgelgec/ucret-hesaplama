// Ücret esası gidiş-dönüş: net esasta hesaplanan brütler brüt esasa girdi verilince net ödeme, maliyet ve bütün
// kesintiler aynı çıkmalı; brüt esasta döngü ilk turda bitmeli. Mesaili aylarda brüt mesai = brüt saat ücreti × katsayı × saat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kur } from './ortak.mjs';

test('net → brüt gidiş-dönüş örnek verinin bütün kişi-aylarında tutuyor', async () => {
  const o = await kur({ kip: 'ornek' });
  try {
    const r = await o.s.evaluate(() => {
      const ALAN = ['DD', 'DM', 'CY', 'DA', 'CW', 'CX', 'DE', 'DF', 'DG', 'DH', 'DI', 'DJ', 'DK', 'DL', 'DC', 'CV'];
      let ay = 0, mesaiAy = 0, enBuyuk = 0, nerede = '';
      const hatalar = [];
      API.calismaListe().forEach(c => {
        const h = API.calismaHesapla(c.id, { tazele: true });
        const Pb = Object.assign({}, h.P, { ucretEsasi: 'BRUT' });
        h.kisiler.forEach(k => {
          for (let m = 1; m <= 12; m++) {
            const a = k.yil.aylar[m], g = k.girdi[m];
            if (!(a.AM > 0) || !(a.AR > 0)) continue;
            const dev = m > 1 ? k.yil.aylar[m - 1].CK : 0;
            const AMb = a.BB * 30 / a.AR;
            const kk = { yaka: k.kp.yaka, girisAy: 0, cikisAy: null, zamAyi: 1, maasEski: AMb, maasYeni: AMb };
            if ((g.fm1 || 0) === 0 && (g.fm2 || 0) === 0) {
              const b = HESAP.ayHesapla(Pb, kk, Object.assign({}, g, { ayni: a.BX, prim: a.CF, yol: 0, yakit: a.CQ, fm1: 0, fm2: 0 }), m, dev);
              ay++;
              ALAN.forEach(x => {
                const f = Math.abs((b[x] || 0) - (a[x] || 0));
                if (f > enBuyuk) { enBuyuk = f; nerede = `${c.yil}/${c.grup_kod} ${k.kp.ad_soyad} ay ${m} ${x}`; }
                if (f > 0.01 && hatalar.length < 10) hatalar.push(`${c.yil}/${c.grup_kod} ${k.kp.ad_soyad} ay ${m} ${x}: net ${a[x]} brüt ${b[x]}`);
              });
              if (b.tur !== 1 && hatalar.length < 10) hatalar.push('brüt esasta döngü ilk turda bitmedi: ' + b.tur);
            } else {
              const b = HESAP.ayHesapla(Pb, kk, Object.assign({}, g, { ayni: 0, prim: 0, yol: 0, yakit: 0 }), m, dev);
              const bek = AMb / 30 / (Pb.gunlukSaat || 7.5) * (Pb.mesaiKat1 * (g.fm1 || 0) + Pb.mesaiKat2 * (g.fm2 || 0));
              mesaiAy++;
              if (Math.abs(b.BM - bek) > 1e-6 && hatalar.length < 10) hatalar.push(`mesai ${k.kp.ad_soyad} ay ${m}: ${b.BM} ≠ ${bek}`);
            }
          }
        });
      });
      return { ay, mesaiAy, enBuyuk, nerede, hatalar };
    });
    assert.ok(r.ay > 500, 'karşılaştırılan kişi-ay sayısı beklenenden az: ' + r.ay);
    assert.ok(r.mesaiAy > 0, 'mesaili ay bulunamadı');
    assert.deepEqual(r.hatalar, [], `en büyük fark ${r.enBuyuk} (${r.nerede})`);
    assert.deepEqual(o.hatalar, []);
  } finally { await o.kapat(); }
});
