/* =====================================================================
   ÖRNEK VERİ ÜRETECİ
   ---------------------------------------------------------------------
   program/data/ornek-veri.js dosyasını üretir. Bütün veri sabit tohumlu
   bir rastgele sayı üretecinden gelir; gerçek kişi ya da kurum verisi
   kullanılmaz. Aynı tohumla her çalıştırma aynı dosyayı üretir.

   - Adlar "ÖRNEK ÇALIŞAN 001" biçimindedir.
   - T.C. numaraları 11 hanelidir ama kontrol hanesi kasıtlı olarak
     yanlıştır: hiçbir gerçek kişiye ait olamaz.
   - Tutarlar ve tarihler rastgeledir.

   Çalıştırma:  node tools/ornek-veri-uret.mjs
   ===================================================================== */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TOHUM = 2026;
const YIL = 2026;

/* mulberry32 — küçük, deterministik üreteç */
function uretec(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rnd = uretec(TOHUM);
const arasi = (a, b) => a + rnd() * (b - a);
const tamArasi = (a, b) => Math.floor(arasi(a, b + 1));
const sec = l => l[Math.floor(rnd() * l.length)];
const yuvarla = (x, adim) => Math.round(x / adim) * adim;
const olasilik = p => rnd() < p;

/* Geçersiz T.C.: ilk 10 hane kurala uygun hesaplanır, 11. hane bilerek yanlış yazılır */
function gecersizTc(sira) {
  const d = ('99' + String(sira).padStart(7, '0')).split('').map(Number);   // 9 hane
  const d10 = (((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10 + 10) % 10;
  d.push(d10);
  const dogru = d.reduce((t, x) => t + x, 0) % 10;
  d.push((dogru + 5) % 10);
  return d.join('');
}

function tarih(y, m, g) { return `${y}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`; }
function rastgeleGiris() {
  const y = tamArasi(2008, 2025);
  return tarih(y, tamArasi(1, 12), tamArasi(1, 28));
}

/* ---------- Gruplar ve bölümler ---------- */
const GRUPLAR = [
  { kod: 'OFIS', ad: 'Ofis', sira: 1,
    bolumler: ['YÖNETİM', 'FİNANS VE MUHASEBE', 'İNSAN KAYNAKLARI', 'SATIŞ VE PAZARLAMA', 'BİLGİ TEKNOLOJİLERİ', 'AR-GE', 'İDARİ İŞLER'],
    ayar: { 'zam.B.alt_esik': 60000, 'zam.B.ust_esik': 120000, 'zam.B.ust_oran': 0.30, 'zam.B.alt_oran': 0.22 } },
  { kod: 'URETIM', ad: 'Üretim', sira: 2,
    bolumler: ['ÜRETİM', 'KALİTE KONTROL', 'BAKIM ONARIM', 'DEPO VE LOJİSTİK', 'İŞ SAĞLIĞI VE GÜVENLİĞİ'],
    ayar: { 'zam.M.alt_esik': 30000, 'zam.M.ust_esik': 45000, 'zam.M.ust_oran': 0.32, 'zam.M.alt_oran': 0.27,
            'zam.B.alt_esik': 50000, 'zam.B.ust_esik': 90000, 'zam.B.ust_oran': 0.30, 'zam.B.alt_oran': 0.25,
            'zam.yuvarla_ongoru': 50, 'mesai.ongoru': 1 },
    performans: true, mesai: true },
];

/* Bölüm başına kişi sayısı, yaka ve önceki yıl net maaş aralığı */
const KADRO = {
  OFIS: [
    ['YÖNETİM', 3, 'B', 140000, 220000, ['Genel Müdür', 'Genel Müdür Yardımcısı']],
    ['FİNANS VE MUHASEBE', 4, 'B', 38000, 95000, ['Muhasebe Uzmanı', 'Finans Uzmanı', 'Muhasebe Müdürü']],
    ['İNSAN KAYNAKLARI', 3, 'B', 36000, 85000, ['İK Uzmanı', 'Bordro Uzmanı', 'İK Müdürü']],
    ['SATIŞ VE PAZARLAMA', 5, 'B', 40000, 110000, ['Satış Temsilcisi', 'Pazarlama Uzmanı', 'Satış Müdürü']],
    ['BİLGİ TEKNOLOJİLERİ', 3, 'B', 45000, 100000, ['Sistem Uzmanı', 'Yazılım Uzmanı']],
    ['AR-GE', 4, 'B', 50000, 120000, ['AR-GE Mühendisi', 'Tasarım Mühendisi']],
    ['İDARİ İŞLER', 3, 'M', 24000, 32000, ['Şoför', 'Temizlik Görevlisi', 'Güvenlik Görevlisi']],
  ],
  URETIM: [
    ['ÜRETİM', 14, 'M', 23500, 36000, ['Üretim Operatörü', 'Usta', 'Ustabaşı']],
    ['ÜRETİM', 2, 'B', 55000, 90000, ['Üretim Şefi', 'Üretim Mühendisi']],
    ['KALİTE KONTROL', 4, 'M', 24500, 34000, ['Kalite Kontrol Teknisyeni']],
    ['KALİTE KONTROL', 1, 'B', 52000, 75000, ['Kalite Mühendisi']],
    ['BAKIM ONARIM', 4, 'M', 26000, 40000, ['Bakım Teknisyeni', 'Elektrik Teknisyeni']],
    ['DEPO VE LOJİSTİK', 5, 'M', 23500, 31000, ['Depo Görevlisi', 'Forklift Operatörü']],
    ['İŞ SAĞLIĞI VE GÜVENLİĞİ', 1, 'B', 48000, 70000, ['İSG Uzmanı']],
  ],
};

let no = 0;
const personel = [];
GRUPLAR.forEach(g => {
  KADRO[g.kod].forEach(([bolum, adet, yaka, alt, ust, gorevler]) => {
    for (let i = 0; i < adet; i++) {
      no++;
      const maas = yuvarla(arasi(alt, ust), 50);
      const p = {
        tc: gecersizTc(no), ad: 'ÖRNEK ÇALIŞAN ' + String(no).padStart(3, '0'),
        grup: g.kod, butce_bolumu: bolum, bolum: bolum, gorev: sec(gorevler), yaka: yaka,
        ise_giris: rastgeleGiris(), cikis: null, maas_eski: maas,
        maliyet_onceki: Math.round(maas * 12 * arasi(1.45, 1.6) * 100) / 100,
        hesap_turu: 'SSK', kanun: g.kod === 'URETIM' ? '05510-5' : '05510',
        bes: olasilik(0.3) ? 'EVET' : null, sakatlik_derece: null, gv_tesvik: 0,
        yol: g.kod === 'OFIS' && yaka === 'B' && olasilik(0.4) ? 2500 : 0,
        duzeltme: olasilik(0.15) ? sec([-500, 500, 1000, 1500, 2000]) : 0,
        ay: {},
      };
      personel.push(p);
    }
  });
});

/* ---------- Özel durumlar: her hesap kuralı örnekte en az bir kez görünsün ---------- */
const kim = (grup, bolum, n = 0) => personel.filter(p => p.grup === grup && p.butce_bolumu === bolum)[n];

// AR-GE personeli: 05746 teşviki, GV teşviki %80, ayda 22 AR-GE günü (süreklidir, Ocak'tan)
personel.filter(p => p.butce_bolumu === 'AR-GE').forEach(p => {
  p.kanun = '05746'; p.gv_tesvik = 0.8; p.ay[1] = Object.assign(p.ay[1] || {}, { arge_gun: 22 });
});
// Emekli çalışan (SGDP + 15510) ve SGK'sız danışman
Object.assign(kim('OFIS', 'FİNANS VE MUHASEBE', 0), { hesap_turu: 'EMK', kanun: '15510' });
Object.assign(kim('OFIS', 'YÖNETİM', 2), { hesap_turu: 'SGKSIZ', kanun: 'YOK', gorev: 'Danışman' });
Object.assign(kim('URETIM', 'BAKIM ONARIM', 3), { hesap_turu: 'EMK', kanun: '15510' });
// Engelli çalışanlar: 14857 + sakatlık derecesi
Object.assign(kim('URETIM', 'DEPO VE LOJİSTİK', 1), { kanun: '14857', sakatlik_derece: 2 });
Object.assign(kim('OFIS', 'İDARİ İŞLER', 1), { kanun: '14857', sakatlik_derece: 3 });
// Yıl içinde giren / çıkan
Object.assign(kim('URETIM', 'ÜRETİM', 13), { ise_giris: tarih(YIL, 3, 16), maliyet_onceki: null });
Object.assign(kim('OFIS', 'SATIŞ VE PAZARLAMA', 4), { ise_giris: tarih(YIL, 6, 1), maliyet_onceki: null });
Object.assign(kim('URETIM', 'DEPO VE LOJİSTİK', 4), { cikis: tarih(YIL, 8, 31) });
// Zam Temmuz'da (zam ayı 7)
Object.assign(kim('OFIS', 'BİLGİ TEKNOLOJİLERİ', 2), { zam_ayi: 7 });

/* ---------- Aylık girdiler ---------- */
personel.forEach(p => {
  const a = (m, alan, v) => { p.ay[m] = Object.assign(p.ay[m] || {}, { [alan]: v }); };
  // Bayram ayni yardımı (herkese, Mart ve Mayıs)
  a(3, 'ayni', 3000); a(5, 'ayni', 3000);
  // Satış primi: üç ayda bir
  if (p.butce_bolumu === 'SATIŞ VE PAZARLAMA') [3, 6, 9, 12].forEach(m => a(m, 'prim', yuvarla(arasi(5000, 20000), 500)));
  // Yakıt yardımı: satış müdürleri
  if (p.gorev === 'Satış Müdürü') for (let m = 1; m <= 12; m++) a(m, 'yakit', 3000);
  // Bilgi teknolojileri: hafta sonu nöbet mesaisi (sürekli; Ocak'tan geçerli)
  if (p.butce_bolumu === 'BİLGİ TEKNOLOJİLERİ') a(1, 'fm2', 8);
});
// Ücretsiz izin: bir kişi Şubat'ta 15 gün
a2(kim('URETIM', 'KALİTE KONTROL', 2), 2, 'calisilan_gun', 15);
function a2(p, m, alan, v) { p.ay[m] = Object.assign(p.ay[m] || {}, { [alan]: v }); }

/* ---------- Performans değerlendirmesi (Üretim) ---------- */
const KRITER = {
  M: ['is_bilgisi', 'gorev', 'kural', 'iletisim', 'gelisim'],
  B: ['is_bilgisi', 'kalite', 'planlama', 'iletisim', 'gelisim', 'yonetici'],
};
const EGITIM = { M: ['İLK OKUL', 'ORTA OKUL', 'LİSE', 'MESLEK LİSESİ'], B: ['ÖN LİSANS', 'LİSANS', 'YÜKSEK LİSANS'] };
const performans = {};
personel.filter(p => p.grup === 'URETIM' && !p.ise_giris.startsWith(String(YIL))).forEach(p => {
  const g = { grup: p.butce_bolumu, amir1: 'ÖRNEK AMİR ' + String(GRUPLAR[1].bolumler.indexOf(p.butce_bolumu) + 1).padStart(2, '0') };
  // Bölümlerin not ortalamaları bilerek farklı: bölüm katsayısı bunu dengeler
  const comertlik = { 'ÜRETİM': 0, 'KALİTE KONTROL': 4, 'BAKIM ONARIM': -3, 'DEPO VE LOJİSTİK': 2, 'İŞ SAĞLIĞI VE GÜVENLİĞİ': 0 }[p.butce_bolumu] || 0;
  const amirSay = olasilik(0.5) ? 2 : 1;
  for (let i = 1; i <= amirSay; i++) {
    if (i === 2) g.amir2 = 'ÖRNEK AMİR 1' + String(tamArasi(0, 9));
    KRITER[p.yaka].forEach(k => { g['a' + i + '.' + k] = Math.min(100, tamArasi(65, 96) + comertlik); });
  }
  if (p.yaka === 'M') {
    g.devam = Math.round(arasi(88, 100) * 10) / 10;
    g.tutanak = olasilik(0.8) ? 0 : tamArasi(1, 3);
  }
  g.kidem = Math.max(0, YIL - Number(p.ise_giris.slice(0, 4)) - (olasilik(0.2) ? 1 : 0));
  g.egitim = sec(EGITIM[p.yaka]);
  performans[p.tc] = g;
});

/* ---------- Mesai öngörüsü (Üretim, mavi yaka bölümleri) ---------- */
const mesai = [];
const IS_GUNU = [0, 21, 20, 22, 21, 19, 20, 23, 21, 22, 21, 20, 22];   // bilgi amaçlı takvim
for (let m = 1; m <= 12; m++) mesai.push(['', '', m, 'gun', IS_GUNU[m]]);
['ÜRETİM', 'KALİTE KONTROL', 'BAKIM ONARIM', 'DEPO VE LOJİSTİK'].forEach(b => {
  const kisi = personel.filter(p => p.grup === 'URETIM' && p.bolum === b && p.yaka === 'M').length;
  const yogun = { 'ÜRETİM': 14, 'KALİTE KONTROL': 8, 'BAKIM ONARIM': 12, 'DEPO VE LOJİSTİK': 6 }[b];
  for (let m = 1; m <= 12; m++) {
    const mevsim = [0, 0.8, 0.8, 1, 1.1, 1.2, 1.2, 1.1, 0.9, 1.1, 1.2, 1.1, 0.9][m];
    mesai.push(['M', b, m, 'fm1', Math.round(kisi * yogun * mevsim)]);
    mesai.push(['M', b, m, 'fm2', Math.round(kisi * yogun * 0.4 * mevsim)]);
  }
});

/* ---------- Yazım ---------- */
const veri = { yil: YIL, gruplar: GRUPLAR, personel, performans, mesai };
const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const yol = join(kok, 'program', 'data', 'ornek-veri.js');
const govde = JSON.stringify(veri, null, 0)
  .replace(/\{"tc"/g, '\n  {"tc"').replace(/\["/g, '["').replace(/\],\[/g, '],\n  [');
writeFileSync(yol, `/* ÖRNEK VERİ — tools/ornek-veri-uret.mjs ile rastgele üretildi (tohum ${TOHUM}).
   Gerçek kişi ya da kurum verisi içermez. Adlar "ÖRNEK ÇALIŞAN 001" biçimindedir; T.C. numaralarının
   kontrol hanesi kasıtlı olarak yanlıştır. Tutarlar ve tarihler rastgeledir. Elle düzenlemeyin;
   üreteci değiştirip yeniden çalıştırın. */
window.ORNEK_VERI = ${govde};
`, 'utf8');
console.log(`${personel.length} kişi, ${Object.keys(performans).length} değerlendirme, ${mesai.length} mesai hücresi → ${yol}`);
