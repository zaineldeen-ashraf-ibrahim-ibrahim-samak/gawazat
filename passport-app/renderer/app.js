/**
 * Main application entry point for renderer
 * Initializes i18n and sets up basic UI structure
 */

const { initI18n, t } = require('./i18n');

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
        <nav class="navbar navbar-expand-lg navbar-dark">
          <div class="container-fluid">
            <a class="navbar-brand" href="#/">${t('app.title')}</a>
            <div class="navbar-nav">
              <a class="nav-link" href="#/dashboard">${t('nav.dashboard')}</a>
              <a class="nav-link" href="#/import">${t('nav.import')}</a>
              <a class="nav-link" href="#/scan">${t('nav.scan')}</a>
              <a class="nav-link" href="#/passengers">${t('nav.passengerList')}</a>
              <a class="nav-link" href="#/history">${t('nav.scanHistory')}</a>
              <a class="nav-link" href="#/reports">${t('nav.reports')}</a>
              <a class="nav-link" href="#/pending">${t('nav.pendingApproval')}</a>
              <a class="nav-link" href="#/settings">${t('nav.settings')}</a>
            </div>
          </div>
        </nav>

        <!-- Main content -->
        <main id="page-container" class="flex-grow-1 overflow-auto">
          <div class="container-fluid p-4">
            <div class="alert alert-info">
              <h4>${t('common.loading')}</h4>
              <p>Application initializing...</p>
            </div>
          </div>
        </main>
      </div>
    `;

    app.innerHTML = html;

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
