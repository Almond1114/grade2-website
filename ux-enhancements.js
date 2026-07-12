// 2Base usability layer v1
(function(){
  if (window.__grade2UxEnhancements) return;
  window.__grade2UxEnhancements = true;

  const links = [
    ["ホーム","index.html","全体の状況を見る"],
    ["クラス","classes.html","クラス別ページ"],
    ["テスト予定","tests.html","直近のテスト"],
    ["提出物","homework.html","締切を確認"],
    ["お知らせ","announcements.html","最新の連絡"],
    ["学習リンク","links.html","よく使うサイト"],
    ["編集","edit.html","内容を追加・変更"],
    ["通知","notifications.html","通知を設定"]
  ];

  function removeClassSelectors(){
    document.querySelectorAll('.class-select').forEach(el => el.remove());
    document.querySelectorAll('.header-tools').forEach(box => {
      if (!box.children.length) box.remove();
    });
  }

  function installProgress(){
    if (document.querySelector('.ux-progress')) return;
    const bar = document.createElement('div');
    bar.className = 'ux-progress';
    document.body.appendChild(bar);
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, scrollY / max * 100)) : 0;
      bar.style.width = pct + '%';
      document.querySelector('.site-header')?.classList.toggle('is-compact', scrollY > 28);
    };
    addEventListener('scroll', update, {passive:true});
    update();
  }

  function installPalette(){
    if (document.querySelector('.ux-palette')) return;
    const fab = document.createElement('button');
    fab.className = 'ux-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label','クイックメニューを開く');
    fab.textContent = '⌘';

    const wrap = document.createElement('div');
    wrap.className = 'ux-palette';
    wrap.innerHTML = `<div class="ux-palette-card" role="dialog" aria-modal="true" aria-label="クイックメニュー">
      <div class="ux-palette-head"><input type="search" placeholder="ページを検索…" aria-label="ページを検索"><button class="ux-palette-close" type="button" aria-label="閉じる">×</button></div>
      <div class="ux-palette-list"></div>
    </div>`;
    document.body.append(fab,wrap);

    const input = wrap.querySelector('input');
    const list = wrap.querySelector('.ux-palette-list');
    let selected = 0;

    function render(){
      const q = input.value.trim().toLowerCase();
      const filtered = links.filter(([title,,desc]) => `${title} ${desc}`.toLowerCase().includes(q));
      selected = Math.min(selected, Math.max(0, filtered.length - 1));
      list.innerHTML = filtered.map(([title,url,desc],i) => `<a class="ux-palette-item ${i===selected?'active':''}" href="${url}"><span>${title}</span><small>${desc}</small></a>`).join('') || '<div class="empty-state">見つかりませんでした。</div>';
    }
    function open(){ wrap.classList.add('open'); input.value=''; selected=0; render(); setTimeout(()=>input.focus(),30); }
    function close(){ wrap.classList.remove('open'); }
    fab.addEventListener('click',open);
    wrap.querySelector('.ux-palette-close').addEventListener('click',close);
    wrap.addEventListener('click',e=>{ if(e.target===wrap) close(); });
    input.addEventListener('input',render);
    input.addEventListener('keydown',e=>{
      const items=[...list.querySelectorAll('.ux-palette-item')];
      if(e.key==='ArrowDown'){e.preventDefault();selected=Math.min(selected+1,items.length-1);render();}
      if(e.key==='ArrowUp'){e.preventDefault();selected=Math.max(selected-1,0);render();}
      if(e.key==='Enter'&&items[selected]){e.preventDefault();items[selected].click();}
      if(e.key==='Escape') close();
    });
    addEventListener('keydown',e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();wrap.classList.contains('open')?close():open();}
      if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();open();}
      if(e.key==='Escape') close();
    });
    render();
  }

  function improveExternalLinks(){
    document.querySelectorAll('a[target="_blank"]').forEach(a=>{
      if(!a.rel.includes('noopener')) a.rel = `${a.rel} noopener noreferrer`.trim();
    });
  }

  function installTouchFeedback(){
    document.addEventListener('pointerdown',e=>{
      const target=e.target.closest('button,a,.content-card,.list-card,.class-card');
      if(!target) return;
      target.style.setProperty('--pressed','1');
    },{passive:true});
    document.addEventListener('pointerup',e=>{
      const target=e.target.closest('button,a,.content-card,.list-card,.class-card');
      if(target) target.style.removeProperty('--pressed');
    },{passive:true});
  }

  function init(){
    removeClassSelectors();
    installProgress();
    installPalette();
    improveExternalLinks();
    installTouchFeedback();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
