// ============================================================
// KARA KUTU — Bugün
// Üç hâl:  1) oy verilmedi   2) oy verildi, mühür duruyor   3) mühür açıldı
// ============================================================

import {
  db, doc, getDoc, setDoc, updateDoc, collection, query, where,
  orderBy, limit, getDocs, onSnapshot, serverTimestamp, increment
} from "./01-firebase.js";
import { S, guncelle } from "./02-state.js";
import { el, bosalt, toast, avatar, sayacBagla, iskelet, saat } from "./03-ui.js";

const HARFLER = "ABCDEFGH";
let sayacDur = null;

export async function soruYukle() {
  const q = query(
    collection(db, "questions"),
    where("openAt", "<=", new Date()),
    orderBy("openAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) { guncelle({ soru: null }); return; }

  const soru = { id: snap.docs[0].id, ...snap.docs[0].data() };

  // Kendi oyum
  const oySnap = await getDoc(doc(db, "questions", soru.id, "votes", S.user.uid));
  const oyum = oySnap.exists() ? oySnap.data() : null;

  // Sayım yalnız açılış vaktinden sonra okunabilir (kural motoru engelliyor)
  let sayim = null;
  if (acildiMi(soru)) {
    try {
      const t = await getDoc(doc(db, "questions", soru.id, "tally", "counts"));
      sayim = t.exists() ? (t.data().counts || {}) : {};
    } catch { sayim = null; }
  }

  guncelle({ soru, oyum, sayim });
}

export function acildiMi(soru) {
  if (!soru?.revealAt) return false;
  return soru.revealAt.toDate() <= new Date();
}

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

  const panel = el("div", { class: "panel" },
    el("div", { class: "row gap-2" },
      el("span", { class: `qtype qtype--${soru.type === "classic" ? "classic" : "choice"}` },
        soru.type === "classic" ? "Kim" : "Seçmeli"),
      el("span", { class: "eyebrow" }, `Kayıt ${kayitNo(soru)}`)),
    el("h3", { class: "question__text" }, soru.text)
  );

  if (acildiMi(soru))       panel.append(...sonucBlogu(soru));
  else if (S.oyum)          panel.append(muhurBlogu(soru));
  else                      panel.append(...oyBlogu(soru, panel));

  kap.append(panel);
}

// --- 1) Oy verme ------------------------------------------------------------
function oyBlogu(soru, panel) {
  const kutu = el("div", { class: "options" });
  const secenekler = secenekListesi(soru);

  secenekler.forEach((o, i) => {
    kutu.append(el("button", {
      class: "option",
      type: "button",
      onclick: async ev => {
        const btn = ev.currentTarget;
        kutu.querySelectorAll(".option").forEach(b => b.disabled = true);
        btn.classList.add("is-picked");
        try {
          await oyVer(soru, o.id);
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

async function oyVer(soru, optionId) {
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

// --- 2) Mühür ---------------------------------------------------------------
function muhurBlogu(soru) {
  const secim = secenekListesi(soru).find(o => o.id === S.oyum.optionId);
  const sayac = el("div", { class: "countdown" }, "--:--:--");

  const muhur = el("div", { class: "sealed panel" },
    el("div", { class: "sealed__tape" }, "Mühürlü · Mühürlü · Mühürlü · Mühürlü"),
    el("div", { class: "sealed__body" },
      el("div", { class: "sealed__count" }, `${soru.totalVotes || 0} oy içeride`),
      el("div", { class: "sealed__note" },
        `Senin oyun: ${secim ? secim.label : "kayıtlı"}`),
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
      const bar = el("div", {
        class: `bar ${o.n === enYuksek && o.n > 0 ? "is-top" : ""} ${S.oyum?.optionId === o.id ? "is-mine" : ""}`
      },
        dolgu,
        el("div", { class: "bar__row" },
          el("span", {}, o.label),
          el("span", { class: "bar__num" }, `${o.n} · %${yuzde}`))
      );
      kutu.append(bar);
      requestAnimationFrame(() => { dolgu.style.width = `${(o.n / toplam) * 100}%`; });
    });

  const alt = el("p", { class: "eyebrow", style: "margin-top:16px;text-align:center" },
    S.oyum ? "Gri şeritli olan senin oyun" : "Bu soruda oy kullanmadın");

  return [kutu, alt];
}

// --- Yardımcılar ------------------------------------------------------------
export function secenekListesi(soru) {
  if (soru.type === "classic") {
    return S.uyeler.map(u => ({ id: u.uid, label: u.ad }));
  }
  return (soru.options || []).map((o, i) =>
    typeof o === "string" ? { id: `o${i}`, label: o } : o);
}

export function kayitNo(soru) {
  return `KK-${String(soru.no ?? 0).padStart(4, "0")}`;
}
