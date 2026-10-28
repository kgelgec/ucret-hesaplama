// Hesap motoru: örnek verinin kişi kişi, ay ay sonuçları docs/referans/ornek-veri-sonuclari.json ile aynı olmalı.
// Hesap bilinçli olarak değiştiyse referansı yenileyin: npm run referans (ve değişikliği CHANGELOG'a yazın).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { kur, KOK, referansSonuclari, farklar } from './ortak.mjs';

test('örnek veri sonuçları referansla aynı', async () => {
  const beklenen = JSON.parse(readFileSync(join(KOK, 'docs', 'referans', 'ornek-veri-sonuclari.json'), 'utf8'));
  const o = await kur({ kip: 'ornek' });
  try {
    const gercek = await o.s.evaluate(referansSonuclari);
    const f = farklar(gercek.calismalar, beklenen.calismalar);
    assert.deepEqual(f, [], 'Hesap sonuçları referanstan farklı (ilk 20 fark). Değişiklik bilinçliyse: npm run referans\n' + f.join('\n'));
    assert.deepEqual(o.hatalar, []);
  } finally { await o.kapat(); }
});
