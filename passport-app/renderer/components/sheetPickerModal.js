import { t } from '../i18n/index.js';

/**
 * sheetPickerModal.js
 * For each .xlsx/.xls file with more than one sheet, prompt the operator to
 * pick which tab to import. Files with a single sheet are auto-selected.
 *
 * @param {Array<{filePath:string, sheetNames:string[]}>} fileSheets
 * @returns {Promise<Object<string,string>|null>} map of filePath → chosen sheet,
 *   or null if the operator cancelled.
 */
export function showSheetPicker(fileSheets) {
  // Filter to only files with multiple sheets — others don't need prompting.
  const needsPick = (fileSheets || []).filter(f => Array.isArray(f.sheetNames) && f.sheetNames.length > 1);
  const autoPick = {};
  for (const f of (fileSheets || [])) {
    if (!Array.isArray(f.sheetNames) || f.sheetNames.length === 0) continue;
    if (f.sheetNames.length === 1) autoPick[f.filePath] = f.sheetNames[0];
  }
  if (needsPick.length === 0) {
    return Promise.resolve(autoPick);
  }

  return new Promise((resolve) => {
    let modalEl = document.getElementById('sheet-picker-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'sheet-picker-modal';
      modalEl.className = 'modal fade';
      modalEl.setAttribute('tabindex', '-1');
      modalEl.setAttribute('data-bs-backdrop', 'static');
      document.body.appendChild(modalEl);
    }

    const fileBlocks = needsPick.map((f, idx) => {
      const fileName = (f.filePath || '').split(/[\\/]/).pop();
      const options = f.sheetNames.map((name, i) => `
        <div class="form-check">
          <input class="form-check-input sheet-radio" type="radio"
                 name="sheet-${idx}" id="sheet-${idx}-${i}"
                 value="${name.replace(/"/g, '&quot;')}"
                 data-file="${(f.filePath || '').replace(/"/g, '&quot;')}"
                 ${i === 0 ? 'checked' : ''}>
          <label class="form-check-label" for="sheet-${idx}-${i}">${name}</label>
        </div>
      `).join('');

      return `
        <div class="mb-3 p-3 rounded" style="background: var(--bg-secondary); border: 1px solid var(--border);">
          <div class="text-uppercase small mb-2" style="color: var(--text-dim);">
            <i class="bi bi-file-earmark-excel me-1"></i>${fileName}
          </div>
          ${options}
        </div>
      `;
    }).join('');

    modalEl.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content" style="background: var(--panel); color: var(--text); border: 1px solid var(--accent);">
          <div class="modal-header" style="border-color: var(--border);">
            <h5 class="modal-title"><i class="bi bi-collection me-2" style="color: var(--accent);"></i>${t('import.sheetPicker.title') || 'اختر الصفحة المراد استيرادها'}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>${t('import.sheetPicker.prompt') || 'هذا الملف يحتوي على أكثر من صفحة. اختر الصفحة الصحيحة لكل ملف:'}</p>
            ${fileBlocks}
          </div>
          <div class="modal-footer" style="border-color: var(--border);">
            <button type="button" class="btn btn-outline-secondary" id="btn-sheet-cancel">${t('common.cancel')}</button>
            <button type="button" class="btn btn-primary" id="btn-sheet-confirm">${t('common.confirm') || 'تأكيد'}</button>
          </div>
        </div>
      </div>
    `;

    const modalInstance = new window.bootstrap.Modal(modalEl);
    let resolved = false;
    const done = (out) => {
      if (resolved) return;
      resolved = true;
      modalInstance.hide();
      resolve(out);
    };

    document.getElementById('btn-sheet-cancel').onclick = () => done(null);
    document.getElementById('btn-sheet-confirm').onclick = () => {
      const selection = { ...autoPick };
      modalEl.querySelectorAll('.sheet-radio:checked').forEach(input => {
        selection[input.dataset.file] = input.value;
      });
      done(selection);
    };
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (!resolved) done(null);
    }, { once: true });

    modalInstance.show();
  });
}
