// Personel ve Zam → Kişi Bilgileri: hücreden düzenlenen alanlar kaydedilir, kişi kartıyla aynı değeri gösterir,
// maliyet yeniden hesaplanır; geçersiz tarih reddedilir; onaylı çalışmada düzenleme kutusu çıkmaz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kur, bekle } from './ortak.mjs';

test('kişi bilgileri tablodan düzenleniyor', async () => {
  const o = await kur({ kip: 'ornek' });
  const s = o.s;
  try {
    await s.evaluate(() => { APP.secimYap(2027, 'OFIS'); APP.git('personel'); });
    await s.click('[data-sekme="kisi"]'); await bekle(300);
    const tc = await s.evaluate(() => API.calismaPersonelListe(APP.calisma().id)[4].tc_kimlik_no);
    const oku = () => s.evaluate(t => {
      const c = APP.calisma(), k = API.calismaPersonelGetir(c.id, t);
      const h = API.calismaHesapla(c.id, { tazele: true }).kisiler.find(x => x.kp.tc_kimlik_no === t);
      return { yaka: k.yaka, zam_ayi: k.zam_ayi, gv: k.gv_tesvik, sak: k.sakatlik_derece, ozurlu: k.ozurlu_indirimi, bes: k.bes,
        bolum: k.butce_bolumu, giris: k.ise_giris, cikis: k.isten_ayrilis, puan: k.performans_puani, maliyet: Math.round(h.yil.maliyet) };
    }, tc);
    const once = await oku();
    const y0 = await s.evaluate(() => { window.scrollTo(0, 300); return window.scrollY; });
    assert.ok(y0 > 0, 'sayfa kaydırılabilmeli');
    const sec = async (alan, deger) => { await s.select(`#icerik select[data-alan="${alan}"][data-tc="${tc}"]`, String(deger)); await bekle(200); };
    await sec('yaka', 'M');
    assert.equal(await s.evaluate(() => window.scrollY), y0, 'kayıttan sonra kaydırma korunmalı');
    assert.equal(await s.evaluate(t => document.activeElement.getAttribute('data-alan') + '/' + (document.activeElement.getAttribute('data-tc') === t), tc), 'yaka/true', 'odak aynı hücrede kalmalı');
    await sec('zam_ayi', 4); await sec('gv_tesvik', 0.8); await sec('sakatlik_derece', 2); await sec('bes', 'EVET');
    const bolum = await s.evaluate(t => [...document.querySelector(`#icerik select[data-alan="butce_bolumu"][data-tc="${t}"]`).options].map(x => x.value).filter(Boolean)[2], tc);
    await sec('butce_bolumu', bolum);
    const tarih = async (alan, deger) => {
      await s.evaluate((sc, v) => { const e = document.querySelector(sc); e.focus(); e.value = v; }, `#icerik input[data-alan="${alan}"][data-tc="${tc}"]`, deger);
      await s.keyboard.press('Enter'); await bekle(250);
    };
    await tarih('isten_ayrilis', '2027-09-30');
    await s.click(`#icerik input[data-alan="performans_puani"][data-tc="${tc}"]`, { clickCount: 3 });
    await s.keyboard.type('87,5'); await s.keyboard.press('Tab'); await bekle(250);
    assert.equal(await s.evaluate(() => document.activeElement.getAttribute('data-alan')), 'performans_carpani', 'Tab sıradaki hücreye geçmeli');
    const sonra = await oku();
    assert.deepEqual({ yaka: sonra.yaka, zam_ayi: sonra.zam_ayi, gv: sonra.gv, sak: sonra.sak, bes: sonra.bes, bolum: sonra.bolum, cikis: sonra.cikis, puan: sonra.puan },
      { yaka: 'M', zam_ayi: 4, gv: 0.8, sak: 2, bes: 'EVET', bolum, cikis: '2027-09-30', puan: 87.5 });
    assert.ok(sonra.ozurlu > 0, 'sakatlık derecesinden indirim tutarı yazılmalı');
    assert.ok(sonra.maliyet < once.maliyet, 'Eylül çıkışı yıllık maliyeti düşürmeli');
    // Geçersiz tarih reddedilir
    await s.evaluate(t => { const e = document.querySelector(`#icerik input[data-alan="ise_giris"][data-tc="${t}"]`); e.value = '0002-01-01'; e.dispatchEvent(new Event('blur')); }, tc);
    await bekle(250);
    assert.equal((await oku()).giris, once.giris, 'geçersiz tarih kaydedilmemeli');
    // Kişi kartı aynı değerleri gösterir
    await s.click(`#icerik [data-kart="${tc}"]`); await bekle(250);
    const kart = await s.evaluate(() => { const k = document.querySelector('.kip'), v = n => k.querySelector(`[name=${n}]`).value;
      return { yaka: v('yaka'), zam_ayi: v('zam_ayi'), sak: v('sakatlik_derece'), bes: v('bes'), cikis: v('isten_ayrilis') }; });
    assert.deepEqual(kart, { yaka: 'M', zam_ayi: '4', sak: '2', bes: 'EVET', cikis: '2027-09-30' });
    await s.evaluate(() => C.kipHepsiniKapat());
    // Onaylı çalışmada kutu yok
    await s.evaluate(() => { APP.secimYap(2026, 'OFIS'); APP.git('personel'); });
    await bekle(250);
    assert.equal(await s.evaluate(() => document.querySelectorAll('#icerik [data-alan][data-tc]').length), 0);
    assert.deepEqual(o.hatalar, []);
  } finally { await o.kapat(); }
});
