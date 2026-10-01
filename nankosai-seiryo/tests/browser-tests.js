import {api} from '../js/api.js';
import {SITE_CONFIG} from '../js/site-config.js';
import {writeStorage,readStorage} from '../js/storage.js';
import {prepareImage} from '../js/media.js';

let frame=document.querySelector('#frame');
const results=document.querySelector('#results'),prefix='nankosai-seiryo-v2:';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){const started=Date.now();while(!check()){if(Date.now()-started>10000)throw new Error('画面の更新がタイムアウト');await pause(50);}}
function report(label,passed,detail=''){
 const row=document.createElement('li');row.textContent=(passed?'PASS ':'FAIL ')+label+(detail?' / '+detail:'');row.className=passed?'pass':'fail';results.append(row);
 document.querySelector('#test-summary').textContent=`${results.querySelectorAll('.pass').length}件成功 / ${results.querySelectorAll('.fail').length}件失敗`;
}
async function check(label,operation){try{report(label,await operation());}catch(error){report(label,false,error.message);}}
async function load(path,width,allowLogin=false){
 // Recreating an iframe gives each scenario a clean document and leaves the tab's storage intact.
 const next=document.createElement('iframe');next.id='frame';next.title='検証対象';next.width=width;
 const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('画面読込がタイムアウト')),12000);next.onload=()=>{clearTimeout(timer);resolve();};});
 next.src=new URL(path,location.href);frame.replaceWith(next);frame=next;await ready;
 const doc=frame.contentDocument;
 await until(()=>path.includes('admin')?(allowLogin||!doc.querySelector('#admin-shell').hidden):doc.querySelector('#project-grid .project-card'));
 return doc;
}
function edit(doc,selector,value){const input=doc.querySelector(selector);input.value=value;input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));if(input.tagName==='SELECT')input.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));}
const savedKeys=storage=>Object.fromEntries(Object.keys(storage).filter(key=>key.startsWith(prefix)).map(key=>[key,storage.getItem(key)]));
function restore(storage,snapshot){for(const key of Object.keys(storage))if(key.startsWith(prefix))storage.removeItem(key);for(const [key,value] of Object.entries(snapshot))storage.setItem(key,value);}
document.querySelector('#show').onclick=()=>load(document.querySelector('#preview-page').value,Number(document.querySelector('#preview').value),true);
document.querySelector('#run').onclick=async()=>{
 if(SITE_CONFIG.api.url){report('本番APIでは書込検証を実行しません',false);return;}
 const button=document.querySelector('#run');button.disabled=true;results.replaceChildren();
 const localSnapshot=savedKeys(localStorage),sessionSnapshot=savedKeys(sessionStorage);
 try{
  const seed=await(await fetch(new URL('../data/demo.json',import.meta.url))).json();
  restore(sessionStorage,{});writeStorage('database',seed);writeStorage('favorites',[]);
  writeStorage('session',{...await api.login(),provider:api.mode},true);
  for(const width of [320,375,390,768,1440]){
   const doc=await load('../index.html',width);
   report('公開画面 '+width+'px 横はみ出しなし',doc.documentElement.scrollWidth<=width+1);
   report('公開画面 '+width+'px 8企画描画',doc.querySelectorAll('#project-grid .project-card').length===8);
   report('公開画面 '+width+'px CSS読込',frame.contentWindow.getComputedStyle(doc.querySelector('.hero')).position==='relative');
  }
  let doc=await load('../index.html',375);
  await check('全角・複数語検索で企画を絞り込める',()=>{edit(doc,'#project-search','２年３組 深海');return doc.querySelectorAll('#project-grid .project-card').length===1;});
  await check('絞り込み中の条件が見え、1操作で解除できる',()=>{const visible=!doc.querySelector('#active-filters').hidden;doc.querySelector('#active-filters [data-reset-filters]').click();return visible&&doc.querySelectorAll('#project-grid .project-card').length===8;});
  await check('企画名を押して詳細を開ける',()=>{doc.querySelector('#project-grid [data-project="brass"]').click();return doc.querySelector('#project-dialog').open;});
  await check('詳細の開催回が重複しない',()=>doc.querySelectorAll('.detail-slot').length===2);
  await check('詳細から正しいフロアの地図へ移動できる',()=>{doc.querySelector('#project-detail [data-show-location="gym"]').click();return !doc.querySelector('#project-dialog').open&&doc.querySelector('#location-detail h3').textContent==='体育館'&&doc.querySelector('[data-floor="1F"]').getAttribute('aria-pressed')==='true';});
  await check('選択した部屋をSVGでも強調する',async()=>{await until(()=>doc.querySelector('#floor-map').contentDocument?.querySelector('[data-location="gym"]')?.classList.contains('selected-room'));return true;});
  await check('お気に入りが日別の予定になる',()=>{doc.querySelector('#project-grid [data-favorite="deep"]').click();return doc.querySelectorAll('.plan-row').length===1&&doc.querySelector('#favorite-count').textContent==='1';});
  await check('両日の予定をまとめて見られる',()=>{const checkbox=doc.querySelector('#plan-all-dates');checkbox.click();return doc.querySelectorAll('.plan-row').length===2;});
  await check('開催日を変えると予定・時刻表・企画がそろう',()=>{edit(doc,'#plan-date','2027-07-11');return ['#plan-date','#project-date','#schedule-date'].every(selector=>doc.querySelector(selector).value==='2027-07-11');});
  await check('公演の重なりを予定に表示する',()=>{doc.querySelector('#project-grid [data-favorite="live"]').click();doc.querySelector('#project-grid [data-favorite="dance"]').click();return !doc.querySelector('#plan-conflicts').hidden&&doc.querySelector('#my-plan-list').textContent.includes('重なっています');});
  await check('サンプル時刻の開催中表示が動く',()=>{edit(doc,'#demo-time','11:25');doc.querySelector('#demo-clock-toggle').click();return doc.querySelector('#live-list').textContent.includes('SUMMER LIVE')&&doc.querySelector('#live-list').textContent.includes('ダンス');});
  await check('更新してもキーボードのフォーカスを保つ',async()=>{const favorite=doc.querySelector('#project-grid [data-favorite="deep"]');favorite.focus();doc.querySelector('#refresh-data').click();await until(()=>!doc.querySelector('#refresh-data').disabled);return doc.activeElement===favorite;});
  for(const width of [320,375,768,1440]){
   removeAdminView();const admin=await load('../admin.html',width);
   report('管理画面 '+width+'px ダッシュボード表示',admin.querySelectorAll('.metric-card').length===5);
   report('管理画面 '+width+'px 横はみ出しなし',admin.documentElement.scrollWidth<=width+1);
  }
  removeAdminView();doc=await load('../admin.html',320);doc.querySelector('[data-section="projects"]').click();
  await check('管理検索でも全角のクラス名を使える',()=>{edit(doc,'#admin-search','２年３組');return doc.querySelectorAll('.record-row').length===1;});
  edit(doc,'#admin-search','');
  await check('新規作成を保存済みと誤表示しない',()=>doc.querySelector('#dirty-indicator').textContent.includes('まだ保存'));
  await check('未完成の下書きを名前だけで保存できる',async()=>{edit(doc,'#field-title','QA 名前だけの下書き');doc.querySelector('#save-record').click();report('保存中の二重操作・入力変更を止める',doc.querySelector('#save-record').disabled&&doc.querySelector('#field-title').disabled&&doc.querySelector('#save-record').textContent==='保存中…');await until(()=>doc.querySelector('.editor-heading p')?.textContent==='QA 名前だけの下書き'&&!doc.querySelector('#save-record').disabled);return doc.querySelector('#field-organization').value===''&&readStorage('database').projects.some(item=>item.title==='QA 名前だけの下書き'&&item.status==='draft');});
  await check('下書きが来場者へ公開されない',async()=>!(await api.getPublic()).projects.some(item=>item.title==='QA 名前だけの下書き'));
  const draftId=readStorage('admin-view',null,true).editingId;
  edit(doc,'#field-description','QA 入力途中の説明');doc=await load('../admin.html',320);
  await check('入力途中の企画を再表示すると復元できる',()=>doc.querySelector('#field-description').value==='QA 入力途中の説明'&&doc.querySelector('.draft-recovery').textContent.includes('復元しました'));
  await check('公開時には必須項目の不足を止める',()=>{edit(doc,'#field-status','published');return !doc.querySelector('#record-form').checkValidity()&&doc.querySelector('#field-organization').required;});
  edit(doc,'#field-status','draft');doc.querySelector('#save-record').click();await until(()=>!doc.querySelector('#save-record').disabled&&doc.querySelector('#dirty-indicator').textContent==='保存済み');
  await check('スマホ編集中も保存ボタンを追従させる',async()=>{doc.querySelector('#field-description').scrollIntoView({block:'center'});await until(()=>{const box=doc.querySelector('.editor-save-bar').getBoundingClientRect(),sidebar=doc.querySelector('.admin-sidebar').getBoundingClientRect();return box.top>=sidebar.bottom-2&&box.bottom<frame.contentWindow.innerHeight;});return frame.contentWindow.getComputedStyle(doc.querySelector('.editor-save-bar')).position==='sticky';});
  await check('高さ480pxでも入力欄と保存操作を確保する',async()=>{frame.style.height='480px';doc.querySelector('#field-description').scrollIntoView({block:'center'});await until(()=>{const box=doc.querySelector('.editor-save-bar').getBoundingClientRect();return box.top>=0&&box.bottom<200;});return frame.contentWindow.getComputedStyle(doc.querySelector('.admin-sidebar')).position==='relative';});frame.style.height='850px';
  await check('管理フォームも320pxで横にあふれない',()=>doc.documentElement.scrollWidth<=321);
  doc.querySelector('[data-section="schedule"]').click();edit(doc,'#field-projectId','brass');
  await check('関連企画から新規イベントを入力できる',()=>doc.querySelector('#field-title').value==='吹奏楽部ステージ'&&doc.querySelector('#field-locationId').value==='gym');
  // Clear the test-only draft by saving; the database and temporary storage are restored in finally.
  doc.querySelector('#save-record').click();await until(()=>!doc.querySelector('#save-record').disabled&&doc.querySelector('#dirty-indicator').textContent==='保存済み');
  doc.querySelector('[data-section="dashboard"]').click();edit(doc,'[name=emergencyText]','QA 雨天のため屋外企画は中止');doc.querySelector('[name=emergencyEnabled]').click();doc.querySelector('#emergency-form button[type=submit]').click();
  await until(()=>readStorage('database').settings.emergencyEnabled===true);
  doc=await load('../index.html',375);
  await check('緊急バナーが公開画面にも反映する',()=>!doc.querySelector('#emergency-banner').hidden&&doc.querySelector('#emergency-banner').textContent.includes('雨天'));
  let admin=await api.getAdmin(),project=admin.projects.find(item=>item.id==='sky');
  await api.mutate('updateCrowd',{collection:'projects',id:project.id,revision:project.revision,crowd:'quiet'});
  await check('混雑更新が公開データに反映する',async()=>(await api.getPublic()).projects.find(item=>item.id==='sky').crowd==='quiet');
  await check('古いrevisionでの上書きを拒否する',async()=>{try{await api.mutate('updateCrowd',{collection:'projects',id:project.id,revision:project.revision,crowd:'busy'});return false;}catch(error){return error.code==='CONFLICT';}});
  const event=admin.schedule.find(item=>item.id==='brass_2027-07-10');
  await api.mutate('saveRecord',{collection:'schedule',record:{...event,start:'13:00',end:'13:40',locationId:'music'}});
  writeStorage('public-view',{date:'2027-07-10',floor:'1F'},true);doc=await load('../index.html',375);
  await check('変更した時間・場所が企画カードへ反映する',()=>{const card=doc.querySelector('#project-grid [data-project="brass"]').closest('article');return card.textContent.includes('13:00')&&card.textContent.includes('音楽室');});
  doc.querySelector('#project-grid [data-project="brass"]').click();doc.querySelector('#project-detail [data-show-location="music"]').click();
  await check('変更後の会場へ詳細から移動できる',()=>doc.querySelector('[data-floor="3F"]').getAttribute('aria-pressed')==='true'&&doc.querySelector('#location-detail h3').textContent.includes('音楽室'));
  admin=await api.getAdmin();const updated=admin.schedule.find(item=>item.id===event.id);await api.mutate('saveRecord',{collection:'schedule',record:{...updated,cancelled:true}});doc=await load('../index.html',375);
  await check('中止は企画カード・時刻表の両方へ反映する',()=>doc.querySelector('#project-grid [data-project="brass"]').closest('article').textContent.includes('中止')&&doc.querySelector('#timeline').textContent.includes('中止'));
  await check('大きい写真を1600px・2MB以内へ圧縮する',async()=>{const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1800;const context=canvas.getContext('2d');context.fillStyle='#68b6c4';context.fillRect(0,0,2400,1800);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const prepared=await prepareImage(new File([blob],'qa-photo.png',{type:'image/png'}));return prepared.width===1600&&prepared.height===1200&&prepared.bytes<2000000&&prepared.mimeType==='image/jpeg';});
  removeAdminView();doc=await load('../admin.html',375);doc.querySelector('[data-section="media"]').click();
  const iconBlob=await(await fetch(new URL('../assets/icon-512.png',location.href))).blob();
  const selectImage=name=>{const transfer=new DataTransfer();transfer.items.add(new File([iconBlob],name,{type:'image/png'}));const input=doc.querySelector('#image-file');input.files=transfer.files;input.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));};
  await check('画像の選択を取り消せる',async()=>{selectImage('qa-cancel.png');await until(()=>doc.querySelector('#upload-cancel'));doc.querySelector('#upload-cancel').click();return !doc.querySelector('#upload-submit')&&doc.querySelector('#image-file').files.length===0;});
  await check('連続選択では最後の画像だけを採用する',async()=>{selectImage('qa-first.png');selectImage('qa-last.png');await until(()=>doc.querySelector('#upload-submit'));return doc.querySelector('#upload-preview').textContent.includes('qa-last.jpg')&&!doc.querySelector('#upload-preview').textContent.includes('qa-first.jpg');});
  edit(doc,'#upload-alt','QA 清涼アイコン');doc.querySelector('#upload-submit').click();await until(()=>doc.querySelector('.media-grid').textContent.includes('qa-last.jpg'));
  const uploaded=readStorage('database').media.find(item=>item.fileName==='qa-last.jpg');
  await check('管理画面から画像を圧縮して保存できる',()=>uploaded.provider==='demo'&&uploaded.revision===1&&uploaded.mimeType==='image/jpeg'&&uploaded.alt==='QA 清涼アイコン');
  doc.querySelector('[data-section="projects"]').click();edit(doc,'#field-title','QA 画像付き企画');edit(doc,'#field-mediaId',uploaded.id);
  await check('アップロードした画像を企画プレビューへ設定できる',()=>doc.querySelector('#record-preview img').src.startsWith('data:image/jpeg;base64,'));
  doc.querySelector('#save-record').click();await until(()=>doc.querySelector('#dirty-indicator').textContent==='保存済み');const imageProjectId=readStorage('admin-view',null,true).editingId;
  doc.querySelector('[data-section="media"]').click();
  await check('使用中の画像を削除するボタンは無効になる',()=>doc.querySelector(`[data-delete-media="${uploaded.id}"]`).disabled);
  await check('APIでも使用中の画像を保護する',async()=>{try{await api.mutate('deleteImage',{id:uploaded.id,revision:uploaded.revision});return false;}catch(error){return error.code==='IN_USE';}});
  doc.querySelector('[data-section="projects"]').click();doc.querySelector(`[data-edit-record="${imageProjectId}"]`).click();edit(doc,'#field-mediaId','');doc.querySelector('#save-record').click();await until(()=>doc.querySelector('#dirty-indicator').textContent==='保存済み');doc.querySelector('[data-section="media"]').click();
  await check('未使用のテスト画像を削除して保存容量を空ける',async()=>{const confirmation=frame.contentWindow.confirm;frame.contentWindow.confirm=message=>message.includes('qa-last.jpg');try{doc.querySelector(`[data-delete-media="${uploaded.id}"]`).click();await until(()=>!doc.querySelector(`[data-delete-media="${uploaded.id}"]`));const removed=readStorage('database').media.find(item=>item.id===uploaded.id);return !!removed.deletedAt&&removed.url==='';}finally{frame.contentWindow.confirm=confirmation;}});
  await check('PWAの登録先がこのサブディレクトリに限定される',async()=>{const registrations=await navigator.serviceWorker.getRegistrations();return registrations.some(registration=>registration.scope===new URL('../',location.href).href);});
  await check('最新版のPWAに追加JSと両画面のCSSを保存する',async()=>{const source=await(await fetch(new URL('../sw.js',location.href),{cache:'no-store'})).text(),version=source.match(/CACHE_NAME = CACHE_PREFIX \+ '([^']+)'/)[1],name='nankosai-seiryo:'+version;const registrations=await navigator.serviceWorker.getRegistrations(),registration=registrations.find(item=>item.scope===new URL('../',location.href).href);await registration.update();await until(()=>registration.waiting?.state==='installed'||registration.active?.state==='activated');const assets=['js/dom.js','js/editor-storage.js','js/festival-data.js','css/public.css','css/admin.css'];let present=false;for(let attempt=0;attempt<40&&!present;attempt++){const cache=await caches.open(name),saved=await Promise.all(assets.map(asset=>cache.match(new URL('../'+asset,location.href))));present=saved.every(Boolean);if(!present)await pause(100);}return present;});
  await check('静的資材に404がない',async()=>{const resources=['../index.html','../admin.html','../manifest.webmanifest','../sw.js','../js/dom.js','../js/editor-storage.js','../js/festival-data.js','../css/public.css','../css/admin.css','../assets/maps/1F.svg','../assets/maps/2F.svg','../assets/maps/3F.svg'];const statuses=await Promise.all(resources.map(async path=>(await fetch(new URL(path,location.href),{cache:'no-store'})).ok));return statuses.every(Boolean);});
  await check('削除済みの企画を古い編集画面で復活させない',async()=>{const record=(await api.getAdmin()).projects.find(item=>item.id===draftId);await api.mutate('deleteRecord',{collection:'projects',id:record.id,revision:record.revision});try{await api.mutate('saveRecord',{collection:'projects',record});return false;}catch(error){return error.code==='NOT_FOUND';}});
 }catch(error){report('検証の継続',false,error.message);}
 finally{restore(localStorage,localSnapshot);restore(sessionStorage,sessionSnapshot);button.disabled=false;await load('../index.html',375);}
};
function removeAdminView(){sessionStorage.removeItem(prefix+'admin-view');}
