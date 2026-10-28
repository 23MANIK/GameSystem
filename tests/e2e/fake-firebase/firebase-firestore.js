// Fake Firestore: documents live in the test (fake-firestore.test is routed by
// tests/e2e/account.spec.mjs), so two browser contexts share one "cloud".
const BASE = 'https://fake-firestore.test/';
export function getFirestore() { return {}; }
export function connectFirestoreEmulator() {}
export function doc(db, ...path) { return { path: path.join('/') }; }
export function serverTimestamp() { return { __ts: 'server' }; }
export async function getDoc(ref) {
  const data = await (await fetch(BASE + ref.path)).json();
  return { exists: () => data !== null, data: () => data };
}
export async function setDoc(ref, data, opts) {
  await fetch(BASE + ref.path, { method: 'POST', body: JSON.stringify({ data, merge: Boolean(opts?.merge) }) });
}
export async function deleteDoc(ref) {
  await fetch(BASE + ref.path, { method: 'DELETE' });
}
