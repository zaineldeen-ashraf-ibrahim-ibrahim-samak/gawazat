/**
 * Main application entry point for renderer
 * Initializes i18n and sets up basic UI structure
 */

import { initI18n, t, setLanguage } from './i18n/index.js';
import { initRouter, navigate, refreshCurrentRoute } from './router.js';
import { initAudio, setSoundEnabled, playSuccess, playWarning } from './components/audio.js';

function showGlobalScanToast(result) {
  const outcome = result?.outcome || 'unknown';

  // Use theme CSS variables (theme.css) rather than Bootstrap's text-bg-* palette
  // so each outcome gets its semantic color (orange ≠ red ≠ yellow).
  const styleByOutcome = {
    green:         { cssVar: '--green',  icon: 'bi-check-circle-fill',       title: t('scan.green.title') },
    yellow:        { cssVar: '--yellow', icon: 'bi-exclamation-triangle-fill', title: t('scan.yellow.title') },
    orange:        { cssVar: '--orange', icon: 'bi-person-x-fill',           title: t('scan.orange.title') },
    rejected:      { cssVar: '--orange', icon: 'bi-person-x-fill',           title: t('scan.orange.title') },
    'read-failed': { cssVar: '--red',    icon: 'bi-x-circle-fill',           title: t('scan.readFailed.title') }
  };
  const style = styleByOutcome[outcome] || styleByOutcome['read-failed'];

  const p = result?.passenger || result?.mrz_fields || {};
  const name = p.name || [p.surname, p.given_names].filter(Boolean).join(' ') || '---';
  const passport = p.passport_number || p.document_number || '---';
  const subtitle = result?.warning_message
    || (outcome === 'green' ? t('scan.green.subtitle')
      : outcome === 'yellow' ? t('scan.yellow.subtitle')
      : outcome === 'orange' ? t('scan.orange.subtitle', { enteredAt: result?.first_entered_at || '' })
      : t('scan.readFailed.subtitle'));

  let container = document.getElementById('global-scan-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'global-scan-toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1200';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = 'toast align-items-center text-white border-0 shadow-lg';
  toastEl.style.backgroundColor = `var(${style.cssVar})`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fs-6 py-3 w-100">
        <div class="d-flex align-items-center fw-bold mb-1">
          <i class="bi ${style.icon} me-2 fs-5"></i>
          <span>${style.title}</span>
        </div>
        <div class="small opacity-90">${subtitle}</div>
        <div class="mt-2 d-flex justify-content-between small bg-black bg-opacity-25 p-2 rounded">
          <span><i class="bi bi-person me-1"></i>${name}</span>
          <span class="font-monospace"><i class="bi bi-credit-card-2-front me-1"></i>${passport}</span>
        </div>
      </div>
      <button type="button" class="btn-close btn-close-white me-3 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  container.appendChild(toastEl);
  const tInstance = new window.bootstrap.Toast(toastEl, { delay: 5000 });
  tInstance.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

let currentPage = null;

async function init() {
  try {
    // Initialize i18n
    await initI18n();

    // Read app name from env config (via preload bridge)
    const appName = window.api?.config?.appName || t('app.title');
    const currentLang = document.documentElement.lang || 'ar';
    const displayName = currentLang === 'en'
      ? (window.api?.config?.appNameEn || 'Passenger Gate')
      : appName;

    // Set document title from env
    document.title = displayName;

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
            <a class="navbar-brand fw-bold d-flex align-items-center me-auto" href="#/" style="font-size:0.95rem; white-space: nowrap;">
              <img src="assets/icon.png" alt="" class="me-2" style="width:30px;height:30px;object-fit:contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" />
              <span style="letter-spacing: 0.3px;">${displayName}</span>
            </a>

            <div class="d-flex align-items-center ms-auto order-lg-last">
              <span id="header-stats-badge" class="badge bg-dark border border-secondary text-light ms-2 me-3 fs-6 px-3 py-2 d-none" style="font-weight: 500;">
                <i class="bi bi-people me-1"></i> <span id="header-stats-text">0 / 0</span>
              </span>
              <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
              </button>
            </div>

            <div class="collapse navbar-collapse" id="navbarNav">
              <div class="navbar-nav me-auto" style="font-size:0.8rem;">
                <a class="nav-link py-1 px-2" href="#/dashboard"><i class="bi bi-speedometer2 me-1"></i>${t('nav.dashboard')}</a>
                <a class="nav-link py-1 px-2" href="#/import"><i class="bi bi-file-earmark-arrow-up me-1"></i>${t('nav.import')}</a>
                <a class="nav-link py-1 px-2" href="#/scan"><i class="bi bi-upc-scan me-1"></i>${t('nav.scan')}</a>
                <a class="nav-link py-1 px-2" href="#/passengers"><i class="bi bi-people me-1"></i>${t('nav.passengerList')}</a>
                <a class="nav-link py-1 px-2" href="#/history"><i class="bi bi-clock-history me-1"></i>${t('nav.scanHistory')}</a>
                <a class="nav-link py-1 px-2" href="#/reports"><i class="bi bi-file-earmark-pdf me-1"></i>${t('nav.reports')}</a>
                <a class="nav-link py-1 px-2" href="#/pending"><i class="bi bi-hourglass-split me-1"></i>${t('nav.pendingApproval')}</a>
              </div>
              <div class="navbar-nav ms-auto align-items-center" style="font-size:0.8rem;">
                <button id="btn-refresh-page" class="btn btn-sm btn-outline-info me-1" title="${t('common.refresh') || 'Refresh'}">
                  <i class="bi bi-arrow-clockwise"></i>
                </button>
                <a class="nav-link py-1 px-2" href="#/settings">
                  <i class="bi bi-gear-fill me-1"></i>${t('nav.settings')}
                </a>
                <select id="lang-select" class="form-select form-select-sm ms-1" style="width:auto;font-size:0.78rem;">
                  <option value="ar" ${currentLang === 'ar' ? 'selected' : ''}>العربية</option>
                  <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
                </select>
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

        <!-- Keyboard Shortcuts Help Modal -->
        <div class="modal fade" id="helpModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content bg-dark border-secondary text-white">
              <div class="modal-header border-secondary">
                <h5 class="modal-title"><i class="bi bi-keyboard me-2"></i>${t('shortcuts.title')}</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body p-0">
                <table class="table table-dark table-hover mb-0">
                  <tbody>
                    <tr><td class="text-end"><kbd>${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + /</kbd></td><td>${t('shortcuts.title')}</td></tr>
                    <tr><td class="text-end"><kbd>Enter</kbd></td><td>${t('shortcuts.submitMrz')}</td></tr>
                    <tr><td class="text-end"><kbd>Escape</kbd></td><td>${t('shortcuts.clearResult')}</td></tr>
                    <tr><td class="text-end"><kbd>F5</kbd></td><td>${t('shortcuts.resetScan')}</td></tr>
                    <tr><td class="text-end"><kbd>${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + Z</kbd></td><td>${t('shortcuts.undo')}</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="modal-footer border-secondary justify-content-center">
                <small class="text-muted">${t('shortcuts.hint', { combo: `<kbd>${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + /</kbd>` })}</small>
              </div>
            </div>
          </div>
        </div>
        <!-- Gemini PII Notice Modal -->
        <div class="modal fade" id="geminiNoticeModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content bg-dark border-warning text-white">
              <div class="modal-header border-warning bg-warning bg-opacity-25">
                <h5 class="modal-title text-warning text=white"><i class="bi bi-shield-exclamation me-2"></i>إشعار استخدام الذكاء الاصطناعي (Gemini)</h5>
              </div>
              <div class="modal-body">
                <p>لقد تم اكتشاف مفتاح API خاص بخدمة <strong>Google Gemini</strong>.</p>
                <p>يرجى العلم بأنه عند تفعيل هذه الميزة، سيتم إرسال بيانات المسافرين (بما في ذلك الأسماء، تواريخ الميلاد، والجنسيات) إلى خوادم Google لغرض تصحيح النصوص وتنقيتها (Normalization).</p>
                <div class="alert alert-dark border-secondary">
                  <i class="bi bi-info-circle me-2"></i>هذا الإجراء يتطلب اتصالاً بالإنترنت ويخضع لسياسة خصوصية Google. إذا كنت لا توافق، يرجى إزالة مفتاح <code>GEMINI_API_KEY</code> من ملف <code>.env</code>.
                </div>
                <p class="mb-0 text-muted small">هل توافق على استخدام هذه الخدمة ومعالجة البيانات خارجياً؟</p>
              </div>
              <div class="modal-footer border-warning">
                <button type="button" class="btn btn-warning" id="btn-ack-gemini">موافق، استمر</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    app.innerHTML = html;

    // Refresh button event listener
    document.getElementById('btn-refresh-page').addEventListener('click', () => {
      refreshCurrentRoute();
    });

    // Language selector
    document.getElementById('lang-select').addEventListener('change', async function () {
      await setLanguage(this.value);
      init();
    });

    // Global keyboard shortcut: Ctrl+/ or ⌘+/ to open help modal (cross-platform)
    window.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey; // metaKey = ⌘ on macOS
      if (mod && e.key === '/') {
        e.preventDefault();
        const modal = document.getElementById('helpModal');
        if (modal) {
          const bsModal = bootstrap.Modal.getOrCreateInstance(modal);
          bsModal.toggle();
        }
      }
    });

    // Initialize Router
    initRouter(document.getElementById('content-area'));

    // Initialize window API check
    if (window.api) {
      console.log('API bridge connected successfully');
      
      // Initialize audio for global scan notifications (file-watcher / API scans)
      // The scan page initializes its own audio when active; this ensures sound
      // feedback when the user is on any other page.
      initAudio();

      // Gemini Notice logic
      const settings = await window.api.settings.get();
      setSoundEnabled(settings.sound_enabled !== false);
      if (settings.geminiEnabled && !settings.geminiNoticeAcknowledged) {
        const modalEl = document.getElementById('geminiNoticeModal');
        if (modalEl) {
          const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
          modal.show();
          
          document.getElementById('btn-ack-gemini').addEventListener('click', async () => {
            const res = await window.api.settings.acknowledgeGeminiNotice();
            if (res && res.ok) {
              modal.hide();
            }
          });
        }
      }

      // Start auto-updating header stats
      updateHeaderStats();
      setInterval(updateHeaderStats, 2000);

      // Listen for global scan events. When the user is NOT on the scan page
      // (e.g. file-watcher scan arrives while viewing dashboard/list), surface
      // the same UI + voice feedback the scan page provides: a result toast
      // with passenger info plus a success/warning chime. The scan page handles
      // its own UI/audio when active, so we skip duplicate feedback there.
      if (window.api.regula && window.api.regula.onEvent) {
        window.api.regula.onEvent((event) => {
          if (event.type !== 'scan') return;
          const hash = window.location.hash || '';
          const onScanPage = hash.includes('/scan') && !hash.includes('/scan-history');
          if (onScanPage) return;

          const result = event.data || {};
          showGlobalScanToast(result);
          if (result.outcome === 'green') {
            playSuccess();
          } else {
            playWarning();
          }

          // Refresh the current view so lists/counters reflect the new scan —
          // BUT skip if the operator is mid-typing. A blind refresh wipes their
          // input element and they lose focus / keystrokes. Refresh once they
          // blur the input instead.
          const ae = document.activeElement;
          const isTyping = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
          if (!isTyping) {
            refreshCurrentRoute();
          } else {
            const refreshOnBlur = () => {
              ae.removeEventListener('blur', refreshOnBlur);
              refreshCurrentRoute();
            };
            ae.addEventListener('blur', refreshOnBlur, { once: true });
          }
        });
      }
    } else {
      console.warn('API bridge not available');
    }

    console.log('App initialized');
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

async function updateHeaderStats() {
  try {
    if (!window.api || !window.api.dashboard) return;
    const stats = await window.api.dashboard.stats();
    const badge = document.getElementById('header-stats-badge');
    const text = document.getElementById('header-stats-text');
    
    if (badge && text) {
      if (stats.total > 0) {
        badge.classList.remove('d-none');
        text.innerText = `${stats.entered} / ${stats.total}`;
        
        // Optional: add a success color if fully boarded
        if (stats.entered >= stats.total) {
          badge.classList.replace('border-secondary', 'border-success');
          badge.classList.replace('text-light', 'text-success');
        } else {
          badge.classList.replace('border-success', 'border-secondary');
          badge.classList.replace('text-success', 'text-light');
        }
      } else {
        badge.classList.add('d-none');
      }
    }
  } catch (err) {
    // silently fail
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
