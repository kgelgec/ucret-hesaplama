// Ücret esası (net / brüt): API kuralları ve ekranlar. Esas tutar girildikten sonra değişmez, kopya esası
// devralır, içe aktarma esası denetler; brüt çalışmada etiketler, şablon ve Excel raporu brütü izler; "Tümü"de
// karışık esas uyarısı çıkar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kur } from './ortak.mjs';

test('ücret esası API kuralları', async () => {
  const o = await kur({ kip: 'ornek' });
  try {
      const r = await o.s.evaluate(() => {
      const o = {};
      const dene = (ad, fn) => { try { o[ad] = 'OK ' + JSON.stringify(fn()); } catch (e) { o[ad] = 'HATA ' + e.message; } };
      const c = API.calismaListe().find(x => x.durum === 'TASLAK');
      const kp = API.calismaPersonelListe(c.id)[0];
      const tc = kp.tc_kimlik_no;
      dene('erp_maasli_esassiz', () => API.erpAktar(c.id, [{ tc, maas: 50000 }], {}));
      dene('erp_maasli_yanlisEsas', () => API.erpAktar(c.id, [{ tc, maas: 50000 }], {}, 'BRUT'));
      dene('erp_maassiz_esassiz', () => API.erpAktar(c.id, [{ tc, gorev: kp.gorev || 'Uzman' }], {}));
      dene('erp_maasli_dogruEsas', () => API.erpAktar(c.id, [{ tc, maas: kp.maas_eski }], {}, 'NET'));
      // Boş çalışma: yalnız aylık girdi kalmışsa esas değişmez
      const id = API.calismaKaydet({ yil: c.yil, grup_kod: c.grup_kod, ad: 'Esas Kilit Deneme' });
      API.aylikGirdiYaz(id, tc, 3, 'prim', 1000);
      dene('aylikGirdiliEsasDegistir', () => API.calismaAyarYaz(id, { 'ucret.esas': 'BRUT' }));
      API.aylikGirdiYaz(id, tc, 3, 'prim', '');
      dene('bosEsasDegistir', () => { API.calismaAyarYaz(id, { 'ucret.esas': 'BRUT' }); return API.ucretEsasi(id); });
      // Kopya: boş brüt hedef, net kaynağın esasını alır
      dene('kopyaEsasDevri', () => { const n = API.calismaPersonelKopyala(c.id, id, 'KOPYA'); return [n, API.ucretEsasi(id)]; });
      dene('kopyaDoluHedefFarkliEsas', () => {
        const id2 = API.calismaKaydet({ yil: c.yil, grup_kod: c.grup_kod, ad: 'Esas Kilit Deneme 2', ucret_esas: 'BRUT' });
        API.aylikGirdiYaz(id2, tc, 2, 'prim', 500);
        return API.calismaPersonelKopyala(c.id, id2, 'KOPYA');
      });
      return o;
    });
    const hata = v => typeof v === 'string' && v.startsWith('HATA ');
    assert.match(r.erp_maasli_esassiz, /^HATA .*esası \(net \/ brüt\) belirtilmeli/);
    assert.match(r.erp_maasli_yanlisEsas, /^HATA .*aktarılamaz/);
    assert.ok(!hata(r.erp_maassiz_esassiz), 'maaşsız aktarım esas beyanı istememeli: ' + r.erp_maassiz_esassiz);
    assert.ok(!hata(r.erp_maasli_dogruEsas), 'doğru esasla aktarım geçmeli: ' + r.erp_maasli_dogruEsas);
    assert.match(r.aylikGirdiliEsasDegistir, /^HATA .*ücret esası değiştirilemez/);
    assert.equal(r.bosEsasDegistir, 'OK "BRUT"');
    assert.match(r.kopyaEsasDevri, /^OK \[\d+,"NET"\]$/);
    assert.match(r.kopyaDoluHedefFarkliEsas, /^HATA .*ücret esası farklı/);
    assert.deepEqual(o.hatalar, []);
  } finally { await o.kapat(); }
});

test('ücret esası ekranları (brüt çalışma, şablon, içe aktarma, Excel, Tümü)', async () => {
  const o = await kur({ kip: 'ornek' });
  try {
      const r = await o.s.evaluate(async () => {
      const out = { sorun: [] }; window.__out = out;
      const bekle = ms => new Promise(r => setTimeout(r, ms));
      const dene = (ad, kosul, ayrinti) => { if (!kosul) out.sorun.push(ad + (ayrinti ? ' — ' + ayrinti : '')); };
      const bildirim = []; const eskiB = U.bildir; U.bildir = (m, t) => { bildirim.push(t + ': ' + m); return eskiB(m, t); };
      const metin = () => document.getElementById('icerik').textContent.replace(/\s+/g, ' ');
      const kipMetin = () => [...document.querySelectorAll('.kip')].map(k => k.textContent.replace(/\s+/g, ' ')).join('\n');
      const bozuk = (ad, t) => { const m = t.match(/.{0,40}(NaN|undefined|\[object).{0,40}/); if (m) out.sorun.push(ad + ': ' + m[0]); };
      const ev = (el, tur) => el.dispatchEvent(new Event(tur || 'change', { bubbles: true }));
      const eskiOnay = C.onay; C.onay = async () => true;

      /* 1) Yeni Çalışma penceresi: kaynaklıda esas kapalı ve kaynağınki, Boş'ta açık */
      APP.secimYap(2027, 'OFIS'); APP.git('calisma');
      document.getElementById('yeniBtn').click(); await bekle(100);
      let kip = document.querySelector('.kip');
      const es = () => kip.querySelector('[name=ucret_esas]');
      out.yeniKaynakli = { kapali: es().disabled, deger: es().value, not: kip.querySelector('#esasNot').innerText };
      dene('kaynaklıda esas kapalı', es().disabled);
      kip.querySelector('[name=kaynak][value=BOS]').checked = true; ev(kip.querySelector('[name=kaynak][value=BOS]'));
      dene('Boşta esas açık', !es().disabled);
      es().value = 'BRUT'; ev(es());
      kip.querySelector('[name=ad]').value = '2027 Brüt';
      kip.querySelector('[data-kaydet]').click(); await bekle(300);
      const cb = API.calismaListe().find(x => x.yil === 2027 && x.grup_kod === 'OFIS' && x.ad === '2027 Brüt');
      dene('brüt çalışma açıldı', cb, JSON.stringify(bildirim));
      out.brutCalisma = cb && { id: cb.id, esas: API.ucretEsasi(cb.id) };
      dene('esas BRUT', cb && API.ucretEsasi(cb.id) === 'BRUT');
      APP.calismaSec(cb.id); APP.git('calisma');
      dene('listede brüt rozeti', /Brüt esas/.test(metin()));

      /* 2) Şablon: başlık "Brüt Maaş" */
      APP.git('aktarim');
      dene('aktarım brüt açıklaması', /brüt esaslı/.test(metin()));
      let blob = null; const eskiIndir = U.indir; U.indir = (b) => { blob = b; };
      document.getElementById('sablonBtn').click();
      for (let i = 0; i < 50 && !blob; i++) await bekle(100);
      U.indir = eskiIndir;
      const kitap = new ExcelJS.Workbook(); await kitap.xlsx.load(await blob.arrayBuffer());
      const bas = kitap.worksheets[0].getRow(1).values.slice(1);
      out.sablonBaslik = bas;
      dene('şablonda Brüt Maaş', bas.includes('Brüt Maaş'));
      const acik = []; kitap.worksheets[1].eachRow(r => acik.push(r.values.slice(1).join(' | ')));
      dene('şablon açıklaması BRÜT', acik.some(x => /aylık BRÜT maaşı/.test(x)), acik.join(' / '));

      /* 3) Brüt maaşlı kişileri içe al */
      const c = APP.calisma();
      const kisiler = [['98000000017', 'BRÜT KİŞİ BİR', 85000, 'B'], ['98000000025', 'BRÜT KİŞİ İKİ', 62000, 'M'], ['98000000033', 'BRÜT KİŞİ ÜÇ', 140000, 'B']];
      const satir = (k) => bas.map(b => ({ 'T.C. Kimlik No': k[0], 'Ad Soyad': k[1], 'İşe Giriş Tarihi': '01.03.2020', 'Yaka': k[3], 'Brüt Maaş': k[2], 'Bölüm': 'MUHASEBE' }[b] || ''));
      window.AKTARIM_TEST.oku(c, [bas].concat(kisiler.map(satir)));
      await bekle(200);
      dene('brüt sütunu tanındı', /Brüt Maaş\W*Brüt Maaş/.test(metin()), metin().slice(0, 400));
      document.getElementById('yeniHepsi').click();
      document.getElementById('uygulaBtn').click(); await bekle(800);
      const liste = API.calismaPersonelListe(c.id);
      out.aktarilan = liste.map(k => k.ad_soyad + ':' + k.maas_eski);
      dene('3 kişi brüt maaşla', liste.length === 3 && liste.some(k => k.maas_eski === 85000));
      // Ek ödeme ve mesai: brüt esasta da hesap bozulmasın
      API.aylikGirdiYaz(c.id, '98000000017', 3, 'prim', 10000);
      API.aylikGirdiYaz(c.id, '98000000017', 3, 'ayni', 5000);
      API.aylikGirdiYaz(c.id, '98000000025', 1, 'fm1', 10);

      /* 4) Ekranlar brüt etiketlerle */
      const beklenen = {
        personel: [/Tutarlar BRÜT/, /Aylık brüt maaş artışı/, /Brüt esas/],
        maliyet: [/Brüt Maaş/],
        ozet: [/Toplam zam miktarı \(brüt\)/, /Maaş \(brüt\)/],
        dagilim: [/\(brüt\)/],
        aylik: [/Brüt Ayni Yardım/, /Prim \/ Diğer \(brüt\)/],
        excel: [/Tutarlar brüt maaştır/],
      };
      for (const m of Object.keys(beklenen)) {
        APP.git(m); await bekle(150);
        const t = metin() + '\n' + [...document.querySelectorAll('#icerik select option')].map(o => o.textContent).join('\n');
        beklenen[m].forEach(r => dene(m + ' ' + r, r.test(t)));
        bozuk(m, metin());
        dene(m + ' net etiketi kalmamalı', !/Net Maaş|\(net\)|Tutarlar NET|Net Ayni/.test(t), (t.match(/.{0,30}(Net Maaş|\(net\)|Tutarlar NET|Net Ayni).{0,30}/) || [''])[0]);
      }
      // Maliyet: AM ölçüsü ve bordro dökümü
      APP.git('maliyet');
      const ol = document.getElementById('olcu'); ol.value = 'AM'; ev(ol); await bekle(150);
      bozuk('maliyet AM', metin());
      document.querySelector('[data-dokum]').click(); await bekle(150);
      const dk = kipMetin();
      dene('döküm Brüt maaş', /Brüt maaş/.test(dk)); dene('döküm Mesai (brüt)', /Mesai \(brüt\)/.test(dk));
      dene('döküm ek ödeme (brüt)', /Toplam ek ödeme \(brüt\)/.test(dk)); dene('döküm Net ödeme kaldı', /Net ödeme/.test(dk));
      bozuk('döküm', dk);
      C.kipHepsiniKapat();
      ol.value = 'DM';
      APP.git('maliyet'); document.getElementById('olcu').value = 'DM'; ev(document.getElementById('olcu'));
      // Kişi kartı
      APP.git('personel'); document.querySelector('[data-kart]').click(); await bekle(150);
      const kk = kipMetin();
      dene('kart 2026 Brüt Maaş', /2026 Brüt Maaş/.test(kk)); dene('kart yol (aylık brüt)', /Yol Parası \(aylık brüt\)/.test(kk));
      C.kipHepsiniKapat();
      // Excel çıktısı
      const buf = await window.EXCEL_RAPOR.aktar(c, { sadeceIcerik: true });
      const xk = new ExcelJS.Workbook(); await xk.xlsx.load(buf);
      const z = xk.getWorksheet('ZAM ÇALIŞMASI');
      out.excelA2 = String(z.getCell('A2').value);
      dene('excel Tutarlar BRÜT', /Tutarlar BRÜT/.test(out.excelA2));
      dene('excel MAAŞ (BRÜT)', z.getRow(4).values.some(v => /2026 MAAŞ \(BRÜT\)/.test(String(v))));
      dene('excel özet MAAŞ (BRÜT)', xk.getWorksheet('ÖZET').getRow(10).values.some(v => /MAAŞ \(BRÜT\)/.test(String(v))));
      const h = API.calismaHesapla(c.id);
      const k1 = h.kisiler.find(x => x.kp.tc_kimlik_no === '98000000017');
      out.brutHesap = { ocak: { AM: k1.yil.aylar[1].AM, BB: k1.yil.aylar[1].BB, DD: Math.round(k1.yil.aylar[1].DD), DM: Math.round(k1.yil.aylar[1].DM) },
                        mart: { AZ: k1.yil.aylar[3].AZ, CF: k1.yil.aylar[3].CF, BX: k1.yil.aylar[3].BX, DD: Math.round(k1.yil.aylar[3].DD) } };

      /* 5) Personeli olan çalışmada esas değiştirme */
      try { API.calismaAyarYaz(c.id, { 'ucret.esas': 'NET' }); out.sorun.push('API esası değiştirdi!'); }
      catch (e) { out.esasDegistirAPI = e.message; }
      APP.git('calisma');
      document.querySelector(`[data-duzenle="${c.id}"]`).click(); await bekle(150);
      kip = document.querySelector('.kip');
      out.ayarEsas = { kapali: es().disabled, not: kip.querySelector('#esasNot').innerText };
      dene('ayarlarda esas kapalı', es().disabled);
      es().disabled = false; es().value = 'NET';            // kullanıcı yine de zorlarsa API reddetmeli
      bildirim.length = 0;
      kip.querySelector('[data-kaydet]').click(); await bekle(200);
      out.ayarZorlaBildirim = bildirim.slice();
      dene('zorlanan esas değişikliği hata', bildirim.some(b => /^hata: .*ücret esası değiştirilemez/i.test(b)));
      dene('esas hâlâ BRUT', API.ucretEsasi(c.id) === 'BRUT');
      C.kipHepsiniKapat();

      /* 6) Yeni personel: önceki çalışması net → maaş doldurulmaz, not */
      const c26 = API.calismaListe().find(x => x.yil === 2026 && x.grup_kod === 'OFIS');
      const eskiKisi = API.calismaPersonelListe(c26.id).find(k => !k.isten_ayrilis);
      APP.calismaSec(c.id); APP.git('personel');
      document.getElementById('yeniBtn').click(); await bekle(150);
      kip = document.querySelector('.kip');
      const tcIn = kip.querySelector('[name=tc_kimlik_no]'); tcIn.value = eskiKisi.tc_kimlik_no; ev(tcIn); await bekle(150);
      out.onDoldur = { maas: kip.querySelector('[name=maas_eski]').value, not: kip.querySelector('#maasEsasNot').innerText };
      dene('esasFarklı notu', /farklı ücret esasında; maaşı girin/.test(out.onDoldur.not));
      dene('esasFarklı maaş boş', out.onDoldur.maas === '');
      C.kipHepsiniKapat();

      /* 7) Brüt bütçeye "Net Maaş" başlıklı liste → maaş alınmaz; iki sütunlu listede brüt sütun seçilir */
      APP.git('aktarim');
      window.AKTARIM_TEST.oku(c, [['T.C. Kimlik No', 'Net Maaş'], ['98000000017', '50000']]); await bekle(150);
      dene('brüt bütçe net sütunu reddi', /Bu bütçe brüt esaslı; maaş sütununun başlığında 'Brüt' geçmeli/.test(metin()));
      window.AKTARIM_TEST.oku(c, [['T.C. Kimlik No', 'Net Maaş', 'Brüt Maaş'], ['98000000017', '50000', '86000']]); await bekle(150);
      dene('iki sütunda brüt seçildi', /Brüt Maaş\W*Brüt Maaş/.test(metin()) && /86\.000/.test(metin()), metin().slice(0, 500));
      document.getElementById('vazgecBtn').click();

      /* 8) Net bütçeye "Brüt Maaş" başlıklı liste → maaş alınmaz, uyarı */
      const cn = API.calismaListe().find(x => x.yil === 2027 && x.grup_kod === 'OFIS' && x.ad === '2027 Bütçe');
      APP.calismaSec(cn.id); APP.git('aktarim');
      const kn = API.calismaPersonelListe(cn.id)[0];
      window.AKTARIM_TEST.oku(cn, [['T.C. Kimlik No', 'Brüt Maaş', 'Bölüm'], [kn.tc_kimlik_no, '999999', 'YENİ BÖLÜM']]); await bekle(150);
      out.netBrutListe = (document.getElementById('maasEsasUyari') || {}).textContent;
      dene('net bütçe brüt sütun uyarısı', /Brüt maaş sütunu net esaslı bütçeye alınmaz/.test(out.netBrutListe || ''));
      document.getElementById('uygulaBtn').click(); await bekle(600);
      dene('net bütçede maaş değişmedi', API.calismaPersonelGetir(cn.id, kn.tc_kimlik_no).maas_eski === kn.maas_eski);
      APP.git('personel'); dene('net personel etiketi aynen', /Tutarlar NET/.test(metin()) && /Aylık net maaş artışı/.test(metin()));
      APP.git('aylik'); dene('net aylık etiket aynen', /Net Ayni Yardım/.test(metin()) && /Prim \/ Diğer \(net\)/.test(metin()));
      // Net şablon eskisi gibi
      APP.git('aktarim'); blob = null; U.indir = (b) => { blob = b; }; document.getElementById('sablonBtn').click();
      for (let i = 0; i < 50 && !blob; i++) await bekle(100);
      U.indir = eskiIndir;
      const nk = new ExcelJS.Workbook(); await nk.xlsx.load(await blob.arrayBuffer());
      dene('net şablon Net Maaş', nk.worksheets[0].getRow(1).values.includes('Net Maaş'));

      /* 9) Tümü: karışık esas uyarısı, maaş toplamları "—", maliyet var */
      APP.secimYap(2027, 'TUMU');
      out.tumuEsaslar = APP.calismalar().map(x => x.grup_kod + ':' + x.ad + ':' + API.ucretEsasi(x.id));
      for (const m of ['ozet', 'maliyet', 'dagilim']) {
        APP.git(m); await bekle(150);
        dene(m + ' karışık uyarı', /Gruplar farklı ücret esasında/.test(metin()));
        bozuk('Tümü ' + m, metin());
      }
      APP.git('ozet');
      const toplam = [...document.querySelectorAll('#icerik .toplam-satir')].map(r => r.textContent.replace(/\s+/g, ' '));
      out.tumuOzetToplam = toplam;
      dene('özet toplamda — var', toplam.every(t => /—/.test(t)));
      dene('özet maliyet gösteriliyor', /toplam maliyet/i.test(metin()));
      APP.git('maliyet');
      const o2 = document.getElementById('olcu'); o2.value = 'AM'; ev(o2); await bekle(150);
      out.tumuMaliyetAM = document.querySelector('#icerik .toplam-satir').textContent.replace(/\s+/g, ' ').slice(0, 120);
      dene('maliyet AM toplam —', /—/.test(out.tumuMaliyetAM));
      document.getElementById('olcu').value = 'DM'; ev(document.getElementById('olcu')); await bekle(150);
      out.tumuMaliyetDM = document.querySelector('#icerik .toplam-satir').textContent.replace(/\s+/g, ' ').slice(0, 120);

      /* 10) Personelsiz çalışmada esas değiştirilebilir; kopya esası devralır */
      APP.secimYap(2027, 'URETIM'); APP.git('calisma');
      document.getElementById('yeniBtn').click(); await bekle(100);
      kip = document.querySelector('.kip');
      kip.querySelector('[name=kaynak][value=BOS]').checked = true; ev(kip.querySelector('[name=kaynak][value=BOS]'));
      kip.querySelector('[name=ad]').value = 'Boş Deneme';
      kip.querySelector('[data-kaydet]').click(); await bekle(300);
      const cbos = API.calismaListe().find(x => x.ad === 'Boş Deneme');
      dene('boş çalışma NET', API.ucretEsasi(cbos.id) === 'NET');
      APP.git('calisma'); document.querySelector(`[data-duzenle="${cbos.id}"]`).click(); await bekle(150);
      kip = document.querySelector('.kip');
      dene('boşta ayarda esas açık', !es().disabled);
      es().value = 'BRUT'; kip.querySelector('[data-kaydet]').click(); await bekle(300);
      dene('boşta esas değişti', API.ucretEsasi(cbos.id) === 'BRUT', JSON.stringify(bildirim.slice(-2)));
      // Kopya: OFIS brüt çalışmadan
      APP.secimYap(2027, 'OFIS'); APP.git('calisma');
      document.getElementById('yeniBtn').click(); await bekle(100);
      kip = document.querySelector('.kip');
      kip.querySelector('[name=kaynak][value=KOPYA]').checked = true; ev(kip.querySelector('[name=kaynak][value=KOPYA]'));
      const ks = kip.querySelector('[name=kaynak_id]'); ks.value = String(c.id); ev(ks);
      out.kopyaEsas = { kapali: es().disabled, deger: es().value, not: kip.querySelector('#esasNot').innerText };
      dene('kopyada kaynak esası gösterildi', es().disabled && es().value === 'BRUT');
      kip.querySelector('[name=ad]').value = '2027 Brüt Kopya';
      kip.querySelector('[data-kaydet]').click(); await bekle(400);
      const ck = API.calismaListe().find(x => x.ad === '2027 Brüt Kopya');
      dene('kopya BRUT devraldı', ck && API.ucretEsasi(ck.id) === 'BRUT');

      // Kılavuz
      APP.git('kilavuz'); dene('kılavuz bölümü', /Ücret esası: net ya da brüt bütçe/.test(metin()));
      C.onay = eskiOnay;
      out.hataBildirim = bildirim.filter(b => /^hata/.test(b));
      return out;
    });
    assert.deepEqual(r.sorun, []);
    assert.deepEqual(o.hatalar, []);
  } finally { await o.kapat(); }
});
