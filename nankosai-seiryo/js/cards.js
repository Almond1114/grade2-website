import {escapeHTML as e,imageURL,crowdBadge} from './utils.js';
import {favoriteIds} from './storage.js';
import {icon} from './icons.js';
export function favoriteButton(project,staticPosition=false) {
 const selected=favoriteIds().has(project.id);
 return `<button class="favorite-button${staticPosition?' static-favorite':''}" data-favorite="${e(project.id)}" aria-label="${e(project.title)}をお気に入り${selected?'から削除':'に追加'}" aria-pressed="${selected}">${icon('star')}</button>`;
}
export function projectCard(project,data,{preview=false}={}) {
 const location=data.locations.find(item=>item.id===project.locationId),media=data.media.find(item=>item.id===project.mediaId),url=imageURL(media)||'./assets/posters/sky.svg';
 return `<article class="project-card reveal"><div class="project-image-frame"><img class="project-image" src="${e(url)}" data-fallback="./assets/posters/sky.svg" alt="${e(media?.alt||project.title+'の企画画像')}" width="800" height="500" loading="lazy"></div>${preview?'':favoriteButton(project)}<div class="card-content"><div class="card-topline"><span class="card-category">${e(project.category)}</span></div><h3>${e(project.title)}</h3><p class="card-organization">${e(project.organization)}</p><p class="card-description">${e(project.description)}</p><div class="card-meta"><span>${icon('pin')}${e(location?.name||'場所未定')}</span><span>${icon('clock')}${e(project.start)} — ${e(project.end)}</span></div><div class="card-bottom">${crowdBadge(project.crowd)}${preview?'<span class="muted">プレビュー</span>':`<button class="detail-button" data-project="${e(project.id)}">詳しく見る</button>`}</div></div></article>`;
}
