// ============================================================
// KARA KUTU — yapılandırma
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyCIcSXawyrCKPv02-GxTNr_y5z0Jesjb3M",
  authDomain: "kara-kutu-bdd01.firebaseapp.com",
  projectId: "kara-kutu-bdd01",
  storageBucket: "kara-kutu-bdd01.firebasestorage.app",
  messagingSenderId: "1016379292782",
  appId: "1:1016379292782:web:6b198f9fda11e0c51c7a7f"
};

// Yönetici UID'i. firestore.rules içindeki yonetici() ile birebir aynı.
export const ADMIN_UID = "Ae72wmqJxug1WiySDaRuKVJTRDh2";

// Kasa anahtarı. Arşiv sekmesindeki arama kutusuna bunu yazınca
// mühür altı dökümü açılır. Kimseye söyleme, tahmin edilmeyecek bir şey seç.
export const GIZLI_SOZCUK = "kasa";

// Gruba WhatsApp'tan atacağın kod. İstediğin gibi değiştir.
export const DAVET_KODU = "kutu2026";

// Herkesin başlangıç bakiyesi
export const BASLANGIC_BAKIYE = 1000;

// Bakiye birimi
export const BIRIM = "KP"; // Kutu Parası

// Avatar renkleri (isimden deterministik seçilir)
export const AVATAR_RENKLERI = [
  "#FFAA1F", "#4FB3A0", "#D9412F", "#8FA6C4",
  "#C58BD6", "#E0C169", "#7FC24E", "#E88B6A"
];
