import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../gas/Code.gs',import.meta.url),'utf8');
const seed=JSON.parse(fs.readFileSync(new URL('../data/demo.json',import.meta.url),'utf8'));
function server(){
 const props=new Map([['AUTH_VERSION','version']]),cache=new Map();
 const context=vm.createContext({console,Date,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,value)=>Array.from(crypto.createHash('sha256').update(value).digest()),getUuid:()=>crypto.randomUUID()}});
 vm.runInContext(source,context);context.readRecords_=name=>structuredClone(seed[name]||[]);context.settings_=()=>structuredClone(seed.settings);return {context,props,cache};
}
test('公開データは下書き・削除済み・履歴を除外',()=>{const {context}=server();const result=context.bootstrap_(false);assert.ok(result.projects.every(row=>row.status==='published'));assert.equal(result.projects.length,8);assert.ok(!('audit'in result));assert.ok(result.news.every(row=>row.status==='published'));});
test('匿名の管理書込と未知の操作は拒否',()=>{const {context}=server();const response=JSON.parse(context.doPost({parameter:{action:'saveRecord',payload:'{}'}}).text);assert.equal(response.ok,false);assert.equal(response.error.code,'UNAUTHORIZED');assert.equal(JSON.parse(context.doGet({parameter:{action:'adminBootstrap'}}).text).error.code,'BAD_ACTION');});
test('許可外collection・不正日付・公開状態を拒否',()=>{const {context}=server();assert.throws(()=>context.validCollection_('audit'));assert.equal(context.validDate_('2027-02-30'),false);assert.equal(context.validDate_('2027-07-10'),true);assert.throws(()=>context.validateRecord_('projects',{...seed.projects[0],status:'evil'}));assert.throws(()=>context.validateRecord_('projects',{...seed.projects[0],locationId:'unknown'}));});
test('revision競合・Sheet数式注入・不正画像',()=>{const {context}=server();assert.throws(()=>context.checkRevision_({revision:3},2));assert.equal(context.safeCell_('=IMPORTXML("evil")'),'\'=IMPORTXML("evil")');assert.throws(()=>context.uploadImage_({dataUrl:'data:image/svg+xml;base64,AAAA'}));});
test('既存ID更新は空白行を含めて正しい物理行に保存',()=>{const {context}=server();let writtenRow;context.spreadsheet_=()=>({getSheetByName:()=>({getLastRow:()=>4,getRange:(row,col,height)=>row===2&&col===1&&height===3?{getDisplayValues:()=>[['first'],[''],['third']]}:{setValues:()=>{writtenRow=row;}},appendRow:()=>assert.fail('existing record appended')})});context.writeRecord_('news',{id:'third',title:'updated'});assert.equal(writtenRow,4);});
test('セッショントークンはハッシュで照合し期限切れを拒否',()=>{const {context,cache}=server();assert.throws(()=>context.requireSession_('bad'));cache.set('session:'+context.sha256_('valid'),'version');assert.doesNotThrow(()=>context.requireSession_('valid'));cache.clear();assert.throws(()=>context.requireSession_('valid'));});
test('認証失敗回数を制限',()=>{const {context,props,cache}=server();props.set('ADMIN_PASSWORD_HASH','hash');props.set('ADMIN_PASSWORD_SALT','salt');cache.set('login-failures','10');assert.throws(()=>context.login_('wrong'),error=>error.code==='RATE_LIMIT');});
