import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, setDoc, getDoc, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from './firebase.js';
import { state, normalizeDoc, defaultOrigins, defaultPaymentMethods, defaultExpenseCategories, showToast } from './utils.js';

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
export function userPath(name) { return collection(db, 'users', state.user.uid, name); }
export async function saveDocument(collectionName, data) {
  const ref = await addDoc(userPath(collectionName), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  showToast('Tudo certo, item adicionado.');
  return ref;
}
export async function updateDocument(collectionName, id, data) {
  await updateDoc(doc(db, 'users', state.user.uid, collectionName, id), { ...data, updatedAt: serverTimestamp() });
  showToast('Cadastro atualizado.');
  return id;
}
export async function deleteDocument(collectionName, id) {
  await deleteDoc(doc(db, 'users', state.user.uid, collectionName, id));
  showToast('Item excluído.');
  return id;
}
export async function saveUserSettings(partial) {
  state.settings = { ...state.settings, ...partial };
  await setDoc(doc(db, 'users', state.user.uid), { settings: state.settings, updatedAt: serverTimestamp() }, { merge: true });
}
function normalizeName(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function uniqueByName(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = normalizeName(item.name);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSnapshotItems(name, docs) {
  const items = docs.map(normalizeDoc).sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
  if (['origins', 'paymentMethods', 'expenseCategories'].includes(name)) {
    return uniqueByName(items).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  }
  return items;
}

async function removeDuplicatedNames(collectionName, docs) {
  const seen = new Set();
  const duplicated = [];
  docs.forEach(item => {
    const key = normalizeName(item.data().name);
    if (!key) return;
    if (seen.has(key)) duplicated.push(item.id);
    else seen.add(key);
  });
  if (duplicated.length) {
    await Promise.all(duplicated.map(id => deleteDoc(doc(db, 'users', state.user.uid, collectionName, id))));
  }
}

async function seedMissingDefaults(collectionName, defaults) {
  const snap = await getDocs(userPath(collectionName));
  await removeDuplicatedNames(collectionName, snap.docs);
  const existingNames = new Set(snap.docs.map(d => normalizeName(d.data().name)));
  const missing = defaults.filter(item => !existingNames.has(normalizeName(item.name)));
  if (missing.length) {
    await Promise.all(missing.map(item => addDoc(userPath(collectionName), { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })));
  }
}

export async function ensureDefaults() {
  const userRef = doc(db, 'users', state.user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) await setDoc(userRef, { email: state.user.email, settings: state.settings, createdAt: serverTimestamp(), seededDefaults: true });
  else state.settings = { ...state.settings, ...(snap.data().settings || {}) };

  await Promise.all([
    seedMissingDefaults(collections.origins, defaultOrigins),
    seedMissingDefaults(collections.paymentMethods, defaultPaymentMethods),
    seedMissingDefaults(collections.expenseCategories, defaultExpenseCategories)
  ]);
  localStorage.setItem(`rodapay.seed.${state.user.uid}`, '1');
}
export function watchUserData(onChange) {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  Object.values(collections).forEach(name => {
    const unsub = onSnapshot(userPath(name), snap => {
      state[name] = normalizeSnapshotItems(name, snap.docs);
      onChange?.(name);
    });
    unsubscribers.push(unsub);
  });
}
export function clearWatchers() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
}
