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
                <a class="nav-link" href="#/dashboard">${t('nav.dashboard')}</a>
                <a class="nav-link" href="#/import">${t('nav.import')}</a>
                <a class="nav-link" href="#/scan">${t('nav.scan')}</a>
                <a class="nav-link" href="#/passengers">${t('nav.passengerList')}</a>
                <a class="nav-link" href="#/history">${t('nav.scanHistory')}</a>
                <a class="nav-link" href="#/reports">${t('nav.reports')}</a>
                <a class="nav-link" href="#/pending">${t('nav.pendingApproval')}</a>
              </div>
              <div class="navbar-nav ms-auto">
                <a class="nav-link" href="#/settings">
                  <i class="bi bi-gear-fill me-1"></i>${t('nav.settings')}
                </a>
                <div class="nav-item dropdown">
                   <button class="btn btn-link nav-link dropdown-toggle" id="langDropdown" data-bs-toggle="dropdown">
                     ${t('settings.language')}
                   </button>
                   <ul class="dropdown-menu dropdown-menu-end">
                     <li><button class="dropdown-item" onclick="window.setAppLanguage('ar')">العربية</button></li>
                     <li><button class="dropdown-item" onclick="window.setAppLanguage('en')">English</button></li>
                   </ul>
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

    // Expose language switcher to window for onclick handlers
    window.setAppLanguage = async (lang) => {
      await setLanguage(lang);
      // Re-render nav (simplest way to update translations in nav)
      init(); 
    };

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
