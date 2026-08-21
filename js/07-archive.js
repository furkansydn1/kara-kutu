// ============================================================
// KARA KUTU — Arşiv
// Açılmış her soru burada kalır. Neyin sorulduğu, ne çıktığı, ne zaman.
// ============================================================

import { db, collection, doc, getDoc, getDocs, query, orderBy } from "./01-firebase.js";
import { S } from "./02-state.js";
import { el, bosalt, levha, avatar, tarih, iskelet } from "./03-ui.js";
import { secenekListesi, kayitNo, acikUclu } from "./05-today.js";
import { kasaAnahtariMi, kasayiAc } from "./11-kasa.js";

let arsiv = null;

export async function arsivYukle() {
  const snap = await getDocs(query(collection(db, "questions"), orderBy("openAt", "desc")));
  const simdi = new Date();
  const liste = [];
  for (const d of snap.docs) {
    const s = { id: d.id, ...d.data() };
    if (!s.revealAt || s.revealAt.toDate() > simdi) continue; // mühürlü olan arşive girmez
    try {
      if (acikUclu(s)) {
        const a = await getDocs(collection(db, "questions", s.id, "answers"));
        s.cevaplar = a.docs.map(x => x.data().text);
      } else {
        const t = await getDoc(doc(db, "questions", s.id, "tally", "counts"));
        s.sayim = t.exists() ? (t.data().counts || {}) : {};
      }
    } catch { s.sayim = {}; s.cevaplar = []; }
    liste.push(s);
  }
  arsiv = liste;
  return liste;
}

export function arsivCiz(kap) {
  bosalt(kap);
  kap.append(el("div", { class: "view__head" },
    el("span", { class: "eyebrow" }, "Açılmış kayıtlar"),
    el("h2", {}, "Arşiv")
  ));

  if (arsiv === null) {
    kap.append(...iskelet(4));
    arsivYukle().then(() => arsivCiz(kap));
    return;
  }

  if (!arsiv.length) {
    kap.append(el("div", { class: "empty" },
      el("h3", {}, "Arşiv henüz boş"),
      el("p", {}, "İlk soru açıldığında buraya düşer.")));
    return;
  }

  const arama = el("input", {
    class: "input", type: "search", placeholder: "Soru ara…",
    oninput: e => {
      if (kasaAnahtariMi(e.target.value)) {
        e.target.value = "";      // iz bırakma
        e.target.blur();
        ciz("");
        kasayiAc();
        return;
      }
      ciz(e.target.value.toLowerCase());
    }
  });
  const liste = el("div", {});
  kap.append(el("div", { style: "margin-bottom:16px" }, arama), liste);

  function ciz(filtre = "") {
    bosalt(liste);
    const sonuc = arsiv.filter(s => !filtre || s.text.toLowerCase().includes(filtre));
    if (!sonuc.length) {
      liste.append(el("div", { class: "empty" },
        el("h3", {}, "Eşleşme yok"),
        el("p", {}, "Başka bir kelime dene.")));
      return;
    }
    sonuc.forEach(s => liste.append(arsivSatiri(s)));
  }
  ciz();
}

function arsivSatiri(s) {
  const acik = acikUclu(s);
  const secenekler = secenekListesi(s);
  const enCok = Object.entries(s.sayim || {}).sort((a, b) => b[1] - a[1])[0];
  const kazanan = enCok ? secenekler.find(o => o.id === enCok[0]) : null;

  let ozet;
  if (acik) {
    const n = (s.cevaplar || []).length;
    ozet = n
      ? el("div", { class: "arch__win" }, el("span", {}, `${n} cevap`))
      : el("div", { class: "arch__win", style: "color:var(--bone-3)" }, "Cevap yok");
  } else if (kazanan) {
    ozet = el("div", { class: "arch__win" }, avatar(kazanan.label),
      el("span", {}, kazanan.label), el("span", { style: "color:var(--bone-3)" }, `· ${enCok[1]} oy`));
  } else {
    ozet = el("div", { class: "arch__win", style: "color:var(--bone-3)" }, "Oy kullanılmamış");
  }

  return el("button", { class: "arch", type: "button", onclick: () => arsivLevhasi(s) },
    el("div", { class: "arch__top" },
      el("span", { class: "arch__date" }, kayitNo(s), " · ", tarih(s.revealAt)),
      el("span", { class: `qtype qtype--${acik ? "text" : "choice"}` },
        acik ? "Açık uçlu" : "Seçmeli")),
    el("div", { class: "arch__q" }, s.text),
    ozet
  );
}

function arsivLevhasi(s) {
  levha(() => {
    if (acikUclu(s)) {
      const liste = s.cevaplar || [];
      const kutu = el("div", { class: "answers" });
      liste.forEach(t => kutu.append(el("blockquote", { class: "answer" }, t)));
      return el("div", { class: "stack gap-4" },
        el("span", { class: "eyebrow" }, kayitNo(s), " · açılış ", tarih(s.revealAt)),
        el("h3", { style: "font-size:1.375rem;line-height:1.25" }, s.text),
        liste.length ? kutu : el("div", { class: "empty" },
          el("h3", {}, "Cevap yok"), el("p", {}, "Bu soruya kimse yazmamış.")),
        el("p", { class: "eyebrow", style: "text-align:center" },
          `${liste.length} cevap · kim yazdı bilinmiyor`));
    }

    const secenekler = secenekListesi(s);
    const toplam = Object.values(s.sayim || {}).reduce((a, b) => a + b, 0) || 1;
    const enYuksek = Math.max(0, ...Object.values(s.sayim || {}));

    const tally = el("div", { class: "tally" });
    secenekler.map(o => ({ ...o, n: s.sayim?.[o.id] || 0 }))
      .sort((a, b) => b.n - a.n)
      .forEach(o => {
        const dolgu = el("div", { class: "bar__fill", style: `width:${o.n / toplam * 100}%` });
        tally.append(el("div", { class: `bar ${o.n === enYuksek && o.n > 0 ? "is-top" : ""}` },
          dolgu,
          el("div", { class: "bar__row" },
            el("span", {}, o.label),
            el("span", { class: "bar__num" }, `${o.n} · %${Math.round(o.n / toplam * 100)}`))));
      });

    return el("div", { class: "stack gap-4" },
      el("span", { class: "eyebrow" }, kayitNo(s), " · açılış ", tarih(s.revealAt)),
      el("h3", { style: "font-size:1.375rem;line-height:1.25" }, s.text),
      tally,
      el("p", { class: "eyebrow", style: "text-align:center" },
        `${Object.values(s.sayim || {}).reduce((a, b) => a + b, 0)} oy · kim verdi bilinmiyor`));
  });
}

export function arsiviTazele() { arsiv = null; }
