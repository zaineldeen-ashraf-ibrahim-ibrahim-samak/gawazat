/**
 * Manifest Import Page
 * Allows operator to upload/drop Excel files and preview/import passengers.
 */

import { t } from '../i18n/index.js';
import { showDuplicateModal } from '../components/duplicateConfirmModal.js';
import { showReasonToast } from '../components/reasonToast.js';
import { showSheetPicker } from '../components/sheetPickerModal.js';

let selectedFilePath = null;
let selectedSheetSelection = {};

export async function renderImport(container) {
  const html = `
    <div class="page-import">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>${t('import.title')}</h1>
        <button id="btn-download-template" class="btn btn-outline-info">
          <i class="bi bi-download me-2"></i>${t('import.downloadTemplate')}
        </button>
      </div>

      <div id="import-dropzone" class="import-dropzone p-5 text-center border border-2 border-dashed rounded mb-4">
        <i class="bi bi-file-earmark-excel display-1 mb-3 text-muted"></i>
        <p class="lead">${t('import.dropZone')}</p>
        <button id="select-file" class="btn btn-primary px-4">${t('import.selectFile')}</button>
      </div>

      <div id="import-preview" class="d-none">
        <div class="card bg-dark border-secondary shadow mb-4">
          <div class="card-header border-secondary d-flex justify-content-between align-items-center">
            <h5 class="mb-0 text-accent">${t('import.previewTitle')}</h5>
            <div id="preview-stats">
              <!-- Stats will be injected here -->
            </div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive" style="max-height: 400px;">
              <table class="table table-dark table-hover mb-0">
                <thead>
                  <tr>
                    <th>${t('import.table.passport')}</th>
                    <th>${t('import.table.name')}</th>
                    <th>${t('import.table.gender')}</th>
                    <th>${t('import.table.nationality')}</th>
                    <th>${t('import.table.dob')}</th>
                    <th>${t('import.table.status')}</th>
                  </tr>
                </thead>
                <tbody id="preview-body">
                  <!-- Rows will be injected here -->
                </tbody>
              </table>
            </div>
          </div>
          <div class="card-footer border-secondary d-flex justify-content-end gap-3 p-3">
             <button id="btn-cancel-import" class="btn btn-outline-secondary">${t('common.cancel')}</button>
             <button id="btn-confirm-import" class="btn btn-success px-5 d-none">
               ${t('import.importButton', { count: 0 })}
             </button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Event Listeners
  const dropzone = document.getElementById('import-dropzone');
  const selectFileBtn = document.getElementById('select-file');
  const templateBtn = document.getElementById('btn-download-template');
  const confirmBtn = document.getElementById('btn-confirm-import');
  const cancelBtn = document.getElementById('btn-cancel-import');

  templateBtn.onclick = handleDownloadTemplate;
  selectFileBtn.onclick = handleSelectFile;
  confirmBtn.onclick = handleConfirmImport;
  cancelBtn.onclick = () => renderImport(container); // Reset page

  // Drag and drop handlers
  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.classList.add('border-primary', 'bg-dark');
  };

  dropzone.ondragleave = () => {
    dropzone.classList.remove('border-primary', 'bg-dark');
  };

  dropzone.ondrop = async (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-primary', 'bg-dark');
    
    if (e.dataTransfer.files.length > 0) {
      // Gather all paths from dropped files
      const filePaths = Array.from(e.dataTransfer.files)
        .map(f => f.path)
        .filter(Boolean);
      
      if (filePaths.length > 0) {
        handleFilePaths(filePaths);
      }
    }
  };
}

async function handleSelectFile() {
  const result = await window.api.dialog.openFile({
    title: t('import.selectFile'),
    filters: [
      { name: 'Manifest Files', extensions: ['xlsx', 'xls', 'csv', 'json', 'pdf', 'txt'] },
      { name: 'Excel/CSV Files', extensions: ['xlsx', 'xls', 'csv'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'MRZ Text Files', extensions: ['txt'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (result && result.filePaths) {
    handleFilePaths(result.filePaths);
  }
}

async function handleFilePaths(filePaths) {
  try {
    const previewArea = document.getElementById('import-preview');
    const dropzone = document.getElementById('import-dropzone');
    const confirmBtn = document.getElementById('btn-confirm-import');

    // If any of the selected .xlsx/.xls files has multiple sheets, prompt the
    // operator to pick which tab to import for each one.
    let sheetSelection = {};
    try {
      const probe = await window.api.manifest.listSheets({ filePaths });
      if (probe?.ok && Array.isArray(probe.sheets)) {
        const picked = await showSheetPicker(probe.sheets);
        if (picked === null) {
          // operator cancelled
          return;
        }
        sheetSelection = picked || {};
      }
    } catch (_) { /* no sheets info — fall back to default first-sheet behavior */ }

    const result = await window.api.manifest.preview({ filePaths, sheetSelection });
    selectedFilePath = filePaths; // Now stores array of paths
    selectedSheetSelection = sheetSelection;

    
    if (!result.ok && !result.errors) {
       showDetailedError(result.message || t('common.error'), result.stack || result.details || result.message);
       return;
    }

    // Show preview area
    dropzone.classList.add('d-none');
    previewArea.classList.remove('d-none');

    const passengers = result.passengers || [];
    const errors = result.errors || [];
    
    renderPreviewRows(passengers, errors);
    
    const validCount = passengers.length;
    confirmBtn.innerHTML = t('import.importButton', { count: validCount });
    confirmBtn.classList.remove('d-none');
    
  } catch (err) {
    console.error('Import error:', err);
    showDetailedError(t('common.error'), err.stack || err.message || String(err));
  }
}

function showDetailedError(title, details) {
  const modalId = 'modal-detailed-error';
  let modalEl = document.getElementById(modalId);
  if (!modalEl) {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}-label" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content bg-dark text-white border-danger">
            <div class="modal-header border-danger bg-danger bg-opacity-25">
              <h5 class="modal-title text-danger" id="${modalId}-label">
                <i class="bi bi-exclamation-octagon-fill me-2"></i><span id="${modalId}-title"></span>
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
              <p class="fs-5 mb-3">حدث خطأ أثناء معالجة البيانات. يمكنك الاطلاع على التفاصيل التقنية أدناه:</p>
              <pre id="${modalId}-details" class="p-3 bg-black bg-opacity-50 text-warning rounded border border-secondary overflow-auto" style="max-height: 300px; font-size: 0.85rem; direction: ltr; text-align: left;"></pre>
            </div>
            <div class="modal-footer border-danger">
              <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">${t('common.close') || 'إغلاق'}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div.firstElementChild);
    modalEl = document.getElementById(modalId);
  }
  document.getElementById(`${modalId}-title`).textContent = title;
  document.getElementById(`${modalId}-details`).textContent = details || 'لا توجد تفاصيل إضافية.';
  if (window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  } else {
    alert(`${title}\n\n${details}`);
  }
}

/** Escape HTML entities in user-provided data */
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderPreviewRows(passengers, errors) {
  const previewBody = document.getElementById('preview-body');
  const statsArea = document.getElementById('preview-stats');
  
  let html = '';
  
  // Show valid rows
  passengers.forEach(p => {
    html += `
      <tr>
        <td>${esc(p.passport_number)}</td>
        <td>${esc(p.name)}</td>
        <td>${esc(p.gender)}</td>
        <td>${esc(p.nationality)}</td>
        <td>${esc(p.date_of_birth)}</td>
        <td><span class="badge bg-success">${t('import.validRows')}</span></td>
      </tr>
    `;
  });

  // Show errors
  errors.forEach(err => {
    // Determine passport string
    let rowPassport = err.passportRaw || err.value;
    if (!rowPassport && err.message && err.message.includes('Duplicate passport')) {
      const match = err.message.match(/Duplicate passport number \(([^)]+)\)/);
      if (match) rowPassport = match[1];
    }
    
    const isDuplicate = err.rule === 'duplicate' || err.rule === 'duplicate_file' || (err.message && err.message.includes('Duplicate'));
    
    // Choose appropriate message 
    let displayMessage = esc(err.message);
    if (err.rule === 'duplicate_file') {
       displayMessage = `[${esc(err.fileName)}] ` + t('import.duplicateFileLine', { passport: rowPassport || '?' });
    } else if (err.rule === 'duplicate') {
       displayMessage = t('import.duplicateLine', { passport: rowPassport || '?' });
    }

    html += `
      <tr class="${isDuplicate ? 'table-warning' : 'table-danger'}">
        <td>${rowPassport ? esc(rowPassport) : (err.field === 'passport_number' ? '???' : '')}</td>
        <td colspan="4">${displayMessage} (Row ${esc(err.rowIndex)})</td>
        <td><span class="badge ${isDuplicate ? 'bg-warning text-dark' : 'bg-danger'}">${isDuplicate ? (t('import.duplicateBadge') || 'Duplicate') : t('import.errors')}</span></td>
      </tr>
    `;
  });

  previewBody.innerHTML = html;
  statsArea.innerHTML = `
    <span class="badge bg-success me-2">${passengers.length} ${t('import.validRows')}</span>
    <span class="badge bg-danger">${errors.length} ${t('import.invalidRows')}</span>
  `;
}

async function handleConfirmImport() {
  if (!selectedFilePath || selectedFilePath.length === 0) return;
  
  const confirmBtn = document.getElementById('btn-confirm-import');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t('common.loading')}`;

  const result = await window.api.manifest.import({ filePaths: selectedFilePath, sheetSelection: selectedSheetSelection });
  
  if (result.ok) {
    let resolvedFuzzy = 0;
    
    if (result.fuzzyPrompts && result.fuzzyPrompts.length > 0) {
      // Track decisions already made so the operator isn't re-prompted for
      // the SAME person. Two passes:
      //   - resolvedExistingIds: existing manifest passengers already merged
      //     into. Any later prompt pointing at the same existing record is
      //     auto-merged silently (collapse already handled server-side).
      //   - resolvedIncomingKeys: incoming passport keys already decided.
      //     Subsequent prompts for the same incoming row reuse the decision.
      const resolvedExistingIds = new Set();
      const resolvedIncomingKeys = new Map(); // key → decision

      for (const prompt of result.fuzzyPrompts) {
        const { match, raw, existingPassenger } = prompt;

        const incomingNormalized = {
          passportNumberKey: raw.passport_number_normalized,
          name: raw.name,
          dob: raw.date_of_birth,
          nationality: raw.nationality
        };

        const incomingKey = raw.passport_number_normalized || raw.passport_number || '';

        // If this incoming row was already decided in an earlier prompt,
        // re-use that decision without prompting again. Guarded by a
        // non-empty key so rows without a passport number don't all collapse
        // to a single shared cache entry.
        let decision = incomingKey ? resolvedIncomingKeys.get(incomingKey) : undefined;
        // If we already merged into this existing passenger, skip the
        // prompt — the server-side merge has already consolidated rows.
        if (!decision && resolvedExistingIds.has(existingPassenger.id)) {
          decision = 'merge';
        }

        if (!decision) {
          try {
            decision = await showDuplicateModal(
              existingPassenger,
              incomingNormalized,
              match.differences
            );
          } catch (err) {
            console.warn('Duplicate modal failed:', err);
            decision = 'cancel';
          }
        }

        if (decision !== 'cancel') {
          try {
            await window.api.resolveDuplicate({
              incomingRaw: {
                passport_number: raw.passport_number,
                name: raw.name,
                gender: raw.gender,
                nationality: raw.nationality,
                date_of_birth: raw.date_of_birth,
                vessel: raw.vessel,
                seat: raw.seat,
                source: 'manifest'
              },
              incomingNormalized,
              existingPassengerId: existingPassenger.id,
              decision: decision
            });
            if (decision === 'merge') resolvedExistingIds.add(existingPassenger.id);
            if (incomingKey) resolvedIncomingKeys.set(incomingKey, decision);
            resolvedFuzzy++;
          } catch (err) {
            console.warn('resolveDuplicate failed for row', incomingKey, err);
          }
        } else {
          // Record the cancel so we don't re-prompt for the same incoming.
          if (incomingKey) resolvedIncomingKeys.set(incomingKey, 'cancel');
        }
      }
    }
    
    alert(`${t('import.success')} (Inserted: ${(result.inserted || 0) + resolvedFuzzy}, Duplicates Blocked: ${result.duplicatesBlocked || 0})`);
    window.location.hash = '#/passengers';
  } else {
    showReasonToast({
      code: result.reason || 'IMPORT_FILE_UNREADABLE',
      message: result.message || t('common.error'),
      suggestion: 'تأكد من تنسيق الملف وصلاحية الحقول المطلوبة'
    }, 'danger');
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = t('import.importButton', { count: result.passengers?.length || 0 });
  }
}

async function handleDownloadTemplate() {
  const result = await window.api.dialog.saveFile({
    title: t('import.downloadTemplate'),
    defaultPath: 'manifest-template.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  });

  if (result && result.filePath) {
    await window.api.manifest.downloadTemplate({ savePath: result.filePath });
  }
}
