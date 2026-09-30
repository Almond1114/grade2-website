const PREFIX = 'nankosai-seiryo-v2:';
export function readStorage(key, fallback = null, session = false) {
  try { return JSON.parse((session ? sessionStorage : localStorage).getItem(PREFIX + key)) ?? fallback; }
  catch { return fallback; }
}
export function writeStorage(key, value, session = false) {
  try { (session ? sessionStorage : localStorage).setItem(PREFIX + key, JSON.stringify(value)); }
  catch { throw new Error('ブラウザの保存領域が不足しています。画像を減らすか、保存を許可してください。'); }
}
export function removeStorage(key, session = false) {
  (session ? sessionStorage : localStorage).removeItem(PREFIX + key);
}
export const favoriteIds = () => new Set(readStorage('favorites', []));
export function toggleFavorite(id) {
  const favorites = favoriteIds(); favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  writeStorage('favorites', [...favorites]); return favorites.has(id);
}
export function observeStorage(callback) {
  window.addEventListener('storage', event => { if (event.key?.startsWith(PREFIX)) callback(event.key.slice(PREFIX.length)); });
}
