/* =====================================================================
   BİÇİM — tutar/oran gösterimi ve yetkiye bağlı maskeleme
   ===================================================================== */
window.B = (function () {
  'use strict';

  // 1.234.567 (kuruşsuz) ya da 1.234.567,89
  function tl(n, ondalik) {
    const d = ondalik == null ? 0 : ondalik;
    const x = Number(n) || 0;
    if (Math.abs(x) < 0.005 && d === 0) return '<span class="cok-soluk">—</span>';
    return x.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function tlDuz(n, ondalik) {
    const d = ondalik == null ? 0 : ondalik;
    return (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  // 0,2934 → %29,34
  function oran(x, ondalik) {
    if (x == null || !isFinite(x)) return '<span class="cok-soluk">—</span>';
    return '%' + (x * 100).toLocaleString('tr-TR',
      { minimumFractionDigits: ondalik == null ? 2 : ondalik, maximumFractionDigits: ondalik == null ? 2 : ondalik });
  }
  function isaretli(n) {
    const x = Number(n) || 0;
    const s = tlDuz(Math.abs(x));
    if (Math.abs(x) < 0.5) return '<span class="cok-soluk">0</span>';
    return x > 0 ? `<span class="artis">+${s}</span>` : `<span class="azalis">−${s}</span>`;
  }

  // T.C. Kimlik No yalnızca 'alan.tc' yetkisiyle tam görünür
  function tc(t) { return API.yetkiVar('alan.tc') ? U.esc(t) : U.esc(U.tcMaskele(t)); }

  /* ÜCRET ESASI — girilen maaş ve ek ödemelerin net mi brüt mü olduğu (çalışma bazında).
     x: çalışma nesnesi, çalışma id'si ya da doğrudan 'NET' / 'BRUT'. Boş = NET. */
  function esasKod(x) {
    if (x === 'NET' || x === 'BRUT') return x;
    const id = x && typeof x === 'object' ? x.id : x;
    return id ? API.ucretEsasi(Number(id)) : 'NET';
  }
  const esas = x => esasKod(x) === 'BRUT' ? 'brüt' : 'net';            // cümle içinde
  const esasBas = x => esasKod(x) === 'BRUT' ? 'Brüt' : 'Net';         // başlıkta
  const esasBuyuk = x => esasKod(x) === 'BRUT' ? 'BRÜT' : 'NET';       // "Tutarlar NET"
  function esasRozet(x) {
    return esasKod(x) === 'BRUT'
      ? '<span class="rz rz-mor" title="Girilen maaş ve ek ödemeler BRÜT; net ödeme hesaplanır">Brüt esas</span>'
      : '<span class="rz rz-gri" title="Girilen maaş ve ek ödemeler NET; brüt hesaplanır">Net esas</span>';
  }
  /* "Tümü" görünümünde maaş toplamları yerine gösterilen uyarı (birlesikHesapla → karisikEsas) */
  const KARISIK_ESAS = 'Gruplar farklı ücret esasında (net / brüt); maaş tutarları toplanmaz — yalnız maliyet karşılaştırılabilir.';
  function karisikEsasUyari() {
    return `<div class="uyari uyari-dikkat"><span class="ik">⚠</span><div><strong>${KARISIK_ESAS}</strong>
      Maaş ve zam toplamları "—" gösterilir; grup satırlarındaki tutarlar her grubun kendi esasındadır.</div></div>`;
  }

  return { tl, tlDuz, oran, isaretli, tc, esasKod, esas, esasBas, esasBuyuk, esasRozet, KARISIK_ESAS, karisikEsasUyari };
})();
