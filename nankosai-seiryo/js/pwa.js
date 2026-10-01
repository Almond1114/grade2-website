import {toast} from './utils.js?v=77db7237ab62';
export async function registerServiceWorker() {
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 try {
  const registration=await navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname,updateViaCache:'none'});
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)toast('新しい案内を読み込みました。次に開くと最新版が表示されます。');});});
 }catch{ /* Offline information is also retained in a versioned public snapshot. */ }
}
