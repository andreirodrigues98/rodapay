import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

// Estas são as identificações PÚBLICAS do aplicativo Firebase, não credenciais administrativas.
// Nunca inclua uma chave privada ou service account em arquivos do navegador.
const productionConfig = {
  apiKey: 'AIzaSyCLNcnXs-T8Y-9xaRZS2vkCEtK3Gz8eLPk',
  authDomain: 'rodapay-c5490.firebaseapp.com',
  projectId: 'rodapay-c5490',
  storageBucket: 'rodapay-c5490.firebasestorage.app',
  messagingSenderId: '374832778821',
  appId: '1:374832778821:web:d147fa5bca18164ae89d2c'
};

// É intencional: localhost NUNCA acessa o Firestore/Auth de produção.
export const isLocalDevelopment = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname);
export const firebaseConfig = isLocalDevelopment
  ? { ...productionConfig, projectId: 'demo-rodapay', authDomain: 'demo-rodapay.firebaseapp.com' }
  : productionConfig;

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

if (isLocalDevelopment) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
