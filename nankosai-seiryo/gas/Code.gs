/** 南高祭 清涼 CMS API v2. Secrets and resource IDs live in Script Properties. */
const SCHEMAS = {
 settings:['key','value'],
 projects:['id','title','organization','group','category','locationId','dates','start','end','description','mediaId','crowd','featured','status','revision','updatedAt','deletedAt'],
 news:['id','title','body','important','status','publishAt','revision','updatedAt','deletedAt'],
 schedule:['id','title','projectId','date','start','end','locationId','category','status','cancelled','revision','updatedAt','deletedAt'],
 locations:['id','name','floor','description','status','revision','updatedAt','deletedAt'],
 media:['id','fileName','fileId','provider','url','alt','mimeType','width','height','bytes','uploadedAt','revision','updatedAt','deletedAt'],
 audit:['id','time','action','collection','recordId','detail']
};
const EDITABLE_COLLECTIONS = ['projects','news','schedule','locations'];
const SESSION_TTL = 14400;
const SETTINGS_KEYS = ['eventDates','openTime','closeTime','admissionText','emergencyEnabled','emergencyText','emergencyKind','revision'];

function doGet(event) {
 try {
  if(String(event && event.parameter && event.parameter.action || 'bootstrap')!=='bootstrap')return failure_('BAD_ACTION','公開APIの操作が不正です。');
  const cache=CacheService.getScriptCache(),cached=cache.get('public-v2');
  if(cached)return json_({ok:true,data:JSON.parse(cached)});
  const data=bootstrap_(false);data.source='google';data.fetchedAt=new Date().toISOString();
  try {cache.put('public-v2',JSON.stringify(data),15);}catch(ignore){}
  return json_({ok:true,data:data});
 }catch(error){return reportError_(error);}
}
function doPost(event) {
 try {
  const params=event && event.parameter || {};
  const raw=String(params.payload||'{}');if(raw.length>3000000)throw apiError_('TOO_LARGE','送信データが大きすぎます。');
  const payload=JSON.parse(raw),action=String(params.action||'');
  if(action==='login')return json_({ok:true,data:login_(String(payload.password||''))});
  const token=String(params.token||'');requireSession_(token);
  if(action==='logout'){CacheService.getScriptCache().remove('session:'+sha256_(token));return json_({ok:true,data:{loggedOut:true}});}
  if(action==='adminBootstrap')return json_({ok:true,data:bootstrap_(true)});
  if(!['saveRecord','deleteRecord','updateCrowd','saveSettings','uploadImage','deleteImage'].includes(action))throw apiError_('BAD_ACTION','許可されていない操作です。');
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw apiError_('BUSY','他の保存処理が実行中です。少し待って再操作してください。');
  try {
   // Idempotency prevents duplicated uploads/saves after an ambiguous connection failure.
   const requestId=String(params.requestId||'');if(!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))throw apiError_('BAD_INPUT','リクエストIDが不正です。');
   const cache=CacheService.getScriptCache(),key='request:'+sha256_(token+requestId),previous=cache.get(key);if(previous)return json_({ok:true,data:JSON.parse(previous)});
   let result;
   if(action==='saveSettings')result=saveSettings_(payload);
   else if(action==='uploadImage')result=uploadImage_(payload);
   else if(action==='deleteImage')result=deleteImage_(payload);
   else if(action==='deleteRecord')result=deleteRecord_(payload);
   else if(action==='updateCrowd')result=updateCrowd_(payload);
   else result=saveRecord_(payload.collection,payload.record);
   cache.remove('public-v2');try{cache.put(key,JSON.stringify(result),600);}catch(ignore){}
   return json_({ok:true,data:result});
  }finally{lock.releaseLock();}
 }catch(error){return reportError_(error);}
}
function setupSheets() {
 const properties=PropertiesService.getScriptProperties();let id=properties.getProperty('SPREADSHEET_ID');
 if(!id){const created=SpreadsheetApp.create('南高祭 清涼 CMS');id=created.getId();properties.setProperty('SPREADSHEET_ID',id);}
 const spreadsheet=SpreadsheetApp.openById(id);spreadsheet.setSpreadsheetTimeZone('Asia/Tokyo');
 Object.keys(SCHEMAS).forEach(name=>{
  const headers=SCHEMAS[name],sheet=spreadsheet.getSheetByName(name)||spreadsheet.insertSheet(name);
  if(sheet.getLastRow()===0)sheet.getRange(1,1,1,headers.length).setValues([headers]);
  else {const existing=sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];if(existing.join('|')!==headers.join('|'))throw new Error(name+' の列が想定と異なります。データを保護するため停止しました。');}
  sheet.setFrozenRows(1);sheet.getRange(1,1,1,headers.length).setBackground('#163e48').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setColumnWidths(1,headers.length,170);
 });
 const sheet=spreadsheet.getSheetByName('settings');
 if(sheet.getLastRow()===1)sheet.getRange(2,1,8,2).setValues([['eventDates','2027-07-10,2027-07-11'],['openTime','09:00'],['closeTime','16:00'],['admissionText','正式案内をご確認ください。'],['emergencyEnabled','false'],['emergencyText',''],['emergencyKind','warning'],['revision','1']]);
 if(!properties.getProperty('DRIVE_FOLDER_ID'))properties.setProperty('DRIVE_FOLDER_ID',DriveApp.createFolder('南高祭 清涼 企画画像').getId());
 Logger.log('Spreadsheet: '+spreadsheet.getUrl());Logger.log('Folder: https://drive.google.com/drive/folders/'+properties.getProperty('DRIVE_FOLDER_ID'));
}
/** Run from the editor: password is prompted, never put it in source or logs. */
function setAdminPassword(password) {
 if(!password){const response=SpreadsheetApp.getUi().prompt('管理者パスワード','12文字以上の固有のパスワードを入力してください。',SpreadsheetApp.getUi().ButtonSet.OK_CANCEL);if(response.getSelectedButton()!==SpreadsheetApp.getUi().Button.OK)return;password=response.getResponseText();}
 if(typeof password!=='string'||password.length<12||password.length>128)throw new Error('12〜128文字のパスワードを使用してください。');
 const props=PropertiesService.getScriptProperties(),salt=Utilities.getUuid()+Utilities.getUuid();
 props.setProperties({ADMIN_PASSWORD_SALT:salt,ADMIN_PASSWORD_HASH:passwordHash_(password,salt),AUTH_VERSION:Utilities.getUuid()});
 Logger.log('管理者パスワードを設定しました。既存セッションは無効になります。');
}
function onOpen(){SpreadsheetApp.getUi().createMenu('南高祭CMS').addItem('シートと画像フォルダを準備','setupSheets').addItem('管理者パスワードを設定','setAdminPassword').addToUi();}
function spreadsheet_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw apiError_('NOT_CONFIGURED','APIの初期設定が完了していません。');return SpreadsheetApp.openById(id);}
function readRecords_(name) {
 if(!SCHEMAS[name])throw apiError_('BAD_COLLECTION','操作対象が不正です。');
 const sheet=spreadsheet_().getSheetByName(name);if(!sheet)throw apiError_('NOT_CONFIGURED','必要なシートがありません。setupSheetsを実行してください。');
 if(sheet.getLastRow()<2)return [];
 const rows=sheet.getRange(2,1,sheet.getLastRow()-1,SCHEMAS[name].length).getDisplayValues();
 return rows.filter(row=>row[0]).map(row=>{const record={};SCHEMAS[name].forEach((key,index)=>{record[key]=row[index];if(['featured','important','cancelled'].includes(key))record[key]=bool_(row[index]);if(['revision','width','height','bytes'].includes(key))record[key]=Number(row[index]||0);});return record;});
}
function settings_(){const values={};readRecords_('settings').forEach(row=>{if(SETTINGS_KEYS.includes(row.key))values[row.key]=row.value;});values.emergencyEnabled=bool_(values.emergencyEnabled);values.revision=Number(values.revision||1);return values;}
function bootstrap_(admin) {
 const data={schemaVersion:2,settings:settings_()};
 EDITABLE_COLLECTIONS.forEach(collection=>data[collection]=readRecords_(collection).filter(item=>!item.deletedAt&&(admin||item.status==='published')));
 if(!admin)data.news=data.news.filter(item=>!item.publishAt||item.publishAt<=new Date().toISOString());
 data.media=readRecords_('media').filter(item=>!item.deletedAt);
 if(admin)data.audit=readRecords_('audit').reverse().slice(0,300);
 else {const used={};data.projects.forEach(item=>used[item.mediaId]=true);data.media=data.media.filter(item=>used[item.id]);}
 return data;
}
function safeCell_(value){const text=typeof value==='boolean'?String(value):String(value==null?'':value);return /^[=+@\-]/.test(text)?"'"+text:text;}
function writeRecord_(name,record) {
 const sheet=spreadsheet_().getSheetByName(name),ids=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).getDisplayValues():[],index=ids.findIndex(row=>row[0]===record.id),row=SCHEMAS[name].map(key=>safeCell_(record[key]));
 if(index>=0)sheet.getRange(index+2,1,1,row.length).setValues([row]);else sheet.appendRow(row);
 return record;
}
function validCollection_(name){if(!EDITABLE_COLLECTIONS.includes(name))throw apiError_('BAD_COLLECTION','許可されていないデータです。');return name;}
function existing_(name,id){return readRecords_(validCollection_(name)).find(item=>item.id===id&&!item.deletedAt);}
function checkRevision_(existing,revision){if(existing&&Number(existing.revision)!==Number(revision))throw apiError_('CONFLICT','別の管理者が更新しました。最新情報を読み込んで保存し直してください。');}
function validateRecord_(name,input) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw apiError_('BAD_INPUT','入力が不正です。');
 const record={};SCHEMAS[name].forEach(key=>{if(key in input)record[key]=input[key];});
 record.status=record.status||'draft';if(!['draft','published'].includes(record.status))throw apiError_('BAD_INPUT','公開状態が不正です。');
 const required=record.status==='draft'?[name==='locations'?'name':'title']:name==='locations'?['name','floor']:name==='news'?['title','body','publishAt']:name==='schedule'?['title','date','start','end','locationId','category']:['title','organization','group','category','locationId','dates','start','end','description'];
 required.forEach(key=>{if(!String(record[key]||'').trim())throw apiError_('BAD_INPUT','必須項目を入力してください。');});
 Object.keys(record).forEach(key=>{if(typeof record[key]==='string'){record[key]=record[key].trim();if(record[key].length>(['body','description'].includes(key)?4000:500))throw apiError_('BAD_INPUT','入力が長すぎます。');}});
 if(record.id&&!/^[a-zA-Z0-9_-]{1,100}$/.test(record.id))throw apiError_('BAD_INPUT','IDが不正です。');
 if((record.start&&!validTime_(record.start))||(record.end&&!validTime_(record.end))||(record.start&&record.end&&record.start>=record.end))throw apiError_('BAD_INPUT','開始・終了時刻を確認してください。');
 const dates=record.dates?String(record.dates).split(','):record.date?[record.date]:[];if(dates.length>30||dates.some(date=>!validDate_(date.trim())))throw apiError_('BAD_INPUT','日付を確認してください。');
 if(record.locationId&&!readRecords_('locations').some(item=>item.id===record.locationId&&!item.deletedAt&&(record.status!=='published'||item.status==='published')))throw apiError_('BAD_INPUT','公開中の場所を選択してください。');
 if(record.dates)record.dates=[...new Set(dates.map(date=>date.trim()))].join(',');
 if(name==='locations'&&record.floor&&!['1F','2F','3F'].includes(record.floor))throw apiError_('BAD_INPUT','フロアが不正です。');
 if(name==='projects'){record.crowd=record.crowd||'normal';if(!['quiet','normal','busy'].includes(record.crowd))throw apiError_('BAD_INPUT','混雑状況が不正です。');}
 if(record.mediaId&&!readRecords_('media').some(item=>item.id===record.mediaId&&!item.deletedAt))throw apiError_('BAD_INPUT','画像が見つかりません。');
 if(record.projectId&&!readRecords_('projects').some(item=>item.id===record.projectId&&!item.deletedAt&&(record.status!=='published'||item.status==='published')))throw apiError_('BAD_INPUT','関連する公開中企画を選択してください。');
 if(record.publishAt&&(!/^\d{4}-\d{2}-\d{2}T/.test(record.publishAt)||isNaN(Date.parse(record.publishAt))))throw apiError_('BAD_INPUT','公開日時が不正です。');
 if(record.publishAt)record.publishAt=new Date(record.publishAt).toISOString();
 if(record.id&&record.status==='draft'){
  const references=name==='locations'?readRecords_('projects').concat(readRecords_('schedule')).filter(item=>item.locationId===record.id):name==='projects'?readRecords_('schedule').filter(item=>item.projectId===record.id):[];
  if(references.some(item=>item.status==='published'&&!item.deletedAt))throw apiError_('IN_USE','公開中の企画・時刻表で使用しています。関連項目を先に下書きへ戻してください。');
 }
 ['featured','important','cancelled'].forEach(key=>{if(key in record)record[key]=bool_(record[key]);});return record;
}
function saveRecord_(name,input) {
 validCollection_(name);const record=validateRecord_(name,input),existing=record.id?existing_(name,record.id):null;
 if(record.id&&!existing)throw apiError_('NOT_FOUND','対象が削除されています。新規作成してください。');
 checkRevision_(existing,record.revision);record.id=record.id||name+'_'+Utilities.getUuid();record.revision=Number(existing&&existing.revision||0)+1;record.updatedAt=new Date().toISOString();record.deletedAt='';
 writeRecord_(name,record);audit_('saveRecord',name,record.id,record.title||record.name);return record;
}
function updateCrowd_(payload){if(payload.collection!=='projects'||!['quiet','normal','busy'].includes(payload.crowd))throw apiError_('BAD_INPUT','混雑変更の入力が不正です。');const record=existing_('projects',payload.id);if(!record)throw apiError_('NOT_FOUND','企画が見つかりません。');checkRevision_(record,payload.revision);record.crowd=payload.crowd;record.revision++;record.updatedAt=new Date().toISOString();writeRecord_('projects',record);audit_('updateCrowd','projects',record.id,record.title+' / '+payload.crowd);return record;}
function deleteRecord_(payload){const name=validCollection_(payload.collection),record=existing_(name,payload.id);if(!record)throw apiError_('NOT_FOUND','対象が見つかりません。');checkRevision_(record,payload.revision);
 if(name==='locations'&&['projects','schedule'].some(collection=>readRecords_(collection).some(item=>!item.deletedAt&&item.locationId===record.id)))throw apiError_('IN_USE','企画や時刻表で使用している場所は削除できません。');
 if(name==='projects'&&readRecords_('schedule').some(item=>!item.deletedAt&&item.projectId===record.id))throw apiError_('IN_USE','関連する時刻表を削除または関連なしにしてから企画を削除してください。');
 record.deletedAt=new Date().toISOString();record.revision++;writeRecord_(name,record);audit_('deleteRecord',name,record.id,record.title||record.name);return record;
}
function saveSettings_(payload){const current=settings_();checkRevision_(current,payload.revision);const result={};SETTINGS_KEYS.forEach(key=>{result[key]=key in payload?payload[key]:current[key];});
 const dates=String(result.eventDates||'').split(',').map(date=>date.trim());
 if(!dates.length||dates.length>30||!dates.every(validDate_)||!validTime_(result.openTime)||!validTime_(result.closeTime)||result.openTime>=result.closeTime)throw apiError_('BAD_INPUT','開催日・開場・閉場時刻を確認してください。');
 result.eventDates=[...new Set(dates)].join(',');
 result.emergencyEnabled=bool_(result.emergencyEnabled);result.emergencyText=String(result.emergencyText||'').trim();result.admissionText=String(result.admissionText||'').trim();
 if(result.emergencyText.length>300||result.admissionText.length>4000||(result.emergencyEnabled&&!result.emergencyText))throw apiError_('BAD_INPUT','案内文を確認してください。');
 result.revision=current.revision+1;const sheet=spreadsheet_().getSheetByName('settings'),records=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).getDisplayValues():[];
 SETTINGS_KEYS.forEach(key=>{const index=records.findIndex(item=>item[0]===key);if(index>=0)sheet.getRange(index+2,2).setValue(safeCell_(result[key]));else sheet.appendRow([key,safeCell_(result[key])]);});audit_('saveSettings','settings','','運営設定・緊急告知');return result;
}
function uploadImage_(payload){
 const match=String(payload.dataUrl||'').match(/^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/);if(!match)throw apiError_('BAD_IMAGE','JPEG・PNG・WebP画像を送信してください。');
 const bytes=Utilities.base64Decode(match[2]);if(bytes.length>2000000||bytes.length<12)throw apiError_('TOO_LARGE','画像は2MB以下にしてください。');
 const unsigned=bytes.slice(0,12).map(value=>(value+256)%256),jpeg=unsigned[0]===255&&unsigned[1]===216&&unsigned[2]===255,png=unsigned.slice(0,8).join(',')==='137,80,78,71,13,10,26,10',webp=unsigned.slice(0,4).join(',')==='82,73,70,70'&&unsigned.slice(8,12).join(',')==='87,69,66,80';
 if(!((match[1]==='image/jpeg'&&jpeg)||(match[1]==='image/png'&&png)||(match[1]==='image/webp'&&webp)))throw apiError_('BAD_IMAGE','画像の実際の形式が一致しません。');
 const folderId=PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');if(!folderId)throw apiError_('NOT_CONFIGURED','画像フォルダが未設定です。');
 const extension=match[1].split('/')[1],fileName=Date.now()+'_'+String(payload.fileName||'image').replace(/[^\w.\-ぁ-んァ-ヶ一-龠]/g,'_').slice(0,120).replace(/\.[^.]+$/,'')+'.'+extension;
 let file;
 try{file=DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes,match[1],fileName));file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
 const record={id:'media_'+Utilities.getUuid(),fileName:fileName,fileId:file.getId(),provider:'drive',url:'',alt:String(payload.alt||'').slice(0,200),mimeType:match[1],width:Math.max(0,Math.min(1600,Number(payload.width)||0)),height:Math.max(0,Math.min(1600,Number(payload.height)||0)),bytes:bytes.length,uploadedAt:new Date().toISOString(),revision:1,updatedAt:new Date().toISOString(),deletedAt:''};writeRecord_('media',record);audit_('uploadImage','media',record.id,fileName);return record;
 }catch(error){if(file)try{file.setTrashed(true);}catch(ignore){}throw apiError_('UPLOAD_FAILED','画像を保存できません。Driveの権限・共有設定・容量を確認してください。');}
}
function deleteImage_(payload){
 const record=readRecords_('media').find(item=>item.id===payload.id&&!item.deletedAt);
 if(!record)throw apiError_('NOT_FOUND','画像が見つかりません。');checkRevision_(record,payload.revision);
 if(record.provider!=='drive'||!record.fileId)throw apiError_('BAD_INPUT','標準画像は削除できません。');
 if(readRecords_('projects').some(project=>project.mediaId===record.id&&!project.deletedAt))throw apiError_('IN_USE','企画で使用中の画像です。企画の画像を変更してから削除してください。');
 const folderId=PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');if(!folderId)throw apiError_('NOT_CONFIGURED','画像フォルダが未設定です。');
 const file=DriveApp.getFileById(record.fileId),parents=file.getParents();let belongs=false;
 while(parents.hasNext())if(parents.next().getId()===folderId)belongs=true;
 if(!belongs)throw apiError_('BAD_INPUT','専用画像フォルダ以外のファイルは操作できません。');
 file.setTrashed(true);record.deletedAt=new Date().toISOString();record.revision++;record.updatedAt=record.deletedAt;
 writeRecord_('media',record);audit_('deleteImage','media',record.id,record.fileName);return record;
}
function login_(password){
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw apiError_('BUSY','ログイン処理中です。少し待ってください。');
 try {
  const props=PropertiesService.getScriptProperties(),cache=CacheService.getScriptCache(),hash=props.getProperty('ADMIN_PASSWORD_HASH'),salt=props.getProperty('ADMIN_PASSWORD_SALT');
  if(!hash||!salt)throw apiError_('NOT_CONFIGURED','管理者パスワードが未設定です。');
  const attempts=Number(cache.get('login-failures')||0);if(attempts>=10)throw apiError_('RATE_LIMIT','ログイン試行が多いため5分待ってください。');
  if(password.length>128||!constantEquals_(passwordHash_(password,salt),hash)){cache.put('login-failures',String(attempts+1),300);throw apiError_('UNAUTHORIZED','パスワードを確認してください。');}
  cache.remove('login-failures');const token=Utilities.getUuid()+Utilities.getUuid();cache.put('session:'+sha256_(token),props.getProperty('AUTH_VERSION'),SESSION_TTL);
  return {token:token,expiresAt:new Date(Date.now()+SESSION_TTL*1000).toISOString()};
 }finally{lock.releaseLock();}
}
function requireSession_(token){const version=PropertiesService.getScriptProperties().getProperty('AUTH_VERSION');if(!token||token.length>200||!version||CacheService.getScriptCache().get('session:'+sha256_(token))!==version)throw apiError_('UNAUTHORIZED','ログイン期限が切れました。再ログインしてください。');}
function passwordHash_(password,salt){let value=salt+':'+password;for(let i=0;i<5000;i++)value=sha256_(value+salt);return value;}
function constantEquals_(left,right){let difference=left.length^right.length;for(let i=0;i<Math.max(left.length,right.length);i++)difference|=(left.charCodeAt(i)||0)^(right.charCodeAt(i)||0);return difference===0;}
function sha256_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(byte=>('0'+((byte+256)%256).toString(16)).slice(-2)).join('');}
function audit_(action,collection,id,detail){spreadsheet_().getSheetByName('audit').appendRow(['audit_'+Utilities.getUuid(),new Date().toISOString(),action,collection,id,safeCell_(detail)]);}
function bool_(value){return value===true||String(value)==='true';}
function validTime_(value){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));}
function validDate_(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value))&&!isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function apiError_(code,message){const error=new Error(message);error.code=code;return error;}
function reportError_(error){return failure_(error.code||'SERVER_ERROR',error.code?error.message:'サーバーで処理できませんでした。設定と実行ログを確認してください。');}
function failure_(code,message){return json_({ok:false,error:{code:code,message:message}});}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
