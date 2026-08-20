// ============================================================
// KARA KUTU — Ben
// ============================================================

import { S, bakiye, servet, bagliPara } from "./02-state.js";
import { el, bosalt, avatar, para, tarih, saat } from "./03-ui.js";
import { cikisYap } from "./04-auth.js";
import { BASLANGIC_BAKIYE } from "./00-config.js";

export function benCiz(kap) {
  bosalt(kap);

  const kazanilan = S.bahislerim.filter(b => {
    const m = S.piyasalar.find(p => p.id === b.marketId);
    return m?.status === "settled" && m.outcome === b.optionId;
  }).length;

  kap.append(
    el("div", { class: "me__head" },
      avatar(S.user.ad, true),
      el("div", { class: "stack" },
        el("div", { class: "me__name" }, S.user.ad),
        el("div", { class: "me__mail" }, S.user.email))),

    el("div", { class: "stats" },
      el("div", { class: "stat" },
        el("div", { class: "stat__n" }, servet().toLocaleString("tr-TR")),
        el("div", { class: "stat__l" }, "Servet")),
      el("div", { class: "stat" },
        el("div", { class: "stat__n" }, S.bahislerim.length),
        el("div", { class: "stat__l" }, "Bahis")),
      el("div", { class: "stat" },
        el("div", { class: "stat__n" }, kazanilan),
        el("div", { class: "stat__l" }, "Tutan"))),

    el("div", { class: "section-label" }, "Kese"),
    el("div", { class: "panel stack gap-2" },
      satir("Başlangıç", para(BASLANGIC_BAKIYE)),
      ...S.defter.slice(-6).map(k => satir(k.reason || "Hareket",
        `${k.delta >= 0 ? "+" : ""}${para(k.delta)}`,
        k.delta >= 0 ? "var(--verdigris)" : "var(--seal)")),
      bagliPara() > 0 && satir("Açık bahislerde bağlı", `−${para(bagliPara())}`, "var(--bone-3)"),
      el("div", { style: "height:1px;background:var(--line);margin:4px 0" }),
      satir("Harcanabilir", para(bakiye()), "var(--amber)")),

    el("div", { class: "section-label" }, "Gelen kutusu"),
    S.bildirimler.length
      ? el("div", { class: "stack gap-2" }, ...S.bildirimler.slice(0, 12).map(bildirimSatiri))
      : el("div", { class: "empty" },
          el("h3", {}, "Bildirim yok"),
          el("p", {}, "Bahsin sonuçlandığında buraya düşer.")),

    el("div", { style: "margin-top:32px" },
      el("button", { class: "btn btn--ghost btn--block", onclick: cikisYap }, "Çıkış yap"))
  );
}

function satir(sol, sag, renk) {
  return el("div", { class: "row between gap-3" },
    el("span", { style: "font-size:.875rem;color:var(--bone-2)" }, sol),
    el("span", { class: "mono", style: `font-size:.875rem;${renk ? `color:${renk}` : ""}` }, sag));
}

function bildirimSatiri(b) {
  return el("div", { class: "panel", style: `border-left:3px solid ${b.tur === "win" ? "var(--verdigris)" : "var(--line)"}` },
    el("div", { class: "row between gap-3" },
      el("strong", { style: "font-size:.9375rem" }, b.title),
      el("span", { class: "eyebrow" }, tarih(b.ts))),
    el("p", { style: "margin:6px 0 0;font-size:.875rem;color:var(--bone-2)" }, b.body));
}
