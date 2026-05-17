import { t } from '../i18n/index.js';
import { showReasonToast } from '../components/reasonToast.js';

export async function renderSettings(container) {
  const settings = await window.api.settings.get();
  const currentMode = settings.scan_mode || 'keyboard';

  const html = `
    <div class="page-settings">
      <h1 class="mb-4">${t('nav.settings')}</h1>

      <div class="row">
        <div class="col-md-8">

          <!-- ── General Settings ── -->
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
                    <label class="form-label"><i class="bi bi-hdd-network me-1"></i>${t('settings.regulaUrl')}</label>
                    <div class="input-group">
                      <input type="text" class="form-control" id="input-regula-url" value="${settings.regula_url || 'http://localhost:8080'}">
                      <button type="button" class="btn btn-outline-info btn-test-url" data-target="input-regula-url" data-badge="regula-test-badge" title="اختبار الاتصال">
                        <i class="bi bi-wifi"></i>
                      </button>
                    </div>
                    <span id="regula-test-badge" class="badge mt-1" style="display:none;"></span>
                    <div class="form-text text-muted">${t('settings.help.regulaUrl')}</div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.pollInterval')}</label>
                    <input type="number" class="form-control" id="input-regula-poll" min="100" max="5000" value="${settings.regula_poll_ms || 500}">
                    <div class="form-text text-muted">${t('settings.help.regulaPoll')}</div>
                  </div>
                </div>

                <!-- Penta device settings -->
                <div id="penta-settings" class="row mb-3" style="display:${currentMode === 'penta' ? 'flex' : 'none'};">
                  <div class="col-md-6 mb-3 mb-md-0">
                    <label class="form-label"><i class="bi bi-hdd-network me-1"></i>${t('settings.pentaUrl')}</label>
                    <div class="input-group">
                      <input type="text" class="form-control" id="input-penta-url" value="${settings.penta_url || 'http://localhost:8085'}">
                      <button type="button" class="btn btn-outline-info btn-test-url" data-target="input-penta-url" data-badge="penta-test-badge" title="اختبار الاتصال">
                        <i class="bi bi-wifi"></i>
                      </button>
                    </div>
                    <span id="penta-test-badge" class="badge mt-1" style="display:none;"></span>
                    <div class="form-text text-muted">${t('settings.help.pentaUrl')}</div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">${t('settings.pollInterval')}</label>
                    <input type="number" class="form-control" id="input-penta-poll" min="100" max="5000" value="${settings.penta_poll_ms || 500}">
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

          <!-- ── File Watcher + Shared Path ── -->
          <div class="card border-secondary bg-dark shadow mb-4">
            <div class="card-header border-secondary d-flex justify-content-between align-items-center">
              <h5 class="mb-0 text-accent"><i class="bi bi-folder-symlink me-2"></i>مسار الملف والمراقبة التلقائية</h5>
              <span id="watcher-badge" class="badge ${settings.watch_file_enabled ? 'bg-success' : 'bg-secondary'}" style="font-size:0.75rem;">
                <i class="bi ${settings.watch_file_enabled ? 'bi-eye' : 'bi-eye-slash'} me-1"></i>
                ${settings.watch_file_enabled ? 'مفعّلة' : 'متوقفة'}
              </span>
            </div>
            <div class="card-body">
              <p class="text-muted small mb-3">
                المسار المُدخل يُستخدم لمراقبة الملف تلقائياً عند التحديث (File Watcher)، ويُستخدم أيضاً كمسار للـ API الداخلي.
                يُشغَّل تلقائياً عند بدء التطبيق بناءً على الإعداد المحفوظ.
              </p>

              <div class="row g-3 align-items-end">
                <div class="col-md-3">
                  <div class="form-check form-switch mb-1">
                    <input class="form-check-input" type="checkbox" id="check-watcher-enabled"
                           ${settings.watch_file_enabled ? 'checked' : ''}>
                    <label class="form-check-label fw-semibold" for="check-watcher-enabled">تفعيل المراقبة</label>
                  </div>
                </div>
                <div class="col-md-7">
                  <label class="form-label mb-1">المسار <span class="text-muted small">(مثال: C:\\MRZ.txt أو /import/mrz)</span></label>
                  <input type="text" class="form-control" id="input-shared-path"
                         value="${settings.watch_file_path || settings.api_server_path || ''}">
                </div>
                <div class="col-md-2">
                  <button type="button" id="btn-save-watcher" class="btn btn-primary w-100">
                    <i class="bi bi-save me-1"></i>حفظ
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Field Requirements ── -->
          <div class="card border-secondary bg-dark shadow mb-4">
            <div class="card-header border-secondary d-flex justify-content-between align-items-center">
              <h5 class="mb-0 text-accent"><i class="bi bi-card-checklist me-2"></i>تخصيص الحقول المطلوبة</h5>
              <span class="badge bg-info text-dark">متطلبات النظام</span>
            </div>
            <div class="card-body">
              <p class="text-muted small mb-3">
                حدد الحقول الإلزامية التي يجب توفرها في بيانات المسافر (سواء عبر الاستيراد من ملف أو المسح المباشر).
                إذا كان الحقل غير مفعل هنا، يُعتبر اختيارياً ولن يمنع تسجيل المسافر إذا كان مفقوداً.
              </p>

              <div class="table-responsive">
                <table class="table table-dark table-hover align-middle mb-0" id="table-field-reqs">
                  <thead>
                    <tr>
                      <th>اسم الحقل</th>
                      <th class="text-end">مطلوب (إلزامي)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- Injected dynamically -->
                  </tbody>
                </table>
              </div>

              <div class="d-flex justify-content-end mt-3">
                <button type="button" id="btn-save-field-reqs" class="btn btn-primary px-4">
                  <i class="bi bi-save me-2"></i>حفظ الحقول
                </button>
              </div>
            </div>
          </div>

        </div>

        <div class="col-md-4">
          <!-- ── Danger Zone ── -->
          <div class="card bg-dark border-danger shadow mb-4">
            <div class="card-header border-danger bg-danger bg-opacity-25">
              <h5 class="mb-0 text-danger"><i class="bi bi-exclamation-triangle-fill me-2"></i>منطقة الخطر</h5>
            </div>
            <div class="card-body text-center p-4">
              <p class="text-muted small mb-4">${t('settings.help.clearSession')}</p>
              <button id="btn-clear-session" class="btn btn-outline-danger w-100">
                <i class="bi bi-trash me-2"></i>${t('settings.clearSession')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Password Modal for Clear Session -->
      <div class="modal fade" id="clearModal" tabindex="-1" aria-labelledby="clearModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content bg-dark text-white border-danger">
            <div class="modal-header border-danger bg-danger bg-opacity-25">
              <h5 class="modal-title text-danger" id="clearModalLabel"><i class="bi bi-shield-lock-fill me-2"></i>تأكيد مسح البيانات</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
              <p class="mb-3">يرجى إدخال كلمة مرور المشرف لتأكيد مسح كافة بيانات الرحلة والسجلات الحالية:</p>
              <input type="password" id="input-clear-password" class="form-control bg-black bg-opacity-50 text-white border-secondary mb-2" placeholder="كلمة المرور">
              <div id="clear-error" class="text-danger small d-none">كلمة المرور غير صحيحة</div>
            </div>
            <div class="modal-footer border-danger">
              <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">${t('common.cancel')}</button>
              <button type="button" id="btn-confirm-clear" class="btn btn-danger px-4"><i class="bi bi-trash me-1"></i>مسح البيانات</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Toggle scan mode settings visibility
  const selectScanMode = document.getElementById('select-scan-mode');
  selectScanMode.onchange = () => {
    const val = selectScanMode.value;
    document.getElementById('regula-settings').style.display = (val === 'regula' || val === 'api') ? 'flex' : 'none';
    document.getElementById('penta-settings').style.display  = val === 'penta' ? 'flex' : 'none';
  };

  // Test URL buttons
  container.querySelectorAll('.btn-test-url').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-target');
      const badgeId  = btn.getAttribute('data-badge');
      const url = document.getElementById(targetId).value.trim();
      const badge = document.getElementById(badgeId);

      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
      badge.style.display = 'none';

      const result = await window.api.settings.testDeviceUrl({ url });

      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-wifi"></i>`;
      badge.style.display = 'inline-block';

      if (result.ok) {
        badge.className = 'badge bg-success mt-1';
        badge.textContent = `✓ متصل (${result.status})`;
      } else {
        badge.className = 'badge bg-danger mt-1';
        badge.textContent = `✗ ${result.message}`;
      }
    });
  });

  // Save general settings
  document.getElementById('settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-settings');
    saveBtn.disabled = true;

    const newSettings = {
      ship_name:          document.getElementById('input-ship-name').value,
      auto_reset_seconds: parseInt(document.getElementById('input-auto-reset').value) || 5,
      scan_mode:          document.getElementById('select-scan-mode').value,
      regula_url:         document.getElementById('input-regula-url').value,
      regula_poll_ms:     parseInt(document.getElementById('input-regula-poll').value) || 500,
      penta_url:          document.getElementById('input-penta-url').value,
      penta_poll_ms:      parseInt(document.getElementById('input-penta-poll').value) || 500,
      retention_days:     parseInt(document.getElementById('input-retention').value) || 30,
      sound_enabled:      document.getElementById('check-sound').checked,
    };

    const result = await window.api.settings.set(newSettings);
    saveBtn.disabled = false;

    if (result.ok) {
      alert(t('import.success'));
      window.api.regula.setMode({ mode: newSettings.scan_mode });
    } else {
      showReasonToast({ code: result.reason || 'IPC_INVALID_ARGS', message: result.message || t('common.error'), suggestion: 'تحقق من صحة القيم المدخلة' }, 'danger');
    }
  };

  // Save file watcher + shared path
  document.getElementById('btn-save-watcher').onclick = async () => {
    const btn = document.getElementById('btn-save-watcher');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

    const sharedPath = document.getElementById('input-shared-path').value.trim();
    const enabled    = document.getElementById('check-watcher-enabled').checked;

    const result = await window.api.settings.set({
      watch_file_enabled: enabled,
      watch_file_path:    sharedPath,
      api_server_path:    sharedPath,
    });

    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-save me-1"></i>حفظ`;

    if (result.ok) {
      // Update badge
      const badge = document.getElementById('watcher-badge');
      if (badge) {
        badge.className = `badge ${enabled ? 'bg-success' : 'bg-secondary'}`;
        badge.innerHTML = `<i class="bi ${enabled ? 'bi-eye' : 'bi-eye-slash'} me-1"></i>${enabled ? 'مفعّلة' : 'متوقفة'}`;
      }
    } else {
      showReasonToast({ code: result.reason || 'IPC_INVALID_ARGS', message: result.message || t('common.error'), suggestion: 'تأكد من مسار المجلد وصلاحيات الوصول' }, 'danger');
    }
  };

  // Clear session — Bootstrap modal with password field (prompt/confirm blocked in Electron sandbox)
  document.getElementById('btn-clear-session').onclick = () => {
    const modalEl = document.getElementById('clearModal');
    document.getElementById('input-clear-password').value = '';
    document.getElementById('clear-error').classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
    setTimeout(() => document.getElementById('input-clear-password').focus(), 300);
  };

  document.getElementById('btn-confirm-clear').onclick = async () => {
    const password = document.getElementById('input-clear-password').value;
    const errEl = document.getElementById('clear-error');
    const btn = document.getElementById('btn-confirm-clear');

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>جاري المسح...`;

    const result = await window.api.session.clearWithPassword({ password });

    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-trash me-1"></i>مسح البيانات`;

    if (result.ok) {
      bootstrap.Modal.getOrCreateInstance(document.getElementById('clearModal')).hide();
      window.location.hash = '#/';
    } else {
      errEl.textContent = result.message || 'كلمة المرور غير صحيحة';
      errEl.classList.remove('d-none');
      document.getElementById('input-clear-password').value = '';
      document.getElementById('input-clear-password').focus();
    }
  };

  // Field Requirements table population and save handler
  const fieldReqs = await window.api.settings.getFieldRequirements();
  const fieldReqsTbody = container.querySelector('#table-field-reqs tbody');
  const fieldKeys = [
    { key: 'passportNumber', label: 'رقم الجواز (Passport Number)' },
    { key: 'familyName', label: 'اسم العائلة / اللقب (Family Name)' },
    { key: 'givenName', label: 'الاسم الأول (Given Name)' },
    { key: 'dob', label: 'تاريخ الميلاد (Date of Birth)' },
    { key: 'nationality', label: 'الجنسية (Nationality)' },
    { key: 'gender', label: 'الجنس (Gender)' },
    { key: 'documentType', label: 'نوع الوثيقة (Document Type)' }
  ];

  fieldReqsTbody.innerHTML = fieldKeys.map(item => `
    <tr>
      <td class="fw-semibold">${item.label}</td>
      <td class="text-end">
        <div class="form-check form-switch d-inline-block">
          <input class="form-check-input check-field-req" type="checkbox" data-key="${item.key}" ${fieldReqs[item.key] ? 'checked' : ''}>
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('btn-save-field-reqs').onclick = async () => {
    const btn = document.getElementById('btn-save-field-reqs');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>جاري الحفظ...`;

    const updatedReqs = {};
    container.querySelectorAll('.check-field-req').forEach(input => {
      updatedReqs[input.getAttribute('data-key')] = input.checked;
    });

    try {
      const res = await window.api.settings.setFieldRequirements(updatedReqs);
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-save me-1"></i>حفظ الحقول`;
      if (res.ok) {
        alert('تم حفظ إعدادات الحقول بنجاح');
      } else {
        showReasonToast({ code: res.reason || 'IPC_INVALID_ARGS', message: res.message || t('common.error'), suggestion: 'تحقق من صحة مفاتيح الحقول المطلوبة' }, 'danger');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-save me-1"></i>حفظ الحقول`;
    }
  };
}
