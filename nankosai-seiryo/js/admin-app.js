import {SITE_CONFIG,applySiteConfig} from './site-config.js?v=77db7237ab62';
import {api} from './api.js?v=77db7237ab62';
import {readStorage,writeStorage,removeStorage} from './storage.js?v=77db7237ab62';
import {readEditorDraft,keepEditorDraft,clearEditorDraft} from './editor-storage.js?v=77db7237ab62';
import {matchesSearch} from './festival-data.js?v=77db7237ab62';
import {escapeHTML as e,asBool,statusLabels,crowdLabels,imageURL,toast,eventState,japanNow,eventDates,bindImageFallbacks,downloadJSON} from './utils.js?v=77db7237ab62';
import {icon} from './icons.js?v=77db7237ab62';
import {prepareImage} from './media.js?v=77db7237ab62';
import {projectCard} from './cards.js?v=77db7237ab62';
import {validateRecord,validateSettings} from './schema.js?v=77db7237ab62';
const $=selector=>document.querySelector(selector);
const menu=[['dashboard','ダッシュボード','grid'],['projects','企画管理','wind'],['news','お知らせ管理','news'],['schedule','タイムテーブル','clock'],['locations','場所・校内マップ','map'],['media','画像','image'],['settings','サイト設定','settings'],['audit','変更履歴','history']];
let data=null,section='dashboard',editingId='',dirty=false,busy=false,pendingImage=null,listQuery='',listStatus='',imageRequest=0;
const items=collection=>(data[collection]||[]).filter(item=>!item.deletedAt);
const empty=message=>`<p class="empty-state">${e(message)}</p>`;
const locationName=id=>{const place=items('locations').find(item=>item.id===id);return place?`${place.floor} / ${place.name}`:'場所未定';};
const localTime=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'日時不明':date.toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});};
const pageTitle=(title,description,action='')=>`<div class="admin-page-title"><div><h1>${e(title)}</h1><p>${e(description)}</p></div>${action}</div>`;
function requireLeave(){
 if(busy){toast('保存中です。完了するまでお待ちください。');return false;}
 return !dirty||confirm(section==='media'?'まだ保存していない画像があります。画像を破棄して移動しますか？':'まだサーバーに保存していません。入力はこのタブに一時保存されています。移動しますか？');
}
function handleError(error){toast(error.message,true);if(error.code==='UNAUTHORIZED'){removeStorage('session',true);$('#admin-shell').hidden=true;$('#login-screen').hidden=false;$('#login-error').textContent='ログイン期限が切れました。入力はこのタブに残っています。再ログインしてください。';}}
async function reload(){data=await api.getAdmin();renderEmergency();}
function renderEmergency(){const banner=$('#emergency-banner');banner.hidden=!asBool(data.settings.emergencyEnabled)||!data.settings.emergencyText;banner.textContent=data.settings.emergencyText||'';}
function trackSettingsForm(form,key,original){
 const snapshot=readEditorDraft(api.mode,'settings',key);
 const remember=()=>{dirty=true;keepEditorDraft(api.mode,'settings',key,readForm(form,original));};
 const fill=values=>{for(const control of form.elements){if(!control.name||!(control.name in values))continue;if(control.type==='checkbox')control.checked=asBool(values[control.name]);else control.value=values[control.name];}};
 if(snapshot){
  const sameRevision=Number(snapshot.record.revision)===Number(original.revision),note=document.createElement('div');note.className='info-note settings-recovery';
  const message=document.createElement('p');message.textContent=sameRevision?'入力途中の設定を復元しました。まだ公開されていません。':'一時保存の後に設定が更新されています。最新の設定を表示しています。';note.append(message);
  if(sameRevision){fill(snapshot.record);dirty=true;}
  else{const restore=document.createElement('button');restore.type='button';restore.className='text-button';restore.textContent='以前の入力を確認する';restore.onclick=()=>{fill(snapshot.record);remember();message.textContent='以前の入力を復元しました。最新の設定と比較してから保存してください。';restore.remove();};note.append(restore);}
  const discard=document.createElement('button');discard.type='button';discard.className='text-button';discard.textContent='一時保存を破棄';discard.onclick=()=>{if(confirm('一時保存した設定の入力を破棄しますか？保存済みの設定は残ります。')){clearEditorDraft(api.mode,'settings',key);fill(original);dirty=false;note.remove();}};note.append(discard);form.prepend(note);
 }
 form.addEventListener('input',remember);form.addEventListener('change',remember);
}
function applySaved(action,payload,saved){
 if(action==='saveSettings')data.settings=saved;
 else{const collection=['uploadImage','deleteImage'].includes(action)?'media':payload.collection,index=data[collection].findIndex(item=>item.id===saved.id);if(index<0)data[collection].push(saved);else data[collection][index]=saved;}
 data.audit.unshift({time:new Date().toISOString(),action,collection:payload.collection||(['uploadImage','deleteImage'].includes(action)?'media':'settings'),detail:saved.title||saved.name||saved.fileName||'運営設定'});renderEmergency();
}
async function mutate(action,payload,message){
 if(busy)return false;busy=true;$('#admin-workspace').setAttribute('aria-busy','true');
 const controls=[...document.querySelectorAll('#admin-workspace input,#admin-workspace select,#admin-workspace textarea')],disabledStates=controls.map(control=>control.disabled);
 controls.forEach(control=>control.disabled=true);
 const progressButtons=[...document.querySelectorAll('#admin-workspace button[type=submit],#upload-submit')],buttonLabels=progressButtons.map(button=>button.textContent);
 progressButtons.forEach(button=>button.textContent='保存中…');
 document.querySelectorAll('button[type=submit],#save-draft,#upload-submit').forEach(button=>button.disabled=true);
 try{
  const saved=await api.mutate(action,payload);
  // A successful write must remain successful even when the following refresh fails.
  applySaved(action,payload,saved);dirty=false;toast(message);
  try{await reload();}catch{toast('保存は完了しました。最新一覧の取得に失敗したため、接続が戻ったら「再読み込み」を押してください。',true);}
  return saved;
 }catch(error){handleError(error);return false;}
 finally{busy=false;$('#admin-workspace').removeAttribute('aria-busy');controls.forEach((control,index)=>control.disabled=disabledStates[index]);progressButtons.forEach((button,index)=>button.textContent=buttonLabels[index]);document.querySelectorAll('button[type=submit],#save-draft,#upload-submit').forEach(button=>button.disabled=false);}
}
function renderNav(){ $('#admin-nav').innerHTML=menu.map(([id,label,graphic])=>`<button data-section="${id}" ${section===id?'aria-current="page"':''}>${icon(graphic)}${label}</button>`).join('');$('#current-section-label').textContent=menu.find(item=>item[0]===section)[1]; }
function crowdButtons(project){return `<div class="crowd-buttons" role="group" aria-label="${e(project.title)}の混雑状況">${Object.entries(crowdLabels).map(([value,label])=>`<button data-crowd-id="${e(project.id)}" data-crowd="${value}" aria-pressed="${project.crowd===value}">${label}</button>`).join('')}</div>`;}
function dashboardRow(item,collection){return `<div class="dashboard-row"><div><b>${e(item.title||item.name||item.detail)}</b><small>${e(item.organization||item.start||item.time||'')}${item.locationId?' / '+e(locationName(item.locationId)):''}</small></div>${collection==='projects'?crowdButtons(item):`<button class="text-button" data-open-record="${e(item.id)}" data-collection="${collection}">確認</button>`}</div>`;}
function renderDashboard(){
 const projects=items('projects'),news=items('news'),events=items('schedule'),now=japanNow(),next=events.filter(event=>event.status==='published'&&!asBool(event.cancelled)&&eventState(event,now)==='soon').sort((a,b)=>a.start.localeCompare(b.start));
 const metrics=[['公開中企画',projects.filter(p=>p.status==='published').length],['下書き企画',projects.filter(p=>p.status==='draft').length],['混雑中企画',projects.filter(p=>p.crowd==='busy'&&p.status==='published').length],['重要なお知らせ',news.filter(n=>n.status==='published'&&asBool(n.important)).length],['本日これから',next.length]];
 $('#admin-workspace').innerHTML=pageTitle('今日の運営を、ひと目で。','混雑状況と緊急告知を、ここからすぐに更新できます。')+`<div class="metric-grid">${metrics.map(([label,count])=>`<div class="metric-card"><span>${label}</span><b>${count}</b></div>`).join('')}</div><section class="admin-panel emergency-panel"><div class="panel-heading"><h2>緊急バナー</h2><span class="badge">${asBool(data.settings.emergencyEnabled)?'表示中':'非表示'}</span></div><form id="emergency-form" class="emergency-form"><label>来場者への案内<small>公開サイト・管理画面の最上部に表示します。</small><input name="emergencyText" maxlength="300" placeholder="例：雨天のため屋外企画は中止します" value="${e(data.settings.emergencyText)}"></label><label class="checkbox-field"><input name="emergencyEnabled" type="checkbox" ${asBool(data.settings.emergencyEnabled)?'checked':''}>バナーを表示</label><button class="button" type="submit">バナーを更新</button></form></section><div class="dashboard-grid"><section class="admin-panel"><h2>混雑中の企画</h2>${projects.filter(p=>p.crowd==='busy'&&p.status==='published').map(p=>dashboardRow(p,'projects')).join('')||empty('混雑中の企画はありません。')}</section><section class="admin-panel"><h2>直近のイベント</h2>${[...events].filter(event=>event.status==='published'&&!asBool(event.cancelled)&&(event.date+event.end)>=now.date+now.time).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).slice(0,4).map(item=>dashboardRow(item,'schedule')).join('')||empty('これから始まるイベントはありません。')}</section><section class="admin-panel"><h2>重要なお知らせ</h2>${news.filter(item=>asBool(item.important)&&item.status==='published').map(item=>dashboardRow(item,'news')).join('')||empty('重要なお知らせはありません。')}</section><section class="admin-panel"><h2>最近の変更</h2>${data.audit.slice(0,5).map(item=>`<div class="dashboard-row"><div><b>${e(item.detail)}</b><small>${e(localTime(item.time))} / ${e(actionLabel(item.action))}</small></div></div>`).join('')}</section></div>`;
 const form=$('#emergency-form');trackSettingsForm(form,'emergency',data.settings);
 form.addEventListener('submit',async event=>{event.preventDefault();try{const values=validateSettings(readForm(form,data.settings));if(await mutate('saveSettings',values,'緊急バナーを更新しました')){clearEditorDraft(api.mode,'settings','emergency');renderDashboard();}}catch(error){toast(error.message,true);}});
}
function defaults(collection){const common={id:'',revision:0,status:'draft'};if(collection==='projects')return {...common,title:'',organization:'',group:'2年生',category:'体験・ゲーム',locationId:'',dates:eventDates(data.settings).join(','),start:data.settings.openTime||'09:00',end:data.settings.closeTime||'16:00',description:'',mediaId:'',crowd:'normal',featured:false};if(collection==='news')return {...common,title:'',body:'',important:false,publishAt:new Date().toISOString()};if(collection==='schedule')return {...common,title:'',date:eventDates(data.settings)[0],start:'11:00',end:'11:30',locationId:'',category:'ステージ',projectId:'',cancelled:false};return {...common,name:'',floor:'1F',description:''};}
function field(name,label,help,value,{type='text',options=[],required=false,full=false,maxLength=4000}={}){
 const id='field-'+name,attributes=`id="${id}" name="${name}" aria-describedby="${id}-help" ${required?'data-required-on-publish required':''}`;
 let control=type==='select'?`<select ${attributes}>${options.map(([val,title])=>`<option value="${e(val)}" ${String(value)===String(val)?'selected':''}>${e(title)}</option>`).join('')}</select>`:type==='textarea'?`<textarea ${attributes} maxlength="${maxLength}">${e(value)}</textarea>`:type==='checkbox'?`<input ${attributes} type="checkbox" ${asBool(value)?'checked':''}>`:`<input ${attributes} type="${type}" value="${e(value)}" maxlength="${maxLength}">`;
 return `<div class="${full?'field-full':''}"><label for="${id}">${e(label)}${required?' <span class="field-requirement">'+(['title','name'].includes(name)?'必須':'公開時に必須')+'</span>':''}<small id="${id}-help">${e(help)}</small></label>${control}</div>`;
}
function recordFields(collection,record){
 const placeOptions=[['','場所を選択'],...items('locations').map(item=>[item.id,`${item.floor} / ${item.name}${item.status==='draft'?'（下書き）':''}`])];
 let fields=collection==='locations'?field('name','場所名','マップの場所一覧と企画の会場名に表示します。',record.name,{required:true,full:true,maxLength:120})+field('floor','フロア','場所を表示する階を選択します。',record.floor,{type:'select',options:SITE_CONFIG.map.floors.map(f=>[f,f]),required:true})+field('description','場所の説明','場所を選んだときに表示します。校内図のSVG配置はコード側で変更します。',record.description,{type:'textarea',full:true}):field('title',collection==='news'?'お知らせの見出し':'企画・イベント名','公開サイトのカードやタイムテーブル上部に表示します。',record.title,{required:true,full:true,maxLength:120});
 if(collection==='projects')fields+=field('organization','クラス・団体名','例：2年3組、軽音楽部。企画名の下に表示します。',record.organization,{required:true,maxLength:120})+field('group','学年・団体','企画の絞り込みに使います。',record.group,{type:'select',options:['1年生','2年生','3年生','部活動','有志','その他'].map(v=>[v,v]),required:true})+field('category','カテゴリー','企画カードとカテゴリー絞り込みに表示します。',record.category,{required:true,maxLength:120})+field('locationId','開催場所','公開中の場所を選びます。場所は左の管理メニューで追加できます。',record.locationId,{type:'select',options:placeOptions,required:true})+field('dates','開催日','YYYY-MM-DD。複数日はカンマ区切り（例：2027-07-10,2027-07-11）。',record.dates,{required:true,full:true,maxLength:400})+field('start','開始時刻','関連する時刻表がある場合、公開画面では時刻表の時間・場所が優先されます。',record.start,{type:'time',required:true})+field('end','終了時刻','開始時刻より後の同日内の時刻を入力します。',record.end,{type:'time',required:true})+field('description','短い説明','企画カード・企画詳細に表示します。HTMLは使用できません。',record.description,{type:'textarea',required:true,full:true})+field('mediaId','企画画像','「画像」でアップロードした画像を選択してください。',record.mediaId,{type:'select',options:[['','標準の企画画像'],...items('media').map(m=>[m.id,m.fileName])]})+field('crowd','混雑状況','来場者に「空いてる・普通・混雑」の文字で表示します。',record.crowd,{type:'select',options:Object.entries(crowdLabels)})+field('featured','注目企画に掲載','トップの「ひとつ、寄り道。」に最大3件表示します。',record.featured,{type:'checkbox',full:true});
 if(collection==='news')fields+=field('body','お知らせ本文','来場者が読む案内文を入力してください。HTMLは使用できません。',record.body,{type:'textarea',required:true,full:true})+field('publishAt','公開開始日時（日本時間）','公開中にしても、この日時になるまで来場者には表示しません。',toLocalDateTime(record.publishAt),{type:'datetime-local',required:true,full:true})+field('important','重要なお知らせ','淡い暖色と「重要なお知らせ」のラベルで目立たせます。',record.important,{type:'checkbox',full:true});
 if(collection==='schedule')fields+=field('projectId','関連する企画','新規イベントでは、選ぶと企画名・日付・時間・場所を自動入力します。',record.projectId,{type:'select',options:[['','関連なし'],...items('projects').map(p=>[p.id,p.title+(p.status==='draft'?'（下書き）':'')])]})+field('category','カテゴリー','タイムテーブルの分類ラベルに表示します。',record.category,{required:true,maxLength:120})+field('date','開催日','イベントを行う日を選択します。',record.date,{type:'date',required:true})+field('locationId','開催場所','タイムテーブルに表示します。',record.locationId,{type:'select',options:placeOptions,required:true})+field('start','開始時刻','タイムテーブルに表示します。',record.start,{type:'time',required:true})+field('end','終了時刻','開始時刻より後の同日内の時刻を入力します。',record.end,{type:'time',required:true})+field('cancelled','このイベントは中止','公開ページに中止ラベルを表示し、「開催中」から外します。',record.cancelled,{type:'checkbox',full:true});
 return fields+field('status','公開状態','下書きは名前だけで保存できます。公開中にするには公開時必須の項目を入力してください。',record.status,{type:'select',options:Object.entries(statusLabels),full:true});
}
function toLocalDateTime(value){if(!value)return '';const date=new Date(value);if(Number.isNaN(date.getTime()))return '';return new Date(date.getTime()+9*60*60*1000).toISOString().slice(0,16);}
function readForm(form,original){const result={...original};for(const control of form.elements){if(!control.name)continue;result[control.name]=control.type==='checkbox'?control.checked:control.value.trim();}if(result.publishAt&&form.elements.publishAt){const timestamp=new Date(result.publishAt+':00+09:00');if(!Number.isNaN(timestamp.getTime()))result.publishAt=timestamp.toISOString();}return result;}
function renderList(){
 const filtered=items(section).filter(item=>matchesSearch([item.title,item.name,item.organization],listQuery)&&(!listStatus||item.status===listStatus));
 $('#record-list').innerHTML=filtered.map(item=>`<article class="record-row${editingId===item.id?' selected':''}"><button class="record-select" data-edit-record="${e(item.id)}"><b>${e(item.title||item.name)}</b><small>${e(item.organization||item.date||item.floor||'')}</small></button><span class="badge badge-${e(item.status)}">${e(statusLabels[item.status])}</span>${section==='projects'?crowdButtons(item):''}</article>`).join('')||empty('該当する項目はありません。');
}
function renderManagement(){
 const label=menu.find(item=>item[0]===section)[1];$('#admin-workspace').innerHTML=pageTitle(label,'一覧で選択して編集します。新規作成は下書きから始まります。',`<button class="button" id="new-record">${icon('plus')}新規作成</button>`)+`<div class="management-layout"><aside class="record-list-panel"><div class="list-toolbar"><input id="admin-search" type="search" placeholder="名前・クラスで検索" aria-label="管理一覧を検索" value="${e(listQuery)}"><select id="admin-status" aria-label="公開状態で絞り込み"><option value="">すべての状態</option>${Object.entries(statusLabels).map(([key,label])=>`<option value="${key}" ${listStatus===key?'selected':''}>${label}</option>`).join('')}</select></div><div id="record-list" class="record-list"></div></aside><div id="record-editor"></div></div>`;
 renderList();renderEditor();$('#admin-search').addEventListener('input',event=>{listQuery=event.target.value;renderList();});$('#admin-status').addEventListener('change',event=>{listStatus=event.target.value;renderList();});
 $('#new-record').addEventListener('click',()=>{if(!editingId&&dirty){toast('この入力を先に下書き保存すると、次の企画を新規作成できます。');focusEditor();return;}if(requireLeave()){editingId='';dirty=false;rememberView();renderManagement();focusEditor();}});
}
function focusEditor(){
 $('#record-editor').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 $('#field-title,#field-name')?.focus({preventScroll:true});
}
function renderEditor({discardTemporary=false,forceRestore=false}={}){
 const collection=section,recordId=editingId,original=items(collection).find(item=>item.id===recordId)||defaults(collection);
 if(discardTemporary)clearEditorDraft(api.mode,collection,recordId);
 const snapshot=readEditorDraft(api.mode,collection,recordId),sameRevision=snapshot&&Number(snapshot.record.revision)===Number(original.revision),restoring=snapshot&&(sameRevision||forceRestore);
 const initial=restoring?{...snapshot.record,id:original.id,revision:original.revision}:original;dirty=!!restoring;
 const recovery=snapshot?`<div class="draft-recovery" role="status"><p>${restoring?'入力途中の内容を復元しました。まだ公開されていません。':'一時保存の後に元データが更新されています。最新の内容を表示しています。'}<small>一時保存：${e(localTime(snapshot.savedAt))}</small></p><div>${!restoring?'<button type="button" id="restore-temporary" class="text-button">以前の入力を確認する</button>':''}<button type="button" id="discard-temporary" class="text-button">一時保存を破棄</button></div></div>`:'';
 $('#record-editor').innerHTML=`<form id="record-form" class="record-form"><div class="editor-heading"><div><h2>${recordId?'編集中':'新規作成'}</h2><p>${recordId?e(original.title||original.name):'名前だけでも下書き保存できます。'}</p></div><span id="dirty-indicator" class="dirty-indicator" aria-live="polite">${restoring?'未保存・入力を復元':recordId?'保存済み':'まだ保存していません'}</span></div><div class="editor-save-bar"><span id="save-state-label"></span><div><button type="button" id="save-draft" class="button button-secondary">下書きで保存</button><button type="submit" id="save-record" class="button">変更を保存</button></div></div>${recovery}<p class="editor-help">入力はこのタブに一時保存します。公開には「公開状態」を公開中にして保存してください。</p><div class="form-fields">${recordFields(collection,initial)}</div><p id="editor-error" class="form-error" role="alert" tabindex="-1"></p><div class="preview-section"><h3>公開カードのプレビュー</h3><div id="record-preview"></div></div><div class="editor-actions">${recordId?'<button type="button" id="delete-record" class="delete-button">この項目を削除</button>':'<span class="muted">保存すると一覧に追加されます</span>'}<small>Ctrl / ⌘ + S でも保存できます</small></div></form>`;
 const form=$('#record-form');
 const preview=()=>{
  const value=readForm(form,original);
  $('#record-preview').innerHTML=collection==='projects'?projectCard(value,data,{preview:true}):`<article class="news-preview"><span class="badge badge-${e(value.status)}">${e(statusLabels[value.status])}</span><h3>${e(value.title||value.name||'見出しを入力')}</h3><p>${e(value.body||value.description||value.date||'')}</p>${value.start?`<p>${e(value.start)} — ${e(value.end)} / ${e(locationName(value.locationId))}</p>`:''}</article>`;bindImageFallbacks($('#record-preview'));
 };
 const syncStatus=()=>{
  const published=form.elements.status.value==='published';
  form.querySelectorAll('[data-required-on-publish]').forEach(control=>control.required=published||['title','name'].includes(control.name));
  $('#save-state-label').textContent=published?'保存すると公開されます':'下書き・来場者には非表示';
  $('#save-record').textContent=published?'公開中として保存':'下書きを保存';$('#save-draft').hidden=!published||original.status==='published';
 };
 const remember=()=>{dirty=true;$('#dirty-indicator').textContent='未保存・このタブに一時保存';$('#editor-error').textContent='';keepEditorDraft(api.mode,collection,recordId,readForm(form,original));syncStatus();preview();};
 syncStatus();preview();form.addEventListener('input',remember);form.addEventListener('change',remember);
 form.elements.projectId?.addEventListener('change',()=>{
  if(recordId)return;const project=items('projects').find(item=>item.id===form.elements.projectId.value);if(!project)return;
  for(const name of ['title','category','locationId','start','end'])form.elements[name].value=project[name]||'';
  form.elements.date.value=String(project.dates||'').split(',')[0]||eventDates(data.settings)[0];remember();toast('関連企画から入力しました。イベントの時間・場所を確認してください。');
 });
 $('#save-draft').addEventListener('click',()=>{form.elements.status.value='draft';syncStatus();remember();form.requestSubmit();});
 $('#discard-temporary')?.addEventListener('click',()=>{if(confirm('このタブに一時保存した入力を破棄しますか？保存済みの内容は残ります。')){dirty=false;renderEditor({discardTemporary:true});}});
 $('#restore-temporary')?.addEventListener('click',()=>renderEditor({forceRestore:true}));
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  try{const record=validateRecord(collection,readForm(form,original),data),saved=await mutate('saveRecord',{collection,record},record.status==='draft'?'下書きを保存しました。来場者には表示されません。':'公開中として保存しました');
   if(saved){clearEditorDraft(api.mode,collection,recordId);editingId=saved.id;rememberView();renderManagement();}
  }catch(error){$('#editor-error').textContent=error.message;$('#editor-error').focus();toast(error.message,true);}
 });
 $('#delete-record')?.addEventListener('click',async()=>{if(busy||!confirm(`「${original.title||original.name}」を削除しますか？公開ページと管理一覧から取り除きます。`))return;if(await mutate('deleteRecord',{collection,id:original.id,revision:original.revision},'削除しました')){clearEditorDraft(api.mode,collection,recordId);editingId='';rememberView();renderManagement();}});
}
function mediaDeleteControl(media){
 if(!['drive','demo'].includes(media.provider))return '';
 const used=items('projects').filter(project=>project.mediaId===media.id).length;
 return `<p class="media-usage">${used?'使用中：'+used+'企画（下書きを含む）':'現在は使用していません'}</p><button class="delete-button" data-delete-media="${e(media.id)}" ${used?'disabled':''}>画像を削除</button>`;
}
function renderMedia(){
 imageRequest++;pendingImage=null;
 $('#admin-workspace').innerHTML=pageTitle('画像ライブラリ','画像はブラウザで縮小・圧縮してから保存します。')+`<section class="upload-zone"><h2>新しい画像を追加</h2><p>JPEG・PNG・WebP / 元画像25MB以下 / 最大1600px・送信2MB以下に圧縮。位置情報などのEXIFは再描画で取り除きます。</p><p class="media-sharing-note">${api.mode==='google'?'保存する画像は表示用のリンク共有になります。企画の公開は企画管理で行います。':'デモ画像はこのブラウザ内だけに保存されます。'}</p><label for="image-file">画像を選択<input id="image-file" type="file" accept="image/jpeg,image/png,image/webp"></label><div id="upload-preview" class="upload-preview"></div><p id="upload-error" class="form-error" role="alert"></p></section><div class="media-grid">${items('media').map(media=>`<article class="media-card"><img src="${e(imageURL(media)||'./assets/posters/sky.svg')}" alt="${e(media.alt||media.fileName)}" data-fallback="./assets/posters/sky.svg" loading="lazy"><div><p>${e(media.fileName)}</p><small>${e(media.width)}×${e(media.height)} / ${Math.round(Number(media.bytes||0)/1024)} KB<br>${media.provider==='demo'?'ブラウザ内':media.provider==='drive'?'Google Drive':'標準画像'}</small><button class="text-button" data-copy-media="${e(media.id)}">画像IDをコピー</button>${mediaDeleteControl(media)}</div></article>`).join('')}</div>`;
 bindImageFallbacks();$('#image-file').addEventListener('change',async event=>{
  const request=++imageRequest,file=event.target.files[0];pendingImage=null;dirty=!!file;$('#upload-error').textContent='';$('#upload-preview').textContent=file?'画像を縮小しています…':'';if(!file)return;
  try{
   const prepared=await prepareImage(file);if(section!=='media'||request!==imageRequest)return;pendingImage=prepared;
   $('#upload-preview').innerHTML=`<img src="${e(prepared.dataUrl)}" alt="アップロード前の確認"><div><p>${e(prepared.fileName)}<br>${prepared.width}×${prepared.height} / ${Math.round(prepared.bytes/1024)} KB</p><label>画像の説明<small>写真の内容を短く書きます。見えない方への説明に使います。</small><input id="upload-alt" maxlength="200" placeholder="例：窓辺に並んだ青いドリンク"></label><button id="upload-submit" class="button">この画像を保存</button></div>`;
   $('#upload-submit').addEventListener('click',async()=>{if(!pendingImage||busy)return;const payload={...pendingImage,alt:$('#upload-alt').value.trim()};if(await mutate('uploadImage',payload,'画像を保存しました。企画の「企画画像」から選べます。')){pendingImage=null;renderMedia();}});
   const cancel=document.createElement('button');cancel.type='button';cancel.className='button button-secondary';cancel.textContent='取り消す';cancel.id='upload-cancel';cancel.onclick=()=>{if(!busy){dirty=false;renderMedia();}};$('#upload-submit').after(cancel);
  }catch(error){if(section==='media'&&request===imageRequest){$('#upload-preview').textContent='';$('#upload-error').textContent=error.message;dirty=false;}}
 });
}
function renderSettings(){
 const settings=data.settings;$('#admin-workspace').innerHTML=pageTitle('サイト設定','当日の開催情報と緊急告知を管理します。')+`<div class="settings-layout"><form id="settings-form" class="admin-panel settings-form">${field('eventDates','開催日','YYYY-MM-DD。複数日はカンマ区切りで入力します。',settings.eventDates,{required:true,maxLength:400})}${field('openTime','開場時刻','ヒーローの開催時間に表示します。',settings.openTime,{type:'time',required:true})}${field('closeTime','閉場時刻','開場時刻より後の時刻を入力してください。',settings.closeTime,{type:'time',required:true})}${field('admissionText','受付・入場案内','公開サイトのアクセス欄に表示します。',settings.admissionText,{type:'textarea'})}${field('emergencyText','緊急バナーの文面','全ページ最上部に表示します。300文字以内。',settings.emergencyText,{type:'textarea',maxLength:300})}${field('emergencyEnabled','緊急バナーを表示','文面を入力して、チェックを入れて保存すると表示されます。',settings.emergencyEnabled,{type:'checkbox'})}<button class="button" type="submit">運営設定を保存</button><p id="settings-error" class="form-error" role="alert"></p></form><div class="read-only-config"><h3>文面・フォント・デザインの変更</h3><p>サイトタイトル、テーマ文字、キャッチコピー、色、文字サイズ、余白、角丸、演出は <code>js/site-config.js</code> の定数で変更します。管理画面から基本デザインを書き換える操作はありません。</p><p class="connection-details">接続モード：${api.mode==='demo'?'Demo Provider':'Google Apps Script'}<br>${api.mode==='google'?'API URL：'+e(SITE_CONFIG.api.url):'API URLは未設定です。Google接続後にコード側で設定します。'}</p></div><section class="admin-panel"><h2>データのバックアップ</h2><p>現在の管理データをJSONとして保存できます。認証情報は含みません。</p><button id="export-data" class="button button-secondary">JSONをダウンロード</button></section></div>`;
 const form=$('#settings-form');trackSettingsForm(form,'full',settings);form.addEventListener('submit',async event=>{event.preventDefault();try{const values=validateSettings(readForm(form,settings));if(await mutate('saveSettings',values,'運営設定を保存しました')){clearEditorDraft(api.mode,'settings','full');renderSettings();}}catch(error){$('#settings-error').textContent=error.message;}});$('#export-data').addEventListener('click',()=>downloadJSON(data,'nankosai-backup-'+japanNow().date+'.json'));
}
function actionLabel(action){return {saveRecord:'保存',deleteRecord:'削除',updateCrowd:'混雑変更',saveSettings:'設定変更',uploadImage:'画像保存',deleteImage:'画像削除'}[action]||action;}
function renderAudit(){ $('#admin-workspace').innerHTML=pageTitle('変更履歴','いつ・何を変更したか確認できます。最新300件を表示します。')+`<div class="table-scroll"><table class="audit-table"><thead><tr><th>日時（日本時間）</th><th>操作</th><th>対象</th><th>内容</th></tr></thead><tbody>${data.audit.slice(0,300).map(item=>`<tr><td><time>${e(new Date(item.time).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}))}</time></td><td>${e(actionLabel(item.action))}</td><td>${e(menu.find(m=>m[0]===item.collection)?.[1]||item.collection)}</td><td>${e(item.detail)}</td></tr>`).join('')}</tbody></table></div>`; }
function render(){renderNav();({dashboard:renderDashboard,media:renderMedia,settings:renderSettings,audit:renderAudit}[section]||renderManagement)();}
async function enterAdmin(){await reload();$('#login-screen').hidden=true;$('#admin-shell').hidden=false;$('#provider-indicator').textContent=api.mode==='demo'?'デモモード':'Google接続';$('#admin-demo-note').hidden=api.mode!=='demo';const view=readStorage('admin-view',null,true);if(view&&(!view.provider||view.provider===api.mode)&&menu.some(item=>item[0]===view.section)){section=view.section;editingId=view.editingId||'';}if(editingId&&!items(section).some(item=>item.id===editingId)){editingId='';toast('前回の編集項目が見つからないため、新規作成を表示します。');}render();}
function rememberView(){try{writeStorage('admin-view',{section,editingId,provider:api.mode},true);}catch{}}
applySiteConfig();$('#password-field').hidden=api.mode==='demo';$('#admin-password').required=api.mode==='google';$('#login-button').textContent=api.mode==='demo'?'デモ管理を試す':'ログイン';$('#login-mode-note').textContent=api.mode==='demo'?'パスワード不要のデモです。このブラウザ内で編集を試せます。':'管理者パスワードはサーバー側で照合します。';
$('#login-form').addEventListener('submit',async event=>{event.preventDefault();$('#login-button').disabled=true;$('#login-error').textContent='';try{const session=await api.login($('#admin-password').value);writeStorage('session',{...session,provider:api.mode},true);$('#admin-password').value='';await enterAdmin();}catch(error){$('#login-error').textContent=error.message;}finally{$('#login-button').disabled=false;}});
$('#logout-button').addEventListener('click',async()=>{if(!requireLeave())return;try{await api.logout();}catch{}removeStorage('session',true);dirty=false;data=null;$('#admin-shell').hidden=true;$('#login-screen').hidden=false;toast('ログアウトしました');});
$('#admin-refresh').addEventListener('click',async()=>{if(!requireLeave())return;try{await reload();dirty=false;render();toast('最新情報を読み込みました');}catch(error){handleError(error);}});
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.section&&requireLeave()){section=button.dataset.section;editingId='';dirty=false;listQuery='';listStatus='';pendingImage=null;imageRequest++;rememberView();render();}
 if(button.dataset.editRecord&&requireLeave()){editingId=button.dataset.editRecord;dirty=false;rememberView();renderList();renderEditor();if(innerWidth<900)focusEditor();}
 if(button.dataset.openRecord&&requireLeave()){section=button.dataset.collection;editingId=button.dataset.openRecord;dirty=false;rememberView();render();if(innerWidth<900)focusEditor();}
 if(button.dataset.crowdId){if(dirty||busy){toast('編集中の内容を保存してから混雑状況を変更してください。',true);return;}const project=items('projects').find(p=>p.id===button.dataset.crowdId);if(!project||project.crowd===button.dataset.crowd)return;button.disabled=true;if(await mutate('updateCrowd',{collection:'projects',id:project.id,revision:project.revision,crowd:button.dataset.crowd},'混雑状況を更新しました'))render();else button.disabled=false;}
 if(button.dataset.copyMedia){try{await navigator.clipboard.writeText(button.dataset.copyMedia);toast('画像IDをコピーしました');}catch{toast('画像ID：'+button.dataset.copyMedia);}}
 if(button.dataset.deleteMedia){
  if(dirty||busy){toast('選択中の画像を保存するか、取り消してから削除してください。',true);return;}
  const image=items('media').find(item=>item.id===button.dataset.deleteMedia);if(!image)return;
  const explanation=api.mode==='demo'?'このブラウザの画像データを削除します。元の写真ファイルは削除しません。':'専用Google Driveフォルダの画像をゴミ箱へ移します。';
  if(confirm(`「${image.fileName}」を画像ライブラリから削除しますか？${explanation}`)&&await mutate('deleteImage',{id:image.id,revision:image.revision},'画像を削除しました'))renderMedia();
 }
});
document.addEventListener('keydown',event=>{if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='s'||$('#admin-shell').hidden)return;event.preventDefault();if(busy)return;$('#record-form,#settings-form,#emergency-form')?.requestSubmit();});
window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
if('ResizeObserver' in window)new ResizeObserver(entries=>document.documentElement.style.setProperty('--admin-nav-height',entries[0].contentRect.height+24+'px')).observe($('.admin-sidebar'));
const session=readStorage('session',null,true);if(session?.provider===api.mode&&Date.parse(session.expiresAt)>Date.now()){try{await enterAdmin();}catch(error){handleError(error);}}
