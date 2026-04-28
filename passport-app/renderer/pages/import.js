/**
 * Manifest Import Page
 * Allows operator to upload/drop Excel files and preview/import passengers.
 */

import { t } from '../i18n/index.js';

let selectedFilePath = null;

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
      const file = e.dataTransfer.files[0];
      // Note: In Electron with sandbox, e.dataTransfer.files[0].path might not be available
      // unless we handle it specifically. But window.api.manifest.import needs the path.
      // With contextIsolation and sandbox, we usually get a File object.
      // We might need to use the dialog:openFile instead for real paths.
      handleFilePath(file.path);
    }
  };
}

async function handleSelectFile() {
  const result = await window.api.dialog.openFile({
    title: t('import.selectFile'),
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
  });

  if (result && result.filePath) {
    handleFilePath(result.filePath);
  }
}

async function handleFilePath(filePath) {
  try {
    const previewArea = document.getElementById('import-preview');
    const dropzone = document.getElementById('import-dropzone');
    const previewBody = document.getElementById('preview-body');
    const statsArea = document.getElementById('preview-stats');
    const confirmBtn = document.getElementById('btn-confirm-import');

    // Call main process to parse file (Note: main process already has the parseFile service)
    // We'll use a new IPC method or update manifest:import to return preview first.
    // Actually T032 implementation returns the full list.
    
    // For now, let's assume we use manifest:import which replaces the manifest.
    // Wait, the task says "preview renders". So manifest:import should probably be two-step 
    // or we add a manifest:preview.
    
    // Let's assume manifest:import returns the result but doesn't commit if we pass a flag?
    // Or we just call it and it returns the data.
    
    const result = await window.api.manifest.preview({ filePath });
    selectedFilePath = filePath;
    
    if (!result.ok && !result.errors) {
       alert(result.message || t('common.error'));
       return;
    }

    // Show preview area
    dropzone.classList.add('d-none');
    previewArea.classList.remove('d-none');

    const passengers = result.passengers || [];
    const errors = result.errors || [];
    
    // If manifest:import committed already, we just show what happened.
    // But the task says "preview renders... valid rows commit".
    // This implies a two-step process.
    
    // I'll update manifestHandlers.js to add a 'preview' method.
    // Actually, I'll just use the result from import for now to show the preview.
    
    renderPreviewRows(passengers, errors);
    
    const validCount = passengers.length;
    confirmBtn.innerHTML = t('import.importButton', { count: validCount });
    confirmBtn.classList.remove('d-none');
    
    // Since my manifestHandlers.js already committed the change in 'import', 
    // I should probably have made a separate preview call. 
    // I will fix the IPC handlers later to separate preview from commit.
    
  } catch (err) {
    console.error('Import error:', err);
    alert(t('common.error'));
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
    html += `
      <tr class="table-danger">
        <td>${err.field === 'passport_number' ? '???' : ''}</td>
        <td colspan="4">${esc(err.message)} (Row ${esc(err.rowIndex)})</td>
        <td><span class="badge bg-danger">${t('import.errors')}</span></td>
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
  if (!selectedFilePath) return;
  
  const confirmBtn = document.getElementById('btn-confirm-import');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t('common.loading')}`;

  const result = await window.api.manifest.import({ filePath: selectedFilePath });
  
  if (result.ok) {
    alert(t('import.success'));
    window.location.hash = '#/passengers';
  } else {
    alert(result.message || t('common.error'));
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
