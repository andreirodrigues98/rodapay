// Funções puras de validação do painel administrativo local.
export const MAX_BODY_BYTES = 8192;
export function parseMode(mode, project, confirmation) {
  if (mode === 'emulator' && project === 'demo-rodapay') return { mode, project, emulator: true };
  if (mode === 'production' && project === 'rodapay-c5490' && confirmation === 'CONFIRMO-PRODUCAO-RODAPAY') {
    return { mode, project, emulator: false };
  }
  throw new Error('Projeto administrativo não autorizado: selecione emulator/demo-rodapay ou confirme produção explicitamente.');
}
export function validateUid(input) {
  const uid = String(input || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Identificador de conta inválido.');
  return uid;
}
export function validateEmail(input) {
  const email = String(input || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
  return email;
}
export function allowedHost(host) {
  return host === '127.0.0.1:5601';
}
export function allowedOrigin(origin) {
  return origin === 'http://127.0.0.1:5601';
}
