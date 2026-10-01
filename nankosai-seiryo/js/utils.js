import { SITE_CONFIG } from './site-config.js?v=77db7237ab62';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const uid = prefix => `${prefix}_${crypto.randomUUID()}`;
export const asBool = value => value === true || value === 'true';
export const crowdLabels = {quiet: '空いてる', normal: '普通', busy: '混雑'};
export const statusLabels = {draft: '下書き', published: '公開中'};
export const clone = value => structuredClone(value);
export function japanNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part => [part.type,part.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export function dateLabel(value, short = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return '日付未定';
  return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:short?undefined:'short'}).format(new Date(`${value}T12:00:00+09:00`));
}
export const projectDates = project => String(project.dates || '').split(',').map(date => date.trim()).filter(Boolean);
export function eventState(item, clock) {
  const dates = item.dates ? projectDates(item) : [item.date];
  if (item.cancelled === true || item.cancelled === 'true') return 'cancelled';
  if (!dates.includes(clock.date)) return 'other';
  if (clock.time >= item.start && clock.time < item.end) return 'live';
  if (clock.time < item.start) return 'soon';
  return 'ended';
}
export function safeURL(value, { allowDataImage = false } = {}) {
  if (!value) return '';
  if (allowDataImage && /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(value)) return value;
  try {
    const url = new URL(value, location.href);
    if (url.protocol === 'https:' || (url.origin === location.origin && ['http:','https:'].includes(url.protocol))) return url.href;
  } catch {}
  return '';
}
export function imageURL(media) {
  if (!media) return '';
  if (media.provider === 'drive' && /^[a-zA-Z0-9_-]{10,}$/.test(media.fileId || '')) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(media.fileId)}&sz=w1600`;
  return safeURL(media.url, {allowDataImage:media.provider === 'demo'});
}
export const crowdBadge = value => `<span class="badge crowd-${escapeHTML(value)}">${escapeHTML(crowdLabels[value] || '未確認')}</span>`;
export function toast(message, isError = false) {
  const region = document.querySelector('#toast-region');
  if (!region) return;
  const item = document.createElement('div'); item.className = `toast${isError ? ' toast-error' : ''}`;
  item.setAttribute('role', isError ? 'alert' : 'status'); item.textContent = message; region.append(item);
  setTimeout(() => item.remove(), 6500);
}
export function bindImageFallbacks(container = document) {
  container.querySelectorAll('img[data-fallback]').forEach(image => {if(image.dataset.fallbackBound)return;image.dataset.fallbackBound='true';image.addEventListener('error', () => {
    if (image.dataset.failed) return; image.dataset.failed = 'true'; image.src = image.dataset.fallback;
  }, {once:true});});
}
export function downloadJSON(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href=url; link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function eventDates(settings) { return String(settings?.eventDates || SITE_CONFIG.content.eventDates.join(',')).split(',').map(date=>date.trim()).filter(Boolean); }
