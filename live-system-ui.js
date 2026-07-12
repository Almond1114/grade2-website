(function(){
  if (window.__grade2LiveSystemInstalled) return;

  function ensureToast(){
    let box=document.getElementById('syncToast');
    if(!box){box=document.createElement('div');box.id='syncToast';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.appendChild(box)}
    return box;
  }
  function toast(message,type='success'){
    const box=ensureToast();box.className=type;box.textContent=message;requestAnimationFrame(()=>box.classList.add('show'));clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('show'),2800)
  }
  function clock(date=new Date()){
    return new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(date)
  }
  function init(){
    if(window.__grade2LiveSystemInstalled||typeof renderConnection!=='function')return;
    window.__grade2LiveSystemInstalled=true;
    let started=performance.now();
    let lastLive=null;
    const original=renderConnection;
    renderConnection=function(mode,detail=''){
      if(mode==='loading')started=performance.now();
      original(mode,detail);
      const box=document.getElementById('connectionBanner');if(!box)return;
      let title='接続確認中',sub='Google Sheetsへ接続しています',meta='同期中…',view=mode;
      if(mode==='live'){
        lastLive=new Date();
        const sec=Math.max(.01,(performance.now()-started)/1000);
        title='LIVE — Google Sheets接続中';sub='最新データに同期済み';meta=`${sec.toFixed(2)} s / ${clock(lastLive)}`;
      }else if(mode==='cached'){
        title='高速表示中';sub='保存データを表示しながら最新版を確認しています';meta='バックグラウンド同期';
      }else if(mode==='cached-error'){
        title='接続が不安定です';sub='前回同期したデータを安全に表示しています';meta='再接続待機中';
      }else if(mode==='sample'){
        title='接続できませんでした';sub=detail||'サンプルデータを表示しています';meta='要確認';view='offline';
      }
      box.className=`connection-banner ${view}`;box.dataset.syncMeta=meta;
      box.innerHTML=`<span class="sync-copy"><span class="sync-title">${title}</span><span class="sync-detail">${sub}</span></span><button class="sync-action" type="button">再同期</button>`;
      box.querySelector('.sync-action')?.addEventListener('click',()=>{if(typeof loadData==='function')loadData()});
    };
    window.addEventListener('online',()=>{toast('オンラインに復帰しました。最新情報へ再同期します。');if(typeof loadData==='function')loadData()});
    window.addEventListener('offline',()=>{
      const box=document.getElementById('connectionBanner');
      if(box){box.className='connection-banner offline';box.dataset.syncMeta='オフライン';box.innerHTML='<span class="sync-copy"><span class="sync-title">オフライン</span><span class="sync-detail">接続が戻るまで保存済みデータを表示します</span></span>'}
      toast('インターネット接続が切れました。','error');
    });
    const form=document.getElementById('editForm');
    if(form&&!form.dataset.liveBound){form.dataset.liveBound='true';form.addEventListener('submit',()=>{document.body.classList.add('is-syncing');toast('Google Sheetsへ送信しています…')},true)}
    const status=document.getElementById('formStatus');
    if(status)new MutationObserver(()=>{
      const msg=status.textContent||'';
      if(/保存しました|追加しました/.test(msg)){document.body.classList.remove('is-syncing');toast('Google Sheetsへ保存しました');if(typeof loadData==='function')setTimeout(()=>loadData(),250)}
      else if(/保存できません|追加できません|エラー/.test(msg)){document.body.classList.remove('is-syncing');toast(msg,'error')}
    }).observe(status,{childList:true,subtree:true,characterData:true});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&lastLive&&Date.now()-lastLive.getTime()>60000&&typeof loadData==='function')loadData()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();