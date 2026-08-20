// ============================================================
// KARA KUTU — Firebase kurulumu
// Tüm SDK çağrıları buradan geçer, başka modül CDN'e dokunmaz.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit,
  serverTimestamp, Timestamp, increment, writeBatch, collectionGroup
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { firebaseConfig } from "./00-config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit,
  serverTimestamp, Timestamp, increment, writeBatch, collectionGroup
};
