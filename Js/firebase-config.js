// Configuração pública do Firebase para o site La Plata.
// Usada pelo index.html e admin.html no navegador.
// Não coloque tokens PushinPay nem chaves privadas neste arquivo.
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBD_FlggUFgADtfmrOsKrid2-DUAqqn-Ks',
  authDomain: 'la-plata-91a75.firebaseapp.com',
  projectId: 'la-plata-91a75',
  storageBucket: 'la-plata-91a75.firebasestorage.app',
  messagingSenderId: '505752324044',
  appId: '1:505752324044:web:adc2748caeb9f5791a3f69',
  measurementId: 'G-N74G26QM58'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
