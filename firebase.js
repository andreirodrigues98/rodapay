import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';


export const firebaseConfig = {
  apiKey: "AIzaSyCLNcnXs-T8Y-9xaRZS2vkCEtK3Gz8eLPk",
  authDomain: "rodapay-c5490.firebaseapp.com",
  projectId: "rodapay-c5490",
  storageBucket: "rodapay-c5490.firebasestorage.app",
  messagingSenderId: "374832778821",
  appId: "1:374832778821:web:d147fa5bca18164ae89d2c"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
