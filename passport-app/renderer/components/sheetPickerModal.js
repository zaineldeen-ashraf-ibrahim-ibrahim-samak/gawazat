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
  // For each file: keep only the sheets that actually look like a passenger
  // list (sheetInfo[i].isPassengerSheet). Workbooks with exactly one such
  // sheet are auto-selected silently; only ambiguous ones prompt.
  const passengerSheetsForFile = (f) => {
    if (!Array.isArray(f.sheetNames) || f.sheetNames.length === 0) return [];
    if (Array.isArray(f.sheetInfo) && f.sheetInfo.length > 0) {
      const filtered = f.sheetInfo.filter(s => s.isPassengerSheet).map(s => s.name);
      // If filtering left us with nothing (every sheet looked like a
      // breakdown/summary), fall back to the full list so the operator can
      // still pick something rather than seeing an empty modal.
      return filtered.length > 0 ? filtered : f.sheetNames.slice();
    }
    return f.sheetNames.slice();
  };

  const enriched = (fileSheets || []).map(f => ({ ...f, candidateSheets: passengerSheetsForFile(f) }));
  const needsPick = enriched.filter(f => f.candidateSheets.length > 1);
  const autoPick = {};
  for (const f of enriched) {
    if (f.candidateSheets.length === 1) autoPick[f.filePath] = f.candidateSheets[0];
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
      const options = f.candidateSheets.map((name, i) => {
        const meta = Array.isArray(f.sheetInfo) ? f.sheetInfo.find(s => s.name === name) : null;
        const rowHint = meta && Number.isFinite(meta.rowCount)
          ? `<span class="small ms-2" style="color: var(--text-dim);">(${Math.max(0, meta.rowCount - 1)} ${t('import.sheetPicker.rows') || 'rows'})</span>`
          : '';
        return `
          <div class="form-check">
            <input class="form-check-input sheet-radio" type="radio"
                   name="sheet-${idx}" id="sheet-${idx}-${i}"
                   value="${name.replace(/"/g, '&quot;')}"
                   data-file="${(f.filePath || '').replace(/"/g, '&quot;')}"
                   ${i === 0 ? 'checked' : ''}>
            <label class="form-check-label" for="sheet-${idx}-${i}">${name}${rowHint}</label>
          </div>
        `;
      }).join('');

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
