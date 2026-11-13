import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc, getDoc, getDocs, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from './firebase.js';
import { watchProfile } from './profile.js';
import { state, normalizeDoc, defaultOrigins, defaultPaymentMethods, defaultExpenseCategories, showToast, toISODate } from './utils.js';

export const collections = {
  entries: 'entries',
  expenses: 'expenses',
  origins: 'origins',
  paymentMethods: 'paymentMethods',
  expenseCategories: 'expenseCategories',
  goals: 'goals',
  drivingSessions: 'drivingSessions'
};

let unsubscribers = [];
const collectionNames = new Set(Object.values(collections));
function currentUid() {
  const uid = state.user?.uid;
  if (!uid) throw new Error('Sessão encerrada. Faça login novamente.');
  return uid;
}
function ensureCollection(name) {
  if (!collectionNames.has(name)) throw new Error('Tipo de cadastro não permitido.');
  return name;
}
export function userPath(name) { return collection(db, 'users', currentUid(), ensureCollection(name)); }
// A mesma tentativa de corrida usa sempre o mesmo ID. Repetir um envio não cria outra corrida.
export function newRideDraftId() { return `ride_${doc(userPath('entries')).id}`; }
export async function saveRideDocument(recordId, payload) {
  if (!/^ride_[A-Za-z0-9]{20}$/.test(recordId)) throw new Error('Identificador da corrida inválido.');
  await setDoc(doc(db, 'users', currentUid(), 'entries', recordId), {
    ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return recordId;
}
// A divisão de uma jornada em dias é gravada em lote atômico. Um retry
// reutiliza os mesmos IDs, evitando duplicação após falhas ou cliques repetidos.
export async function saveDrivingDayRecords(groupId, days, source = 'timer') {
  const uid = currentUid();
  if (!/^work_[A-Za-z0-9]{20}$/.test(groupId)) throw new Error('Jornada sem identificador válido.');
  if (!['timer','manual'].includes(source)) throw new Error('Origem de jornada inválida.');
  if (!Array.isArray(days) || days.length < 1 || days.length > 90) throw new Error('Período da jornada inválido.');
  const batch = writeBatch(db);
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || toISODate(day.date) !== day.date || !Number.isFinite(day.totalSeconds)
      || day.totalSeconds <= 0 || day.totalSeconds > 86400) throw new Error('Horas da jornada inválidas.');
    const ref = doc(db, 'users', uid, 'drivingSessions', `${groupId}_${day.date}`);
    batch.set(ref, {
      userId:uid, startDate:day.date, endDate:day.date,
      startTime:day.startTime || '', endTime:day.endTime || '',
      totalSeconds:Math.round(day.totalSeconds), source, groupId,
      createdAt:serverTimestamp(), updatedAt:serverTimestamp()
    });
  }
  await batch.commit();
  return groupId;
}
export function newWorkGroupId() { return `work_${doc(userPath('drivingSessions')).id}`; }

export async function saveDocument(collectionName, data) {
  const ref = await addDoc(userPath(collectionName), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  showToast('Tudo certo, item adicionado.');
  return ref;
}
export async function updateDocument(collectionName, id, data) {
  await updateDoc(doc(db, 'users', currentUid(), ensureCollection(collectionName), id), { ...data, updatedAt: serverTimestamp() });
  showToast('Cadastro atualizado.');
  return id;
}
export async function deleteDocument(collectionName, id) {
  await deleteDoc(doc(db, 'users', currentUid(), ensureCollection(collectionName), id));
  showToast('Item excluído.');
  return id;
}
export async function saveUserSettings(partial) {
  const next = { ...state.settings, ...partial };
  await updateDoc(doc(db, 'users', currentUid()), { settings: next, updatedAt: serverTimestamp() });
  // A local state change only occurs if Firestore accepted the update.
  state.settings = next;
}
function normalizeName(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}
function normalizeSnapshotItems(name, docs) {
  const items = docs.map(normalizeDoc).sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
  // Do not hide duplicate documents: users must be able to inspect or delete them themselves.
  if (['origins', 'paymentMethods', 'expenseCategories'].includes(name)) {
    return items.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  }
  return items;
}

async function seedMissingDefaults(collectionName, defaults) {
  const snap = await getDocs(userPath(collectionName));
  const existingNames = new Set(snap.docs.map(d => normalizeName(d.data().name)));
  const missing = defaults.filter(item => !existingNames.has(normalizeName(item.name)));
  if (missing.length) {
    await Promise.all(missing.map(item => addDoc(userPath(collectionName), { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })));
  }
}

// Somente quando a pessoa solicita: não recriar automaticamente categorias
// excluídas por escolha própria em cada login de contas já existentes.
export async function restoreSuggestedExpenseCategories() {
  const snap = await getDocs(userPath('expenseCategories'));
  const existing = new Set(snap.docs.map(row => normalizeName(row.data().name)));
  const missing = defaultExpenseCategories.filter(item => !existing.has(normalizeName(item.name)));
  if (!missing.length) return 0;
  const batch = writeBatch(db);
  for (const entry of missing) {
    const ref = doc(userPath('expenseCategories'));
    batch.set(ref, { ...entry, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  await batch.commit();
  return missing.length;
}

export async function ensureDefaults() {
  const userRef = doc(db, 'users', state.user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists() && snap.data()?.active === false) {
    throw new Error('Esta conta está suspensa. Entre em contato com o suporte.');
  }
  if (!snap.exists()) {
    await setDoc(userRef, { email: state.user.email, settings: state.settings, createdAt: serverTimestamp(), seededDefaults: true });
    // Defaults are created just once. Otherwise deleted categories reappear on every login.
    await Promise.all([
      seedMissingDefaults(collections.origins, defaultOrigins),
      seedMissingDefaults(collections.paymentMethods, defaultPaymentMethods),
      seedMissingDefaults(collections.expenseCategories, defaultExpenseCategories)
    ]);
  } else {
    // Contas novas já provisionadas no admin possuem seededDefaults=false.
    // Inicializa exatamente uma vez: não recria categorias apagadas de contas antigas.
    if (snap.data()?.seededDefaults === false) {
      await Promise.all([
        seedMissingDefaults(collections.origins, defaultOrigins),
        seedMissingDefaults(collections.paymentMethods, defaultPaymentMethods),
        seedMissingDefaults(collections.expenseCategories, defaultExpenseCategories)
      ]);
      await updateDoc(userRef, { seededDefaults: true, updatedAt: serverTimestamp() });
    }
    state.settings = { ...state.settings, ...(snap.data().settings || {}) };
    // Preferências antigas criavam modo claro sem escolha explícita do usuário.
    // A partir desta versão, dark é o padrão; somente uma escolha v2 ativa light.
    state.settings.themePreference = state.settings.themePreference === 'light' ? 'light' : 'dark';
    state.settings.lightMode = state.settings.themePreference === 'light';
  }
}
export function watchUserData(onChange, onBlocked, onError) {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  Object.values(collections).forEach(name => {
    const unsub = onSnapshot(userPath(name), snap => {
      state[name] = normalizeSnapshotItems(name, snap.docs);
      onChange?.(name);
    }, onError);
    unsubscribers.push(unsub);
  });
  const userId = state.user.uid;
  unsubscribers.push(onSnapshot(doc(db, 'users', userId), snap => {
    if (snap.exists() && snap.data()?.active === false) onBlocked?.();
  }, onError));
  unsubscribers.push(watchProfile(userId, () => onChange?.('profile'), onError));
}
export function clearWatchers() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
}
