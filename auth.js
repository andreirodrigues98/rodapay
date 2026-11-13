import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase.js';
import { state, showToast } from './utils.js';
import { ensureDefaults, watchUserData, clearWatchers } from './data.js';
import { renderAll, scheduleDataRender } from './app.js';
import { restoreDrivingSession, pauseDrivingSessionForLogout } from './driving.js';
import { ensureLegalAccess } from './legal.js';

export function getAuthErrorMessage(error) {
  const code = String(error?.code || '');
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'E-mail ou senha inválidos.';
  if (code.includes('too-many-requests')) return 'Muitas tentativas. Tente novamente mais tarde.';
  if (code.includes('network-request-failed') || code.includes('unavailable')) return 'Sem conexão. Confira sua internet e tente novamente.';
  if (code.includes('operation-not-allowed')) return 'Não foi possível entrar. Procure nosso atendimento.';
  if (code.includes('unauthorized-domain')) return 'Não foi possível entrar neste endereço. Procure nosso atendimento.';
  if (code.includes('requires-recent-login')) return 'Confirme sua senha atual e tente novamente.';
  if (code.includes('weak-password')) return 'Escolha uma senha mais forte.';
  if (code.includes('user-disabled')) return 'Este acesso foi desativado. Entre em contato com o suporte.';
  if (code.includes('permission-denied')) return 'Seu acesso não está disponível. Procure nosso atendimento.';
  return /^(Sua conta ainda não foi liberada|Este acesso está suspenso|Acesso interrompido)/.test(error?.message || '') ? error.message : 'Não foi possível concluir. Tente novamente.';
}

export async function loginUser(email, password) {
  try { await signInWithEmailAndPassword(auth, String(email || '').trim(), String(password || '')); }
  catch (error) { throw new Error(getAuthErrorMessage(error)); }
}

export async function logoutUser() { pauseDrivingSessionForLogout(); await signOut(auth); }

export async function requestPasswordReset(email) {
  const normalized = String(email || '').trim();
  if (!normalized) throw new Error('Digite seu e-mail para recuperar a senha.');
  try { await sendPasswordResetEmail(auth, normalized); }
  catch (error) { throw new Error(getAuthErrorMessage(error)); }
}

export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Entre novamente na sua conta.');
  if (!currentPassword) throw new Error('Informe sua senha atual.');
  if (typeof newPassword !== 'string' || newPassword.length < 10)
    throw new Error('A nova senha precisa ter pelo menos 10 caracteres.');
  if (newPassword === currentPassword) throw new Error('A nova senha deve ser diferente da atual.');
  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (error) { throw new Error(getAuthErrorMessage(error)); }
}

let authSequence = 0;
export function watchAuthState() {
  onAuthStateChanged(auth, async user => {
    const sequence = ++authSequence;
    const loginView = document.getElementById('loginView');
    const appShell = document.getElementById('appShell');
    const appStarting = document.getElementById('appStarting');
    clearWatchers();
    if (!user) {
      appStarting?.classList.add('hidden');
      state.user = null;
      state.profile = { displayName: '', avatar: '' };
      pauseDrivingSessionForLogout();
      state.settings = { incomeTaxRate: 0.6, lightMode: false, themePreference: 'dark' };
      document.body.classList.remove('light-mode');
      for (const key of ['entries','expenses','origins','paymentMethods','expenseCategories','goals','drivingSessions']) state[key] = [];
      loginView.classList.remove('hidden');
      appShell.classList.add('hidden');
      return;
    }
    loginView.classList.add('hidden');
    appShell.classList.add('hidden');
    appStarting?.classList.remove('hidden');
    state.user = user;
    try {
      await ensureLegalAccess(user, () => sequence === authSequence);
      if (sequence !== authSequence || auth.currentUser?.uid !== user.uid) return;
      await ensureDefaults();
      if (sequence !== authSequence || auth.currentUser?.uid !== user.uid) return;
      watchUserData(
        name => { if (auth.currentUser?.uid === user.uid) scheduleDataRender(name); },
        () => { showToast('Acesso suspenso. Entre em contato com o suporte.'); logoutUser(); },
        error => { console.error('Falha ao sincronizar dados:', error?.code); showToast('Não foi possível sincronizar os dados. Verifique as permissões ou conexão.'); }
      );
      loginView.classList.add('hidden');
      appShell.classList.remove('hidden');
      appStarting?.classList.add('hidden');
      restoreDrivingSession();
      renderAll();
    } catch (error) {
      console.error('Falha ao iniciar conta:', error?.code || 'initialization-error');
      showToast(getAuthErrorMessage(error));
      appStarting?.classList.add('hidden');
      if (auth.currentUser?.uid === user.uid) await logoutUser();
    }
  });
}
