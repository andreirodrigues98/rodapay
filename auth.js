import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase.js';
import { state, showToast } from './utils.js';
import { ensureDefaults, watchUserData, clearWatchers } from './data.js';
import { renderAll } from './app.js';

export function getAuthErrorMessage(error) {
  const code = String(error?.code || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found') || code.includes('invalid-email')) {
    return 'E-mail ou senha inválidos.';
  }
  if (code.includes('too-many-requests')) {
    return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  }
  if (code.includes('network-request-failed')) {
    return 'Não foi possível conectar. Verifique sua internet.';
  }
  if (code.includes('operation-not-allowed')) {
    return 'O login por e-mail e senha não está ativado no Firebase.';
  }
  if (code.includes('unauthorized-domain')) {
    return 'Domínio não autorizado no Firebase. Use localhost ou autorize este domínio no painel do Firebase.';
  }
  return 'Não foi possível entrar agora. Confira o acesso e tente novamente.';
}

export async function loginUser(email, password) {
  try {
    await signInWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
    showToast('Tudo certo, acesso liberado.');
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export async function logoutUser() {
  await signOut(auth);
}

export function watchAuthState() {
  onAuthStateChanged(auth, async user => {
    const loginView = document.getElementById('loginView');
    const appShell = document.getElementById('appShell');
    if (!user) {
      state.user = null;
      clearWatchers();
      loginView.classList.remove('hidden');
      appShell.classList.add('hidden');
      return;
    }
    state.user = user;
    await ensureDefaults();
    loginView.classList.add('hidden');
    appShell.classList.remove('hidden');
    watchUserData(() => renderAll());
    renderAll();
  });
}

window.RodaPayAuth = { loginUser, logoutUser, getAuthErrorMessage };
