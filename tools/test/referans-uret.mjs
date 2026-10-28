// docs/referans/ dosyalarını yeniden üretir: örnek veriyle kurulmuş şifresiz veritabanı (ornek-veri.db; giriş
// deneme / ornek-1234) ve kişi kişi, ay ay sonuçlar (ornek-veri-sonuclari.json). Hesap motoru bilinçli olarak
// değiştiğinde çalıştırın (npm run referans); farkı CHANGELOG'a yazın ve README'deki toplam tablosunu güncelleyin.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { kur, bekle, KOK, referansSonuclari } from './ortak.mjs';

const hedef = join(KOK, 'docs', 'referans');
const o = await kur({ kip: 'ornek', parola: 'ornek-1234' });
try {
  const veri = await o.s.evaluate(referansSonuclari);
  await o.s.evaluate(() => ADB.kaydetHemen());
  await bekle(2500);
  writeFileSync(join(hedef, 'ornek-veri-sonuclari.json'), JSON.stringify(veri, null, 1) + '\n', 'utf8');
  const db = join(o.sunucu.veriKok, 'veri', 'butce.db');
  if (!existsSync(db)) throw new Error('veri dosyası oluşmadı: ' + db);
  copyFileSync(db, join(hedef, 'ornek-veri.db'));
  for (const c of veri.calismalar)
    console.log(`${c.calisma.yil} · ${c.calisma.grup_adi} · ${c.calisma.ad} (${c.calisma.durum}) — ${c.kisi} kişi — ${c.toplam_maliyet.toFixed(2)}`);
  if (o.hatalar.length) { console.log('HATALAR: ' + JSON.stringify(o.hatalar)); process.exitCode = 1; }
} finally { await o.kapat(); }
