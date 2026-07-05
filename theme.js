(function(){
  const key = "grade2Theme";
  const defaultTheme = "clear";

  function loadCssOnce(href, marker){
    if (document.querySelector(`link[data-css-loader="${marker}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.cssLoader = marker;
    document.head.appendChild(link);
  }

  function loadResponsiveCss(){
    loadCssOnce('responsive-ui.css?v=2', 'responsive-ui');
    loadCssOnce('mobile-editor-fix.css?v=1', 'mobile-editor-fix');
  }

  function apply(theme){
    document.documentElement.dataset.theme = theme || defaultTheme;
    localStorage.setItem(key, theme || defaultTheme);
    document.querySelectorAll('.theme-select').forEach(sel => sel.value = theme || defaultTheme);
  }

  function init(){
    loadResponsiveCss();
    const saved = localStorage.getItem(key) || defaultTheme;
    apply(saved);
    document.querySelectorAll('.theme-select').forEach(sel => {
      sel.value = saved;
      sel.addEventListener('change', () => apply(sel.value));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
