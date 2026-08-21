// ============================================================
// KARA KUTU — Kasa (gizli)
// Panelde görünmez. Arşivdeki arama kutusuna GIZLI_SOZCUK yazınca açılır.
// Sözcük kodda duruyor ama tek başına işe yaramaz: mühür altındaki veriyi
// okuma izni güvenlik kurallarında ADMIN_UID'e bağlı. Sözcüğü bulan biri
// bile yönetici değilse Firestore erişimi reddeder.
// ============================================================

import { db, collection, getDocs, query, orderBy } from "./01-firebase.js";
import { GIZLI_SOZCUK } from "./00-config.js";
import { S, uyeAdi } from "./02-state.js";
import { el, bosalt, toast, levha } from "./03-ui.js";
import { secenekListesi, kayitNo, acikUclu } from "./05-today.js";

/** Arama kutusuna yazılan metin gizli sözcük mü? */
export function kasaAnahtariMi(metin) {
  return S.user?.isAdmin &&
         metin.trim().toLowerCase() === GIZLI_SOZCUK.trim().toLowerCase();
}

/** Kasayı aç. Sekme değişince veya ekran arka plana düşünce kendi kapanır. */
export async function kasayiAc() {
  let sorular;
  try {
    const snap = await getDocs(query(collection(db, "questions"), orderBy("openAt", "desc")));
    sorular = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
    toast("Kasa açılamadı.", "bad");
    return;
  }

  const kapat = levha(() => {
    const liste = el("div", { class: "stack gap-2" });

    if (!sorular.length) {
      liste.append(el("div", { class: "empty" },
        el("h3", {}, "Kayıt yok"), el("p", {}, "Henüz soru açılmamış.")));
    } else {
      sorular.forEach(s => liste.append(el("div", { class: "reveal-row" },
        el("div", { class: "stack", style: "min-width:0" },
          el("span", { class: "reveal-row__q" }, s.text),
          el("span", { class: "eyebrow" },
            `${kayitNo(s)} · ${s.totalVotes || 0} ${acikUclu(s) ? "cevap" : "oy"}`)),
        el("button", { class: "btn btn--ghost btn--sm",
          onclick: () => dokumAc(s) }, "Aç"))));
    }

    return el("div", { class: "stack gap-3" },
      el("span", { class: "eyebrow", style: "color:var(--seal)" }, "Kasa · yalnız sen"),
      el("h3", { style: "font-size:1.25rem" }, "Mühür altı"),
      el("p", { style: "font-size:.8125rem;color:var(--bone-3);margin:0" },
        "Sekmeden çıkınca veya ekranı kapatınca kasa kendiliğinden kapanır."),
      liste);
  });

  // Emniyet: uygulama arka plana düşerse kasa kapansın
  const kapatVeTemizle = () => {
    kapat();
    document.removeEventListener("visibilitychange", gizlendi);
  };
  const gizlendi = () => { if (document.hidden) kapatVeTemizle(); };
  document.addEventListener("visibilitychange", gizlendi);
  document.querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", kapatVeTemizle, { once: true }));
}

/** Tek bir sorunun kim-ne-verdi dökümü */
async function dokumAc(s) {
  let kayitlar;
  try {
    const snap = await getDocs(collection(db, "questions", s.id, "votes"));
    kayitlar = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
    toast("Döküm okunamadı.", "bad");
    return;
  }

  const secenekler = secenekListesi(s);
  levha(() => {
    const kutu = el("div", { class: "secret" });
    if (!kayitlar.length) {
      kutu.append(el("div", { style: "font-size:.875rem;color:var(--bone-2)" }, "Henüz cevap yok."));
    } else {
      kayitlar.forEach(v => {
        const cevap = v.text !== undefined
          ? v.text
          : (secenekler.find(o => o.id === v.optionId)?.label || "—");
        kutu.append(el("div", { class: "secret__row" },
          el("span", {}, uyeAdi(v.uid)),
          el("span", { style: "text-align:right;max-width:62%" }, cevap)));
      });
    }
    return el("div", { class: "stack gap-3" },
      el("span", { class: "eyebrow", style: "color:var(--seal)" }, kayitNo(s), " · mühür altı"),
      el("h3", { style: "font-size:1.125rem;line-height:1.3" }, s.text),
      kutu);
  });
}
