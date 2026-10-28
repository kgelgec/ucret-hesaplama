// Kılavuz görsellerini (program/img/kilavuz/*.png) örnek veriyle yeniden çeker. README'deki kısa tur da bu
// görselleri kullanır. Ekran ya da örnek veri değişince çalıştırın: npm run gorsel
import { join } from 'node:path';
import { kur, bekle, PROGRAM } from './ortak.mjs';

const hedef = join(PROGRAM, 'img', 'kilavuz');
const o = await kur({ kip: 'ornek', genislik: 1366, yukseklik: 820, kullanici: 'ornek', parola: 'ornek-1234', ad: 'Örnek Yönetici' });
const s = o.s, hatalar = o.hatalar;
try {
  await bekle(1000);
  // Başlangıç gezisi: ücret esası adımı
  await s.evaluate(() => { APP.git('ozet'); GEZI.baslat(); });
  for (let i = 0; i < 4; i++) { await s.keyboard.press('ArrowRight'); await bekle(150); }
  await bekle(400);
  await s.screenshot({ path: join(hedef, '15-gezi.png') });
  await s.evaluate(() => { GEZI.kapat(); document.activeElement.blur(); });

  const ekran = async (yil, grup, modul, ad, sonra) => {
    await s.evaluate((y, g, m) => { C.kipHepsiniKapat(); APP.secimYap(y, g); APP.git(m); window.scrollTo(0, 0); }, yil, grup, modul);
    await bekle(500);
    if (sonra) await sonra();
    await bekle(400);
    if (ad) await s.screenshot({ path: join(hedef, ad) });
  };
  const kip = async ad => {
    await s.waitForSelector('.kip', { timeout: 5000 });
    await bekle(400);
    const el = await s.$('.kip');
    await el.screenshot({ path: join(hedef, ad) });
  };

  await ekran(2027, 'OFIS', 'ozet', '01-genel.png');
  await ekran(2027, 'URETIM', 'personel', '02-personel.png');
  await ekran(2027, 'URETIM', 'personel', null, async () => {
    const tc = await s.evaluate(() => {
      const c = APP.calisma();
      const k = API.calismaPersonelListe(c.id).find(x => x.yaka === 'M' && x.kanun === '05510-5' && x.hesap_turu === 'SSK');
      return k.tc_kimlik_no;
    });
    await s.click(`a[data-kart="${tc}"]`);
    await kip('03-kart.png');
  });
  await ekran(2027, 'URETIM', 'aylik', null, async () => { await s.click('[data-ay="3"]'); await bekle(500); });
  await s.screenshot({ path: join(hedef, '04-aylik.png') });
  await ekran(2027, 'OFIS', 'calisma', '06-calisma.png');
  await ekran(2027, 'OFIS', 'calisma', null, async () => { await s.click('#yeniBtn'); await kip('07-yeni-calisma.png'); });
  await ekran(2027, 'OFIS', 'parametre', '08-parametre.png');
  await ekran(2027, 'URETIM', 'maliyet', '09-maliyet.png');
  await ekran(2027, 'OFIS', 'maliyet', null, async () => {
    const tc = await s.evaluate(() => {
      const c = APP.calisma();
      return API.calismaPersonelListe(c.id).find(x => x.kanun === '05746').tc_kimlik_no;
    });
    await s.click(`a[data-dokum="${tc}"]`);
    await kip('10-bordro.png');
  });
  await ekran(2027, 'OFIS', 'excel', '11-rapor.png');
  await ekran(2027, 'URETIM', 'performans', null, async () => { await s.click('#pfModel'); await kip('14-model.png'); });
  await ekran(2027, 'OFIS', 'dagilim', '16-dagilim.png');
  await ekran(2027, 'URETIM', 'personel', null, async () => { await s.click('[data-sekme="kisi"]'); await bekle(400); });
  await s.screenshot({ path: join(hedef, '17-kisi-bilgileri.png') });
  await s.evaluate(() => { const b = document.querySelector('[data-sekme="zam"]'); if (b) b.click(); });
  await ekran(2027, 'OFIS', 'kullanici', null, async () => { await s.click('#yeniBtn'); await kip('12-kullanici.png'); });
  await s.evaluate(() => C.kipHepsiniKapat());
  await bekle(300);
  const ka = await s.$('.kenar-alt');
  await ka.screenshot({ path: join(hedef, '13-kilavuz-dugme.png') });
  console.log(hatalar.length ? 'HATALAR: ' + JSON.stringify(hatalar) : 'Görseller yenilendi: ' + hedef);
  if (hatalar.length) process.exitCode = 1;
} finally { await o.kapat(); }
