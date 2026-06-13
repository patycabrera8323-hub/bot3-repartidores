/* ==========================================
   NEXUS REPARTIDOR APP - FIREBASE CONFIGURATION
   Project: bot-nuevo-bdf67
   ========================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCy11ISYlKFtDF21sgeMnDSJ6GvLC5IzUo",
  authDomain: "bot-nuevo-bdf67.firebaseapp.com",
  projectId: "bot-nuevo-bdf67",
  storageBucket: "bot-nuevo-bdf67.firebasestorage.app",
  messagingSenderId: "124378699288",
  appId: "1:124378699288:web:de728dc8b1f4c32aba156d",
  measurementId: "G-NQ6YR56BXE"
};

let app;
let db;
let isFirebaseEnabled = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isFirebaseEnabled = true;
  console.log("🔥 Nexus Repartidor: Conectado a Firebase Firestore → " + firebaseConfig.projectId);
} catch (error) {
  console.error("❌ Error inicializando Firebase:", error);
}

export {
  db,
  isFirebaseEnabled,
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  query,
  where
};
