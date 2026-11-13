import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { LEGAL_VERSION, hasAcceptedLegal } from './legal-policy.mjs';

/** Confirma conta provisionada pelo administrador e aceite da versão vigente. */
export async function ensureLegalAccess(user, isCurrentUser = () => true) {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Sua conta ainda não foi liberada. Fale com nosso atendimento.');
  if (snapshot.data()?.active === false) throw new Error('Este acesso está suspenso. Fale com nosso atendimento.');
  if (hasAcceptedLegal(snapshot.data())) return;

  const overlay = document.getElementById('legalAcceptance');
  const checkbox = document.getElementById('legalAcknowledgement');
  const submit = document.getElementById('acceptLegal');
  const exit = document.getElementById('declineLegal');
  const feedback = document.getElementById('legalFeedback');
  if (!overlay || !checkbox || !submit || !exit) throw new Error('Não foi possível apresentar os documentos de uso.');
  overlay.classList.remove('hidden');
  checkbox.checked = false;
  submit.disabled = true;
  feedback.textContent = '';
  try {
    await new Promise((resolve, reject) => {
      let pending = false;
      const changed = () => { submit.disabled = !checkbox.checked || pending; };
      const finish = (error) => {
        checkbox.removeEventListener('change', changed);
        submit.removeEventListener('click', accept);
        exit.removeEventListener('click', decline);
        error ? reject(error) : resolve();
      };
      const decline = () => finish(new Error('Acesso interrompido. Você pode voltar quando desejar.'));
      const accept = async () => {
        if (!checkbox.checked || pending) return;
        pending = true; changed();
        feedback.textContent = 'Registrando sua confirmação...';
        try {
          if (!isCurrentUser() || auth.currentUser?.uid !== user.uid) throw new Error('Sua sessão mudou. Entre novamente.');
          await updateDoc(ref, { legalVersion: LEGAL_VERSION, legalAcceptedAt: serverTimestamp() });
          finish();
        } catch (error) {
          pending = false; changed();
          feedback.textContent = 'Não conseguimos concluir. Verifique sua conexão e tente novamente.';
        }
      };
      checkbox.addEventListener('change', changed);
      submit.addEventListener('click', accept);
      exit.addEventListener('click', decline);
    });
  } finally {
    overlay.classList.add('hidden');
  }
}
