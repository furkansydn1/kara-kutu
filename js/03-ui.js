// ============================================================
// KARA KUTU — arayüz yardımcıları
// ============================================================

import { AVATAR_RENKLERI, BIRIM } from "./00-config.js";

/** Etiket oluşturucu: el("div", { class: "x" }, "metin", cocukEl) */
export function el(tag, attrs = {}, ...cocuklar) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  for (const c of cocuklar.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

export const $ = (s, kok = document) => kok.querySelector(s);

export function bosalt(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// --- Bildirim şeridi --------------------------------------------------------
export function toast(mesaj, tur = "") {
  const kap = $("#toasts");
  if (!kap) return;
  const t = el("div", { class: `toast ${tur ? "toast--" + tur : ""}` }, mesaj);
  kap.append(t);
  setTimeout(() => {
    t.style.transition = "opacity .3s, transform .3s";
    t.style.opacity = "0";
    t.style.transform = "translateY(8px)";
    setTimeout(() => t.remove(), 320);
  }, 4200);
}

// --- Alt levha (sheet) ------------------------------------------------------
export function levha(icerikBuilder) {
  const govde = el("div", { class: "sheet" }, el("div", { class: "sheet__grip" }));
  const arka = el("div", { class: "sheet-backdrop" }, govde);

  const kapat = () => {
    arka.style.opacity = "0";
    setTimeout(() => arka.remove(), 180);
    document.removeEventListener("keydown", esc);
  };
  const esc = e => { if (e.key === "Escape") kapat(); };

  arka.addEventListener("click", e => { if (e.target === arka) kapat(); });
  document.addEventListener("keydown", esc);

  govde.append(...[icerikBuilder(kapat)].flat());
  document.body.append(arka);
  return kapat;
}

// --- Avatar -----------------------------------------------------------------
export function avatar(ad, buyuk = false) {
  const harfler = (ad || "?").trim().split(/\s+/).slice(0, 2)
    .map(p => p[0]).join("").toUpperCase();
  let h = 0;
  for (const ch of ad || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const renk = AVATAR_RENKLERI[h % AVATAR_RENKLERI.length];
  return el("div", {
    class: `av ${buyuk ? "av--lg" : ""}`,
    style: `background:${renk}`,
    "aria-hidden": "true"
  }, harfler);
}

// --- Biçimlendirme ----------------------------------------------------------
export const para = n => `${Math.round(n).toLocaleString("tr-TR")} ${BIRIM}`;

export function tarih(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export function saat(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

/** "3g 04:12:09" biçiminde kalan süre */
export function kalanSure(hedef) {
  const ms = (hedef.toDate ? hedef.toDate() : new Date(hedef)) - Date.now();
  if (ms <= 0) return null;
  const sn = Math.floor(ms / 1000);
  const g = Math.floor(sn / 86400);
  const s = Math.floor((sn % 86400) / 3600);
  const d = Math.floor((sn % 3600) / 60);
  const k = sn % 60;
  const iki = x => String(x).padStart(2, "0");
  return g > 0 ? `${g}g ${iki(s)}:${iki(d)}:${iki(k)}` : `${iki(s)}:${iki(d)}:${iki(k)}`;
}

/** Her saniye çalışan sayaç; hedefe varınca bittiCb bir kez tetiklenir */
export function sayacBagla(node, hedef, bittiCb) {
  const tik = () => {
    const s = kalanSure(hedef);
    if (s === null) {
      clearInterval(id);
      bittiCb?.();
      return;
    }
    node.textContent = s;
  };
  tik();
  const id = setInterval(tik, 1000);
  return () => clearInterval(id);
}

export function iskelet(adet = 2) {
  return Array.from({ length: adet }, () =>
    el("div", { class: "skeleton", style: "margin-bottom:12px" }));
}
