// Versão única usada na interface e no registro de aceite.
export const LEGAL_VERSION = '2026-11-13';
export function hasAcceptedLegal(documentData = {}, version = LEGAL_VERSION) {
  return documentData?.legalVersion === version && Boolean(documentData?.legalAcceptedAt);
}
