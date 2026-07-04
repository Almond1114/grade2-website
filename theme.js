(function(){
  const key = "grade2Theme";
  const defaultTheme = "clear";
  function apply(theme){
    document.documentElement.dataset.theme = theme || defaultTheme;
    localStorage.setItem(key, theme || defaultTheme);
    document.querySelectorAll('.theme-select').forEach(sel => sel.value = theme || defaultTheme);
  }
  function init(){
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
