import { t } from '../i18n/index.js';

let statusPollInterval = null;

export async function renderSettings(container) {
  const settings = await window.api.settings.get();
  const currentMode = settings.scan_mode || 'keyboard';

  // Fetch live API server status
  let apiStatus = { running: false, port: null };
  try {
    apiStatus = await window.api.settings.apiServerStatus();
  } catch (_) { /* preload may not have the method in older builds */ }

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
                  <div class="col-md-6 mb-3 mb-md-0">
                    <label class="form-label">${t('settings.shipName')}</label>
                    <input type="text" class="form-control"
                           id="input-ship-name" value="${settings.ship_name || ''}">
                    <div class="form-text text-muted">${t('settings.help.shipName')}</div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.autoReset')}</label>
                    <input type="number" class="form-control"
                           id="input-auto-reset" min="1" max="30" value="${settings.auto_reset_seconds || 5}">
                    <div class="form-text text-muted">${t('settings.help.autoReset')}</div>
                  </div>
                </div>

                <!-- Scan Mode + Retention -->
                <div class="row mb-3">
                  <div class="col-md-6 mb-3 mb-md-0">
                    <label class="form-label"><i class="bi bi-upc-scan me-1"></i>${t('settings.scanMode.label')}</label>
                    <select class="form-select" id="select-scan-mode">
                      <option value="keyboard" ${currentMode === 'keyboard' ? 'selected' : ''}>${t('settings.scanMode.keyboard')}</option>
                      <option value="regula"   ${currentMode === 'regula' || currentMode === 'api' ? 'selected' : ''}>${t('settings.scanMode.regula')}</option>
                      <option value="penta"    ${currentMode === 'penta' ? 'selected' : ''}>${t('settings.scanMode.penta')}</option>
                    </select>
                    <div class="form-text text-muted">${t('settings.help.scanMode')}</div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.retention')}</label>
                    <input type="number" class="form-control"
                           id="input-retention" min="1" max="365" value="${settings.retention_days || 30}">
                    <div class="form-text text-muted">${t('settings.help.retention')}</div>
                  </div>
                </div>

                <!-- Regula device settings -->
                <div id="regula-settings" class="row mb-3" style="display:${currentMode === 'regula' || currentMode === 'api' ? 'flex' : 'none'};">
                  <div class="col-md-6 mb-3 mb-md-0">
                    <label class="form-label">${t('settings.regulaUrl')}</label>
                    <input type="text" class="form-control"
                           id="input-regula-url" value="${settings.regula_url || 'http://localhost:8080'}">
                    <div class="form-text text-muted">${t('settings.help.regulaUrl')}</div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.pollInterval')}</label>
                    <input type="number" class="form-control"
                           id="input-regula-poll" min="100" max="5000" value="${settings.regula_poll_ms || 500}">
                    <div class="form-text text-muted">${t('settings.help.regulaPoll')}</div>
                  </div>
                </div>

                <!-- Penta device settings -->
                <div id="penta-settings" class="row mb-3" style="display:${currentMode === 'penta' ? 'flex' : 'none'};">
                  <div class="col-md-6 mb-3 mb-md-0">
                    <label class="form-label">${t('settings.pentaUrl')}</label>
                    <input type="text" class="form-control"
                           id="input-penta-url" value="${settings.penta_url || 'http://localhost:8085'}">
                    <div class="form-text text-muted">${t('settings.help.pentaUrl')}</div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.pollInterval')}</label>
                    <input type="number" class="form-control"
                           id="input-penta-poll" min="100" max="5000" value="${settings.penta_poll_ms || 500}">
                    <div class="form-text text-muted">${t('settings.help.pentaPoll')}</div>
                  </div>
                </div>

                <!-- Sound -->
                <div class="row mb-3">
                  <div class="col-md-6">
                    <div class="form-check form-switch mt-3">
                      <input class="form-check-input" type="checkbox" id="check-sound"
                             ${settings.sound_enabled !== false ? 'checked' : ''}>
                      <label class="form-check-label" for="check-sound">${t('settings.sound')}</label>
                    </div>
                    <div class="form-text text-muted ms-4">${t('settings.help.sound')}</div>
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

          <!-- ═══════════════════════════════════════════════════ -->
          <!-- API Server Card                                    -->
          <!-- ═══════════════════════════════════════════════════ -->
          <div class="card bg-dark border-secondary shadow mb-4" id="api-server-card">
            <div class="card-header border-secondary d-flex justify-content-between align-items-center">
              <h5 class="mb-0 text-accent"><i class="bi bi-hdd-network me-2"></i>${t('settings.apiServer.title')}</h5>
              <span id="api-status-badge" class="badge ${apiStatus.running ? 'bg-success' : 'bg-secondary'}" style="font-size: 0.75rem;">
                <i class="bi ${apiStatus.running ? 'bi-broadcast' : 'bi-stop-circle'} me-1"></i>
                <span id="api-status-text">${apiStatus.running ? t('settings.apiServer.statusRunning').replace('{{port}}', apiStatus.port) : t('settings.apiServer.statusStopped')}</span>
              </span>
            </div>
            <div class="card-body">
              <p class="text-muted small mb-3">${t('settings.apiServer.description')}</p>

              <div class="row align-items-end">
                <div class="col-md-5 mb-3 mb-md-0">
                  <div class="form-check form-switch mb-2">
                    <input class="form-check-input" type="checkbox" id="check-api-enabled"
                           ${settings.api_server_enabled !== false ? 'checked' : ''}>
                    <label class="form-check-label fw-semibold" for="check-api-enabled">${t('settings.apiServer.enabled')}</label>
                  </div>
                  <div class="form-text text-muted ms-4">${t('settings.help.apiServerEnabled')}</div>
                </div>
                <div class="col-md-3 mb-3 mb-md-0">
                  <label class="form-label">${t('settings.apiServer.port')}</label>
                  <input type="number" class="form-control" id="input-api-port"
                         min="1024" max="65535" value="${settings.api_server_port || 7755}"
                         ${settings.api_server_enabled === false ? 'disabled' : ''}>
                </div>
                <div class="col-md-4">
                  <label class="form-label">${t('settings.apiServer.path')}</label>
                  <div class="d-flex gap-2">
                    <input type="text" class="form-control" id="input-api-path"
                           value="${settings.api_server_path || '/import/mrz'}"
                           ${settings.api_server_enabled === false ? 'disabled' : ''}>
                    <button type="button" id="btn-save-api" class="btn btn-primary px-3">
                      <i class="bi bi-arrow-repeat"></i>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Example usage box -->
              <div class="mt-4 p-3 rounded" style="background: rgba(0,0,0,0.3); border: 1px solid var(--border);">
                <div class="d-flex align-items-center mb-2">
                  <i class="bi bi-terminal me-2 text-accent"></i>
                  <span class="fw-semibold small text-accent">cURL Examples</span>
                </div>
                <pre class="mb-0 small" style="color: var(--text-dim); white-space: pre-wrap; word-break: break-all;"><code># Raw text body
curl -X POST -H 'Content-Type: text/plain' \\
  --data-binary @MRZ.txt http://127.0.0.1:<span id="example-port">${settings.api_server_port || 7755}</span><span id="example-path">${settings.api_server_path || '/import/mrz'}</span>

# Multipart upload
curl -X POST -F "file=@MRZ.txt" \\
  http://127.0.0.1:<span id="example-port-2">${settings.api_server_port || 7755}</span><span id="example-path-2">${settings.api_server_path || '/import/mrz'}</span></code></pre>
              </div>
            </div>
          </div>

          <!-- File Watcher -->
          <div class="card border-secondary bg-dark shadow mb-4">
            <div class="card-header border-secondary d-flex justify-content-between align-items-center">
              <h5 class="mb-0"><i class="bi bi-folder-symlink me-2"></i>المسح التلقائي من ملف (File Watcher)</h5>
            </div>
            <div class="card-body">
              <p class="text-muted small mb-3">يقوم بمسح الجواز تلقائياً بمجرد تحديث أو حفظ الملف من قِبل جهاز المسح الخارجي.</p>

              <div class="row align-items-end">
                <div class="col-md-5 mb-3 mb-md-0">
                  <div class="form-check form-switch mb-2">
                    <input class="form-check-input" type="checkbox" id="check-watcher-enabled"
                           ${settings.watch_file_enabled ? 'checked' : ''}>
                    <label class="form-check-label fw-semibold" for="check-watcher-enabled">تفعيل المراقبة التلقائية</label>
                  </div>
                </div>
                <div class="col-md-7">
                  <label class="form-label">المسار الكامل للملف (مثال: C:\\MRZ.txt أو /path/to/MRZ.txt)</label>
                  <div class="d-flex gap-2">
                    <input type="text" class="form-control" id="input-watcher-path"
                           value="${settings.watch_file_path || ''}"
                           ${settings.watch_file_enabled ? '' : 'disabled'}>
                    <button type="button" id="btn-save-watcher" class="btn btn-primary px-3">
                      <i class="bi bi-arrow-repeat"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Danger Zone -->
          <div class="card border-danger bg-dark shadow mb-4">
            <div class="card-header border-danger">
              <h5 class="mb-0 text-danger"><i class="bi bi-exclamation-triangle me-2"></i>${t('settings.clearSession')}</h5>
            </div>
            <div class="card-body">
              <p class="text-muted small">${t('settings.help.clearSession')}</p>
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

  // Toggle device-specific rows on scan mode change
  const scanModeSelect = document.getElementById('select-scan-mode');
  scanModeSelect.addEventListener('change', () => {
    const mode = scanModeSelect.value;
    document.getElementById('regula-settings').style.display = mode === 'regula' ? 'flex' : 'none';
    document.getElementById('penta-settings').style.display  = mode === 'penta'   ? 'flex' : 'none';
  });

  // ── API Server toggle ──────────────────────────────────────────
  const apiEnabledCheck = document.getElementById('check-api-enabled');
  const apiPortInput = document.getElementById('input-api-port');
  const apiPathInput = document.getElementById('input-api-path');

  apiEnabledCheck.addEventListener('change', () => {
    apiPortInput.disabled = !apiEnabledCheck.checked;
    apiPathInput.disabled = !apiEnabledCheck.checked;
  });

  // Update example port/path in real time
  const updateExamples = () => {
    const p = apiPortInput.value || '7755';
    let pth = apiPathInput.value || '/import/mrz';
    if (!pth.startsWith('/')) pth = '/' + pth;

    const el1 = document.getElementById('example-port');
    const el2 = document.getElementById('example-port-2');
    const elP1 = document.getElementById('example-path');
    const elP2 = document.getElementById('example-path-2');
    
    if (el1) el1.textContent = p;
    if (el2) el2.textContent = p;
    if (elP1) elP1.textContent = pth;
    if (elP2) elP2.textContent = pth;
  };
  
  apiPortInput.addEventListener('input', updateExamples);
  apiPathInput.addEventListener('input', updateExamples);

  // Save API server settings
  document.getElementById('btn-save-api').onclick = async () => {
    const btn = document.getElementById('btn-save-api');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

    let newPath = apiPathInput.value || '/import/mrz';
    if (!newPath.startsWith('/')) newPath = '/' + newPath;

    const apiSettings = {
      api_server_enabled: apiEnabledCheck.checked,
      api_server_port: parseInt(apiPortInput.value) || 7755,
      api_server_path: newPath,
    };

    const result = await window.api.settings.set(apiSettings);
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-arrow-repeat"></i>`;

    if (result.ok) {
      // Refresh the status badge after a short delay (server needs time to bind)
      setTimeout(() => refreshApiStatus(), 500);
    } else {
      alert(result.message || t('common.error'));
    }
  };

  // File Watcher Settings
  const watcherEnabledCheck = document.getElementById('check-watcher-enabled');
  const watcherPathInput = document.getElementById('input-watcher-path');
  
  watcherEnabledCheck.addEventListener('change', () => {
    watcherPathInput.disabled = !watcherEnabledCheck.checked;
  });

  document.getElementById('btn-save-watcher').onclick = async () => {
    const btn = document.getElementById('btn-save-watcher');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

    const watcherSettings = {
      watch_file_enabled: watcherEnabledCheck.checked,
      watch_file_path: watcherPathInput.value,
    };

    const result = await window.api.settings.set(watcherSettings);
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-arrow-repeat"></i>`;

    if (!result.ok) {
      alert(result.message || t('common.error'));
    }
  };

  // Save general settings
  document.getElementById('settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-settings');
    saveBtn.disabled = true;

    const newSettings = {
      ship_name:          document.getElementById('input-ship-name').value,
      auto_reset_seconds: parseInt(document.getElementById('input-auto-reset').value)  || 5,
      scan_mode:          document.getElementById('select-scan-mode').value,
      regula_url:         document.getElementById('input-regula-url').value,
      regula_poll_ms:     parseInt(document.getElementById('input-regula-poll').value) || 500,
      penta_url:          document.getElementById('input-penta-url').value,
      penta_poll_ms:      parseInt(document.getElementById('input-penta-poll').value)  || 500,
      retention_days:     parseInt(document.getElementById('input-retention').value)   || 30,
      sound_enabled:      document.getElementById('check-sound').checked,
    };

    const result = await window.api.settings.set(newSettings);
    saveBtn.disabled = false;

    if (result.ok) {
      alert(t('import.success'));
      window.api.regula.setMode({ mode: newSettings.scan_mode });
    } else {
      alert(result.message || t('common.error'));
    }
  };

  // Clear session
  document.getElementById('btn-clear-session').onclick = async () => {
    if (confirm(t('settings.clearConfirm'))) {
      const result = await window.api.session.clear();
      if (result.ok) {
        alert(t('settings.clearSuccess'));
        window.location.hash = '#/';
      } else {
        alert(result.message || t('common.error'));
      }
    }
  };

  // ── Live status polling ────────────────────────────────────────
  if (statusPollInterval) clearInterval(statusPollInterval);
  statusPollInterval = setInterval(() => refreshApiStatus(), 3000);
  // Also clean up when we leave the page
  const observer = new MutationObserver(() => {
    if (!document.getElementById('api-server-card')) {
      clearInterval(statusPollInterval);
      statusPollInterval = null;
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true });
}

async function refreshApiStatus() {
  try {
    const st = await window.api.settings.apiServerStatus();
    const badge = document.getElementById('api-status-badge');
    const text = document.getElementById('api-status-text');
    if (!badge || !text) return;

    if (st.running) {
      badge.className = 'badge bg-success';
      badge.querySelector('i').className = 'bi bi-broadcast me-1';
      text.textContent = t('settings.apiServer.statusRunning').replace('{{port}}', st.port);
    } else {
      badge.className = 'badge bg-secondary';
      badge.querySelector('i').className = 'bi bi-stop-circle me-1';
      text.textContent = t('settings.apiServer.statusStopped');
    }
  } catch (_) { /* ignore */ }
}
