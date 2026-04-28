/**
 * Settings Page
 * Allows operator to configure app behavior, scanner device, and clear data.
 */

import { t } from '../i18n/index.js';

export async function renderSettings(container) {
  const settings = await window.api.settings.get();
  const currentMode = settings.scan_mode || 'keyboard';

  const html = `
    <div class="page-settings">
      <h1 class="mb-4">${t('nav.settings')}</h1>

      <div class="row">
        <div class="col-md-8">
          <div class="card bg-dark border-secondary shadow mb-4">
            <div class="card-header border-secondary">
              <h5 class="mb-0 text-accent"><i class="bi bi-gear me-2"></i>${t('nav.settings')}</h5>
            </div>
            <div class="card-body">
              <form id="settings-form">
                <!-- Ship Name + Auto Reset -->
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.shipName')}</label>
                    <input type="text" class="form-control" 
                           id="input-ship-name" value="${settings.ship_name || ''}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.autoReset')}</label>
                    <input type="number" class="form-control" 
                           id="input-auto-reset" min="1" max="30" value="${settings.auto_reset_seconds || 5}">
                  </div>
                </div>

                <!-- Scan Mode Selection -->
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label class="form-label"><i class="bi bi-upc-scan me-1"></i>Scan Mode</label>
                    <select class="form-select" id="select-scan-mode">
                      <option value="keyboard" ${currentMode === 'keyboard' ? 'selected' : ''}>${t('settings.scanMode.keyboard')}</option>
                      <option value="regula" ${currentMode === 'regula' || currentMode === 'api' ? 'selected' : ''}>${t('settings.scanMode.regula')}</option>
                      <option value="penta" ${currentMode === 'penta' ? 'selected' : ''}>${t('settings.scanMode.penta')}</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.retention')}</label>
                    <input type="number" class="form-control" 
                           id="input-retention" min="1" max="365" value="${settings.retention_days || 30}">
                  </div>
                </div>

                <!-- Device URLs (shown based on scan mode) -->
                <div id="regula-settings" class="row mb-3" style="display: ${currentMode === 'regula' || currentMode === 'api' ? 'flex' : 'none'};">
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.regulaUrl')}</label>
                    <input type="text" class="form-control" 
                           id="input-regula-url" value="${settings.regula_url || 'http://localhost:8080'}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Poll Interval (ms)</label>
                    <input type="number" class="form-control" 
                           id="input-regula-poll" min="100" max="5000" value="${settings.regula_poll_ms || 500}">
                  </div>
                </div>

                <div id="penta-settings" class="row mb-3" style="display: ${currentMode === 'penta' ? 'flex' : 'none'};">
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.pentaUrl')}</label>
                    <input type="text" class="form-control" 
                           id="input-penta-url" value="${settings.penta_url || 'http://localhost:8085'}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Poll Interval (ms)</label>
                    <input type="number" class="form-control" 
                           id="input-penta-poll" min="100" max="5000" value="${settings.penta_poll_ms || 500}">
                  </div>
                </div>

                <!-- Sound + Save -->
                <div class="row mb-3">
                  <div class="col-md-6">
                    <div class="form-check form-switch mt-3">
                      <input class="form-check-input" type="checkbox" id="check-sound" 
                             ${settings.sound_enabled !== false ? 'checked' : ''}>
                      <label class="form-check-label" for="check-sound">${t('settings.sound')}</label>
                    </div>
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

          <!-- Danger Zone: Clear Session -->
          <div class="card border-danger bg-dark shadow mb-4">
            <div class="card-header border-danger">
              <h5 class="mb-0 text-danger"><i class="bi bi-exclamation-triangle me-2"></i>${t('settings.clearSession')}</h5>
            </div>
            <div class="card-body">
              <p class="text-muted small">${t('settings.language') === 'اللغة' 
                ? 'سيتم حذف جميع بيانات الرحلة الحالية بما فيها بيانات المسافرين وسجل المسح. لا يمكن التراجع عن هذا الإجراء.' 
                : 'This will permanently delete the current voyage, all manifest data, scan history, and boarding records. This action cannot be undone.'}</p>
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

  // Toggle device-specific settings visibility based on scan mode selection
  const scanModeSelect = document.getElementById('select-scan-mode');
  scanModeSelect.addEventListener('change', () => {
    const mode = scanModeSelect.value;
    document.getElementById('regula-settings').style.display = mode === 'regula' ? 'flex' : 'none';
    document.getElementById('penta-settings').style.display = mode === 'penta' ? 'flex' : 'none';
  });

  // Save Settings handler
  const form = document.getElementById('settings-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-settings');
    saveBtn.disabled = true;

    const newSettings = {
      ship_name: document.getElementById('input-ship-name').value,
      auto_reset_seconds: parseInt(document.getElementById('input-auto-reset').value) || 5,
      scan_mode: document.getElementById('select-scan-mode').value,
      regula_url: document.getElementById('input-regula-url').value,
      regula_poll_ms: parseInt(document.getElementById('input-regula-poll').value) || 500,
      penta_url: document.getElementById('input-penta-url').value,
      penta_poll_ms: parseInt(document.getElementById('input-penta-poll').value) || 500,
      retention_days: parseInt(document.getElementById('input-retention').value) || 30,
      sound_enabled: document.getElementById('check-sound').checked
    };

    const result = await window.api.settings.set(newSettings);
    saveBtn.disabled = false;
    
    if (result.ok) {
      alert(t('import.success'));
      // Update scan mode in main process
      window.api.regula.setMode({ mode: newSettings.scan_mode });
    } else {
      alert(result.message || t('common.error'));
    }
  };

  // Clear Session handler
  document.getElementById('btn-clear-session').onclick = async () => {
    const confirmMsg = t('settings.language') === 'اللغة'
      ? 'هل أنت متأكد من مسح جميع البيانات الحالية؟'
      : 'Are you sure you want to clear ALL session data? This will wipe the current manifest and scan history.';
    if (confirm(confirmMsg)) {
      const result = await window.api.session.clear();
      if (result.ok) {
        alert(t('settings.language') === 'اللغة' ? 'تم مسح البيانات بنجاح' : 'Session cleared successfully');
        window.location.hash = '#/';
      } else {
        alert(result.message || t('common.error'));
      }
    }
  };
}
