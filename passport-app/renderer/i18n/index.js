const i18next = require('i18next');
const ar = require('./i18n/locales/ar.json');
const en = require('./i18n/locales/en.json');

/**
 * Initialize i18next in renderer with bundled locales
 */
async function initI18n() {
  await i18next.init({
    lng: 'ar',
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
function setLanguage(lang) {
  i18next.changeLanguage(lang);
  
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
function t(key, options = {}) {
  return i18next.t(key, options);
}

module.exports = { initI18n, setLanguage, t };
