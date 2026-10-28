/* =====================================================================
   SİMGELER — çizgi (SVG) simge seti
   ---------------------------------------------------------------------
   Çizimler Lucide simge setinden alınmıştır (ISC lisansı; bkz.
   js/vendor/LISANSLAR.md). Emoji yerine SVG: her sistemde aynı görünür,
   rengi yazı rengini (currentColor) izler.

   IKON.svg(ad)       → simgenin SVG metni
   IKON.menu(modulId) → menüdeki simge
   IKON.donustur(kok) → ekranlardaki simge karakterlerini (🗑 ✎ ⚠ ℹ …) SVG'ye
                        çevirir. Uygulama açılırken bir kez bağlanır; sonradan
                        eklenen ekranlar, pencereler kendiliğinden çevrilir.
   ===================================================================== */
window.IKON = (function () {
  'use strict';

  const P = {
    ozet: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    grafik: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    kisiler: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    hesap: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    takvim: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    hedef: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    saat: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    klasor: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    tablo: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
    yukle: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    indir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    ayar: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    liste: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    anahtar: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
    disli: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    kitap: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    cikis: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    sil: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    duzenle: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    kilit: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    kilitAcik: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    kalkan: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    bilgi: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    uyari: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    tamam: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    ipucu: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    goz: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    toplam: '<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>',
    yenile: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    yukari: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    asagi: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    geri: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    nokta: '<circle cx="12" cy="12" r="2"/>',
  };

  function svg(ad, sinif) {
    return `<svg class="ik-svg${sinif ? ' ' + sinif : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[ad] || P.nokta}</svg>`;
  }

  /* Menü: ekran kimliği → simge */
  const MENU = { ozet: 'ozet', dagilim: 'grafik', calisma: 'klasor', personel: 'kisiler', aylik: 'takvim', maliyet: 'hesap',
    performans: 'hedef', mesai: 'saat', aktarim: 'yukle', excel: 'tablo', parametre: 'ayar', tanim: 'liste',
    kullanici: 'anahtar', sistem: 'disli', kilavuz: 'kitap' };
  const menu = id => svg(MENU[id] || 'nokta');

  /* Ekranlardaki simge karakterleri → SVG.
     HER YERDE: 🗑 ✎ (yalnız simge olarak kullanılırlar).
     YALNIZ düğme, başlık, logo ve uyarı simgesi içinde: diğerleri (düz metindeki → ✓ gibi işaretlere dokunulmaz). */
  const HER_YER = { '🗑': 'sil', '✎': 'duzenle' };
  const KAP = { '🔒': 'kilit', '🔓': 'kilitAcik', '🔐': 'kalkan', 'ℹ': 'bilgi', '⚠': 'uyari', '✓': 'tamam', '💡': 'ipucu',
    '📖': 'kitap', '⏱': 'saat', '🗂': 'klasor', '🔑': 'anahtar', '👁': 'goz', '⇩': 'indir', '⤓': 'indir', '↻': 'yenile',
    '↑': 'yukari', '↓': 'asagi', '←': 'geri', 'Σ': 'toplam', '🛠': 'disli', '📤': 'tablo', '📋': 'liste', '⚙': 'ayar' };
  const KAP_SECICI = 'button, .ik, h1, h2, h3, h4, .logo, summary, .kl-git';
  const tumu = Object.assign({}, KAP, HER_YER);
  const desen = new RegExp('(' + Object.keys(tumu).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?', 'g');
  const desenHerYer = new RegExp('(' + Object.keys(HER_YER).join('|') + ')\\uFE0F?', 'g');

  function metinDugumu(d) {
    const ust = d.parentElement;
    if (!ust || ust.closest('textarea, input, select, option, script, style, svg, [data-ikonsuz]')) return;
    const kapIci = !!ust.closest(KAP_SECICI);
    const rx = kapIci ? desen : desenHerYer;
    const s = d.nodeValue;
    rx.lastIndex = 0;
    if (!rx.test(s)) return;
    rx.lastIndex = 0;
    const span = document.createElement('span');
    span.className = 'ik-sar';
    span.innerHTML = s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
      .replace(rx, (m, k) => svg(tumu[k]));
    ust.replaceChild(span, d);
    /* Yalnız simgeden oluşan düğmeye ekran okuyucu etiketi (başlık varsa o) */
    const btn = span.closest('button');
    if (btn && !btn.getAttribute('aria-label') && !btn.textContent.trim()) {
      const ad = btn.getAttribute('title');
      if (ad) btn.setAttribute('aria-label', ad);
    }
  }
  function donustur(kok) {
    if (!kok) return;
    if (kok.nodeType === 3) { metinDugumu(kok); return; }
    if (kok.nodeType !== 1) return;
    const w = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT);
    const l = [];
    while (w.nextNode()) l.push(w.currentNode);
    l.forEach(metinDugumu);
  }
  let gozcu = null;
  function bagla() {
    if (gozcu || !window.MutationObserver) return;
    donustur(document.body);
    gozcu = new MutationObserver(kayitlar => kayitlar.forEach(k => {
      if (k.type === 'characterData') donustur(k.target);
      else k.addedNodes.forEach(donustur);
    }));
    gozcu.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bagla); else bagla();

  return { svg, menu, donustur, bagla };
})();
