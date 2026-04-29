/**
 * Passenger List Page
 * Displays all passengers with filtering, search, and manual toggle.
 */

import { t } from '../i18n/index.js';

let currentFilter = 'all';
let currentSearch = '';

/** Escape HTML entities */
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function renderPassengerList(container) {
  const passengers = await window.api.manifest.list({ filter: currentFilter, search: currentSearch });

  const html = `
    <div class="page-passenger-list h-100 d-flex flex-column">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>${t('nav.passengerList')}</h1>
        <div class="d-flex gap-2">
           <button id="btn-export" class="btn btn-outline-info">
              <i class="bi bi-file-earmark-excel me-2"></i>${t('history.export')}
           </button>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-md-4">
          <div class="input-group">
            <span class="input-group-text bg-dark border-secondary"><i class="bi bi-search text-muted"></i></span>
            <input type="search" id="input-search" class="form-control bg-dark text-white border-secondary" 
                   placeholder="${t('passengerList.search')}..." value="${esc(currentSearch)}">
          </div>
        </div>
        <div class="col-md-8 d-flex gap-2">
          <div class="btn-group shadow-sm">
            <button class="btn btn-outline-secondary filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">${t('passengerList.filter.all')}</button>
            <button class="btn btn-outline-secondary filter-btn ${currentFilter === 'entered' ? 'active' : ''}" data-filter="entered">${t('passengerList.filter.entered')}</button>
            <button class="btn btn-outline-secondary filter-btn ${currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">${t('passengerList.filter.pending')}</button>
          </div>
          <div class="btn-group shadow-sm">
            <button class="btn btn-outline-secondary filter-btn ${currentFilter === 'M' ? 'active' : ''}" data-filter="M">${t('passengerList.filter.male')}</button>
            <button class="btn btn-outline-secondary filter-btn ${currentFilter === 'F' ? 'active' : ''}" data-filter="F">${t('passengerList.filter.female')}</button>
          </div>
        </div>
      </div>

      <div class="card bg-dark border-secondary shadow flex-grow-1 overflow-hidden">
        <div class="table-responsive h-100">
          <table class="table table-dark table-hover mb-0 align-middle">
            <thead class="sticky-top bg-dark">
              <tr>
                <th>${t('import.table.passport')}</th>
                <th>${t('import.table.name')}</th>
                <th>${t('import.table.nationality')}</th>
                <th>${t('import.table.gender')}</th>
                <th>${t('import.table.dob')}</th>
                <th>${t('import.table.status')}</th>
                <th class="text-end">${t('common.confirm')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${passengers.length === 0 ? `
                <tr><td colspan="8" class="text-center p-5 text-muted">${t('common.empty')}</td></tr>
              ` : passengers.map(p => `
                <tr class="${p.is_entered ? 'table-success-dim' : ''}">
                  <td><code>${esc(p.passport_number)}</code></td>
                  <td class="fw-bold">${esc(p.name)}</td>
                  <td>${esc(p.nationality)}</td>
                  <td>${esc(p.gender)}</td>
                  <td>${esc(p.date_of_birth)}</td>
                  <td>
                    ${p.source === 'added-at-gate' ? `<span class="badge bg-accent text-dark me-1" style="background:#f59e0b;">جديد</span>` : `<span class="badge bg-dark border border-secondary text-muted me-1">أصلي</span>`}
                    ${p.is_entered
                      ? `<span class="badge bg-success">${t('passengerList.filter.entered')}</span><br><small class="text-muted">${(p.entered_at || '').split('T')[1]?.split('.')[0] || ''}</small>`
                      : `<span class="badge bg-secondary opacity-50">${t('passengerList.filter.pending')}</span>`
                    }
                  </td>
                  <td class="text-end">
                    <div class="form-check form-switch d-inline-block">
                      <input class="form-check-input status-toggle" type="checkbox" role="switch"
                             data-passport="${esc(p.passport_number_normalized)}" ${p.is_entered ? 'checked' : ''}>
                    </div>
                  </td>
                  <td>
                    <button class="btn btn-sm btn-outline-danger delete-btn" data-passport="${esc(p.passport_number_normalized)}" title="حذف">
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Search handler
  const searchInput = document.getElementById('input-search');
  searchInput.oninput = (e) => {
    currentSearch = e.target.value;
    // Debounce would be better
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => renderPassengerList(container), 300);
  };

  // Filter handlers
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      currentFilter = btn.getAttribute('data-filter');
      renderPassengerList(container);
    };
  });

  // Toggle handlers
  container.querySelectorAll('.status-toggle').forEach(toggle => {
    toggle.onchange = async () => {
      const passport = toggle.getAttribute('data-passport');
      const entered = toggle.checked;
      
      const result = await window.api.manifest.toggleEntered({ 
        passport_number_normalized: passport, 
        entered 
      });

      if (!result.ok) {
        alert(result.message || t('common.error'));
        toggle.checked = !entered; // Revert
      } else {
        renderPassengerList(container); // Refresh
      }
    };
  });

  // Delete handlers
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const passport = btn.getAttribute('data-passport');
      if (!confirm('هل تريد حذف هذا المسافر نهائياً؟')) return;
      const result = await window.api.manifest.delete({ passport_number_normalized: passport });
      if (!result.ok) {
        alert(result.message || t('common.error'));
      } else {
        renderPassengerList(container);
      }
    };
  });

  // Export handler
  document.getElementById('btn-export').onclick = async () => {
    const result = await window.api.dialog.saveFile({
      title: t('history.export'),
      defaultPath: `passengers-${currentFilter}-${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result && result.filePath) {
      const exportResult = await window.api.manifest.exportFiltered({
        filter: currentFilter,
        search: currentSearch,
        savePath: result.filePath
      });
      if (exportResult.ok) alert(t('import.success'));
      else alert(exportResult.message || t('common.error'));
    }
  };
}
