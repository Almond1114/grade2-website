/** 文面と基本デザインの変更はこのファイルから。管理CMSは運営情報を扱います。 */
export const SITE_CONFIG = {
  version: '2.0.0',
  content: {
    festivalName: '南高祭', year: '2027', siteTitle: '南高祭 2027 | 清涼',
    theme: '清涼', englishName: 'NANKO FESTIVAL 2027', themeEnglish: 'SEIRYO',
    heroCopy: '風が通るように、\n記憶に残る二日間。',
    description: '企画を見つけて、校舎をめぐる。あなたのペースで楽しむ南高祭。',
    schoolName: '北海道札幌南高等学校',
    eventDates: ['2027-07-10', '2027-07-11'], openTime: '09:00', closeTime: '16:00',
    dateNote: '開催日・時間はサンプルです',
    disclaimer: '仮想公式サイト / 学校の公式発表ではありません',
    accessText: '会場は北海道札幌南高等学校を想定しています。実際の開催日・一般公開・入場方法は学校からの正式案内をご確認ください。',
    admissionText: '受付・入場方法は正式案内をご確認ください。',
    footerCopy: '夏の熱気も、廊下を抜ける風も。',
  },
  colors: {
    background: '#f7fbfc', surface: '#ffffff', subBackground: '#eaf4f6', text: '#15383e',
    muted: '#526e75', primary: '#066d78', accent: '#d0a05e', light: '#b8e5e8',
    warning: '#a54422', success: '#21734e', danger: '#ad3544', border: '#d1e2e5',
  },
  typography: {
    bodyFont: '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
    headingFont: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", Georgia, serif',
    themeFont: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
    heroThemeSize: 'clamp(6.5rem, 18vw, 15rem)', heroFestivalSize: 'clamp(1.1rem, 2vw, 1.5rem)',
    sectionTitleSize: 'clamp(1.8rem, 4vw, 2.8rem)', subheadingSize: '1.3rem',
    bodySize: '1rem', smallSize: '.875rem', buttonSize: '.9375rem',
  },
  layout: {
    contentWidth: '1160px', sectionGap: 'clamp(4rem, 8vw, 7rem)', cardGap: '1.25rem',
    cardRadius: '18px', buttonRadius: '10px', imageRadius: '12px',
    shadow: '0 8px 36px rgba(18, 67, 76, .06)', headerHeight: '72px',
  },
  animation: { duration: 700, parallaxStrength: .12, fadeDistance: 18, backgroundIntensity: .65 },
  api: { url: '', timeoutMs: 20000, autoRefreshMs: 60000, provider: 'apps-script' },
  media: { provider: 'drive', maxDimension: 1600, quality: .82, maxUploadBytes: 2000000 },
  map: { floors: ['1F', '2F', '3F'], assetBase: './assets/maps/', isIllustrative: true },
};

export function applySiteConfig() {
  const root = document.documentElement;
  const groups = {
    colors: {background:'bg',surface:'surface',subBackground:'sub-bg',text:'ink',muted:'muted',primary:'primary',accent:'accent',light:'light',warning:'warning',success:'success',danger:'danger',border:'border'},
    typography: {bodyFont:'font-body',headingFont:'font-heading',themeFont:'font-theme',heroThemeSize:'hero-theme-size',heroFestivalSize:'hero-festival-size',sectionTitleSize:'section-title-size',subheadingSize:'subheading-size',bodySize:'body-size',smallSize:'small-size',buttonSize:'button-size'},
    layout: {contentWidth:'content-width',sectionGap:'section-gap',cardGap:'card-gap',cardRadius:'card-radius',buttonRadius:'button-radius',imageRadius:'image-radius',shadow:'shadow',headerHeight:'header-height'},
  };
  Object.entries(groups).forEach(([group, keys]) => Object.entries(keys).forEach(([key, name]) => root.style.setProperty(`--${name}`, SITE_CONFIG[group][key])));
  root.style.setProperty('--motion-duration', `${SITE_CONFIG.animation.duration}ms`);
  root.style.setProperty('--fade-distance', `${SITE_CONFIG.animation.fadeDistance}px`);
  root.style.setProperty('--atmosphere-intensity', SITE_CONFIG.animation.backgroundIntensity);
  document.querySelectorAll('[data-config]').forEach(element => {
    const value = element.dataset.config.split('.').reduce((object, key) => object?.[key], SITE_CONFIG);
    if (value !== undefined) element.textContent = value;
  });
  document.title = document.body.dataset.page === 'admin' ? `運営CMS | ${SITE_CONFIG.content.festivalName}` : SITE_CONFIG.content.siteTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', SITE_CONFIG.content.description);
}
