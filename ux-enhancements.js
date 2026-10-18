// 2Base usability layer v1
(function(){
  if (window.__grade2UxEnhancements) return;
  window.__grade2UxEnhancements = true;

  const links = [
    ["ホーム","index.html","2年3組の状況を見る"],
    ["2年3組","class-2-3.html","時間割と明日の準備"],
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
    wrap.innerHTML = `<div id="grade2QuickMenu" class="ux-palette-card" role="dialog" aria-modal="true" aria-label="メニュー">
      <div class="ux-palette-head"><input type="search" placeholder="ページを検索…" aria-label="ページを検索"><button class="ux-palette-close" type="button" aria-label="閉じる">×</button></div>
      <div class="ux-palette-list"></div>
    </div>`;
    document.body.append(fab,wrap);

    const input = wrap.querySelector('input');
    const list = wrap.querySelector('.ux-palette-list');
    let selected = 0;
    let returnFocus = null;

    function render(){
      const q = input.value.trim().toLowerCase();
      const filtered = links.filter(([title,,desc]) => `${title} ${desc}`.toLowerCase().includes(q));
      selected = Math.min(selected, Math.max(0, filtered.length - 1));
      list.innerHTML = filtered.map(([title,url,desc],i) => `<a class="ux-palette-item ${i===selected?'active':''}" href="${url}"><span>${title}</span><small>${desc}</small></a>`).join('') || '<div class="empty-state">見つかりませんでした。</div>';
    }
    function open(trigger, focusSearch = true){
      returnFocus = trigger || document.activeElement;
      wrap.classList.add('open');
      document.documentElement.classList.add('ux-menu-open');
      document.querySelector('.mobile-menu-more')?.setAttribute('aria-expanded','true');
      input.value=''; selected=0; render();
      // スマホの「メニュー」からは検索キーボードを開かず、ページの選択へ進む。
      (focusSearch ? input : list.querySelector('a') || wrap.querySelector('.ux-palette-close')).focus();
    }
    function close(){
      if (!wrap.classList.contains('open')) return;
      wrap.classList.remove('open');
      document.documentElement.classList.remove('ux-menu-open');
      document.querySelector('.mobile-menu-more')?.setAttribute('aria-expanded','false');
      if (returnFocus?.isConnected) returnFocus.focus();
    }
    fab.addEventListener('click',()=>open(fab));
    wrap.querySelector('.ux-palette-close').addEventListener('click',close);
    wrap.addEventListener('click',e=>{ if(e.target===wrap) close(); });
    list.addEventListener('click',e=>{ if(e.target.closest('a')) close(); });
    wrap.addEventListener('keydown',e=>{
      if (e.key !== 'Tab') return;
      const controls = [...wrap.querySelectorAll('input,button,a[href]')];
      const first = controls[0], last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
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
    return { open, close };
  }

  function installMobileNavigation(palette){
    if (!palette || document.querySelector('.mobile-nav')) return;
    const primary = [
      ['home','ホーム','index.html','M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9'],
      ['class','時間割','class-2-3.html','M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2'],
      ['homework','提出物','homework.html','m8 12 3 3 5-6M7 3h10v3H7zM7 5H5v16h14V5h-2'],
      ['announcements','お知らせ','announcements.html','M4 9h4l12-5v16L8 15H4zM8 15l2 6h4l-2-4']
    ];
    const page = document.body.dataset.page;
    const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`;
    const nav = document.createElement('nav');
    nav.className = 'mobile-nav';
    nav.setAttribute('aria-label','スマートフォン用メニュー');
    nav.innerHTML = primary.map(([key,label,url,path]) => `<a href="${url}" ${page === key ? 'class="active" aria-current="page"' : ''}>${icon(path)}<span>${label}</span></a>`).join('') + `<button type="button" class="mobile-menu-more ${primary.some(([key])=>key===page)?'':'active'}" aria-haspopup="dialog" aria-controls="grade2QuickMenu" aria-expanded="false">${icon('M5 12h.01M12 12h.01M19 12h.01')}<span>メニュー</span></button>`;
    document.body.appendChild(nav);
    const more = nav.querySelector('.mobile-menu-more');
    more.addEventListener('click',()=>palette.open(more,false));
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
    const palette = installPalette();
    installMobileNavigation(palette);
    improveExternalLinks();
    installTouchFeedback();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
