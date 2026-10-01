import {SITE_CONFIG, applySiteConfig} from './site-config.js?v=9fcad938b8a5';
import {api, getPublicWithFallback} from './api.js?v=9fcad938b8a5';
import {favoriteIds, toggleFavorite, observeStorage, readStorage, writeStorage} from './storage.js?v=9fcad938b8a5';
import {escapeHTML as e, japanNow, dateLabel, eventState, eventDates, crowdBadge, imageURL, asBool, toast, bindImageFallbacks} from './utils.js?v=9fcad938b8a5';
import {projectSlots, projectSummary, favoriteSlots, overlappingSlots, matchesSearch} from './festival-data.js?v=9fcad938b8a5';
import {renderHTML, scrollToSection} from './dom.js?v=9fcad938b8a5';
import {icon} from './icons.js?v=9fcad938b8a5';
import {projectCard, favoriteButton} from './cards.js?v=9fcad938b8a5';
import {initializeAnimations, revealElements} from './animations.js?v=9fcad938b8a5';
import {registerServiceWorker} from './pwa.js?v=9fcad938b8a5';

const $ = selector => document.querySelector(selector);
let data = null, selectedDate = '', selectedFloor = SITE_CONFIG.map.floors[0], selectedLocation = '';
let sampleClock = false, refreshing = false, detailProjectId = '', detailEventId = '', dataSignature = '';
const empty = message => `<div class="empty-state">${e(message)}</div>`;
const locationName = id => {
  const location = data.locations.find(item => item.id === id);
  return location ? `${location.floor} / ${location.name}` : '場所未定';
};
const publishedProject = id => data.projects.find(project => project.id === id);
const clock = () => sampleClock ? {date: selectedDate, time: $('#demo-time').value || '10:32'} : japanNow();
const html = (selector, content) => renderHTML($(selector), content);

function setOptions(select, values, label = value => value) {
  const previous = select.value;
  renderHTML(select, values.map(value => `<option value="${e(value)}">${e(label(value))}</option>`).join(''));
  if (values.includes(previous)) select.value = previous;
}

function renderEmergency() {
  const banner = $('#emergency-banner');
  banner.hidden = !asBool(data.settings.emergencyEnabled) || !data.settings.emergencyText;
  renderHTML(banner, `${icon('alert')}<span>${e(data.settings.emergencyText)}</span>`);
}

function setupFilters() {
  const dates = eventDates(data.settings);
  if (!dates.includes(selectedDate)) selectedDate = dates.includes(japanNow().date) ? japanNow().date : dates[0] || '';
  for (const selector of ['#project-date', '#schedule-date', '#plan-date']) {
    setOptions($(selector), dates, dateLabel); $(selector).value = selectedDate;
  }
  setOptions($('#filter-category'), ['', ...new Set(data.projects.map(project => project.category))], value => value || 'すべて');
  setOptions($('#filter-group'), ['', ...new Set(data.projects.map(project => project.group))], value => value || 'すべて');
  $('#hero-dates').textContent = dates.map(day => dateLabel(day, true)).join(' — ');
  $('#hero-hours').textContent = `${data.settings.openTime || SITE_CONFIG.content.openTime} — ${data.settings.closeTime || SITE_CONFIG.content.closeTime}`;
  $('#admission-text').textContent = data.settings.admissionText || SITE_CONFIG.content.admissionText;
  $('#demo-clock-controls').hidden = api.mode !== 'demo';
}

function renderProjects() {
  const query = $('#project-search').value, category = $('#filter-category').value;
  const group = $('#filter-group').value, crowd = $('#filter-crowd').value, favorites = favoriteIds();
  const projects = data.projects.filter(project => {
    const slots = projectSlots(project, data, selectedDate);
    const venues = slots.map(slot => locationName(slot.locationId));
    return slots.length && matchesSearch([project.title, project.organization, project.description, ...venues], query) &&
      (!category || project.category === category) && (!group || project.group === group) &&
      (!crowd || project.crowd === crowd) && (!$('#filter-favorites').checked || favorites.has(project.id));
  });
  const active = [query.trim() ? `検索「${query.trim()}」` : '', category, group, crowd ? {quiet:'空いてる', normal:'普通', busy:'混雑'}[crowd] : '', $('#filter-favorites').checked ? 'お気に入り' : ''].filter(Boolean);
  $('#project-count').textContent = `${dateLabel(selectedDate)} / ${projects.length}件`;
  html('#active-filters', `${active.length ? `<span>${e(active.join(' / '))}</span><button type="button" class="text-button" data-reset-filters>条件を解除</button>` : ''}`);
  $('#active-filters').hidden = !active.length;
  $('#search-form summary').textContent = `絞り込み${active.length ? `（${active.length}）` : ''}`;
  html('#project-grid', projects.map(project => projectCard(project, data, {date: selectedDate})).join('') ||
    `<div class="empty-state"><p>条件に合う企画はありません。</p><button class="button button-secondary" data-reset-filters>検索・絞り込みを解除</button></div>`);
  bindImageFallbacks($('#project-grid')); revealElements();
}

function renderFeatured() {
  const featured = data.projects.filter(project => asBool(project.featured) && projectSlots(project, data, selectedDate).length).slice(0, 3);
  $('#featured').hidden = !featured.length;
  html('#featured-grid', featured.map(project => projectCard(project, data, {date:selectedDate})).join(''));
  bindImageFallbacks($('#featured-grid')); revealElements();
}

function row(item, {time = false} = {}) {
  const project = publishedProject(item.projectId || item.id);
  return `<div class="compact-row">${time ? `<span class="compact-time">${e(item.start)}</span>` : ''}<button ${project ? `data-project="${e(project.id)}"` : `data-event="${e(item.id)}"`}>${e(item.title)}<small>${e(locationName(item.locationId))}${project ? ' · ' + e(project.organization) : ''}</small></button>${project ? crowdBadge(project.crowd) : ''}</div>`;
}

function renderNow() {
  const current = clock(); $('#current-clock').textContent = current.time;
  $('#current-clock').setAttribute('datetime', `${current.date}T${current.time}+09:00`);
  $('#current-day').textContent = `${dateLabel(current.date)}${sampleClock ? ' / サンプル時刻' : ' / 日本時間'}`;
  $('#now-notice').textContent = sampleClock ? '当日の表示体験です。実際の開催状況ではありません。' :
    eventDates(data.settings).includes(current.date) ? '開始・終了時刻から自動表示しています。混雑情報は運営による更新です。' : '開催期間外です。当日の開催情報はここに表示されます。';
  const scheduledIds = new Set(data.schedule.map(event => event.projectId).filter(Boolean));
  const candidates = [...data.projects.filter(project => !scheduledIds.has(project.id)), ...data.schedule.filter(event => !asBool(event.cancelled))];
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const live = candidates.filter(item => eventState(item, current) === 'live');
  const soon = candidates.filter(item => eventState(item, current) === 'soon' && minutes(item.start) - minutes(current.time) <= 60).sort((a, b) => a.start.localeCompare(b.start));
  html('#live-list', live.map(item => row(item)).join('') || empty('現在開催中の企画はありません。'));
  html('#soon-list', soon.map(item => row(item, {time: true})).join('') || empty('60分以内に始まる企画はありません。'));
  if (selectedLocation) renderLocation();
}

function renderPlan() {
  const favorites = favoriteIds(), allDates = $('#plan-all-dates').checked;
  $('#favorite-count').textContent = data.projects.filter(project => favorites.has(project.id)).length;
  const slots = favoriteSlots(data, favorites, allDates ? '' : selectedDate), conflicts = overlappingSlots(slots);
  $('#plan-count').textContent = `${allDates ? '全日程' : dateLabel(selectedDate)} / ${slots.length}件`;
  $('#plan-conflicts').hidden = !conflicts.size;
  html('#my-plan-list', slots.map(item => `<article class="plan-row${asBool(item.cancelled) ? ' cancelled-row' : ''}"><div class="plan-time"><small>${e(dateLabel(item.date))}</small> ${e(item.start)} — ${e(item.end)}</div><button class="plan-title" data-project="${e(item.project.id)}"><b>${e(item.title)} ${asBool(item.cancelled) ? '<span class="badge badge-important">中止</span>' : ''}</b><small>${e(locationName(item.locationId))} / ${e(item.project.organization)}</small>${conflicts.has(item.id) ? '<span class="badge badge-important">ほかの予定と重なっています</span>' : ''}</button><button class="plan-remove" data-favorite="${e(item.project.id)}" aria-label="${e(item.project.title)}を予定から外す">予定から外す</button></article>`).join('') ||
    `<div class="empty-state"><p>${favorites.size ? 'この日の予定はありません。別の日も確認できます。' : '気になる企画の☆を押すと、開催時刻順に確認できます。'}</p><a href="#projects" class="button button-secondary">企画を探す</a></div>`);
}

function renderTimeline() {
  const favorites = favoriteIds();
  const events = data.schedule.filter(item => item.date === selectedDate && (!$('#schedule-favorites').checked || favorites.has(item.projectId))).sort((a,b) => a.start.localeCompare(b.start));
  html('#timeline', events.map(event => {
    const project = publishedProject(event.projectId), state = eventState(event, clock());
    return `<article class="timeline-row reveal"><div class="timeline-time">${e(event.start)}<small>〜 ${e(event.end)}</small></div><div class="timeline-card"><div><span class="badge">${e(event.category)}</span> ${state === 'live' ? '<span class="badge badge-published">開催中</span>' : ''}${asBool(event.cancelled) ? '<span class="badge badge-important">中止</span>' : ''}<h3 class="${asBool(event.cancelled) ? 'event-cancelled' : ''}"><button class="detail-button" ${project ? `data-project="${e(project.id)}"` : `data-event="${e(event.id)}"`}>${e(event.title)}</button></h3><p>${e(locationName(event.locationId))}</p></div>${project ? favoriteButton(project, true) : ''}</div></article>`;
  }).join('') || empty('この日の該当イベントはありません。'));
  revealElements();
}

function renderMap() {
  html('#floor-tabs', SITE_CONFIG.map.floors.map(floor => `<button data-floor="${e(floor)}" aria-pressed="${floor === selectedFloor}">${e(floor)}</button>`).join(''));
  const locations = data.locations.filter(item => item.floor === selectedFloor);
  if (!locations.some(item => item.id === selectedLocation)) selectedLocation = locations[0]?.id || '';
  html('#location-buttons', locations.map(item => `<button data-location="${e(item.id)}" aria-pressed="${item.id === selectedLocation}">${e(item.name)}</button>`).join(''));
  const object = $('#floor-map'), path = `${SITE_CONFIG.map.assetBase}${encodeURIComponent(selectedFloor)}.svg`;
  if (object.getAttribute('data') !== path) object.setAttribute('data', path);
  object.setAttribute('aria-label', `${selectedFloor} ${SITE_CONFIG.map.isIllustrative ? '仮の' : ''}校内図`);
  renderLocation();
}

function highlightMapRoom() {
  try {
    $('#floor-map').contentDocument?.querySelectorAll('[data-location]').forEach(room => {
      const selected = room.dataset.location === selectedLocation;
      room.setAttribute('aria-pressed', String(selected)); room.classList.toggle('selected-room', selected);
    });
  } catch { /* Cross-origin maps keep their HTML place buttons. */ }
}

function renderLocation() {
  const location = data.locations.find(item => item.id === selectedLocation);
  if (!location) { html('#location-detail', empty('このフロアの場所は未登録です。')); return; }
  $('#location-buttons').querySelectorAll('[data-location]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.location === selectedLocation)));
  highlightMapRoom();
  const slots = data.projects.flatMap(project => projectSlots(project, data, selectedDate)).filter(slot => slot.locationId === location.id);
  html('#location-detail', `<span class="eyebrow">${e(location.floor)}</span><h3>${e(location.name)}</h3><p>${e(location.description)}</p><h4>${e(dateLabel(selectedDate))}の企画</h4>${slots.map(slot => `<div class="compact-row"><button data-project="${e(slot.project.id)}">${e(slot.title)}<small>${e(slot.start)} — ${e(slot.end)} ${asBool(slot.cancelled) ? ' · 中止' : eventState(slot, clock()) === 'live' ? ' · 開催中' : ''}</small></button></div>`).join('') || empty('この日の企画はありません。')}`);
}

function renderNews() {
  html('#news-list', [...data.news].sort((a,b) => Number(asBool(b.important)) - Number(asBool(a.important)) || String(b.publishAt).localeCompare(String(a.publishAt))).map(news => {
    const date = news.publishAt ? japanNow(new Date(news.publishAt)).date : '';
    return `<article class="news-item${asBool(news.important) ? ' important' : ''}"><time datetime="${e(news.publishAt)}">${e(date ? dateLabel(date) : 'お知らせ')}</time><div>${asBool(news.important) ? `<span class="badge badge-important">${icon('alert')}重要なお知らせ</span>` : ''}<h3>${e(news.title)}</h3><p>${e(news.body)}</p></div></article>`;
  }).join('') || empty('お知らせはありません。'));
}

function detailSchedule(slots) {
  return `<div class="detail-schedule">${slots.map(slot => `<div class="detail-slot"><div><b>${e(dateLabel(slot.date))}</b><span>${e(slot.start)} — ${e(slot.end)}</span>${asBool(slot.cancelled) ? '<span class="badge badge-important">中止</span>' : ''}</div><button class="text-button" data-show-location="${e(slot.locationId)}">${icon('pin')} ${e(locationName(slot.locationId))}を地図で見る</button></div>`).join('')}</div>`;
}

function openProject(id, {update = false} = {}) {
  const project = publishedProject(id); if (!project) return;
  detailProjectId = id; detailEventId = '';
  const media = data.media.find(item => item.id === project.mediaId), slots = projectSlots(project, data);
  html('#project-detail', `<img class="detail-image" src="${e(imageURL(media) || './assets/posters/sky.svg')}" alt="${e(media?.alt || project.title)}" data-fallback="./assets/posters/sky.svg"><div class="detail-meta"><span class="badge">${e(project.category)}</span>${crowdBadge(project.crowd)}</div><p class="muted">${e(project.organization)}</p><h2 id="detail-title">${e(project.title)}</h2><p>${e(project.description)}</p>${detailSchedule(slots)}<div class="detail-actions"><button class="button" data-favorite="${e(id)}">${favoriteIds().has(id) ? '予定から外す' : '自分の予定に追加'}</button><button class="button button-secondary" data-share-project="${e(id)}">企画のリンクをコピー</button></div><div id="share-fallback" hidden></div>`);
  bindImageFallbacks($('#project-detail'));
  if (!update && !$('#project-dialog').open) $('#project-dialog').showModal();
}

function openEvent(id) {
  const event = data.schedule.find(item => item.id === id); if (!event) return;
  detailProjectId = ''; detailEventId = id;
  html('#project-detail', `<div class="detail-meta"><span class="badge">${e(event.category)}</span></div><h2 id="detail-title">${e(event.title)}</h2>${detailSchedule([event])}`);
  if (!$('#project-dialog').open) $('#project-dialog').showModal();
}

function rememberView() {
  try { writeStorage('public-view', {date:selectedDate, floor:selectedFloor}, true); } catch {}
}

function changeDate(date) {
  selectedDate = date;
  for (const selector of ['#project-date', '#schedule-date', '#plan-date']) $(selector).value = date;
  renderProjects(); renderFeatured(); renderPlan(); renderTimeline(); renderLocation();
  if (sampleClock) renderNow(); rememberView();
}

function resetFilters() {
  for (const selector of ['#project-search', '#filter-category', '#filter-group', '#filter-crowd']) $(selector).value = '';
  $('#filter-favorites').checked = false; if (data) renderProjects(); $('#project-search').focus({preventScroll:true});
}

function renderAll() {
  renderEmergency(); setupFilters(); renderNow(); renderFeatured(); renderProjects(); renderPlan(); renderTimeline(); renderMap(); renderNews();
  if ($('#project-dialog').open && detailProjectId) {
    if (publishedProject(detailProjectId)) openProject(detailProjectId, {update:true});
    else { $('#project-dialog').close(); toast('この企画は現在公開されていません。'); }
  } else if ($('#project-dialog').open && detailEventId) {
    if (data.schedule.some(event => event.id === detailEventId)) openEvent(detailEventId);
    else {$('#project-dialog').close(); toast('このイベントは現在公開されていません。');}
  }
}

async function refresh({manual = false} = {}) {
  if (refreshing) return;
  refreshing = true; $('#refresh-data').disabled = true;
  try {
    const result = await getPublicWithFallback();
    const signature = JSON.stringify([result.settings, result.projects, result.news, result.schedule, result.locations, result.media]);
    data = result;
    if (signature !== dataSignature) { renderAll(); dataSignature = signature; }
    $('#connection-status').textContent = data.stale ? `保存した情報を表示中 / 最終取得 ${new Date(data.fetchedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}。混雑・緊急情報は最新ではありません。` : `${api.mode === 'demo' ? 'デモデータ / 編集はこのブラウザ内だけに反映' : '運営データ'} · ${japanNow(new Date(data.fetchedAt || Date.now())).time} 更新`;
    if (manual) toast(data.stale ? '通信できません。最後に保存した情報を表示しています。' : '最新情報を確認しました', data.stale);
  } catch (error) {
    $('#connection-status').textContent = `情報を取得できません。${error.message}`;
    if (!data) {
      html('#project-grid', empty('通信を確認して「最新情報に更新」を押してください。'));
      html('#live-list', empty('情報を取得できません。')); html('#soon-list', empty('情報を取得できません。'));
    }
    if (manual || !data) toast(error.message, true);
  } finally { refreshing = false; $('#refresh-data').disabled = false; }
}

applySiteConfig();
document.querySelectorAll('[data-icon]').forEach(element => element.innerHTML = icon(element.dataset.icon));
const filterStatus = document.createElement('div'); filterStatus.id = 'active-filters'; filterStatus.className = 'active-filters'; filterStatus.hidden = true;
$('#search-form').after(filterStatus);
const view = readStorage('public-view', {}, true), parameters = new URLSearchParams(location.search);
selectedDate = parameters.get('day') || view.date || ''; selectedFloor = SITE_CONFIG.map.floors.includes(view.floor) ? view.floor : selectedFloor;
$('#search-form').addEventListener('submit', event => event.preventDefault());
$('#project-search').addEventListener('input', () => data && renderProjects());
$('#project-search').addEventListener('keydown', event => { if (event.key === 'Escape') resetFilters(); });
for (const selector of ['#filter-category','#filter-group','#filter-crowd','#filter-favorites']) $(selector).addEventListener('change', () => data && renderProjects());
$('#reset-filters').addEventListener('click', resetFilters);
for (const selector of ['#project-date','#schedule-date','#plan-date']) $(selector).addEventListener('change', event => data && changeDate(event.target.value));
$('#plan-all-dates').addEventListener('change', () => data && renderPlan());
$('#schedule-favorites').addEventListener('change', () => data && renderTimeline());
$('#refresh-data').addEventListener('click', () => refresh({manual:true}));
$('#demo-clock-toggle').addEventListener('click', () => {
  if (!data) return; sampleClock = !sampleClock;
  $('#demo-clock-toggle').setAttribute('aria-pressed', String(sampleClock)); $('#demo-clock-toggle').textContent = sampleClock ? '実時刻に戻す' : 'サンプル時刻を使う';
  renderNow(); renderTimeline();
});
$('#demo-time').addEventListener('input', () => { if (sampleClock && data) { renderNow(); renderTimeline(); } });
$('#floor-map').addEventListener('load', () => {
  try {
    $('#floor-map').contentDocument?.querySelectorAll('[data-location]').forEach(room => {
      const choose = () => { if (!data || !data.locations.some(place => place.id === room.dataset.location)) return; selectedLocation = room.dataset.location; renderLocation(); };
      room.addEventListener('click', choose); room.addEventListener('keydown', event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); choose(); } });
    });
    if (data) highlightMapRoom();
  } catch {}
});
$('#project-dialog').addEventListener('close', () => { detailProjectId = ''; detailEventId = ''; });
$('#install-guide').addEventListener('click', () => $('#install-dialog').showModal());
document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.hasAttribute('data-close-dialog')) button.closest('dialog').close();
  if (!data) return;
  if (button.hasAttribute('data-reset-filters')) resetFilters();
  if (button.dataset.project) openProject(button.dataset.project);
  if (button.dataset.event) openEvent(button.dataset.event);
  if (button.dataset.favorite) {
    try {
      const id = button.dataset.favorite, added = toggleFavorite(id);
      document.querySelectorAll(`button[data-favorite="${CSS.escape(id)}"]`).forEach(item => {
        if (item.classList.contains('favorite-button')) { item.setAttribute('aria-pressed', String(added)); item.setAttribute('aria-label', `${publishedProject(id)?.title || '企画'}をお気に入り${added ? 'から削除' : 'に追加'}`); }
        else if (item.closest('#project-detail')) item.textContent = added ? '予定から外す' : '自分の予定に追加';
      });
      const wasPlanButton = button.classList.contains('plan-remove');
      renderPlan(); if ($('#filter-favorites').checked) renderProjects(); if ($('#schedule-favorites').checked) renderTimeline();
      if (wasPlanButton && !added) $('#plan-date').focus({preventScroll:true});
      toast(added ? '自分の予定に追加しました' : '予定から外しました');
    } catch (error) { toast(error.message, true); }
  }
  if (button.dataset.floor) { selectedFloor = button.dataset.floor; renderMap(); rememberView(); }
  if (button.dataset.location) { selectedLocation = button.dataset.location; renderLocation(); }
  if (button.dataset.showLocation) {
    const place = data.locations.find(item => item.id === button.dataset.showLocation);
    if (place) {
      selectedFloor = place.floor; selectedLocation = place.id; renderMap(); $('#project-dialog').close();
      // A shared project URL must become a map URL here. Otherwise reloading after
      // "地図で見る" would unexpectedly reopen the project dialog.
      const url = new URL(location.href); url.searchParams.delete('project'); url.hash = 'map';
      history.replaceState(null, '', url); scrollToSection($('#map')); rememberView();
    }
  }
  if (button.dataset.shareProject) {
    const url = new URL('./', location.href); url.searchParams.set('project', button.dataset.shareProject); url.searchParams.set('day', selectedDate);
    try { await navigator.clipboard.writeText(url.href); toast('企画のリンクをコピーしました'); }
    catch { $('#share-fallback').hidden = false; html('#share-fallback', `<label>このリンクをコピーしてください<input readonly value="${e(url.href)}" aria-label="企画の共有リンク"></label>`); $('#share-fallback input').select(); }
  }
});
observeStorage(key => { if (key === 'database') refresh(); if (key === 'favorites' && data) { renderProjects(); renderFeatured(); renderPlan(); renderTimeline(); if (detailProjectId) openProject(detailProjectId, {update:true}); } });
window.addEventListener('online', () => refresh()); document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (data && !document.hidden) { renderNow(); renderTimeline(); } }, 30000);
setInterval(() => { if (!document.hidden) refresh(); }, SITE_CONFIG.api.autoRefreshMs);
initializeAnimations(); registerServiceWorker(); await refresh();
if (data && parameters.get('project')) openProject(parameters.get('project'));
