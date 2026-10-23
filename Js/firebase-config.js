// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBD_FlggUFgADtfmrOsKrid2-DUAqqn-Ks",
  authDomain: "la-plata-91a75.firebaseapp.com",
  projectId: "la-plata-91a75",
  storageBucket: "la-plata-91a75.firebasestorage.app",
  messagingSenderId: "505752324044",
  appId: "1:505752324044:web:adc2748caeb9f5791a3f69",
  measurementId: "G-N74G26QM58"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exportações necessárias para o index.html e admin.html
export const auth = getAuth(app);
export const db = getFirestore(app);
