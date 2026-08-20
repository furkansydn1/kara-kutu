// ============================================================
// KARA KUTU — Bugün
// İki soru türü:
//   choice : şıkları yönetici yazar, oy sayılır
//   text   : şık yok, herkes kendi cevabını yazar
// Üç hâl:  1) cevap verilmedi   2) verildi, mühür duruyor   3) mühür açıldı
// ============================================================

import {
  db, doc, getDoc, setDoc, updateDoc, collection, query, where,
  orderBy, limit, getDocs, serverTimestamp, increment, writeBatch
} from "./01-firebase.js";
import { S, guncelle } from "./02-state.js";
import { el, bosalt, toast, sayacBagla } from "./03-ui.js";

const HARFLER = "ABCDEFGH";
export const CEVAP_SINIRI = 280;
let sayacDur = null;

// --- Yükleme ----------------------------------------------------------------
export async function soruYukle() {
  const q = query(
    collection(db, "questions"),
    where("openAt", "<=", new Date()),
    orderBy("openAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) { guncelle({ soru: null, oyum: null, sayim: null, cevaplar: null }); return; }

  const soru = { id: snap.docs[0].id, ...snap.docs[0].data() };

  // Kendi cevabım
  const oySnap = await getDoc(doc(db, "questions", soru.id, "votes", S.user.uid));
  const oyum = oySnap.exists() ? oySnap.data() : null;

  // Sonuçlar yalnız açılış vaktinden sonra okunabilir (kural motoru engelliyor)
  let sayim = null, cevaplar = null;
  if (acildiMi(soru)) {
    try {
      if (acikUclu(soru)) {
        const a = await getDocs(collection(db, "questions", soru.id, "answers"));
        cevaplar = karistir(a.docs.map(d => d.data().text));
      } else {
        const t = await getDoc(doc(db, "questions", soru.id, "tally", "counts"));
        sayim = t.exists() ? (t.data().counts || {}) : {};
      }
    } catch { /* kural engelledi, boş bırak */ }
  }

  guncelle({ soru, oyum, sayim, cevaplar });
}

export function acildiMi(soru) {
  if (!soru?.revealAt) return false;
  return soru.revealAt.toDate() <= new Date();
}

export function acikUclu(soru) {
  return soru?.type === "text";
}

// --- Çizim ------------------------------------------------------------------
export function bugunCiz(kap) {
  if (sayacDur) { sayacDur(); sayacDur = null; }
  bosalt(kap);

  kap.append(el("div", { class: "view__head" },
    el("span", { class: "eyebrow" }, "Bugünün kaydı"),
    el("h2", {}, "Kutu")
  ));

  const soru = S.soru;
  if (!soru) {
    kap.append(el("div", { class: "empty" },
      el("h3", {}, "Sırada soru yok"),
      el("p", {}, "Yeni soru düştüğünde burada olacak.")));
    return;
  }

  const acik = acikUclu(soru);
  const panel = el("div", { class: "panel" },
    el("div", { class: "row gap-2" },
      el("span", { class: `qtype qtype--${acik ? "text" : "choice"}` },
        acik ? "Açık uçlu" : "Seçmeli"),
      el("span", { class: "eyebrow" }, `Kayıt ${kayitNo(soru)}`)),
    el("h3", { class: "question__text" }, soru.text)
  );

  if (acildiMi(soru))  panel.append(...sonucBlogu(soru));
  else if (S.oyum)     panel.append(muhurBlogu(soru));
  else if (acik)       panel.append(...yaziBlogu(soru, panel));
  else                 panel.append(...secimBlogu(soru, panel));

  kap.append(panel);
}

// --- 1a) Şık seçme ----------------------------------------------------------
function secimBlogu(soru, panel) {
  const kutu = el("div", { class: "options" });
  const secenekler = secenekListesi(soru);

  if (!secenekler.length) {
    return [el("div", { class: "empty" },
      el("h3", {}, "Şık tanımlanmamış"),
      el("p", {}, "Bu soru şıksız kaydedilmiş, yönetim panelinden yenisini aç."))];
  }

  secenekler.forEach((o, i) => {
    kutu.append(el("button", {
      class: "option", type: "button",
      onclick: async ev => {
        const btn = ev.currentTarget;
        kutu.querySelectorAll(".option").forEach(b => b.disabled = true);
        btn.classList.add("is-picked");
        try {
          await secimGonder(soru, o.id);
          toast("Oyun mühürlendi.", "win");
          bugunCiz(panel.parentElement);
        } catch (err) {
          console.error(err);
          toast("Oy gitmedi, tekrar dene.", "bad");
          kutu.querySelectorAll(".option").forEach(b => b.disabled = false);
          btn.classList.remove("is-picked");
        }
      }
    },
      el("span", { class: "option__key" }, HARFLER[i] || String(i + 1)),
      el("span", { class: "grow" }, o.label)
    ));
  });

  return [
    kutu,
    el("p", { class: "eyebrow", style: "margin-top:16px;text-align:center" },
      "Bir kez oy verilir · geri alınmaz")
  ];
}

async function secimGonder(soru, optionId) {
  const uid = S.user.uid;
  await setDoc(doc(db, "questions", soru.id, "votes", uid), {
    optionId, ts: serverTimestamp()
  });
  // Sayacı artır — okumadan yazıyoruz, o yüzden içerik sızmıyor
  await updateDoc(doc(db, "questions", soru.id, "tally", "counts"), {
    [`counts.${optionId}`]: increment(1)
  });
  await updateDoc(doc(db, "questions", soru.id), { totalVotes: increment(1) });
  guncelle({ oyum: { optionId } });
}

// --- 1b) Yazı yazma ---------------------------------------------------------
function yaziBlogu(soru, panel) {
  const alan = el("textarea", {
    class: "textarea", maxlength: String(CEVAP_SINIRI),
    placeholder: "Cevabını yaz…", rows: "4"
  });
  const sayar = el("span", { class: "eyebrow" }, `0 / ${CEVAP_SINIRI}`);
  const gonder = el("button", { class: "btn btn--primary btn--block", disabled: true },
    "Cevabı mühürle");

  alan.addEventListener("input", () => {
    const n = alan.value.trim().length;
    sayar.textContent = `${n} / ${CEVAP_SINIRI}`;
    gonder.disabled = n < 2;
  });

  gonder.addEventListener("click", async () => {
    gonder.disabled = true;
    gonder.textContent = "Mühürleniyor…";
    alan.disabled = true;
    try {
      await yaziGonder(soru, alan.value.trim());
      toast("Cevabın mühürlendi.", "win");
      bugunCiz(panel.parentElement);
    } catch (err) {
      console.error(err);
      toast("Cevap gitmedi, tekrar dene.", "bad");
      gonder.disabled = false;
      gonder.textContent = "Cevabı mühürle";
      alan.disabled = false;
    }
  });

  return [
    alan,
    el("div", { class: "row between", style: "margin:8px 0 16px" },
      el("span", { class: "eyebrow" }, "Bir kez yazılır · geri alınmaz"), sayar),
    gonder,
    el("p", { class: "eyebrow", style: "margin-top:12px;text-align:center;line-height:1.6" },
      "Cevabın isimsiz görünecek. Ama yazı tarzından tanınabilirsin.")
  ];
}

async function yaziGonder(soru, metin) {
  const uid = S.user.uid;
  const batch = writeBatch(db);

  // Gizli arşiv — kime ait olduğu burada, yalnız yönetici okur
  batch.set(doc(db, "questions", soru.id, "votes", uid), {
    text: metin, ts: serverTimestamp()
  });
  // Herkese açık kopya — kimlik taşımaz, sıra bilgisi de yok
  batch.set(doc(collection(db, "questions", soru.id, "answers")), { text: metin });
  batch.update(doc(db, "questions", soru.id), { totalVotes: increment(1) });

  await batch.commit();
  guncelle({ oyum: { text: metin } });
}

// --- 2) Mühür ---------------------------------------------------------------
function muhurBlogu(soru) {
  const sayac = el("div", { class: "countdown" }, "--:--:--");
  const benimki = acikUclu(soru)
    ? kisalt(S.oyum.text, 60)
    : (secenekListesi(soru).find(o => o.id === S.oyum.optionId)?.label || "kayıtlı");

  const muhur = el("div", { class: "sealed panel" },
    el("div", { class: "sealed__tape" }, "Mühürlü · Mühürlü · Mühürlü · Mühürlü"),
    el("div", { class: "sealed__body" },
      el("div", { class: "sealed__count" },
        `${soru.totalVotes || 0} ${acikUclu(soru) ? "cevap" : "oy"} içeride`),
      el("div", { class: "sealed__note" }, `Seninki: ${benimki}`),
      el("div", { style: "margin-top:20px" },
        el("div", { class: "eyebrow", style: "margin-bottom:6px" }, "Açılışa kalan"),
        sayac))
  );

  sayacDur = sayacBagla(sayac, soru.revealAt, async () => {
    muhur.classList.add("is-breaking");
    await new Promise(r => setTimeout(r, 780));
    await soruYukle();
    bugunCiz(document.querySelector("#view"));
    toast("Mühür açıldı. Sonuçlar geldi.", "win");
  });

  return muhur;
}

// --- 3) Sonuç ---------------------------------------------------------------
function sonucBlogu(soru) {
  return acikUclu(soru) ? cevapListesi(soru) : oyCubuklari(soru);
}

function cevapListesi(soru) {
  const liste = S.cevaplar || [];
  if (!liste.length) {
    return [el("div", { class: "empty" },
      el("h3", {}, "Cevap yok"),
      el("p", {}, "Bu soruya kimse yazmamış."))];
  }

  const kutu = el("div", { class: "answers" });
  liste.forEach(metin => {
    const benim = S.oyum?.text && S.oyum.text === metin;
    kutu.append(el("blockquote", { class: `answer ${benim ? "is-mine" : ""}` }, metin));
  });

  return [
    kutu,
    el("p", { class: "eyebrow", style: "margin-top:16px;text-align:center" },
      `${liste.length} cevap · sıra karışık · kim yazdı bilinmiyor`)
  ];
}

function oyCubuklari(soru) {
  const sayim = S.sayim || {};
  const secenekler = secenekListesi(soru);
  const toplam = Object.values(sayim).reduce((a, b) => a + b, 0) || 1;
  const enYuksek = Math.max(0, ...Object.values(sayim));

  const kutu = el("div", { class: "tally" });
  secenekler
    .map(o => ({ ...o, n: sayim[o.id] || 0 }))
    .sort((a, b) => b.n - a.n)
    .forEach(o => {
      const yuzde = Math.round((o.n / toplam) * 100);
      const dolgu = el("div", { class: "bar__fill" });
      kutu.append(el("div", {
        class: `bar ${o.n === enYuksek && o.n > 0 ? "is-top" : ""} ${S.oyum?.optionId === o.id ? "is-mine" : ""}`
      },
        dolgu,
        el("div", { class: "bar__row" },
          el("span", {}, o.label),
          el("span", { class: "bar__num" }, `${o.n} · %${yuzde}`))
      ));
      requestAnimationFrame(() => { dolgu.style.width = `${(o.n / toplam) * 100}%`; });
    });

  return [
    kutu,
    el("p", { class: "eyebrow", style: "margin-top:16px;text-align:center" },
      S.oyum ? "Gri şeritli olan senin oyun" : "Bu soruda oy kullanmadın")
  ];
}

// --- Yardımcılar ------------------------------------------------------------
export function secenekListesi(soru) {
  if (acikUclu(soru)) return [];
  return (soru.options || []).map((o, i) =>
    typeof o === "string" ? { id: `o${i}`, label: o } : o);
}

export function kayitNo(soru) {
  return `KK-${String(soru.no ?? 0).padStart(4, "0")}`;
}

function kisalt(s, n) {
  if (!s) return "kayıtlı";
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

/** Fisher–Yates — gönderim sırası sızmasın diye */
function karistir(dizi) {
  const a = [...dizi];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
