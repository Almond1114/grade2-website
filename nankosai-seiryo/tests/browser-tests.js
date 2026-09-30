import {api,publicData} from '../js/api.js';
import {SITE_CONFIG} from '../js/site-config.js';
import {writeStorage,readStorage} from '../js/storage.js';
const frame=document.querySelector('#frame'),results=document.querySelector('#results');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function report(label,passed){const row=document.createElement('li');row.textContent=(passed?'PASS ':'FAIL ')+label;row.className=passed?'pass':'fail';results.append(row);}
async function load(path,width){frame.width=width;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('画面読込がタイムアウト')),12000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.src=new URL(path,location.href);});await pause(1300);return frame.contentDocument;}
document.querySelector('#show').onclick=()=>load('../index.html',Number(document.querySelector('#preview').value));
document.querySelector('#run').onclick=async()=>{
 if(SITE_CONFIG.api.url){report('本番APIではデモ書込テストを実行しません',false);return;}
 const button=document.querySelector('#run');button.disabled=true;results.replaceChildren();
 const savedDatabase=localStorage.getItem('nankosai-seiryo-v2:database'),savedSession=sessionStorage.getItem('nankosai-seiryo-v2:session');
 try{
  for(const width of [320,375,390,768,1440]){
   const doc=await load('../index.html',width);
   report('公開画面 '+width+'px 横はみ出しなし',doc.documentElement.scrollWidth<=width+1);
   report('公開画面 '+width+'px 企画描画',doc.querySelectorAll('.project-card').length>=8);
   report('公開画面 '+width+'px CSS読込',frame.contentWindow.getComputedStyle(doc.querySelector('.hero')).position==='relative');
  }
  const data=await api.getPublic();report('下書きは非公開',data.projects.every(item=>item.status==='published')&&!('audit' in data));
  writeStorage('session',await api.login(),true);
  const admin=await api.getAdmin(),project=admin.projects.find(item=>item.status==='published');
  const updated=await api.mutate('updateCrowd',{collection:'projects',id:project.id,revision:project.revision,crowd:'quiet'});
  report('混雑更新が公開データに反映',(await api.getPublic()).projects.find(item=>item.id===project.id).crowd==='quiet');
  try{await api.mutate('updateCrowd',{collection:'projects',id:project.id,revision:project.revision,crowd:'busy'});report('古いrevisionを拒否',false);}catch(error){report('古いrevisionを拒否',error.code==='CONFLICT');}
  const draft=await api.mutate('saveRecord',{collection:'news',record:{title:'QA下書き',body:'検証',status:'draft',important:false,publishAt:''}});
  report('新規下書きが公開されない',!(await api.getPublic()).news.some(item=>item.id===draft.id));
  for(const width of [320,375,768,1440]){
   const doc=await load('../admin.html',width);
   report('管理画面 '+width+'px ダッシュボード表示',!doc.querySelector('#admin-shell').hidden&&doc.querySelectorAll('.metric-card').length===5);
   report('管理画面 '+width+'px 横はみ出しなし',doc.documentElement.scrollWidth<=width+1);
  }
 }catch(error){report(error.message,false);}
 finally{
  if(savedDatabase===null)localStorage.removeItem('nankosai-seiryo-v2:database');else localStorage.setItem('nankosai-seiryo-v2:database',savedDatabase);
  if(savedSession===null)sessionStorage.removeItem('nankosai-seiryo-v2:session');else sessionStorage.setItem('nankosai-seiryo-v2:session',savedSession);
  button.disabled=false;await load('../index.html',375);
 }
};
