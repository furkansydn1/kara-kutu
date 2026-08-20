// ============================================================
// KARA KUTU — uygulama çekirdeği
// ============================================================

import {
  auth, db, onAuthStateChanged, collection, query, where, orderBy,
  onSnapshot, getDocs, doc, updateDoc
} from "./01-firebase.js";
import { ADMIN_UID } from "./00-config.js";
import { S, guncelle, bakiye } from "./02-state.js";
import { el, $, bosalt, toast, para, levha, avatar, tarih } from "./03-ui.js";
import { kapiyiCiz, uyeGetir } from "./04-auth.js";
import { soruYukle, bugunCiz } from "./05-today.js";
import { piyasalariYukle, borsaCiz } from "./06-market.js";
import { arsivCiz } from "./07-archive.js";
import { benCiz } from "./08-me.js";
import { yonetimCiz } from "./09-admin.js";

const SEKMELER = [
  { id: "bugun",   etiket: "Bugün",   ikon: "M4 4h16v16H4z M4 9h16", ciz: bugunCiz },
  { id: "borsa",   etiket: "Borsa",   ikon: "M4 18l5-6 4 3 7-8", ciz: borsaCiz },
  { id: "arsiv",   etiket: "Arşiv",   ikon: "M3 6h18v4H3z M5 10v9h14v-9 M10 14h4", ciz: arsivCiz },
  { id: "ben",     etiket: "Ben",     ikon: "M12 12a4 4 0 100-8 4 4 0 000 8z M4 20a8 8 0 0116 0", ciz: benCiz },
  { id: "yonetim", etiket: "Yönetim", ikon: "M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z", ciz: yonetimCiz, admin: true }
];

// --- Başlangıç --------------------------------------------------------------
onAuthStateChanged(auth, async user => {
  if (!user) { $("#gate").classList.remove("hidden"); kapiyiCiz(); return; }

  const uye = await uyeGetir(user);
  guncelle({
    user: {
      uid: user.uid,
      email: user.email,
      ad: uye.ad || user.email.split("@")[0],
      isAdmin: user.uid === ADMIN_UID
    }
  });

  $("#gate").classList.add("hidden");
  kabuguCiz();
  await verileriYukle();
  canliDinle();
  git("bugun");
});

async function verileriYukle() {
  const uyeSnap = await getDocs(collection(db, "users"));
  guncelle({ uyeler: uyeSnap.docs.map(d => ({ uid: d.id, ad: d.data().ad })) });
  await Promise.all([soruYukle(), piyasalariYukle()]);
}

// --- Canlı akışlar ----------------------------------------------------------
function canliDinle() {
  // Kese hareketleri
  onSnapshot(query(collection(db, "ledger"), where("uid", "==", S.user.uid)), snap => {
    guncelle({ defter: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    bakiyeYaz();
  });

  // Bildirimler — yeni gelen anında düşer
  let ilkAkis = true;
  onSnapshot(query(collection(db, "notifications"), where("to", "==", S.user.uid)), snap => {
    const liste = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0));
    guncelle({ bildirimler: liste });
    rozetYaz();

    if (!ilkAkis) {
      snap.docChanges().filter(c => c.type === "added").forEach(c => {
        const b = c.doc.data();
        toast(`${b.title} · ${b.body}`, b.tur === "win" ? "win" : "bad");
      });
    }
    ilkAkis = false;
  });
}

// --- Kabuk ------------------------------------------------------------------
function kabuguCiz() {
  const kok = bosalt($("#app"));

  kok.append(
    el("header", { class: "topbar" },
      el("div", { class: "brand" },
        el("span", { class: "brand__mark" }, "Kara Kutu"),
        el("span", { class: "brand__unit" }, S.user.isAdmin ? "YÖNETİCİ" : "ÜYE")),
      el("div", { class: "topbar__right" },
        el("span", { class: "balance", id: "bakiye" }, para(0)),
        el("button", { class: "bell", id: "zil", "aria-label": "Bildirimler",
          onclick: bildirimLevhasi },
          el("span", { html: "&#9679;", style: "font-size:10px" })))),
    el("main", {}, el("div", { class: "view", id: "view" })),
    el("nav", { class: "tabbar", id: "tabbar" })
  );

  const bar = $("#tabbar");
  SEKMELER.filter(t => !t.admin || S.user.isAdmin).forEach(t => {
    bar.append(el("button", {
      class: "tab", "data-tab": t.id, onclick: () => git(t.id)
    },
      ikonCiz(t.ikon),
      el("span", {}, t.etiket)));
  });
}

function ikonCiz(d) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  d.split(" M").forEach((parca, i) => {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", (i === 0 ? "" : "M") + parca);
    svg.append(p);
  });
  return svg;
}

// --- Yönlendirme ------------------------------------------------------------
export function git(sekmeId) {
  const t = SEKMELER.find(x => x.id === sekmeId);
  if (!t) return;
  guncelle({ gorunum: sekmeId });
  document.querySelectorAll(".tab").forEach(b =>
    b.classList.toggle("is-active", b.dataset.tab === sekmeId));
  const kap = $("#view");
  kap.style.animation = "none";
  void kap.offsetWidth;
  kap.style.animation = "";
  t.ciz(kap);
  window.scrollTo({ top: 0 });
}

// --- Üst şerit güncellemeleri -----------------------------------------------
function bakiyeYaz() {
  const n = $("#bakiye");
  if (n) n.textContent = para(bakiye());
}

function rozetYaz() {
  const zil = $("#zil");
  if (!zil) return;
  zil.querySelector(".bell__dot")?.remove();
  const okunmamis = S.bildirimler.filter(b => !b.read).length;
  if (okunmamis) zil.append(el("span", { class: "bell__dot" }, String(okunmamis)));
}

function bildirimLevhasi() {
  levha(() => {
    const kutu = el("div", { class: "stack gap-2" });
    if (!S.bildirimler.length) {
      kutu.append(el("div", { class: "empty" },
        el("h3", {}, "Sessizlik"),
        el("p", {}, "Bahsin sonuçlandığında haber vereceğim.")));
    } else {
      S.bildirimler.forEach(b => kutu.append(
        el("div", { class: "panel",
          style: `border-left:3px solid ${b.tur === "win" ? "var(--verdigris)" : "var(--seal)"}` },
          el("div", { class: "row between gap-3" },
            el("strong", { style: "font-size:.9375rem" }, b.title),
            el("span", { class: "eyebrow" }, tarih(b.ts))),
          el("p", { style: "margin:6px 0 0;font-size:.875rem;color:var(--bone-2)" }, b.body))));
    }
    // Görüldü olarak işaretle
    S.bildirimler.filter(b => !b.read).forEach(b =>
      updateDoc(doc(db, "notifications", b.id), { read: true }).catch(() => {}));

    return el("div", { class: "stack gap-3" },
      el("h3", { style: "font-size:1.25rem" }, "Bildirimler"),
      kutu);
  });
}

// Sekme geri gelince veriyi tazele (mühür açılmış olabilir)
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || !S.user) return;
  await soruYukle();
  if (S.gorunum === "bugun") bugunCiz($("#view"));
});
