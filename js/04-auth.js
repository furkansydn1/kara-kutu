// ============================================================
// KARA KUTU — giriş kapısı
// ============================================================

import {
  auth, db, doc, getDoc, setDoc, serverTimestamp,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile
} from "./01-firebase.js";
import { DAVET_KODU } from "./00-config.js";
import { el, $, bosalt, toast } from "./03-ui.js";

let mod = "giris"; // "giris" | "kayit"

export function kapiyiCiz() {
  const kap = bosalt($("#gate"));
  const hataEl = el("div", { class: "gate__err", role: "alert" });

  const eposta = el("input", { class: "input", type: "email", id: "g-mail",
    autocomplete: "email", placeholder: "sen@ornek.com" });
  const sifre = el("input", { class: "input", type: "password", id: "g-pass",
    autocomplete: "current-password", placeholder: "••••••••" });
  const ad = el("input", { class: "input", type: "text", id: "g-ad",
    autocomplete: "nickname", placeholder: "Grupta bilindiğin isim" });
  const kod = el("input", { class: "input mono", type: "text", id: "g-kod",
    placeholder: "Gruptan aldığın kod" });

  const gonder = el("button", { class: "btn btn--primary btn--block", type: "submit" },
    mod === "giris" ? "Kutuyu aç" : "Kayda geç");

  const form = el("form", { class: "stack", onsubmit: async e => {
    e.preventDefault();
    hataEl.textContent = "";
    gonder.disabled = true;
    gonder.textContent = "Bağlanıyor…";
    try {
      if (mod === "kayit") {
        if (kod.value.trim() !== DAVET_KODU) throw new Error("Kod tutmuyor. Gruba sor.");
        if (ad.value.trim().length < 2) throw new Error("İsim en az 2 harf olmalı.");
        const { user } = await createUserWithEmailAndPassword(auth, eposta.value.trim(), sifre.value);
        await updateProfile(user, { displayName: ad.value.trim() });
        await setDoc(doc(db, "users", user.uid), {
          ad: ad.value.trim(),
          email: user.email,
          katilim: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, eposta.value.trim(), sifre.value);
      }
    } catch (err) {
      hataEl.textContent = hataCevir(err);
      gonder.disabled = false;
      gonder.textContent = mod === "giris" ? "Kutuyu aç" : "Kayda geç";
    }
  }},
    el("div", { class: "field" }, el("label", { for: "g-mail" }, "E-posta"), eposta),
    el("div", { class: "field" }, el("label", { for: "g-pass" }, "Şifre"), sifre),
    mod === "kayit" && el("div", { class: "field" }, el("label", { for: "g-ad" }, "İsim"), ad),
    mod === "kayit" && el("div", { class: "field" }, el("label", { for: "g-kod" }, "Davet kodu"), kod),
    gonder,
    hataEl
  );

  kap.append(el("div", { class: "gate__inner" },
    el("h1", { class: "gate__mark" }, "Kara", el("span", {}, "Kutu")),
    el("p", { class: "gate__sub" },
      "Oylar mühürlenir, kimse göremez.",
      el("br"),
      "Bahisler açıktır, herkes görür."),
    form,
    el("div", { class: "gate__switch" },
      mod === "giris" ? "Henüz kaydın yok mu? " : "Zaten kayıtlı mısın? ",
      el("button", { type: "button", onclick: () => {
        mod = mod === "giris" ? "kayit" : "giris";
        kapiyiCiz();
      }}, mod === "giris" ? "Kayıt ol" : "Giriş yap"))
  ));
}

export async function cikisYap() {
  await signOut(auth);
  location.reload();
}

/** Üye belgesi yoksa oluştur (elle eklenen hesaplar için emniyet) */
export async function uyeGetir(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const ad = user.displayName || user.email.split("@")[0];
    await setDoc(ref, { ad, email: user.email, katilim: serverTimestamp() });
    return { ad, email: user.email };
  }
  return snap.data();
}

function hataCevir(err) {
  const k = err.code || "";
  if (k.includes("invalid-credential") || k.includes("wrong-password"))
    return "E-posta ya da şifre yanlış.";
  if (k.includes("email-already-in-use")) return "Bu e-posta zaten kayıtlı. Giriş yap.";
  if (k.includes("weak-password")) return "Şifre en az 6 karakter olmalı.";
  if (k.includes("invalid-email")) return "E-posta biçimi hatalı.";
  if (k.includes("too-many-requests")) return "Çok denedin, biraz bekle.";
  return err.message || "Bir şeyler ters gitti.";
}
