// We use the global i18next loaded from vendor/i18next.min.js
// But we need to load the locales

async function loadLocale(lang) {
  const response = await fetch(`./i18n/locales/${lang}.json`);
  return await response.json();
}

/**
 * Initialize i18next in renderer with bundled locales
 */
export async function initI18n() {
  const ar = await loadLocale('ar');
  const en = await loadLocale('en');

  // Check if i18next is already initialized to preserve language
  if (i18next.isInitialized) {
    return i18next;
  }

  await i18next.init({
    lng: document.documentElement.lang || 'ar',
    fallbackLng: 'ar',
    debug: false,
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
  });

  return i18next;
}

/**
 * Set language and update DOM
 */
export async function setLanguage(lang) {
  await i18next.changeLanguage(lang);
  
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Swap Bootstrap CSS
  const bootstrapLink = document.getElementById('bootstrap-css');
  if (bootstrapLink) {
    const cssFile = lang === 'ar' ? 'bootstrap.rtl.min.css' : 'bootstrap.min.css';
    bootstrapLink.href = `styles/vendor/${cssFile}`;
  }
}

/**
 * Get translation for a key
 */
export function t(key, options = {}) {
  return i18next.t(key, options);
}
