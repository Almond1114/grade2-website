import {SITE_CONFIG} from './site-config.js?v=f4753749f056';
import {readStorage,writeStorage,removeStorage} from './storage.js?v=f4753749f056';
import {clone,uid,asBool} from './utils.js?v=f4753749f056';
import {validateRecord,validateSettings} from './schema.js?v=f4753749f056';
const COLLECTIONS = ['projects','news','schedule','locations'];
export class ApiError extends Error {
  constructor(message,code='API_ERROR') {super(message);this.code=code;}
}
export function publicData(data) {
  const result=clone(data), now=new Date().toISOString();
  for(const collection of COLLECTIONS) result[collection]=(result[collection]||[]).filter(record=>record.status==='published'&&!record.deletedAt&&(collection!=='news'||!record.publishAt||record.publishAt<=now));
  const referenced=new Set(result.projects.map(project=>project.mediaId));
  result.media=(result.media||[]).filter(media=>referenced.has(media.id)&&!media.deletedAt);
  delete result.audit;return result;
}
class DemoProvider {
  mode='demo';
  async seed() {
    if(!this.initial) {const response=await fetch(new URL('../data/demo.json',import.meta.url));if(!response.ok)throw new ApiError('デモデータを読み込めません。');this.initial=await response.json();}
    return clone(this.initial);
  }
  async database() {return readStorage('database',null)||await this.seed();}
  async getPublic() {return {...publicData(await this.database()),source:'demo',fetchedAt:new Date().toISOString()};}
  async login() {return {token:'demo-session',expiresAt:new Date(Date.now()+4*60*60*1000).toISOString()};}
  async logout() {removeStorage('session',true);}
  requireSession() {const session=readStorage('session',null,true);if(!session?.token||Date.parse(session.expiresAt)<=Date.now())throw new ApiError('管理画面に入り直してください。','UNAUTHORIZED');}
  async getAdmin() {this.requireSession();return clone(await this.database());}
  async mutate(action,payload) {
    this.requireSession();
    const operation=async()=>{
      const data=await this.database();let saved;
      if(action==='saveSettings') {
        if(Number(payload.revision)!==Number(data.settings.revision))throw new ApiError('別の画面で設定が更新されました。再読み込みしてください。','CONFLICT');
        data.settings={...validateSettings({...data.settings,...payload}),revision:Number(data.settings.revision)+1};saved=data.settings;
      } else if(action==='uploadImage') {
        saved={...payload,id:uid('media'),provider:'demo',url:payload.dataUrl,fileId:'',revision:1,updatedAt:new Date().toISOString(),deletedAt:''};delete saved.dataUrl;
        data.media.push(saved);
      } else if(action==='deleteImage') {
        const index=data.media.findIndex(item=>item.id===payload.id&&!item.deletedAt),image=data.media[index];
        if(!image)throw new ApiError('画像が見つかりません。','NOT_FOUND');
        if(image.provider!=='demo')throw new ApiError('標準画像は削除できません。','BAD_INPUT');
        if(Number(image.revision)!==Number(payload.revision))throw new ApiError('画像が更新されています。最新情報を読み込んでください。','CONFLICT');
        if(data.projects.some(project=>project.mediaId===image.id&&!project.deletedAt))throw new ApiError('企画で使用中の画像です。企画の画像を変更してから削除してください。','IN_USE');
        saved={...image,url:'',bytes:0,deletedAt:new Date().toISOString(),revision:Number(image.revision)+1};data.media[index]=saved;
      } else {
        const collection=payload.collection;if(!COLLECTIONS.includes(collection))throw new ApiError('操作対象が不正です。');
        const items=data[collection],record=payload.record||{},index=items.findIndex(item=>item.id===(payload.id||record.id)),existing=items[index];
        if((payload.id||record.id)&&(!existing||existing.deletedAt))throw new ApiError('対象が削除されています。最新一覧を確認してください。','NOT_FOUND');
        if(existing&&Number(payload.revision??record.revision)!==Number(existing.revision))throw new ApiError('別の画面で更新されました。最新データを読み込んでから保存してください。','CONFLICT');
        if(action==='deleteRecord') {
          if(!existing)throw new ApiError('対象が見つかりません。');
          if(collection==='projects'&&data.schedule.some(item=>item.projectId===existing.id&&!item.deletedAt))throw new ApiError('関連する時刻表を削除または関連なしにしてから企画を削除してください。');
          if(collection==='locations'&&[...data.projects,...data.schedule].some(item=>item.locationId===existing.id&&!item.deletedAt))throw new ApiError('企画・時刻表で使用中の場所は削除できません。');
          existing.deletedAt=new Date().toISOString();existing.revision++;saved=existing;
        } else if(action==='updateCrowd') {
          if(!existing)throw new ApiError('対象が見つかりません。');
          if(!['quiet','normal','busy'].includes(payload.crowd))throw new ApiError('混雑状況が不正です。');
          existing.crowd=payload.crowd;existing.revision++;saved=existing;
        } else if(action==='saveRecord') {
          const validated=validateRecord(collection,record,data);
          saved={...validated,id:record.id||uid(collection),revision:Number(existing?.revision||0)+1,updatedAt:new Date().toISOString(),deletedAt:''};
          index>=0?items[index]=saved:items.push(saved);
        } else throw new ApiError('操作が不正です。');
      }
      data.audit.unshift({id:uid('audit'),time:new Date().toISOString(),action,collection:payload.collection||(['uploadImage','deleteImage'].includes(action)?'media':'settings'),recordId:saved?.id||'',detail:saved?.title||saved?.fileName||saved?.name||'運営設定'});
      data.audit=data.audit.slice(0,300);writeStorage('database',data);return clone(saved);
    };
    return navigator.locks ? navigator.locks.request('nankosai-demo-write',operation) : operation();
  }
}
class AppsScriptProvider {
  mode='google';
  async request(action,payload={},isPublic=false) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),SITE_CONFIG.api.timeoutMs);
    try {
      const url=new URL(SITE_CONFIG.api.url);let options={signal:controller.signal,credentials:'omit',redirect:'follow',cache:'no-store'};
      if(isPublic)url.searchParams.set('action',action);
      else {
        // URLSearchParams keeps the request CORS-safelisted; no custom headers or JSON preflight.
        options={...options,method:'POST',body:new URLSearchParams({action,payload:JSON.stringify(payload),token:readStorage('session',null,true)?.token||'',requestId:uid('request')})};
      }
      const response=await fetch(url,options);if(!response.ok)throw new ApiError('サーバーへ接続できません。');
      let result;try{result=await response.json();}catch{throw new ApiError('APIのJSONを受信できません。Web Appの公開権限とURLを確認してください。');}
      if(!result.ok)throw new ApiError(result.error?.message||'操作を完了できません。',result.error?.code);
      return result.data;
    }catch(error){if(error.name==='AbortError')throw new ApiError('接続がタイムアウトしました。更新結果を確認してから再操作してください。');throw error;}
    finally{clearTimeout(timer);}
  }
  getPublic(){return this.request('bootstrap',{},true);}
  getAdmin(){return this.request('adminBootstrap');}
  login(password){return this.request('login',{password});}
  logout(){return this.request('logout');}
  mutate(action,payload){return this.request(action,payload);}
}
export const api=SITE_CONFIG.api.url ? new AppsScriptProvider() : new DemoProvider();
export async function getPublicWithFallback() {
  try {const data=await api.getPublic();try{writeStorage('public-cache',{provider:api.mode,data});}catch{}return {...data,stale:false};}
  catch(error) {
    const cached=readStorage('public-cache');if(cached?.provider===api.mode)return {...cached.data,stale:true,error:error.message};
    throw error; // A live API failure never silently turns into fictional demo data.
  }
}
