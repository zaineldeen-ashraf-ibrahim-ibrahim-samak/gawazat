/**
 * Settings Page
 * Allows operator to configure app behavior and clear data.
 */

import { t } from '../i18n/index.js';

export async function renderSettings(container) {
  const settings = await window.api.settings.get();

  const html = `
    <div class="page-settings">
      <h1 class="mb-4">${t('nav.settings')}</h1>

      <div class="row">
        <div class="col-md-8">
          <div class="card bg-dark border-secondary shadow mb-4">
            <div class="card-header border-secondary">
              <h5 class="mb-0 text-accent">${t('nav.settings')}</h5>
            </div>
            <div class="card-body">
              <form id="settings-form">
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.shipName')}</label>
                    <input type="text" class="form-control bg-dark text-white border-secondary" 
                           id="input-ship-name" value="${settings.ship_name || ''}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.autoReset')}</label>
                    <input type="number" class="form-control bg-dark text-white border-secondary" 
                           id="input-auto-reset" value="${settings.auto_reset_seconds || 5}">
                  </div>
                </div>

                <div class="row mb-3">
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.scanMode.api')}</label>
                    <select class="form-select bg-dark text-white border-secondary" id="select-scan-mode">
                      <option value="keyboard" ${settings.scan_mode === 'keyboard' ? 'selected' : ''}>Keyboard Simulation</option>
                      <option value="api" ${settings.scan_mode === 'api' ? 'selected' : ''}>Regula Device (API)</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.regulaUrl')}</label>
                    <input type="text" class="form-control bg-dark text-white border-secondary" 
                           id="input-regula-url" value="${settings.regula_url || 'http://localhost:8080'}">
                  </div>
                </div>

                <div class="d-flex justify-content-end mt-4">
                  <button type="submit" id="btn-save-settings" class="btn btn-primary px-4">
                    <i class="bi bi-save me-2"></i>${t('common.confirm')}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div class="card border-danger bg-dark shadow mb-4">
            <div class="card-header border-danger">
              <h5 class="mb-0 text-danger">${t('settings.clearSession')}</h5>
            </div>
            <div class="card-body">
              <p class="text-muted small">This will permanently delete the current voyage, all manifest data, scan history, and boarding records. This action cannot be undone.</p>
              <button id="btn-clear-session" class="btn btn-outline-danger">
                <i class="bi bi-trash me-2"></i>${t('settings.clearSession')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Save Settings handler
  const form = document.getElementById('settings-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-settings');
    saveBtn.disabled = true;

    const newSettings = {
      ship_name: document.getElementById('input-ship-name').value,
      auto_reset_seconds: parseInt(document.getElementById('input-auto-reset').value),
      scan_mode: document.getElementById('select-scan-mode').value,
      regula_url: document.getElementById('input-regula-url').value
    };

    const result = await window.api.settings.set(newSettings);
    saveBtn.disabled = false;
    
    if (result.ok) {
       alert(t('import.success'));
       // Update scan mode in main process via Regula setMode
       window.api.regula.setMode({ mode: newSettings.scan_mode });
    } else {
       alert(result.message || t('common.error'));
    }
  };

  // Clear Session handler
  document.getElementById('btn-clear-session').onclick = async () => {
    if (confirm('Are you sure you want to clear ALL session data? This will wipe the current manifest and scan history.')) {
      const result = await window.api.session.clear();
      if (result.ok) {
        alert('Session cleared successfully');
        window.location.hash = '#/';
      } else {
        alert(result.message || t('common.error'));
      }
    }
  };
}
