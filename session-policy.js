// Regra de retorno: sete dias corridos SEM uso neste navegador.
// Só armazenamos horário e UID; nunca senha ou token do Firebase.
export const INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'rodapay.session.last-used.v1.';

export function sessionActivityKey(uid) {
  return `${STORAGE_PREFIX}${uid}`;
}

export function readLastActivity(storage, uid) {
  if (!uid) return null;
  try {
    const raw = storage.getItem(sessionActivityKey(uid));
    if (raw == null) return null; // Primeira abertura após a atualização: preservar login existente.
    const timestamp = Number(raw);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  } catch {
    return null; // Armazenamento bloqueado (ex.: navegação privada).
  }
}

export function shouldRequireLogin(lastActivity, now = Date.now()) {
  if (lastActivity == null) return false;
  // Relógio do aparelho alterado: não prolongar a sessão indefinidamente.
  if (lastActivity > now + 5 * 60 * 1000) return true;
  return now - lastActivity >= INACTIVITY_LIMIT_MS;
}

export function saveLastActivity(storage, uid, now = Date.now()) {
  if (!uid) return false;
  try {
    storage.setItem(sessionActivityKey(uid), String(now));
    return true;
  } catch {
    return false;
  }
}
