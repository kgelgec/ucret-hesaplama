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

  return { tl, tlDuz, oran, isaretli, tc };
})();
