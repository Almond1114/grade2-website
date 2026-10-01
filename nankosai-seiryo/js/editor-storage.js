import {readStorage, writeStorage, removeStorage} from './storage.js?v=f4753749f056';
const key = (provider, collection, id) => `unsaved:${provider}:${collection}:${id || 'new'}`;

export const readEditorDraft = (provider, collection, id) => readStorage(key(provider, collection, id), null, true);
export function keepEditorDraft(provider, collection, id, record) {
  try { writeStorage(key(provider, collection, id), {record, savedAt: new Date().toISOString()}, true); }
  catch { /* The editor remains usable if session storage is unavailable. */ }
}
export const clearEditorDraft = (provider, collection, id) => removeStorage(key(provider, collection, id), true);
