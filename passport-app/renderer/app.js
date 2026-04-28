/**
 * Main application entry point for renderer
 * Initializes i18n and sets up basic UI structure
 */

import { initI18n, t, setLanguage } from './i18n/index.js';
import { initRouter, navigate } from './router.js';

let currentPage = null;

async function init() {
  try {
    // Initialize i18n
    await initI18n();

    // Get app container
    const app = document.getElementById('app');
    if (!app) {
      console.error('App container not found');
      return;
    }

    // Create basic UI structure
    const html = `
      <div class="d-flex flex-column h-100">
        <!-- Navigation -->
        <nav class="navbar navbar-expand-lg navbar-dark shadow-sm" style="background-color: var(--panel);">
          <div class="container-fluid">
            <a class="navbar-brand fw-bold" href="#/">
              <i class="bi bi-shield-check me-2"></i>${t('app.title')}
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
              <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
              <div class="navbar-nav me-auto">
                <a class="nav-link" href="#/dashboard"><i class="bi bi-speedometer2 me-1"></i>${t('nav.dashboard')}</a>
                <a class="nav-link" href="#/import"><i class="bi bi-file-earmark-arrow-up me-1"></i>${t('nav.import')}</a>
                <a class="nav-link" href="#/scan"><i class="bi bi-upc-scan me-1"></i>${t('nav.scan')}</a>
                <a class="nav-link" href="#/passengers"><i class="bi bi-people me-1"></i>${t('nav.passengerList')}</a>
                <a class="nav-link" href="#/history"><i class="bi bi-clock-history me-1"></i>${t('nav.scanHistory')}</a>
                <a class="nav-link" href="#/reports"><i class="bi bi-file-earmark-pdf me-1"></i>${t('nav.reports')}</a>
                <a class="nav-link" href="#/pending"><i class="bi bi-hourglass-split me-1"></i>${t('nav.pendingApproval')}</a>
              </div>
              <div class="navbar-nav ms-auto align-items-center">
                <a class="nav-link" href="#/settings">
                  <i class="bi bi-gear-fill me-1"></i>${t('nav.settings')}
                </a>
                <div class="btn-group ms-2">
                  <button class="btn btn-sm btn-outline-light" id="btn-lang-ar">العربية</button>
                  <button class="btn btn-sm btn-outline-light" id="btn-lang-en">English</button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <!-- Main content -->
        <main id="page-container" class="flex-grow-1 overflow-auto">
          <div class="container-fluid p-4" id="content-area">
            <!-- Page content will be injected here -->
          </div>
        </main>
      </div>
    `;

    app.innerHTML = html;

    // Language switcher event listeners (NOT inline onclick — CSP blocks those)
    document.getElementById('btn-lang-ar').addEventListener('click', async () => {
      await setLanguage('ar');
      init();
    });
    document.getElementById('btn-lang-en').addEventListener('click', async () => {
      await setLanguage('en');
      init();
    });

    // Highlight the active language button
    const currentLang = document.documentElement.lang || 'ar';
    if (currentLang === 'ar') {
      document.getElementById('btn-lang-ar').classList.replace('btn-outline-light', 'btn-light');
    } else {
      document.getElementById('btn-lang-en').classList.replace('btn-outline-light', 'btn-light');
    }

    // Initialize Router
    initRouter(document.getElementById('content-area'));

    // Initialize window API check
    if (window.api) {
      console.log('API bridge connected successfully');
    } else {
      console.warn('API bridge not available');
    }

    console.log('App initialized');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
