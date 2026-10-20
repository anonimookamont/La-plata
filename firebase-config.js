import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Suas chaves exatas da La Plata configuradas
const firebaseConfig = {
  apiKey: "AIzaSyBD_FlggUFgADtfmrOsKrid2-DUAqqn-Ks",
  authDomain: "la-plata-91a75.firebaseapp.com",
  projectId: "la-plata-91a75",
  storageBucket: "la-plata-91a75.firebasestorage.app",
  messagingSenderId: "505752324044",
  appId: "1:505752324044:web:adc2748caeb9f5791a3f69",
  measurementId: "G-N74G26QM58"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta a Autenticação e o Banco de Dados para os outros arquivos (index.js e admin.js) usar
export const auth = getAuth(app);
export const db = getFirestore(app);
