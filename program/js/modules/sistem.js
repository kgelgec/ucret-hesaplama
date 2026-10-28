/* =====================================================================
   SİSTEM — veri deposu, şifreleme, yedek, işlem kaydı, örnek veri,
   sıfırlama
   ===================================================================== */
(function () {
  'use strict';

  function ciz(kap) {
    const ist = ADB.istatistik();
    const yd = ADB.yedekDurumu();

    const dosyada = ADB.depoDurumu().kip === 'sunucu';
    kap.innerHTML = `
      <div class="kart">
        <div class="kart-baslik"><div><h2>Veri Deposu</h2>
          <div class="kart-aciklama">Verilerin nerede durduğu ve korunması.</div></div></div>
        <div id="depoKutu"><p class="kart-aciklama">Okunuyor…</p></div>
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>🔒 Veri Şifreleme</h2></div></div>
        <div id="sifreKutu"></div>
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>⏱ Otomatik Kapanma</h2>
          <div class="kart-aciklama">Belirtilen süre boyunca fare ya da klavye hareketi olmazsa program kendini kapatır:
            bekleyen kayıt dosyaya yazılır, veri parolası bellekten silinir. Yeniden açmak için veri parolası ve giriş
            parolası istenir. Kapanmadan 30 saniye önce uyarı çıkar. <strong>0</strong> yazılırsa özellik kapalıdır.</div></div></div>
        <div class="btn-satir">
          <label class="satir">Süre <input id="zaDk" type="number" min="0" max="240" step="1" style="width:90px"
            value="${API.oturumZamanAsimi()}"> dakika</label>
          <button class="btn" id="zaKaydet">Kaydet</button>
        </div>
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>Yedek</h2>
          <div class="kart-aciklama">${dosyada
            ? 'Veriler diskteki dosyada saklanır; program her kayıttan önce <code>yedek</code> klasörüne otomatik kopya alır. ' +
              'Yine de <strong>haftada bir elle yedek alıp</strong> dosyayı ayrı bir yerde (ağ sürücüsü, harici disk) saklayın: ' +
              'diskin kendisi bozulursa otomatik kopyalar da aynı diskte durur. Şifreleme açıksa yedekler de şifrelidir.'
            : 'Program sunucusuz açıldı: veri bu tarayıcıda duruyor. Tarayıcı verisi silinirse tek kurtarma yolu yedektir.'}</div></div></div>
        <div class="izgara izgara-4">
          <div class="stat"><div class="kucuk soluk">Personel</div><div class="gosterge">${ist.personel}</div></div>
          <div class="stat"><div class="kucuk soluk">Çalışma</div><div class="gosterge">${ist.calisma}</div></div>
          <div class="stat"><div class="kucuk soluk">Aylık girdi</div><div class="gosterge">${ist.aylik}</div></div>
          <div class="stat"><div class="kucuk soluk">Veritabanı</div><div class="gosterge">${ist.boyutKB} KB</div></div>
        </div>
        <div class="uyari ${!yd.alinmis || yd.gun > 7 ? 'uyari-dikkat' : 'uyari-basari'} ust-bosluk"><span class="ik">${!yd.alinmis || yd.gun > 7 ? '⚠' : '✓'}</span>
          <div>${yd.alinmis ? `Son yedek: ${U.tarihGoster(yd.tarih)} (${yd.gun} gün önce)` : 'Henüz yedek alınmamış.'}</div></div>
        <div class="btn-satir ust-bosluk">
          <button class="btn" id="yedekKlasor">Yedeği "yedek-elle" klasörüne kaydet</button>
          <button class="btn btn-ikincil" id="yedekIndir">Yedeği indir</button>
          <label class="btn btn-ikincil">Yedekten geri yükle<input type="file" id="yedekDosya" accept=".db" class="gizli"></label>
        </div>
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>İşlem Kaydı</h2><div class="kart-aciklama">Son 300 işlem.</div></div></div>
        ${C.tablo([
          { baslik: 'Tarih', deger: l => U.tarihGoster(l.tarih) + ' ' + l.tarih.slice(11, 19) },
          { baslik: 'Kullanıcı', alan: 'kullanici_adi' }, { baslik: 'İşlem', alan: 'islem' },
          { baslik: 'Tablo', alan: 'tablo' }, { baslik: 'Kayıt', alan: 'kayit_anahtar' },
          { baslik: 'Ayrıntı', deger: l => `<span class="kucuk">${U.esc(l.detay || '')}</span>` },
        ], API.logListe(300))}
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>Örnek Veri</h2>
          <div class="kart-aciklama">Programı denemek için uydurma iki grup, bu grupların bütçe bölümleri, örnek personel ve
            bütçe çalışmaları eklenir. Var olan kayıtlara dokunulmaz: aynı kodlu grup, aynı T.C. Kimlik No'lu kişi ya da aynı
            yıl ve addaki çalışma zaten varsa atlanır. Gerçek kullanıma geçerken örnek grupları ve çalışmalarını silin ya da
            veritabanını sıfırlayın.</div></div>
          <button class="btn btn-ikincil" id="ornekBtn">Örnek veriyi yükle</button></div>
      </div>

      <div class="kart">
        <div class="kart-baslik"><div><h2>Veritabanını Sıfırla</h2>
          <div class="kart-aciklama">Elle girilen her şey ve kullanıcı hesapları silinir; program ilk kurulum ekranıyla yeniden açılır
            (yasal parametreler yeniden yüklenir, örnek veriyle ya da boş başlanabilir). <strong>Program güncellemeleri için sıfırlama GEREKMEZ</strong>:
            yeni özellikler mevcut verinin üzerine kendiliğinden kurulur. Sıfırlamadan önce mevcut veri otomatik olarak
            <code>yedek-elle</code> klasörüne yedeklenir; yedek alınamazsa sıfırlama yapılmaz.</div></div>
          <button class="btn btn-tehlike" id="sifirlaBtn">Sıfırla…</button></div>
      </div>`;

    depoKutusunuDoldur(U.el('depoKutu'), dosyada);
    sifreKutusunuCiz();

    U.el('zaKaydet').onclick = () => {
      try {
        const v = API.oturumZamanAsimiYaz(U.el('zaDk').value);
        U.bildir(v ? 'Program ' + v + ' dakika hareketsizlikten sonra kapanacak.' : 'Otomatik kapanma kapatıldı.', 'basari');
      } catch (e) { U.bildir(e.message, 'hata'); }
    };

    U.el('yedekKlasor').onclick = async () => {
      try { const s = await ADB.yedekSunucuyaKaydet(); U.bildir('Yedek kaydedildi: ' + s.klasor + '\\' + s.dosya, 'basari'); APP.tazele(); }
      catch (e) { U.bildir('Klasöre kaydedilemedi (' + e.message + '). İndirme ile deneyin.', 'hata'); }
    };
    U.el('yedekIndir').onclick = () => { ADB.yedekIndir(); setTimeout(() => APP.tazele(), 500); };
    U.el('yedekDosya').onchange = async e => {
      const d = e.target.files[0]; if (!d) return;
      const ok = await C.onay({ baslik: 'Yedekten Geri Yükle', mesaj: `<strong>${U.esc(d.name)}</strong> yüklenecek.`,
        detay: 'Şu anki veritabanının üzerine yazılır. Önce mevcut hâlin yedeğini alın.', evetYazi: 'Geri Yükle', tehlike: true });
      if (!ok) return;
      try { await ADB.yedektenYukle(await d.arrayBuffer()); location.reload(); } catch (err) { U.bildir(err.message, 'hata'); }
    };
    U.el('ornekBtn').onclick = async () => {
      const ok = await C.onay({ baslik: 'Örnek Veriyi Yükle',
        mesaj: 'Uydurma iki grup (bütçe bölümleriyle), örnek personel ve bütçe çalışmaları eklenecek.',
        detay: 'Var olan kayıtlara dokunulmaz; aynı kodlu grup, aynı kişi ya da aynı çalışma varsa atlanır. ' +
               'Örnek veri programı denemek içindir: gerçek verinin yanında kalırsa raporlara ve toplamlara karışır.',
        evetYazi: 'Yükle' });
      if (!ok) return;
      const btn = U.el('ornekBtn');
      btn.disabled = true; btn.textContent = 'Yükleniyor…';
      setTimeout(() => {
        try {
          API.ornekVeriYukle();
          U.bildir('Örnek veri yüklendi.', 'basari');
          // Yeni gruplar üst çubuğa gelsin; seçili grup yoksa ya da geçersizse ilk gruba geçilir
          const kodlar = API.gorunurGruplar().map(g => g.kod), ag = APP.grup();
          if (kodlar.length && !(ag === 'TUMU' ? kodlar.length > 1 : kodlar.indexOf(ag) >= 0)) APP.secimYap(null, kodlar[0]);
          else { APP.calismaSeciciCiz(); APP.tazele(); }
        } catch (e) {
          U.bildir('Örnek veri yüklenemedi: ' + e.message, 'hata');
          btn.disabled = false; btn.textContent = 'Örnek veriyi yükle';
        }
      }, 30);
    };
    U.el('sifirlaBtn').onclick = async () => {
      const ok = await C.onay({ baslik: 'Veritabanını Sıfırla', mesaj: 'Bütün veriler ve kullanıcı hesapları silinecek.',
        detay: 'Program güncellemeleri için sıfırlama gerekmez. Önce otomatik yedek alınır; yine de bu işlem ' +
               'girdiğiniz bütün kayıtları siler.', evetYazi: 'Devam', tehlike: true });
      if (!ok) return;
      const yazi = await C.metinSor({ baslik: 'Son onay', etiket: 'Sıfırlamak için büyük harflerle SIFIRLA yazın', ipucu: 'SIFIRLA' });
      if (yazi == null) return;
      if (yazi.trim() !== 'SIFIRLA') { U.bildir('Onay metni hatalı; sıfırlama yapılmadı.', 'hata'); return; }
      try {
        const y = await ADB.sifirla();
        U.bildir('Sıfırlamadan önce yedek alındı: ' + ((y && y.dosya) || ''), 'basari');
        setTimeout(() => location.reload(), 1200);
      } catch (e) { U.bildir(e.message, 'hata'); }
    };
  }

  /* ---------- Veri deposu kutusu (sunucudan dosya bilgisi) ---------- */
  async function depoKutusunuDoldur(kutu, dosyada) {
    if (!kutu) return;
    if (!dosyada) {
      kutu.innerHTML = `<div class="uyari uyari-hata"><span class="ik">⚠</span><div>Veriniz şu anda
        <strong>tarayıcının deposunda</strong> duruyor: tarayıcı verisi temizlenirse kayıtlar gider. Programı
        <code>BUTCE-BASLAT.bat</code> ile açın; veri otomatik olarak diskteki dosyaya taşınır.</div></div>`;
      return;
    }
    let b = null;
    try { b = await fetch('/veri-bilgi', { cache: 'no-store' }).then(y => y.json()); } catch (e) { b = null; }
    if (!b || !b.basarili) { kutu.innerHTML = '<p class="kart-aciklama">Dosya bilgisi alınamadı.</p>'; return; }
    const satir = (ad, deger) => `<tr><td class="kucuk soluk">${ad}</td><td>${deger}</td></tr>`;
    kutu.innerHTML = `
      <p class="kart-aciklama">Veriniz <strong>tarayıcıda değil</strong>, diskteki bir dosyada duruyor. Tarayıcı verisi
        silinse, profil bozulsa ya da başka tarayıcı kullanılsa bile kayıtlarınız yerinde kalır.</p>
      <table class="genis-tablo"><tbody>
        ${satir('Veri dosyası', `<code>${U.esc(b.yol)}</code>`)}
        ${satir('Durum', b.var ? (b.sifreli ? '<span class="rz rz-yesil">şifreli</span>' : '<span class="rz rz-kirmizi">ŞİFRESİZ</span>')
                               : '<span class="rz rz-gri">henüz oluşmadı</span>')}
        ${satir('Boyut', b.var ? Math.round(b.boyut / 1024) + ' KB' : '—')}
        ${satir('Son yazma', b.tarih ? U.esc(b.tarih.replace('T', ' ')) : '—')}
        ${satir('Otomatik yedek', b.yedekSayisi + ' kopya · <code>' + U.esc(b.yedekKlasor) + '</code>')}
        ${satir('Elle yedekler', '<code>' + U.esc(b.elleYedekKlasor) + '</code>')}
      </tbody></table>
      ${b.duzYedek ? `<div class="uyari uyari-dikkat ust-bosluk"><span class="ik">⚠</span><div>Yedek klasörlerinde
        <strong>${b.duzYedek} şifresiz dosya</strong> var (şifreleme kurulmadan önce alınmış yedekler). İçlerinde maaş
        verisi açık duruyor; artık gerekmiyorsa Windows Gezgini'nden silin.</div></div>` : ''}`;
  }

  /* ---------- Veri şifreleme kutusu ----------
     Üç durum: kullanılamıyor (veri dosyada değil) · kurulmamış · açık */
  function sifreKutusunuCiz() {
    const kutu = U.el('sifreKutu');
    if (!kutu) return;
    const kullanilabilir = ADB.sifrelemeKullanilabilir();
    const acik = ADB.sifrelemeAcikMi();
    if (!kullanilabilir && !acik) {
      kutu.innerHTML = '<p class="kart-aciklama">Şifreleme yalnızca program <code>BUTCE-BASLAT.bat</code> ile açıldığında ve veri dosyada tutulurken kullanılabilir.</p>';
      return;
    }
    const alanlar = (yeni) => `
      <div class="izgara izgara-2 ust-bosluk">
        <div class="alan"><label>${yeni ? 'Yeni veri parolası' : 'Veri parolası'} (en az 8 karakter)</label><input type="password" id="sfParola" autocomplete="new-password"></div>
        <div class="alan"><label>Parola (tekrar)</label><input type="password" id="sfParola2" autocomplete="new-password"></div>
      </div><div class="perde-hata" id="sfHata"></div>`;
    if (!acik) {
      kutu.innerHTML = `
        <div class="uyari uyari-dikkat"><span class="ik">⚠</span><div><strong>Veri dosyası şu anda şifresiz.</strong>
          Dosyayı kopyalayan herkes — sunucu yöneticileri ve yedekleme sistemleri dâhil — bütün maaşları okuyabilir.</div></div>
        <div class="uyari uyari-hata"><span class="ik">🔑</span><div><strong>Parolayı kaybederseniz veriye kimse ulaşamaz.</strong>
          Arka kapı yoktur. Parolayı kilitli bir yerde yazılı saklayın.</div></div>
        ${alanlar(false)}
        <button class="btn" id="sfKurBtn">🔒 Şifrelemeyi Kur</button>`;
      U.el('sfKurBtn').onclick = () => sifreUygula('kur');
      return;
    }
    kutu.innerHTML = `
      <div class="uyari uyari-basari"><span class="ik">🔒</span><div><strong>Veri şifreli.</strong> Dosyayı kopyalayan biri
        veri parolası olmadan hiçbir kaydı okuyamaz. Otomatik kopyalar ve aldığınız yedekler de şifrelidir.</div></div>
      <p class="kart-aciklama">Parolayı değiştirmek için yenisini girin. Daha önce alınmış yedekler <strong>eski parolayla</strong> açılır.</p>
      ${alanlar(true)}
      <div class="btn-satir">
        <button class="btn" id="sfKurBtn">🔑 Parolayı Değiştir</button>
        <button class="btn btn-tehlike" id="sfKaldirBtn">🔓 Şifrelemeyi Kaldır</button>
      </div>`;
    U.el('sfKurBtn').onclick = () => sifreUygula('degistir');
    U.el('sfKaldirBtn').onclick = sifreKaldir;
  }

  async function sifreUygula(kip) {
    const hata = U.el('sfHata');
    const p1 = U.el('sfParola').value, p2 = U.el('sfParola2').value;
    hata.textContent = '';
    if (p1.length < 8) { hata.textContent = 'Parola en az 8 karakter olmalıdır.'; return; }
    if (p1 !== p2) { hata.textContent = 'İki parola aynı değil.'; return; }
    const metin = kip === 'kur'
      ? 'Veri dosyası bu parolayla şifrelenecek. Parolayı kaybederseniz verilere BİR DAHA ULAŞILAMAZ. Parolayı yazılı olarak sakladınız mı?'
      : 'Veri parolası değiştirilecek. Programı kullanan diğer kişilere de bildirmeniz gerekir. Devam edilsin mi?';
    if (!await C.onay({ baslik: 'Veri Şifreleme', mesaj: metin, evetYazi: 'Evet, uygula' })) return;
    const btn = U.el('sfKurBtn');
    btn.disabled = true; btn.textContent = 'Uygulanıyor…';
    try {
      await ADB.sifrelemeyiKur(p1);
      U.bildir(kip === 'kur' ? 'Şifreleme kuruldu; veri dosyası şifreli yazıldı.' : 'Veri parolası değiştirildi.', 'basari');
      APP.tazele();
    } catch (e) {
      hata.textContent = e.message;
      btn.disabled = false; btn.textContent = kip === 'kur' ? '🔒 Şifrelemeyi Kur' : '🔑 Parolayı Değiştir';
    }
  }

  async function sifreKaldir() {
    if (!await C.onay({ baslik: 'Şifrelemeyi Kaldır', mesaj: 'Şifreleme kaldırılacak ve veri dosyası DÜZ yazılacak.',
      detay: 'Dosyayı kopyalayan herkes — sunucu yöneticileri ve yedekleme sistemleri dâhil — bütün maaşları okuyabilir hâle gelir.',
      evetYazi: 'Evet, kaldır', tehlike: true })) return;
    try { await ADB.sifrelemeyiKaldir(); U.bildir('Şifreleme kaldırıldı.', 'basari'); APP.tazele(); }
    catch (e) { U.bildir('Şifreleme kaldırılamadı: ' + e.message, 'hata'); }
  }

  APP.modulKaydet({
    id: 'sistem', ad: 'Sistem', ikon: '🛠', grup: 'Yönetim',
    baslik: 'Sistem', altBaslik: 'Yedek, şifreleme, işlem kaydı, örnek veri',
    yetki: 'sistem.yonet', ciz: ciz,
  });
})();
