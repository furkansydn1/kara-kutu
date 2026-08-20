// ============================================================
// KARA KUTU — Yönetim (yalnız ADMIN_UID)
// Soru açar, piyasa açar, sonucu girer, ödemeleri dağıtır,
// ve gerektiğinde mührün altına bakar.
// ============================================================

import {
  db, collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc,
  query, orderBy, serverTimestamp, Timestamp, writeBatch
} from "./01-firebase.js";
import { S, uyeAdi } from "./02-state.js";
import { el, bosalt, toast, levha, avatar, para, tarih, saat } from "./03-ui.js";
import { secenekListesi, kayitNo } from "./05-today.js";
import { havuzHesapla, piyasalariYukle } from "./06-market.js";
import { arsiviTazele } from "./07-archive.js";

export function yonetimCiz(kap) {
  bosalt(kap);
  kap.append(
    el("div", { class: "view__head" },
      el("span", { class: "eyebrow" }, "Yalnız sen görürsün"),
      el("h2", {}, "Yönetim")),
    el("div", { class: "admin-note" },
      el("span", {}, "⚠"),
      el("span", {}, "Mühür altındaki oyları burada açabilirsin. Bir kez baktığında geri dönüşü yok — grup bunu bilmiyor.")),

    el("div", { class: "stack gap-2" },
      el("button", { class: "btn btn--primary btn--block", onclick: soruLevhasi }, "Yeni soru aç"),
      el("button", { class: "btn btn--ghost btn--block", onclick: piyasaLevhasi }, "Yeni piyasa aç")),

    el("div", { class: "section-label" }, "Sonuç bekleyen piyasalar"),
    bekleyenPiyasalar(),

    el("div", { class: "section-label" }, "Mühür altı"),
    muhurAltiListe()
  );
}

// --- Soru oluşturma ---------------------------------------------------------
function soruLevhasi() {
  levha(kapat => {
    let tur = "choice";
    const metin = el("textarea", { class: "textarea",
      placeholder: "Bu grupta kim sevgilisine en çok yalan söyler?" });

    const secKutu = el("div", { class: "opt-editor" });
    const secEkle = (deger = "") => {
      const inp = el("input", { class: "input", value: deger, placeholder: "Seçenek metni" });
      const satir = el("div", { class: "opt-editor__row" }, inp,
        el("button", { class: "btn btn--ghost btn--sm", type: "button",
          onclick: () => satir.remove() }, "Sil"));
      secKutu.append(satir);
    };
    secEkle(); secEkle();

    const turSec = el("div", { class: "options" },
      turDugmesi("choice", "Seçmeli · şıkları sen yazarsın", "S", true),
      turDugmesi("text", "Açık uçlu · herkes kendi cevabını yazar", "A", false));

    function turDugmesi(deger, etiket, harf, secili) {
      const b = el("button", { class: `option ${secili ? "is-picked" : ""}`, type: "button",
        onclick: () => {
          tur = deger;
          turSec.querySelectorAll(".option").forEach(x => x.classList.remove("is-picked"));
          b.classList.add("is-picked");
          secKutu.classList.toggle("hidden", deger !== "choice");
          ekleBtn.classList.toggle("hidden", deger !== "choice");
          uyari.classList.toggle("hidden", deger !== "text");
        }},
        el("span", { class: "option__key" }, harf),
        el("span", { class: "grow" }, etiket));
      return b;
    }

    const ekleBtn = el("button", { class: "btn btn--ghost btn--sm", type: "button",
      onclick: () => secEkle() }, "+ Seçenek ekle");

    const uyari = el("p", { class: "eyebrow hidden",
      style: "line-height:1.6;padding-left:12px;border-left:2px solid var(--seal)" },
      "Açık uçluda cevaplar isimsiz listelenir. Ama 8 kişilik grupta yazı tarzı ele verir — hassas sorular için seçmeli kullan.");

    const bugun = new Date();
    const acilis = el("input", { class: "input mono", type: "datetime-local",
      value: yerelISO(bugun) });
    const acilma = el("input", { class: "input mono", type: "datetime-local",
      value: yerelISO(new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate(), 21, 0)) });

    const kaydet = el("button", { class: "btn btn--primary btn--block" }, "Soruyu aç");
    kaydet.addEventListener("click", async () => {
      const t = metin.value.trim();
      if (t.length < 5) return toast("Soru metni çok kısa.", "bad");
      const secenekler = tur === "choice"
        ? [...secKutu.querySelectorAll("input")].map((i, ix) => ({ id: `o${ix}`, label: i.value.trim() }))
            .filter(o => o.label)
        : [];
      if (tur === "choice" && secenekler.length < 2) return toast("En az 2 seçenek gerekli.", "bad");

      const acilisT = new Date(acilis.value), acilmaT = new Date(acilma.value);
      if (isNaN(acilisT) || isNaN(acilmaT)) return toast("Tarihleri doldur.", "bad");
      if (acilmaT <= acilisT) return toast("Mühür açılışı, düşme saatinden sonra olmalı.", "bad");
      if (acilmaT <= new Date()) return toast("Mühür açılışı geçmişte kalmış. İleri bir saat seç.", "bad");

      kaydet.disabled = true; kaydet.textContent = "Açılıyor…";
      try {
        const sayi = (await getDocs(collection(db, "questions"))).size + 1;
        const ref = await addDoc(collection(db, "questions"), {
          no: sayi,
          type: tur,
          text: t,
          options: secenekler,
          openAt: Timestamp.fromDate(acilisT),
          revealAt: Timestamp.fromDate(acilmaT),
          totalVotes: 0,
          createdAt: serverTimestamp()
        });
        if (tur === "choice") {
          await setDoc(doc(db, "questions", ref.id, "tally", "counts"), { counts: {} });
        }
        toast("Soru açıldı.", "win");
        arsiviTazele();
        kapat();
      } catch (err) {
        console.error(err);
        toast("Kaydedilemedi.", "bad");
        kaydet.disabled = false; kaydet.textContent = "Soruyu aç";
      }
    });

    return el("div", { class: "stack gap-3" },
      el("h3", { style: "font-size:1.375rem" }, "Yeni soru"),
      el("div", { class: "field" }, el("label", {}, "Tür"), turSec),
      uyari,
      el("div", { class: "field" }, el("label", {}, "Soru"), metin),
      secKutu, ekleBtn,
      el("div", { class: "field" }, el("label", {}, "Ne zaman düşsün"), acilis),
      el("div", { class: "field" }, el("label", {}, "Mühür ne zaman açılsın"), acilma),
      kaydet);
  });
}

// --- Piyasa oluşturma -------------------------------------------------------
function piyasaLevhasi() {
  levha(kapat => {
    const baslik = el("input", { class: "input",
      placeholder: "Furkan ay sonuna kadar spora başlar mı?" });
    const aciklama = el("textarea", { class: "textarea",
      placeholder: "Kural: haftada en az 2 gün, fotoğraflı kanıt." });

    const secKutu = el("div", { class: "opt-editor" });
    const secEkle = (deger = "") => {
      const inp = el("input", { class: "input", value: deger });
      const satir = el("div", { class: "opt-editor__row" }, inp,
        el("button", { class: "btn btn--ghost btn--sm", type: "button",
          onclick: () => satir.remove() }, "Sil"));
      secKutu.append(satir);
    };
    secEkle("Evet"); secEkle("Hayır");

    const iki = new Date(); iki.setMonth(iki.getMonth() + 2);
    const kapanis = el("input", { class: "input mono", type: "datetime-local", value: yerelISO(iki) });

    const kaydet = el("button", { class: "btn btn--primary btn--block" }, "Piyasayı aç");
    kaydet.addEventListener("click", async () => {
      const secenekler = [...secKutu.querySelectorAll("input")]
        .map((i, ix) => ({ id: `o${ix}`, label: i.value.trim() })).filter(o => o.label);
      if (baslik.value.trim().length < 5) return toast("Başlık çok kısa.", "bad");
      if (secenekler.length < 2) return toast("En az 2 taraf gerekli.", "bad");

      kaydet.disabled = true; kaydet.textContent = "Açılıyor…";
      try {
        const sayi = (await getDocs(collection(db, "markets"))).size + 1;
        await addDoc(collection(db, "markets"), {
          no: sayi,
          title: baslik.value.trim(),
          desc: aciklama.value.trim(),
          options: secenekler,
          closeAt: Timestamp.fromDate(new Date(kapanis.value)),
          status: "open",
          outcome: null,
          createdAt: serverTimestamp()
        });
        toast("Piyasa açıldı.", "win");
        await piyasalariYukle();
        kapat();
      } catch (err) {
        console.error(err);
        toast("Kaydedilemedi.", "bad");
        kaydet.disabled = false; kaydet.textContent = "Piyasayı aç";
      }
    });

    return el("div", { class: "stack gap-3" },
      el("h3", { style: "font-size:1.375rem" }, "Yeni piyasa"),
      el("div", { class: "field" }, el("label", {}, "Başlık"), baslik),
      el("div", { class: "field" }, el("label", {}, "Kural / açıklama"), aciklama),
      el("div", { class: "field" }, el("label", {}, "Taraflar"), secKutu),
      el("button", { class: "btn btn--ghost btn--sm", type: "button", onclick: () => secEkle() }, "+ Taraf ekle"),
      el("div", { class: "field" }, el("label", {}, "Kapanış"), kapanis),
      kaydet);
  });
}

// --- Sonuç girme ------------------------------------------------------------
function bekleyenPiyasalar() {
  const acik = S.piyasalar.filter(m => m.status !== "settled");
  if (!acik.length) return el("div", { class: "empty" },
    el("h3", {}, "Bekleyen yok"), el("p", {}, "Tüm piyasalar sonuçlandı."));

  const kutu = el("div", {});
  acik.forEach(m => {
    const havuz = havuzHesapla(m);
    kutu.append(el("div", { class: "reveal-row" },
      el("div", { class: "stack", style: "min-width:0" },
        el("span", { class: "reveal-row__q" }, m.title),
        el("span", { class: "eyebrow" }, `${m.bahisler.length} bahis · ${para(havuz.toplam)}`)),
      el("button", { class: "btn btn--primary btn--sm",
        onclick: () => sonucLevhasi(m) }, "Sonucu gir")));
  });
  return kutu;
}

function sonucLevhasi(m) {
  levha(kapat => {
    let secili = null;
    const havuz = havuzHesapla(m);
    const onizleme = el("div", { class: "secret hidden" });

    const secenekler = el("div", { class: "options" });
    m.options.forEach(o => {
      secenekler.append(el("button", { class: "option", type: "button", onclick: e => {
        secili = o.id;
        secenekler.querySelectorAll(".option").forEach(b => b.classList.remove("is-picked"));
        e.currentTarget.classList.add("is-picked");
        onizlemeCiz(o.id);
        onayla.disabled = false;
      }},
        el("span", { class: "option__key" }, "●"),
        el("span", { class: "grow" }, o.label),
        el("span", { class: "mono", style: "font-size:.75rem;color:var(--bone-3)" },
          para(havuz.dagilim[o.id] || 0))));
    });

    function onizlemeCiz(kazananId) {
      const odemeler = odemeHesapla(m, kazananId);
      bosalt(onizleme).classList.remove("hidden");
      onizleme.append(el("div", { class: "eyebrow", style: "margin-bottom:8px" }, "Dağıtım önizlemesi"));
      if (!odemeler.length) {
        onizleme.append(el("div", { style: "font-size:.875rem;color:var(--bone-2)" }, "Bu piyasada bahis yok."));
        return;
      }
      odemeler.forEach(o => {
        onizleme.append(el("div", { class: "secret__row" },
          el("span", {}, o.ad),
          el("span", { style: o.delta >= 0 ? "color:var(--verdigris)" : "color:var(--seal)" },
            `${o.delta >= 0 ? "+" : ""}${para(o.delta)}`)));
      });
    }

    const onayla = el("button", { class: "btn btn--danger btn--block", disabled: true },
      "Sonucu kesinleştir ve öde");
    onayla.addEventListener("click", async () => {
      onayla.disabled = true; onayla.textContent = "Dağıtılıyor…";
      try {
        await sonuclandir(m, secili);
        toast("Ödemeler dağıtıldı, bildirimler gitti.", "win");
        await piyasalariYukle();
        kapat();
        yonetimCiz(document.querySelector("#view"));
      } catch (err) {
        console.error(err);
        toast("Dağıtım başarısız.", "bad");
        onayla.disabled = false; onayla.textContent = "Sonucu kesinleştir ve öde";
      }
    });

    return el("div", { class: "stack gap-3" },
      el("h3", { style: "font-size:1.25rem" }, m.title),
      el("span", { class: "eyebrow" }, "Kazanan tarafı seç"),
      secenekler, onizleme, onayla);
  });
}

/** Ganyan dağıtımı. delta = kesenin net değişimi. */
export function odemeHesapla(m, kazananId) {
  const kazananlar = m.bahisler.filter(b => b.optionId === kazananId);
  const kaybedenler = m.bahisler.filter(b => b.optionId !== kazananId);
  const kazananToplam = kazananlar.reduce((t, b) => t + b.amount, 0);
  const kaybedenToplam = kaybedenler.reduce((t, b) => t + b.amount, 0);

  // Kimse tutturamadıysa herkese iade
  if (!kazananlar.length) {
    return m.bahisler.map(b => ({ uid: b.uid, ad: b.ad, delta: 0, payout: b.amount, kazandi: false }));
  }

  return [
    ...kazananlar.map(b => {
      const pay = b.amount + kaybedenToplam * (b.amount / kazananToplam);
      return { uid: b.uid, ad: b.ad, delta: Math.round(pay - b.amount), payout: Math.round(pay), kazandi: true };
    }),
    ...kaybedenler.map(b => ({ uid: b.uid, ad: b.ad, delta: -b.amount, payout: 0, kazandi: false }))
  ];
}

async function sonuclandir(m, kazananId) {
  const odemeler = odemeHesapla(m, kazananId);
  const kazanan = m.options.find(o => o.id === kazananId);
  const batch = writeBatch(db);

  batch.update(doc(db, "markets", m.id), {
    status: "settled",
    outcome: kazananId,
    settledAt: serverTimestamp()
  });

  for (const o of odemeler) {
    batch.update(doc(db, "markets", m.id, "bets", o.uid), { payout: o.payout });
    batch.set(doc(collection(db, "ledger")), {
      uid: o.uid,
      delta: o.delta,
      reason: m.title,
      marketId: m.id,
      ts: serverTimestamp()
    });
    batch.set(doc(collection(db, "notifications")), {
      to: o.uid,
      tur: o.kazandi ? "win" : "lose",
      title: o.kazandi ? "Tuttu!" : "Tutmadı",
      body: o.kazandi
        ? `"${m.title}" → ${kazanan.label}. Kesene ${para(o.delta)} girdi.`
        : `"${m.title}" → ${kazanan.label}. ${para(-o.delta)} gitti.`,
      read: false,
      ts: serverTimestamp()
    });
  }
  await batch.commit();
}

// --- Mühür altı -------------------------------------------------------------
function muhurAltiListe() {
  const kutu = el("div", {});
  kutu.append(el("div", { class: "skeleton" }));
  getDocs(query(collection(db, "questions"), orderBy("openAt", "desc"))).then(snap => {
    bosalt(kutu);
    if (snap.empty) {
      kutu.append(el("div", { class: "empty" },
        el("h3", {}, "Soru yok"), el("p", {}, "Önce bir soru aç.")));
      return;
    }
    snap.docs.forEach(d => {
      const s = { id: d.id, ...d.data() };
      kutu.append(el("div", { class: "reveal-row" },
        el("div", { class: "stack", style: "min-width:0" },
          el("span", { class: "reveal-row__q" }, s.text),
          el("span", { class: "eyebrow" }, `${kayitNo(s)} · ${s.totalVotes || 0} oy`)),
        el("button", { class: "btn btn--ghost btn--sm",
          onclick: () => oylariAc(s) }, "Kim ne verdi")));
    });
  });
  return kutu;
}

async function oylariAc(s) {
  const snap = await getDocs(collection(db, "questions", s.id, "votes"));
  const secenekler = secenekListesi(s);
  levha(() => {
    const kutu = el("div", { class: "secret" });
    if (snap.empty) {
      kutu.append(el("div", { style: "font-size:.875rem;color:var(--bone-2)" }, "Henüz oy yok."));
    } else {
      snap.docs.forEach(d => {
        const v = d.data();
        const cevap = v.text !== undefined
          ? v.text
          : (secenekler.find(o => o.id === v.optionId)?.label || "—");
        kutu.append(el("div", { class: "secret__row" },
          el("span", {}, uyeAdi(d.id)),
          el("span", { style: "text-align:right;max-width:60%" }, cevap)));
      });
    }
    return el("div", { class: "stack gap-3" },
      el("span", { class: "eyebrow" }, kayitNo(s), " · mühür altı"),
      el("h3", { style: "font-size:1.25rem;line-height:1.25" }, s.text),
      kutu,
      el("p", { class: "eyebrow", style: "text-align:center" },
        "Bu ekranı yalnız sen görüyorsun"));
  });
}

// --- Yardımcı ---------------------------------------------------------------
function yerelISO(d) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
