/**
 * Scan Page
 * Main gate interface. Handles keyboard input and API events.
 */

import { t } from '../i18n/index.js';
import { initAudio, setSoundEnabled, playSuccess, playWarning } from '../components/audio.js';
import { showDuplicateModal } from '../components/duplicateConfirmModal.js';

let resetTimer = null;
let inputBuffer = '';
let lastKeyTime = 0;

function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '1100';
    document.body.appendChild(container);
  }
  const toastEl = document.createElement('div');
  toastEl.className = 'toast align-items-center text-bg-danger border-0';
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fs-5 fw-bold py-3">
        <i class="bi bi-exclamation-octagon me-2"></i> ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-3 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  container.appendChild(toastEl);
  const tInstance = new window.bootstrap.Toast(toastEl, { delay: 5000 });
  tInstance.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

export async function renderScan(container) {
  const settings = await window.api.settings.get();
  const autoResetSeconds = settings.auto_reset_seconds || 5;

  // Initialize audio with settings
  initAudio();
  setSoundEnabled(settings.sound_enabled !== false);

  const html = `
    <div class="page-scan h-100 d-flex flex-column">
      <div id="scan-status-panel" class="flex-grow-1 d-flex flex-column align-items-center justify-content-center rounded-3 mb-3 p-4 transition-all" 
           style="background-color: var(--panel); border: 4px solid transparent;">
        
        <div id="scan-prompt" class="text-center">
          <i class="bi bi-person-bounding-box display-1 mb-4 text-muted"></i>
          <h2 class="display-4 mb-3">${t('scan.placeMrz')}</h2>
          <p class="text-muted fs-4">${t('scan2.shortcutsHint')}</p>
        </div>

        <div id="scan-result" class="d-none w-100 text-center">
          <div id="result-icon" class="mb-4"></div>
          <h1 id="result-title" class="display-2 fw-bold mb-2"></h1>
          <h3 id="result-subtitle" class="mb-5 opacity-75"></h3>
          
          <div id="passenger-card" class="card bg-black bg-opacity-25 border-0 mx-auto" style="max-width: 600px;">
             <div class="card-body p-4 text-start">
                <div class="row g-3">
                   <div class="col-6">
                      <label class="text-muted small">${t('import.table.name')}</label>
                      <div id="p-name" class="fs-4 fw-bold"></div>
                   </div>
                   <div class="col-6 text-end">
                      <label class="text-muted small">${t('import.table.passport')}</label>
                      <div id="p-passport" class="fs-4 fw-bold"></div>
                   </div>
                   <div class="col-4">
                      <label class="text-muted small">${t('import.table.nationality')}</label>
                      <div id="p-nat" class="fs-5"></div>
                   </div>
                   <div class="col-4 text-center">
                      <label class="text-muted small">${t('import.table.gender')}</label>
                      <div id="p-gender" class="fs-5"></div>
                   </div>
                   <div class="col-4 text-end">
                      <label class="text-muted small">${t('import.table.dob')}</label>
                      <div id="p-dob" class="fs-5"></div>
                   </div>
                </div>
             </div>
          </div>

          <div class="mt-5">
             <button id="btn-undo" class="btn btn-outline-light btn-lg d-none">
                <i class="bi bi-arrow-counterclockwise me-2"></i>${t('scan.undo.label')}
             </button>
          </div>
        </div>
      </div>

      <!-- Manual entry panel -->
      <div id="manual-entry-panel" class="d-none mt-3 p-3 rounded" style="background: var(--panel); border: 1px solid var(--border);">
        <h5 class="mb-3"><i class="bi bi-pencil-square me-2"></i>إدخال يدوي</h5>
        <div class="row g-2">
          <div class="col-md-4">
            <input type="text" id="manual-passport" class="form-control bg-dark text-white border-secondary" placeholder="رقم الجواز *">
          </div>
          <div class="col-md-4">
            <input type="text" id="manual-name" class="form-control bg-dark text-white border-secondary" placeholder="الاسم *">
          </div>
          <div class="col-md-2">
            <select id="manual-gender" class="form-select bg-dark text-white border-secondary">
              <option value="">النوع</option>
              <option value="M">ذكر (M)</option>
              <option value="F">أنثى (F)</option>
            </select>
          </div>
          <div class="col-md-2">
            <input type="text" id="manual-nationality" class="form-control bg-dark text-white border-secondary" placeholder="الجنسية (EGY)">
          </div>
          <div class="col-md-3">
            <input type="date" id="manual-dob" class="form-control bg-dark text-white border-secondary">
          </div>
          <div class="col-md-3">
            <button id="btn-manual-submit" class="btn btn-success w-100">
              <i class="bi bi-check-lg me-1"></i>تأكيد الإدخال
            </button>
          </div>
          <div class="col-md-3">
            <button id="btn-manual-cancel" class="btn btn-outline-secondary w-100">إلغاء</button>
          </div>
        </div>
      </div>

      <!-- Manual entry toggle button -->
      <div class="d-flex justify-content-center mt-2">
        <button id="btn-toggle-manual" class="btn btn-sm btn-outline-secondary">
          <i class="bi bi-pencil me-1"></i>إدخال يدوي
        </button>
      </div>

      <!-- Hidden input for keyboard mode -->
      <input type="text" id="mrz-input" style="position: absolute; opacity: 0; pointer-events: none;">
    </div>
  `;

  container.innerHTML = html;

  const mrzInput = document.getElementById('mrz-input');
  const undoBtn = document.getElementById('btn-undo');

  let manualMode = false;

  // Auto-focus the hidden input
  mrzInput.focus();
  document.onclick = (e) => {
    if (manualMode) return; // never steal focus when manual panel is open
    if (e.target.closest('input, select, button, textarea')) return;
    mrzInput.focus();
  };

  mrzInput.onkeydown = (e) => {
    if (manualMode) return; // ignore keyboard when manual panel is open
    if (e.key === 'Enter') {
      const raw = mrzInput.value;
      mrzInput.value = '';
      if (raw) handleScan(raw, autoResetSeconds);
    }
  };

  // Manual entry toggle
  document.getElementById('btn-toggle-manual').onclick = () => {
    const panel = document.getElementById('manual-entry-panel');
    panel.classList.toggle('d-none');
    if (!panel.classList.contains('d-none')) {
      manualMode = true;
      setTimeout(() => document.getElementById('manual-passport').focus(), 50);
    } else {
      manualMode = false;
      mrzInput.focus();
    }
  };

  document.getElementById('btn-manual-cancel').onclick = () => {
    document.getElementById('manual-entry-panel').classList.add('d-none');
    manualMode = false;
    mrzInput.focus();
  };

  document.getElementById('btn-manual-submit').onclick = async () => {
    const passport = document.getElementById('manual-passport').value.trim();
    const name = document.getElementById('manual-name').value.trim();
    const gender = document.getElementById('manual-gender').value;
    const nationality = document.getElementById('manual-nationality').value.trim();
    const dob = document.getElementById('manual-dob').value.trim();

    if (!passport || !name) {
      alert('رقم الجواز والاسم مطلوبان');
      return;
    }

    const result = await window.api.scan.submitManual({ passport, name, gender, nationality, date_of_birth: dob });
    document.getElementById('manual-entry-panel').classList.add('d-none');
    manualMode = false;
    document.getElementById('manual-passport').value = '';
    document.getElementById('manual-name').value = '';
    document.getElementById('manual-gender').value = '';
    document.getElementById('manual-nationality').value = '';
    document.getElementById('manual-dob').value = '';
    await showScanResult(result, autoResetSeconds);
  };

  undoBtn.onclick = async () => {
    const result = await window.api.scan.undoLast();
    if (result.ok) {
       clearScan(autoResetSeconds);
    }
  };

  // Global key shortcuts (cross-platform: Ctrl for Win/Linux, ⌘ for macOS)
  const keyHandler = (e) => {
    if (e.key === 'Escape') clearScan(autoResetSeconds);
    if (e.key === 'F5') { e.preventDefault(); clearScan(autoResetSeconds); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      const undoBtn = document.getElementById('btn-undo');
      if (undoBtn && !undoBtn.classList.contains('d-none')) undoBtn.click();
    }
  };
  window.addEventListener('keydown', keyHandler);

  // Listen for API scan events
  const unsubscribe = window.api.regula && window.api.regula.onEvent ? window.api.regula.onEvent(async (event) => {
    if (event.type === 'scan' && event.data) {
      await showScanResult(event.data, autoResetSeconds);
    }
  }) : null;

  // Cleanup
  container.addEventListener('remove', () => {
    window.removeEventListener('keydown', keyHandler);
    if (resetTimer) clearTimeout(resetTimer);
    if (unsubscribe) unsubscribe();
  });
}

async function handleScan(rawMrz, autoResetSeconds) {
  const result = await window.api.scan.submitMrz({ rawMrz });
  await showScanResult(result, autoResetSeconds);
}

async function showScanResult(result, autoResetSeconds) {
  if (resetTimer) clearTimeout(resetTimer);

  if (result.outcome === 'rejected' && result.reason === 'DUPLICATE_PASSPORT') {
    showToast(t('reasons.DUPLICATE_PASSPORT') || 'Already scanned');
    playWarning();
    clearScan();
    return;
  }

  if (result.outcome === 'fuzzy') {
    playWarning();
    const decision = await showDuplicateModal(
      result.existingPassenger,
      result.normalizedPassenger,
      result.duplicateMatch.differences
    );
    
    await window.api.resolveDuplicate({
      incomingRaw: result.mrz_fields,
      incomingNormalized: result.normalizedPassenger,
      existingPassengerId: result.existingPassenger.id,
      decision: decision
    });
    
    if (decision !== 'cancel') {
      // Optional: play success or just clear
      playSuccess();
    }
    clearScan();
    return;
  }
  
  const prompt = document.getElementById('scan-prompt');
  const resultPanel = document.getElementById('scan-result');
  const statusPanel = document.getElementById('scan-status-panel');
  const title = document.getElementById('result-title');
  const subtitle = document.getElementById('result-subtitle');
  const icon = document.getElementById('result-icon');
  const undoBtn = document.getElementById('btn-undo');

  if (!prompt) return; // Prevent errors if user navigated away

  prompt.classList.add('d-none');
  resultPanel.classList.remove('d-none');
  undoBtn.classList.add('d-none');

  // Update UI based on outcome
  let bgColor = 'var(--panel)';
  let borderColor = 'transparent';
  let iconHtml = '';

  if (result.outcome === 'green') {
    bgColor = '#064e3b'; // Dark green
    borderColor = 'var(--green)';
    iconHtml = '<i class="bi bi-check-circle-fill display-1 text-green"></i>';
    title.innerText = t('scan.green.title');
    subtitle.innerText = t('scan.green.subtitle');
    undoBtn.classList.remove('d-none');
    playSuccess();
  } else if (result.outcome === 'yellow') {
    bgColor = '#422006'; // Dark yellow/orange
    borderColor = 'var(--yellow)';
    iconHtml = '<i class="bi bi-exclamation-triangle-fill display-1 text-yellow"></i>';
    title.innerText = t('scan.yellow.title');
    subtitle.innerText = t('scan.yellow.subtitle');
    playWarning();
  } else if (result.outcome === 'orange') {
    bgColor = '#431407'; // Dark orange/red
    borderColor = 'var(--orange)';
    iconHtml = '<i class="bi bi-person-x-fill display-1 text-orange"></i>';
    title.innerText = t('scan.orange.title');
    subtitle.innerText = result.warning_message || t('scan.orange.subtitle', { enteredAt: result.first_entered_at });
    playWarning();
  } else {
    bgColor = '#450a0a'; // Dark red
    borderColor = 'var(--red)';
    iconHtml = '<i class="bi bi-x-circle-fill display-1 text-red"></i>';
    title.innerText = t('scan.readFailed.title');
    subtitle.innerText = t('scan.readFailed.subtitle');
    playWarning();
  }

  statusPanel.style.backgroundColor = bgColor;
  statusPanel.style.borderColor = borderColor;
  icon.innerHTML = iconHtml;

  // Fill passenger details
  const p = result.passenger || result.mrz_fields;
  if (p) {
    document.getElementById('passenger-card').classList.remove('d-none');
    document.getElementById('p-name').innerText = p.name || `${p.surname || ''} ${p.given_names || ''}`;
    document.getElementById('p-passport').innerText = p.passport_number || p.document_number || '---';
    document.getElementById('p-nat').innerText = p.nationality || '---';
    document.getElementById('p-gender').innerText = p.gender || p.sex || '---';
    document.getElementById('p-dob').innerText = p.date_of_birth || '---';
  } else {
    document.getElementById('passenger-card').classList.add('d-none');
  }

  // Auto-reset
  const resetDelay = result.outcome === 'yellow' ? 1 : autoResetSeconds;
  resetTimer = setTimeout(() => clearScan(), resetDelay * 1000);
}

function clearScan() {
  if (resetTimer) clearTimeout(resetTimer);
  
  const prompt = document.getElementById('scan-prompt');
  const resultPanel = document.getElementById('scan-result');
  const statusPanel = document.getElementById('scan-status-panel');
  
  prompt.classList.remove('d-none');
  resultPanel.classList.add('d-none');
  statusPanel.style.backgroundColor = 'var(--panel)';
  statusPanel.style.borderColor = 'transparent';
  
  const mrzInput = document.getElementById('mrz-input');
  if (mrzInput) {
    mrzInput.value = '';
    mrzInput.focus();
  }
}
