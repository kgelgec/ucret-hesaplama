// Başlangıç gezisi: ilk girişte açılır, her adım kendi ekranını açar, klavyeyle gezilir, yeniden başlatılır;
// aynı hesabın ikinci girişinde açılmaz, yeni hesabın ilk girişinde açılır; çıkışta kapanır.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kur, bekle } from './ortak.mjs';

test('başlangıç gezisi', async () => {
  const o = await kur({ kip: 'ornek' });
  const s = o.s;
  const acik = () => s.evaluate(() => !!document.querySelector('.gezi-perde'));
  const durum = () => s.evaluate(() => {
    const k = document.querySelector('.gezi-kart'), r = k.getBoundingClientRect();
    return { sayac: k.querySelector('.gezi-sayac').textContent, modul: APP.aktifModul(),
      tasma: r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight };
  });
  try {
    // ilk kurulumda açılmıştı (kur() kapattı); düğmeyle yeniden başlat ve bütün adımları gez
    await s.click('#geziBtn'); await bekle(200);
    assert.ok(await acik(), 'düğmeyle açılmalı');
    const adimlar = [];
    for (let i = 0; i < 20 && await acik(); i++) {
      const d = await durum(); adimlar.push(d);
      assert.ok(!d.tasma, 'kart ekrandan taşıyor: ' + d.sayac);
      await s.keyboard.press('ArrowRight'); await bekle(150);
    }
    assert.ok(adimlar.length >= 10, 'adım sayısı: ' + adimlar.length);
    const moduller = adimlar.map(a => a.modul);
    for (const m of ['parametre', 'tanim', 'calisma', 'aktarim', 'personel', 'aylik', 'maliyet', 'excel', 'sistem'])
      assert.ok(moduller.includes(m), m + ' adımı ekranını açmalı');
    assert.equal(await s.evaluate(() => APP.aktifModul()), 'ozet', 'gezi bitince başladığı ekrana dönmeli');

    await s.click('#geziBtn'); await bekle(150);
    await s.keyboard.press('ArrowRight'); await s.keyboard.press('ArrowRight'); await s.keyboard.press('ArrowLeft'); await bekle(150);
    assert.equal((await durum()).sayac.replace(/\s.*$/, ''), 'Adım', '← geri gitmeli');
    for (let i = 0; i < 4; i++) await s.keyboard.press('Tab');
    assert.ok(await s.evaluate(() => !!document.activeElement.closest('.gezi-kart')), 'Tab odağı kartta tutmalı');
    await s.keyboard.press('Escape'); await bekle(150);
    assert.ok(!(await acik()), 'Esc kapatmalı');

    // Giriş / çıkış: aynı hesap ikinci girişte açılmaz, yeni hesap ilk girişte açılır
    await s.evaluate(() => API.kullaniciEkle('ikinci', 'İkinci Kullanıcı', 'ikinci-1234', false));
    const gir = async (ka, p) => {
      await s.evaluate(() => APP.cikis()); await bekle(300);
      await s.waitForSelector('#grKullanici', { visible: true });
      await s.$eval('#grKullanici', e => { e.value = ''; }); await s.type('#grKullanici', ka);
      await s.type('#grParola', p); await s.click('#grBtn');
      await s.waitForFunction(() => !document.getElementById('uygulama').classList.contains('gizli'), { timeout: 30000 });
      await bekle(400);
    };
    await gir('deneme', 'deneme-1234');
    assert.ok(!(await acik()), 'aynı hesabın ikinci girişinde açılmamalı');
    await gir('ikinci', 'ikinci-1234');
    assert.ok(await acik(), 'yeni hesabın ilk girişinde açılmalı');
    await s.evaluate(() => APP.cikis()); await bekle(300);
    assert.ok(!(await acik()), 'çıkışta kapanmalı');
    assert.deepEqual(o.hatalar, []);
  } finally { await o.kapat(); }
});
