import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const base='https://almond1114.github.io/grade2-website/nankosai-seiryo/';
function worker({offline=false}={}){
 const handlers={},stores=new Map([['other-site',new Map()]]),deleted=[];
 const normalize=request=>typeof request==='string'?request:request.url;
 const context=vm.createContext({URL,Request,Response,console,self:{location:{href:base+'sw.js'},skipWaiting:async()=>{},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn},fetch:async()=>{if(offline)throw new Error('offline');return new Response('fresh',{status:200});},caches:{open:async name=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {addAll:async requests=>requests.forEach(request=>store.set(normalize(request),new Response('cached'))),put:async(request,response)=>store.set(normalize(request),response),match:async(request,{ignoreSearch=false}={})=>{const url=normalize(request);if(ignoreSearch){const key=[...store.keys()].find(key=>key.split('?')[0]===url.split('?')[0]);return store.get(key)?.clone();}return store.get(url)?.clone();}};},keys:async()=>[...stores.keys()],delete:async name=>{deleted.push(name);return stores.delete(name);}}});
 vm.runInContext(source,context);
 return {context,handlers,stores,deleted,cacheName:vm.runInContext('CACHE_NAME',context),assets:vm.runInContext('ASSETS',context)};
}
async function install(instance){let work;instance.handlers.install({waitUntil:promise=>work=promise});await work;}
function request(instance,path,{mode='cors',method='GET'}={}){let response;instance.handlers.fetch({request:{url:new URL(path,base).href,method,mode},respondWith:promise=>response=promise});return response;}
test('PWAは版付きURLでサブディレクトリ内の全ES Moduleを事前保存する',async()=>{const instance=worker();await install(instance);for(const name of ['js/dom.js','js/editor-storage.js','js/festival-data.js','index.html','admin.html'])assert.ok([...instance.stores.get(instance.cacheName).keys()].some(url=>url.startsWith(base+name+'?v=')),name);});
test('オフラインでHTML・CSS・JSを保存分から返す',async()=>{const instance=worker({offline:true});await install(instance);for(const path of ['index.html','css/public.css','js/public-app.js'])assert.equal(await(await request(instance,path)).text(),'cached');});
test('オンラインは最新資材を返し、オフライン用の保存も更新する',async()=>{const instance=worker();await install(instance);assert.equal(await(await request(instance,'css/public.css')).text(),'fresh');assert.equal(await instance.stores.get(instance.cacheName).get(base+'css/public.css').text(),'fresh');});
test('API・別サイト・POSTをSWが捕まえない',()=>{const instance=worker();assert.equal(request(instance,'https://script.google.com/macros/s/example/exec'),undefined);assert.equal(request(instance,'../index.html'),undefined);assert.equal(request(instance,'index.html',{method:'POST'}),undefined);});
test('キャッシュ更新で既存ルートサイトのキャッシュを削除しない',async()=>{const instance=worker();instance.stores.set('nankosai-seiryo:old',new Map());let work;instance.handlers.activate({waitUntil:promise=>work=promise});await work;assert.deepEqual(instance.deleted,['nankosai-seiryo:old']);assert.ok(instance.stores.has('other-site'));});
