import {SITE_CONFIG,applySiteConfig} from './site-config.js';
import {api,getPublicWithFallback} from './api.js';
import {favoriteIds,toggleFavorite,observeStorage} from './storage.js';
import {escapeHTML as e,japanNow,dateLabel,eventState,eventDates,projectDates,crowdBadge,imageURL,asBool,toast,bindImageFallbacks} from './utils.js';
import {icon} from './icons.js';
import {projectCard,favoriteButton} from './cards.js';
import {initializeAnimations,revealElements} from './animations.js';
import {registerServiceWorker} from './pwa.js';
const $=selector=>document.querySelector(selector);
let data=null,selectedDate='',selectedFloor=SITE_CONFIG.map.floors[0],selectedLocation='',sampleClock=false,refreshing=false;
const empty=message=>`<div class="empty-state">${e(message)}</div>`;
const locationName=id=>data.locations.find(location=>location.id===id)?.name||'場所未定';
function clock(){return sampleClock?{date:selectedDate,time:$('#demo-time').value||'10:32'}:japanNow();}
function publishedProject(id){return data.projects.find(project=>project.id===id);}
function setOptions(select,values,label=value=>value) {
 const previous=select.value;select.innerHTML=values.map(value=>`<option value="${e(value)}">${e(label(value))}</option>`).join('');if(values.includes(previous))select.value=previous;
}
function renderEmergency() {
 const banner=$('#emergency-banner');banner.hidden=!asBool(data.settings.emergencyEnabled)||!data.settings.emergencyText;
 banner.innerHTML=`${icon('alert')}<span>${e(data.settings.emergencyText)}</span>`;
}
function setupFilters() {
 const dates=eventDates(data.settings);if(!dates.includes(selectedDate))selectedDate=dates.includes(japanNow().date)?japanNow().date:dates[0]||'';
 setOptions($('#project-date'),dates,dateLabel);setOptions($('#schedule-date'),dates,dateLabel);$('#project-date').value=selectedDate;$('#schedule-date').value=selectedDate;
 setOptions($('#filter-category'),['',...new Set(data.projects.map(p=>p.category))],value=>value||'すべて');
 setOptions($('#filter-group'),['',...new Set(data.projects.map(p=>p.group))],value=>value||'すべて');
 $('#hero-dates').textContent=dates.map(d=>dateLabel(d,true)).join(' — ');
 $('#hero-hours').textContent=`${data.settings.openTime||SITE_CONFIG.content.openTime} — ${data.settings.closeTime||SITE_CONFIG.content.closeTime}`;
 $('#admission-text').textContent=data.settings.admissionText||SITE_CONFIG.content.admissionText;
 $('#demo-clock-controls').hidden=api.mode!=='demo';
}
function renderProjects() {
 const query=$('#project-search').value.trim().normalize('NFKC').toLowerCase(),category=$('#filter-category').value,group=$('#filter-group').value,crowd=$('#filter-crowd').value,favorites=favoriteIds();
 const projects=data.projects.filter(project=>(!selectedDate||projectDates(project).includes(selectedDate))&&(!query||[project.title,project.organization,project.description,locationName(project.locationId)].join(' ').normalize('NFKC').toLowerCase().includes(query))&&(!category||project.category===category)&&(!group||project.group===group)&&(!crowd||project.crowd===crowd)&&(!$('#filter-favorites').checked||favorites.has(project.id)));
 $('#project-count').textContent=`${projects.length}件の企画`;
 $('#project-grid').innerHTML=projects.map(project=>projectCard(project,data)).join('')||empty('条件に合う企画はありません。検索や絞り込みを変更してください。');
 bindImageFallbacks($('#project-grid'));revealElements();
}
function renderFeatured() {
 const featured=data.projects.filter(project=>asBool(project.featured)).slice(0,3);
 $('#featured').hidden=!featured.length;$('#featured-grid').innerHTML=featured.map(project=>projectCard(project,data)).join('');bindImageFallbacks($('#featured-grid'));revealElements();
}
function row(item,{time=false}={}) {
 const project=publishedProject(item.projectId||item.id);
 return `<div class="compact-row">${time?`<span class="compact-time">${e(item.start)}</span>`:''}<button ${project?`data-project="${e(project.id)}"`:''}>${e(item.title)}<small>${e(locationName(item.locationId))}${project?' · '+e(project.organization):''}</small></button>${project?crowdBadge(project.crowd):''}</div>`;
}
function renderNow() {
 const current=clock();$('#current-clock').textContent=current.time;
 $('#current-clock').setAttribute('datetime',`${current.date}T${current.time}+09:00`);
 $('#current-day').textContent=`${dateLabel(current.date)}${sampleClock?' / サンプル時刻':' / 日本時間'}`;
 $('#now-notice').textContent=sampleClock?'当日の表示体験です。実際の開催状況ではありません。':eventDates(data.settings).includes(current.date)?'開始・終了時刻から自動表示しています。混雑情報は運営による更新です。':'開催期間外です。当日の開催情報はここに表示されます。';
 // Stage slots are taken from the timetable so a cancellation/time change is reflected here too.
 const scheduledIds=new Set(data.schedule.map(event=>event.projectId).filter(Boolean));
 const candidates=[...data.projects.filter(project=>!scheduledIds.has(project.id)),...data.schedule.filter(event=>!asBool(event.cancelled))];
 const live=candidates.filter(item=>eventState(item,current)==='live');
 const soon=candidates
  .filter(item=>eventState(item,current)==='soon'&&((Number(item.start.slice(0,2))*60+Number(item.start.slice(3)))-(Number(current.time.slice(0,2))*60+Number(current.time.slice(3)))<=60))
  .sort((a,b)=>a.start.localeCompare(b.start));
 $('#live-list').innerHTML=live.map(item=>row(item)).join('')||empty('現在開催中の企画はありません。');
 $('#soon-list').innerHTML=soon.map(item=>row(item,{time:true})).join('')||empty('60分以内に始まる企画はありません。');
 if(selectedLocation)renderLocation();
}
function renderPlan() {
 const favorites=favoriteIds();$('#favorite-count').textContent=favorites.size;
 const slots=[];
 for(const project of data.projects.filter(p=>favorites.has(p.id))) {
  const events=data.schedule.filter(event=>event.projectId===project.id);
  if(events.length)events.forEach(event=>slots.push({...event,project}));
  else projectDates(project).forEach(date=>slots.push({...project,date,project}));
 }
 slots.sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
 $('#my-plan-list').innerHTML=slots.map(item=>`<article class="plan-row"><div class="plan-time"><small>${e(dateLabel(item.date))}</small> ${e(item.start)} — ${e(item.end)}</div><button class="plan-title" data-project="${e(item.project.id)}"><b>${e(item.title)} ${asBool(item.cancelled)?'<span class="badge badge-important">中止</span>':''}</b><small>${e(locationName(item.locationId))} / ${e(item.project.organization)}</small></button><button class="plan-remove" data-favorite="${e(item.project.id)}" aria-label="${e(item.project.title)}を予定から外す">予定から外す</button></article>`).join('')||empty('気になる企画の☆を押すと、ここに開催日・時刻順で表示します。');
}
function renderTimeline() {
 const favorites=favoriteIds(),events=data.schedule.filter(item=>item.date===selectedDate&&(!$('#schedule-favorites').checked||favorites.has(item.projectId))).sort((a,b)=>a.start.localeCompare(b.start));
 $('#timeline').innerHTML=events.map(event=>{const project=publishedProject(event.projectId),state=eventState(event,clock());return `<article class="timeline-row reveal"><div class="timeline-time">${e(event.start)}<small>〜 ${e(event.end)}</small></div><div class="timeline-card"><div><span class="badge">${e(event.category)}</span> ${state==='live'?'<span class="badge badge-published">開催中</span>':''}${asBool(event.cancelled)?'<span class="badge badge-important">中止</span>':''}<h3 class="${asBool(event.cancelled)?'event-cancelled':''}">${project?`<button class="detail-button" data-project="${e(project.id)}">${e(event.title)}</button>`:e(event.title)}</h3><p>${e(locationName(event.locationId))}</p></div>${project?favoriteButton(project,true):''}</div></article>`;}).join('')||empty('この日の該当イベントはありません。');revealElements();
}
function renderMap() {
 $('#floor-tabs').innerHTML=SITE_CONFIG.map.floors.map(floor=>`<button data-floor="${e(floor)}" aria-pressed="${floor===selectedFloor}">${e(floor)}</button>`).join('');
 const locations=data.locations.filter(item=>item.floor===selectedFloor);
 $('#location-buttons').innerHTML=locations.map(item=>`<button data-location="${e(item.id)}" aria-pressed="${item.id===selectedLocation}">${e(item.name)}</button>`).join('');
 const object=$('#floor-map'),path=`${SITE_CONFIG.map.assetBase}${encodeURIComponent(selectedFloor)}.svg`;
 if(object.getAttribute('data')!==path)object.setAttribute('data',path);object.setAttribute('aria-label',`${selectedFloor} 仮の校内図`);
 if(!locations.some(item=>item.id===selectedLocation))selectedLocation=locations[0]?.id||'';renderLocation();
}
function renderLocation() {
 const location=data.locations.find(item=>item.id===selectedLocation);if(!location){$('#location-detail').innerHTML=empty('このフロアの場所は未登録です。');return;}
 $('#location-buttons').querySelectorAll('[data-location]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.location===selectedLocation));
 const projects=data.projects.filter(project=>data.schedule.some(event=>event.projectId===project.id)?data.schedule.some(event=>event.projectId===project.id&&event.locationId===location.id):project.locationId===location.id);
 $('#location-detail').innerHTML=`<span class="eyebrow">${e(location.floor)}</span><h3>${e(location.name)}</h3><p>${e(location.description)}</p><h4>ここで開催する企画</h4>${projects.map(project=>{const events=data.schedule.filter(ev=>ev.projectId===project.id&&ev.locationId===location.id);const live=events.length?events.some(ev=>eventState(ev,clock())==='live'):eventState(project,clock())==='live';return `<div class="compact-row"><button data-project="${e(project.id)}">${e(project.title)}<small>${e(project.start)} — ${e(project.end)} ${live?' · 開催中':''}</small></button></div>`;}).join('')||empty('この場所の企画は未登録です。')}`;
}
function renderNews() {
 $('#news-list').innerHTML=[...data.news].sort((a,b)=>Number(asBool(b.important))-Number(asBool(a.important))||String(b.publishAt).localeCompare(String(a.publishAt))).map(news=>`<article class="news-item${asBool(news.important)?' important':''}"><time datetime="${e(news.publishAt)}">${e(dateLabel(String(news.publishAt).slice(0,10)))}</time><div>${asBool(news.important)?`<span class="badge badge-important">${icon('alert')}重要なお知らせ</span>`:''}<h3>${e(news.title)}</h3><p>${e(news.body)}</p></div></article>`).join('')||empty('お知らせはありません。');
}
function openProject(id) {
 const project=publishedProject(id);if(!project)return;
 const media=data.media.find(item=>item.id===project.mediaId),location=data.locations.find(item=>item.id===project.locationId),events=data.schedule.filter(event=>event.projectId===id);
 $('#project-detail').innerHTML=`<img class="detail-image" src="${e(imageURL(media)||'./assets/posters/sky.svg')}" alt="${e(media?.alt||project.title)}" data-fallback="./assets/posters/sky.svg"><div class="detail-meta"><span class="badge">${e(project.category)}</span>${crowdBadge(project.crowd)}</div><p class="muted">${e(project.organization)}</p><h2>${e(project.title)}</h2><p>${e(project.description)}</p><p>${icon('pin')} ${e(location?.floor||'')} ${e(locationName(project.locationId))}</p><p>${icon('clock')} ${e(project.start)} — ${e(project.end)}<br>${projectDates(project).map(date=>e(dateLabel(date))).join(' / ')}</p>${events.map(ev=>`<p>${e(dateLabel(ev.date))} ${e(ev.start)} — ${e(ev.end)} ${asBool(ev.cancelled)?'<span class="badge badge-important">中止</span>':''}</p>`).join('')}<div class="detail-actions"><button class="button" data-favorite="${e(id)}">${favoriteIds().has(id)?'予定から外す':'自分の予定に追加'}</button><button class="button button-secondary" data-show-location="${e(project.locationId)}">場所を確認</button></div>`;
 bindImageFallbacks($('#project-detail'));if(!$('#project-dialog').open)$('#project-dialog').showModal();
}
function renderAll() {renderEmergency();setupFilters();renderNow();renderFeatured();renderProjects();renderPlan();renderTimeline();renderMap();renderNews();}
async function refresh() {
 if(refreshing)return;refreshing=true;$('#refresh-data').disabled=true;
 try {data=await getPublicWithFallback();renderAll();$('#connection-status').textContent=data.stale?`保存した情報を表示中 / 最終取得 ${new Date(data.fetchedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}。混雑・緊急情報は最新ではありません。`:`${api.mode==='demo'?'デモデータ / 編集はこのブラウザ内だけに反映':'運営データ'} · ${japanNow(new Date(data.fetchedAt||Date.now())).time} 更新`;}
 catch(error){$('#connection-status').textContent=`情報を取得できません。${error.message}`;if(!data){$('#project-grid').innerHTML=empty('通信を確認して「最新情報に更新」を押してください。');$('#live-list').innerHTML=empty('情報を取得できません。');$('#soon-list').innerHTML=empty('情報を取得できません。');}toast(error.message,true);}
 finally{refreshing=false;$('#refresh-data').disabled=false;}
}
applySiteConfig();document.querySelectorAll('[data-icon]').forEach(element=>element.innerHTML=icon(element.dataset.icon));
$('#search-form').addEventListener('submit',event=>event.preventDefault());
$('#project-search').addEventListener('input',()=>data&&renderProjects());
['#filter-category','#filter-group','#filter-crowd','#filter-favorites'].forEach(selector=>$(selector).addEventListener('change',()=>data&&renderProjects()));
$('#reset-filters').addEventListener('click',()=>{['#project-search','#filter-category','#filter-group','#filter-crowd'].forEach(selector=>$(selector).value='');$('#filter-favorites').checked=false;renderProjects();});
['#project-date','#schedule-date'].forEach(selector=>$(selector).addEventListener('change',event=>{selectedDate=event.target.value;$('#project-date').value=selectedDate;$('#schedule-date').value=selectedDate;renderProjects();renderTimeline();if(sampleClock)renderNow();}));
$('#schedule-favorites').addEventListener('change',renderTimeline);
$('#refresh-data').addEventListener('click',refresh);
$('#demo-clock-toggle').addEventListener('click',()=>{sampleClock=!sampleClock;$('#demo-clock-toggle').setAttribute('aria-pressed',sampleClock);$('#demo-clock-toggle').textContent=sampleClock?'実時刻に戻す':'サンプル時刻を使う';renderNow();renderTimeline();});$('#demo-time').addEventListener('input',()=>{if(sampleClock){renderNow();renderTimeline();}});
$('#floor-map').addEventListener('load',()=>{try{$('#floor-map').contentDocument?.querySelectorAll('[data-location]').forEach(room=>{const choose=()=>{selectedLocation=room.dataset.location;renderLocation();};room.addEventListener('click',choose);room.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();choose();}});});}catch{/* A cross-origin replacement SVG still has the HTML location list. */}});
$('#install-guide').addEventListener('click',()=>$('#install-dialog').showModal());
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-close-dialog'))button.closest('dialog').close();
 if(button.dataset.project)openProject(button.dataset.project);
 if(button.dataset.favorite){try{const added=toggleFavorite(button.dataset.favorite);document.querySelectorAll(`button[data-favorite="${CSS.escape(button.dataset.favorite)}"]`).forEach(item=>{if(item.classList.contains('favorite-button')){item.setAttribute('aria-pressed',added);item.setAttribute('aria-label',`${publishedProject(button.dataset.favorite)?.title||'企画'}をお気に入り${added?'から削除':'に追加'}`);}else if(item.closest('#project-detail'))item.textContent=added?'予定から外す':'自分の予定に追加';});renderPlan();if($('#filter-favorites').checked)renderProjects();if($('#schedule-favorites').checked)renderTimeline();toast(added?'自分の予定に追加しました':'予定から外しました');}catch(error){toast(error.message,true);}}
 if(button.dataset.floor){selectedFloor=button.dataset.floor;renderMap();}
 if(button.dataset.location){selectedLocation=button.dataset.location;renderLocation();}
 if(button.dataset.showLocation){const location=data.locations.find(item=>item.id===button.dataset.showLocation);if(location){selectedFloor=location.floor;selectedLocation=location.id;renderMap();$('#project-dialog').close();$('#map').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}
});
observeStorage(key=>{if(key==='database')refresh();if(key==='favorites'&&data){renderProjects();renderFeatured();renderPlan();renderTimeline();}});
window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
setInterval(()=>{if(data&&!document.hidden){renderNow();renderTimeline();}},30000);
setInterval(()=>{if(!document.hidden)refresh();},SITE_CONFIG.api.autoRefreshMs);
initializeAnimations();registerServiceWorker();await refresh();
