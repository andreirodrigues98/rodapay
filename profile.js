import { doc, onSnapshot, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from './firebase.js';
import { state, escapeHtml } from './utils.js';
export { escapeHtml };

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_LENGTH = 90000; // ~67 KB of JPEG after base64

function isSafeAvatar(value) {
  return typeof value === 'string' && value.length <= MAX_AVATAR_LENGTH && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);
}

export function avatarMarkup(avatar, label = 'Foto de perfil') {
  return isSafeAvatar(avatar)
    ? `<img class="profile-avatar-image" src="${avatar}" alt="${escapeHtml(label)}">`
    : '<span class="profile-avatar-fallback" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.7 20c.8-3.9 3.2-6 7.3-6s6.5 2.1 7.3 6"/></svg></span>';
}

export function watchProfile(userId, onChange, onError) {
  return onSnapshot(doc(db, 'users', userId, 'profile', 'main'), snapshot => {
    const value = snapshot.exists() ? snapshot.data() : {};
    state.profile = {
      displayName: typeof value.displayName === 'string' ? value.displayName : '',
      avatar: isSafeAvatar(value.avatar) ? value.avatar : ''
    };
    onChange?.();
  }, onError);
}

export async function saveProfile({ displayName, avatar }) {
  if (!state.user) throw new Error('Faça login novamente para salvar seu perfil.');
  const name = String(displayName || '').trim();
  if (name.length > 60) throw new Error('O nome deve ter até 60 caracteres.');
  if (!isSafeAvatar(avatar) && avatar !== '') throw new Error('Formato da foto inválido.');
  await setDoc(doc(db, 'users', state.user.uid, 'profile', 'main'), {
    displayName: name,
    avatar,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export function prepareAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Selecione uma imagem.'));
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      return reject(new Error('Use uma foto JPG, PNG ou WebP.'));
    if (file.size > MAX_UPLOAD_BYTES) return reject(new Error('A foto original deve ter no máximo 5 MB.'));

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 192;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Não foi possível processar a foto.');
        ctx.fillStyle = '#101010';
        ctx.fillRect(0, 0, 192, 192);
        const size = Math.min(img.naturalWidth, img.naturalHeight);
        const sourceX = (img.naturalWidth - size) / 2;
        const sourceY = (img.naturalHeight - size) / 2;
        ctx.drawImage(img, sourceX, sourceY, size, size, 0, 0, 192, 192);
        for (const quality of [0.82, 0.67, 0.5, 0.35]) {
          const value = canvas.toDataURL('image/jpeg', quality);
          if (isSafeAvatar(value)) return resolve(value);
        }
        reject(new Error('Não foi possível compactar a foto. Selecione outra imagem.'));
      } catch (error) { reject(error); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('A imagem não pôde ser aberta.')); };
    img.src = url;
  });
}
