// ============================================================
// KARA KUTU — Borsa
// Ganyan usulü: herkes havuza atar, kapanışta kaybedenlerin parası
// kazananlara koydukları oranında bölünür. Oran kendiliğinden oluşur.
// Bahisler herkese açıktır — kutunun aksine burada saklı bir şey yok.
// ============================================================

import {
  db, collection, doc, setDoc, getDocs, query, orderBy, serverTimestamp
} from "./01-firebase.js";
import { S, guncelle, bakiye } from "./02-state.js";
import { el, bosalt, toast, avatar, levha, para, tarih, kalanSure, sayacBagla } from "./03-ui.js";

const RENKLER = ["var(--amber)", "var(--verdigris)", "var(--seal)", "var(--bone-3)"];
let sayaclar = [];

export async function piyasalariYukle() {
  const snap = await getDocs(query(collection(db, "markets"), orderBy("closeAt", "asc")));
  const piyasalar = [];
  for (const d of snap.docs) {
    const m = { id: d.id, ...d.data(), bahisler: [] };
    const bs = await getDocs(collection(db, "markets", d.id, "bets"));
    bs.forEach(b => m.bahisler.push({ uid: b.id, ...b.data() }));
    piyasalar.push(m);
  }
  guncelle({
    piyasalar,
    bahislerim: piyasalar.flatMap(m =>
      m.bahisler.filter(b => b.uid === S.user.uid).map(b => ({ marketId: m.id, ...b })))
  });
}

export function borsaCiz(kap) {
  sayaclar.forEach(f => f()); sayaclar = [];
  bosalt(kap);

  kap.append(el("div", { class: "view__head" },
    el("span", { class: "eyebrow" }, "Açık defter"),
    el("h2", {}, "Borsa")
  ));

  const acik = S.piyasalar.filter(m => m.status === "open");
  const kapali = S.piyasalar.filter(m => m.status !== "open");

  if (!S.piyasalar.length) {
    kap.append(el("div", { class: "empty" },
      el("h3", {}, "Ortada bahis yok"),
      el("p", {}, "İlk piyasa açıldığında burada belirecek.")));
    return;
  }

  if (acik.length) {
    kap.append(el("div", { class: "section-label" }, `Açık · ${acik.length}`));
    acik.forEach(m => kap.append(piyasaKarti(m)));
  }
  if (kapali.length) {
    kap.append(el("div", { class: "section-label" }, "Kapanmış"));
    kapali.forEach(m => kap.append(piyasaKarti(m)));
  }
}

function piyasaKarti(m) {
  const havuz = havuzHesapla(m);
  const toplam = havuz.toplam || 1;
  const benimki = m.bahisler.find(b => b.uid === S.user.uid);

  const serit = el("div", { class: "pool" });
  m.options.forEach((o, i) => {
    serit.append(el("div", {
      class: "pool__seg",
      style: `width:${(havuz.dagilim[o.id] || 0) / toplam * 100}%;background:${RENKLER[i % 4]}`
    }));
  });

  const rozet = m.status === "open"
    ? el("span", { class: "badge badge--open" }, "Açık")
    : m.status === "settled"
      ? el("span", { class: "badge badge--settled" }, "Sonuçlandı")
      : el("span", { class: "badge badge--closed" }, "Kapalı");

  const sayacEl = el("span", { class: "mono" }, "");
  if (m.status === "open" && m.closeAt) {
    sayaclar.push(sayacBagla(sayacEl, m.closeAt, () => { sayacEl.textContent = "süre doldu"; }));
  }

  return el("button", {
    class: "panel market",
    type: "button",
    onclick: () => piyasaLevhasi(m)
  },
    el("div", { class: "market__head" }, rozet,
      el("span", { class: "eyebrow" }, `KB-${String(m.no ?? 0).padStart(3, "0")}`)),
    el("div", { class: "market__title" }, m.title),
    serit,
    el("div", { class: "legend" },
      ...m.options.map((o, i) => el("span", { class: "legend__item" },
        el("span", { class: "legend__swatch", style: `background:${RENKLER[i % 4]}` }),
        `${o.label} ${Math.round((havuz.dagilim[o.id] || 0) / toplam * 100)}%`))),
    el("div", { class: "market__meta", style: "margin-top:12px" },
      el("span", {}, "Havuz ", el("strong", {}, para(havuz.toplam))),
      el("span", {}, m.bahisler.length, " oyuncu"),
      m.status === "open" ? el("span", {}, "Kapanış ", sayacEl) : el("span", {}, tarih(m.closeAt)),
      benimki && el("span", { style: "color:var(--amber)" }, "Oynadın"))
  );
}

// --- Detay levhası ----------------------------------------------------------
function piyasaLevhasi(m) {
  levha(kapat => {
    const havuz = havuzHesapla(m);
    const benimki = m.bahisler.find(b => b.uid === S.user.uid);
    const kutu = el("div", { class: "stack gap-4" });

    kutu.append(
      el("span", { class: "eyebrow" }, `KB-${String(m.no ?? 0).padStart(3, "0")} · ${m.status === "open" ? "Açık" : m.status === "settled" ? "Sonuçlandı" : "Kapalı"}`),
      el("h3", { style: "font-size:1.5rem;line-height:1.2" }, m.title),
      m.desc && el("p", { style: "color:var(--bone-2);font-size:.875rem" }, m.desc)
    );

    // Sonuç
    if (m.status === "settled") {
      const kazanan = m.options.find(o => o.id === m.outcome);
      kutu.append(el("div", { class: "panel", style: "border-color:var(--verdigris-dim)" },
        el("span", { class: "eyebrow" }, "Sonuç"),
        el("div", { style: "font-family:var(--f-display);font-weight:800;font-size:1.25rem;color:var(--verdigris);margin-top:4px" },
          kazanan?.label || "—")));
    }

    // Oynama
    if (m.status === "open" && !benimki) {
      kutu.append(bahisFormu(m, havuz, kapat));
    } else if (benimki) {
      const secim = m.options.find(o => o.id === benimki.optionId);
      kutu.append(el("div", { class: "panel" },
        el("span", { class: "eyebrow" }, "Senin bahsin"),
        el("div", { class: "row between", style: "margin-top:8px" },
          el("span", {}, secim?.label || "—"),
          el("span", { class: "mono", style: "color:var(--amber)" }, para(benimki.amount)))));
    }

    // Defter
    kutu.append(el("div", { class: "section-label", style: "margin-top:8px" },
      `Defter · ${m.bahisler.length} kayıt`));
    kutu.append(defterCiz(m));

    return kutu;
  });
}

function bahisFormu(m, havuz, kapat) {
  let secili = null;
  const musait = bakiye();

  const tutar = el("input", {
    class: "input mono", type: "number", min: "10", step: "10",
    value: "100", inputmode: "numeric"
  });
  const tahmin = el("div", { class: "eyebrow", style: "text-align:center" }, "");
  const oyna = el("button", { class: "btn btn--primary btn--block", disabled: true }, "Bahsi koy");

  const yenile = () => {
    const t = Number(tutar.value) || 0;
    oyna.disabled = !secili || t < 10 || t > musait;
    if (!secili) { tahmin.textContent = "Bir taraf seç"; return; }
    if (t > musait) { tahmin.textContent = `Bakiyen yetmiyor · ${para(musait)}`; return; }
    const kendi = (havuz.dagilim[secili] || 0) + t;
    const karsi = havuz.toplam - (havuz.dagilim[secili] || 0);
    const odeme = t + (karsi * (t / kendi));
    tahmin.textContent = `Tutarsa ${para(odeme)} döner · ×${(odeme / t).toFixed(2)}`;
  };

  const secenekler = el("div", { class: "options" });
  m.options.forEach((o, i) => {
    secenekler.append(el("button", {
      class: "option", type: "button",
      onclick: e => {
        secili = o.id;
        secenekler.querySelectorAll(".option").forEach(b => b.classList.remove("is-picked"));
        e.currentTarget.classList.add("is-picked");
        yenile();
      }
    },
      el("span", { class: "option__key", style: `background:${RENKLER[i % 4]};border-color:${RENKLER[i % 4]};color:var(--hull-900)` }, "●"),
      el("span", { class: "grow" }, o.label),
      el("span", { class: "mono", style: "color:var(--bone-3);font-size:.75rem" }, para(havuz.dagilim[o.id] || 0))
    ));
  });

  tutar.addEventListener("input", yenile);
  oyna.addEventListener("click", async () => {
    oyna.disabled = true; oyna.textContent = "Yazılıyor…";
    try {
      await setDoc(doc(db, "markets", m.id, "bets", S.user.uid), {
        optionId: secili,
        amount: Number(tutar.value),
        ad: S.user.ad,
        ts: serverTimestamp()
      });
      toast("Bahis deftere geçti.", "win");
      kapat();
      await piyasalariYukle();
      borsaCiz(document.querySelector("#view"));
    } catch (err) {
      console.error(err);
      toast("Bahis gitmedi.", "bad");
      oyna.disabled = false; oyna.textContent = "Bahsi koy";
    }
  });

  yenile();

  return el("div", { class: "stack gap-3" },
    el("div", { class: "section-label", style: "margin-top:0" }, "Bahsini koy"),
    secenekler,
    el("div", { class: "field", style: "margin:0" },
      el("label", {}, `Tutar · bakiyen ${para(musait)}`), tutar),
    tahmin,
    oyna,
    el("p", { class: "eyebrow", style: "text-align:center" }, "Bahis bir kez konur · geri alınmaz"));
}

function defterCiz(m) {
  if (!m.bahisler.length) {
    return el("div", { class: "empty" },
      el("h3", {}, "Defter boş"),
      el("p", {}, "İlk bahsi koyan sen ol."));
  }
  const kutu = el("div", { class: "ledger" });
  [...m.bahisler].sort((a, b) => b.amount - a.amount).forEach(b => {
    const secim = m.options.find(o => o.id === b.optionId);
    const kazandi = m.status === "settled" && m.outcome === b.optionId;
    const kaybetti = m.status === "settled" && m.outcome !== b.optionId;
    kutu.append(el("div", { class: `ledger__row ${b.uid === S.user.uid ? "is-me" : ""}` },
      el("div", { class: "ledger__who" }, avatar(b.ad),
        el("span", { class: "ledger__name" }, b.ad)),
      el("span", { class: "ledger__pick" }, secim?.label || "—"),
      el("span", { class: `ledger__amt ${kazandi ? "is-win" : ""} ${kaybetti ? "is-lose" : ""}` },
        kazandi && b.payout ? `+${para(b.payout - b.amount)}` : para(b.amount))
    ));
  });
  return kutu;
}

// --- Havuz ------------------------------------------------------------------
export function havuzHesapla(m) {
  const dagilim = {};
  let toplam = 0;
  for (const b of m.bahisler) {
    dagilim[b.optionId] = (dagilim[b.optionId] || 0) + b.amount;
    toplam += b.amount;
  }
  return { dagilim, toplam };
}
