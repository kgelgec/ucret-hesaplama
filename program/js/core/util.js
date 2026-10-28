/* =====================================================================
   ORTAK YARDIMCILAR
   ===================================================================== */
window.U = (function () {
  'use strict';

  const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                 'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const AYLAR_BUYUK = ['OCAK','ŞUBAT','MART','NİSAN','MAYIS','HAZİRAN',
                       'TEMMUZ','AĞUSTOS','EYLÜL','EKİM','KASIM','ARALIK'];
  const GUNLER = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const GUN_KISA = ['Pz','Pt','Sa','Ça','Pe','Cu','Ct'];

  /* ---------- Metin ---------- */
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g,
      c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // Türkçe harflere duyarlı büyük harfe çevirme (i -> İ, ı -> I)
  function buyuk(s) {
    return (s || '').replace(/i/g, 'İ').replace(/ı/g, 'I').toLocaleUpperCase('tr-TR');
  }
  function kucuk(s) {
    return (s || '').replace(/I/g, 'ı').replace(/İ/g, 'i').toLocaleLowerCase('tr-TR');
  }

  // Arama için normalleştirme: büyük/küçük ve Türkçe karakter farkını yok sayar
  function normalize(s) {
    return kucuk(String(s || '').trim())
      .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i')
      .replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
      .replace(/\s+/g,' ');
  }

  function icerir(metin, aranan) {
    if (!aranan) return true;
    return normalize(metin).includes(normalize(aranan));
  }

  /* ---------- Sayı / para ---------- */
  function para(n) {
    return (Number(n) || 0).toLocaleString('tr-TR',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  }
  function sayi(n) { return (Number(n) || 0).toLocaleString('tr-TR'); }

  // "1.234,56" / "1234.56" / "1234" -> 1234.56
  function sayiCoz(s) {
    if (s == null || s === '') return 0;
    if (typeof s === 'number') return s;
    let t = String(s).trim().replace(/[^\d.,-]/g, '');
    if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
    else if (t.includes(',')) t = t.replace(',', '.');
    const n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }

  /* ---------- Tarih (tümü 'YYYY-MM-DD' metin biçiminde, UTC) ---------- */
  function bugun() { return new Date().toISOString().slice(0, 10); }
  function simdi()  { return new Date().toISOString(); }

  function tarihNesne(s) {
    if (!s) return null;
    const p = String(s).slice(0, 10).split('-').map(Number);
    if (p.length !== 3 || p.some(isNaN)) return null;
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }

  function tarihMetin(d) {
    if (!d) return '';
    const p = n => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  }

  // 'YYYY-MM-DD' -> 'GG.AA.YYYY'
  function tarihGoster(s) {
    if (!s) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? `${m[3]}.${m[2]}.${m[1]}` : String(s);
  }

  function gunEkle(s, gun) {
    const d = tarihNesne(s); if (!d) return '';
    d.setUTCDate(d.getUTCDate() + gun);
    return tarihMetin(d);
  }

  /* Ay ekler. Ay sonu taşmaları KIRPILIR: 31 Ocak + 1 ay -> 28/29 Şubat
     (3 Mart'a taşmaz). Taksit tarihleri bu kuralla üretilir. */
  function ayEkle(s, ay) {
    const d = tarihNesne(s); if (!d) return '';
    const gun = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + (Number(ay) || 0));
    // Hedef ayın son günü: sonraki ayın "0." günü
    const sonGun = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(gun, sonGun));
    return tarihMetin(d);
  }

  function yilEkle(s, yil) {
    const d = tarihNesne(s); if (!d) return '';
    const gun = d.getUTCDate();
    d.setUTCFullYear(d.getUTCFullYear() + yil);
    // 29 Şubat taşmasını düzelt
    if (d.getUTCDate() !== gun) d.setUTCDate(0);
    return tarihMetin(d);
  }

  // İki tarih arasındaki gün farkı (bitiş - başlangıç)
  function gunFarki(a, b) {
    const d1 = tarihNesne(a), d2 = tarihNesne(b);
    if (!d1 || !d2) return 0;
    return Math.round((d2 - d1) / 86400000);
  }

  // Başlangıç ve bitiş dahil gün sayısı
  function gunSayisi(a, b) {
    if (!a || !b) return 0;
    return gunFarki(a, b) + 1;
  }

  function haftaninGunu(s) {
    const d = tarihNesne(s);
    return d ? d.getUTCDay() : null;   // 0 = Pazar
  }

  // Belirli bir tarihteki yaş
  function yas(dogum, tarih) {
    if (!dogum) return null;
    const d = tarihNesne(dogum), t = tarihNesne(tarih || bugun());
    if (!d || !t) return null;
    let y = t.getUTCFullYear() - d.getUTCFullYear();
    const ayFark = t.getUTCMonth() - d.getUTCMonth();
    if (ayFark < 0 || (ayFark === 0 && t.getUTCDate() < d.getUTCDate())) y--;
    return y;
  }

  function ayAdi(no) { return AYLAR[Number(no) - 1] || ''; }

  /* Dışarıdan gelen tarihi 'YYYY-MM-DD' biçimine çevirir.
     Excel'den Date nesnesi, seri numarası ya da "01.02.2025" gibi
     metin gelebilir; hepsi desteklenir. Çözülemezse null döner. */
  function tarihCoz(v) {
    if (v == null || v === '') return '';
    const p = n => String(n).padStart(2, '0');

    if (v instanceof Date) {
      if (isNaN(v.getTime())) return null;
      return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
    }

    // Excel seri numarası (1899-12-30 tabanlı)
    if (typeof v === 'number' && isFinite(v)) {
      if (v < 1 || v > 60000) return null;
      const d = new Date(Math.round((v - 25569) * 86400000));
      if (isNaN(d.getTime())) return null;
      return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
    }

    const s = String(v).trim();
    if (!s) return '';
    let m = /^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/.exec(s);          // 2025-02-01
    if (m) return gecerliTarihMi(m[1], m[2], m[3]) ? `${m[1]}-${p(m[2])}-${p(m[3])}` : null;
    m = /^(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{4})/.exec(s);              // 01.02.2025
    if (m) return gecerliTarihMi(m[3], m[2], m[1]) ? `${m[3]}-${p(m[2])}-${p(m[1])}` : null;
    return null;
  }

  function gecerliTarihMi(y, a, g) {
    y = Number(y); a = Number(a); g = Number(g);
    if (!y || a < 1 || a > 12 || g < 1 || g > 31) return false;
    const d = new Date(Date.UTC(y, a - 1, g));
    return d.getUTCFullYear() === y && d.getUTCMonth() === a - 1 && d.getUTCDate() === g;
  }

  /* ---------- T.C. Kimlik No ----------
     Resmî algoritma: 11 hane, ilk hane 0 olamaz, 10. ve 11. hane
     kontrol hanesidir. */
  function tcGecerliMi(tc) {
    const s = String(tc || '').trim();
    if (!/^[1-9][0-9]{10}$/.test(s)) return false;
    const h = s.split('').map(Number);
    const tek = h[0] + h[2] + h[4] + h[6] + h[8];
    const cift = h[1] + h[3] + h[5] + h[7];
    if (((tek * 7) - cift) % 10 !== h[9]) return false;
    const ilk10 = h.slice(0, 10).reduce((a, b) => a + b, 0);
    return ilk10 % 10 === h[10];
  }

  function tcTemizle(tc) { return String(tc || '').replace(/\D/g, '').slice(0, 11); }

  function tcMaskele(tc) {
    const s = String(tc || '');
    return s.length === 11 ? s.slice(0, 3) + '*****' + s.slice(8) : s;
  }

  /* ---------- IBAN ---------- */
  function ibanBicimle(s) {
    const t = String(s || '').replace(/\s+/g, '').toUpperCase();
    return t.replace(/(.{4})/g, '$1 ').trim();
  }

  /* ---------- SHA-256 (saf JavaScript) ----------
     crypto.subtle bulunmayan ortamlar için yedek. Node tarafında da
     aynı sonucu üretir, böylece sunucuya geçişte parolalar geçerli kalır. */
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];

  function sha256Hex(mesaj) {
    const utf8 = unescape(encodeURIComponent(mesaj));
    const uzunlukBit = utf8.length * 8;
    let m = utf8 + '\x80';
    while (m.length % 64 !== 56) m += '\x00';
    const kelime = [];
    for (let i = 0; i < m.length; i += 4) {
      kelime.push((m.charCodeAt(i) << 24) | (m.charCodeAt(i+1) << 16) |
                  (m.charCodeAt(i+2) << 8) | m.charCodeAt(i+3));
    }
    kelime.push(Math.floor(uzunlukBit / 4294967296), uzunlukBit >>> 0);

    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
             0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const w = new Array(64);
    const dondur = (x, n) => (x >>> n) | (x << (32 - n));

    for (let i = 0; i < kelime.length; i += 16) {
      for (let t = 0; t < 16; t++) w[t] = kelime[i + t] | 0;
      for (let t = 16; t < 64; t++) {
        const s0 = dondur(w[t-15],7) ^ dondur(w[t-15],18) ^ (w[t-15] >>> 3);
        const s1 = dondur(w[t-2],17) ^ dondur(w[t-2],19) ^ (w[t-2] >>> 10);
        w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
      }
      let [a,b,c,d,e,f,g,hh] = h;
      for (let t = 0; t < 64; t++) {
        const S1 = dondur(e,6) ^ dondur(e,11) ^ dondur(e,25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
        const S0 = dondur(a,2) ^ dondur(a,13) ^ dondur(a,22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [(h[0]+a)|0,(h[1]+b)|0,(h[2]+c)|0,(h[3]+d)|0,
           (h[4]+e)|0,(h[5]+f)|0,(h[6]+g)|0,(h[7]+hh)|0];
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  function rastgeleHex(bayt) {
    const a = new Uint8Array(bayt);
    crypto.getRandomValues(a);
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- DOM ---------- */
  /* ---------------- Giriş maskeleri ----------------
     Maske deseninde '9' rakam yerini, diğer her karakter sabit ayracı
     gösterir. SGK işyeri sicil numarası buna örnektir:
       maske  : 9.9999.99.99.9999999.999.99-99/999
       yazılan: 2701007071260400034044000
       sonuç  : 2.7010.07.07.1260400.034.04-44/000
     Ayraç, ardından gelecek rakam yoksa EKLENMEZ; böylece yarım
     girişte ekranda boşta kalan nokta/tire görünmez. */
  function maskeUygula(deger, maske) {
    if (!maske) return deger == null ? '' : String(deger);
    const rakamlar = String(deger == null ? '' : deger).replace(/\D/g, '');
    let sonuc = '', i = 0;
    for (const ch of String(maske)) {
      if (ch === '9') {
        if (i >= rakamlar.length) break;
        sonuc += rakamlar[i++];
      } else {
        if (i >= rakamlar.length) break;   // sonda boşta ayraç bırakma
        sonuc += ch;
      }
    }
    return sonuc;
  }

  /* Maskedeki rakam yeri sayısı — alan tam dolmuş mu denetlenir. */
  function maskeHaneSayisi(maske) {
    return (String(maske || '').match(/9/g) || []).length;
  }

  /* Maskeli alanın ham hâli: yalnızca rakamlar. */
  function maskeTemizle(deger) {
    return String(deger == null ? '' : deger).replace(/\D/g, '');
  }

  function el(id) { return document.getElementById(id); }
  function bicimAd(s) { return String(s || '').trim().replace(/\s+/g, ' '); }

  function bildir(mesaj, tur) {
    const t = document.createElement('div');
    t.className = 'toast' + (tur ? ' toast-' + tur : '');
    t.textContent = mesaj;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('gorunur'));
    setTimeout(() => { t.classList.remove('gorunur'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  function indir(icerik, dosyaAdi, tip) {
    const blob = icerik instanceof Blob ? icerik : new Blob([icerik], { type: tip || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = dosyaAdi;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* Panoya kopyalama — iki yollu.

     navigator.clipboard yalnızca GÜVENLİ BAĞLAMDA ve sayfa odaktayken
     çalışır. Program dosyadan (file://) açıldığında ya da pencere odakta
     değilken "Document is not focused" hatası verir ve kopyalama
     sessizce başarısız olur. Bu yüzden başarısız olursa eski
     execCommand yolu denenir: ekran dışında bir metin kutusu oluşturulup
     seçilir ve kopyalanır. İkisi de olmazsa hata fırlatılır, çağıran
     taraf kullanıcıya bildirir. */
  async function panoyaKopyala(metin) {
    const m = String(metin == null ? '' : metin);
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(m); return true; } catch (e) { }
    }
    const kutu = document.createElement('textarea');
    kutu.value = m;
    kutu.setAttribute('readonly', '');
    kutu.style.position = 'fixed';
    kutu.style.left = '-9999px';
    kutu.style.top = '0';
    document.body.appendChild(kutu);
    try {
      kutu.select();
      kutu.setSelectionRange(0, m.length);
      const ok = document.execCommand && document.execCommand('copy');
      if (!ok) throw new Error('Tarayıcı kopyalamaya izin vermedi.');
      return true;
    } finally {
      kutu.remove();
    }
  }

  return {
    AYLAR, AYLAR_BUYUK, GUNLER, GUN_KISA,
    esc, buyuk, kucuk, normalize, icerir, bicimAd,
    para, sayi, sayiCoz, panoyaKopyala,
    bugun, simdi, tarihNesne, tarihMetin, tarihGoster, gunEkle, ayEkle, yilEkle,
    gunFarki, gunSayisi, haftaninGunu, yas, ayAdi, tarihCoz,
    tcGecerliMi, tcTemizle, tcMaskele, ibanBicimle,
    sha256Hex, rastgeleHex,
    el, bildir, indir,
    maskeUygula, maskeHaneSayisi, maskeTemizle,
  };
})();
