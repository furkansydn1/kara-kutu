// ============================================================
// KARA KUTU — durum deposu
// Bakiye burada TÜRETİLİR, hiçbir yerde tek doğru olarak saklanmaz.
//   bakiye = başlangıç + defter toplamı − açık piyasalardaki bağlı para
// Defteri yalnızca yönetici yazabildiği için kimse bakiyesini şişiremez.
// ============================================================

import { BASLANGIC_BAKIYE } from "./00-config.js";

const dinleyiciler = new Set();

export const S = {
  user: null,          // { uid, email, ad, isAdmin }
  uyeler: [],          // [{ uid, ad }]
  soru: null,          // bugünün sorusu
  oyum: null,          // { optionId }
  sayim: null,         // { [optionId]: n }  — yalnız açıldıktan sonra
  piyasalar: [],       // tüm piyasalar
  bahislerim: [],      // { marketId, optionId, amount }
  defter: [],          // { delta, reason }
  bildirimler: [],
  gorunum: "bugun"
};

export function abone(fn) {
  dinleyiciler.add(fn);
  return () => dinleyiciler.delete(fn);
}

export function yayinla(alan) {
  dinleyiciler.forEach(fn => fn(alan));
}

export function guncelle(yama) {
  Object.assign(S, yama);
  yayinla(Object.keys(yama));
}

/** Açık piyasalarda kilitli duran para */
export function bagliPara() {
  const acikIdler = new Set(
    S.piyasalar.filter(p => p.status === "open").map(p => p.id)
  );
  return S.bahislerim
    .filter(b => acikIdler.has(b.marketId))
    .reduce((t, b) => t + (b.amount || 0), 0);
}

/** Harcanabilir bakiye */
export function bakiye() {
  const defterToplam = S.defter.reduce((t, k) => t + (k.delta || 0), 0);
  return BASLANGIC_BAKIYE + defterToplam - bagliPara();
}

/** Toplam servet (bağlı para dahil) */
export function servet() {
  const defterToplam = S.defter.reduce((t, k) => t + (k.delta || 0), 0);
  return BASLANGIC_BAKIYE + defterToplam;
}

export function uyeAdi(uid) {
  return S.uyeler.find(u => u.uid === uid)?.ad || "Bilinmeyen";
}
