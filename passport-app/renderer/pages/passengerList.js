/**
 * Passenger List Page
 * Displays all passengers with filtering, search, and manual toggle.
 *
 * US6 fix: The page shell (search input, filter buttons, table header) is rendered
 *   ONCE on mount. Subsequent filter/search changes only re-render the <tbody>
 *   so the search input never loses focus.
 *
 * US7: Advanced filter panel integrated for multi-criterion filtering.
 */

import { t } from '../i18n/index.js';
import { mountAdvancedFilterPanel, openAdvancedFilterPanel, applyFilterState, countActiveFilters } from '../components/advancedFilterPanel.js';

let currentFilter = 'all';
let currentSearch = '';
let currentAdvancedFilter = null;  // US7: { gender, nationality, status, source, hasWarning }
let renderedCount = 0;
const CHUNK_SIZE = 100;
let observer = null;
let allPassengers = [];   // full server response, filtered client-side
let currentPassengers = []; // post-filter result
let containerEl = null;
let shellRendered = false; // US6: render shell only once

/** Escape HTML entities */
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Build the list of passengers to display after applying all active filters */
function computeVisible() {
  let list = allPassengers;

  // Quick filter (the button group: all/entered/pending/new/M/F)
  if (currentFilter === 'entered') list = list.filter(p => p.is_entered);
  else if (currentFilter === 'pending') list = list.filter(p => !p.is_entered);
  else if (currentFilter === 'new') list = list.filter(p => p.source === 'added-at-gate');
  else if (currentFilter === 'M') list = list.filter(p => p.gender === 'M');
  else if (currentFilter === 'F') list = list.filter(p => p.gender === 'F');

  // Search
  if (currentSearch.trim()) {
    const q = currentSearch.trim().toLowerCase();
    list = list.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.passport_number || '').toLowerCase().includes(q)
    );
  }

  // US7: Advanced filter
  list = applyFilterState(list, currentAdvancedFilter);

  return list;
}

/** Re-render only the <tbody> and reset the IntersectionObserver */
function refreshTable() {
  if (observer) { observer.disconnect(); observer = null; }

  currentPassengers = computeVisible();
  renderedCount = 0;

  // Update filter button active states without touching the input
  containerEl.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === currentFilter);
  });

  // Update the advanced filter badge — show count of active criteria
  const afBadge = document.getElementById('af-active-badge');
  if (afBadge) {
    const activeCount = currentAdvancedFilter ? countActiveFilters(currentAdvancedFilter) : 0;
    if (activeCount > 0) {
      afBadge.textContent = activeCount;
      afBadge.style.display = 'inline-block';
    } else {
      afBadge.style.display = 'none';
    }
  }

  // Reset sentinel
  const sentinel = document.getElementById('scroll-sentinel');
  if (sentinel) sentinel.style.display = '';

  renderNextChunk();

  if (sentinel) {
    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) renderNextChunk();
    }, { root: containerEl.querySelector('.table-responsive'), rootMargin: '200px' });
    observer.observe(sentinel);
  }
}

/** First mount: draw the full page shell (search bar, buttons, table structure) */
async function mountShell(container) {
  containerEl = container;
  shellRendered = true;

  container.innerHTML = `
    <div class="page-passenger-list h-100 d-flex flex-column">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>${t('nav.passengerList')}</h1>
        <div class="d-flex gap-2">
           <button id="btn-advanced-filter" class="btn btn-outline-secondary position-relative">
             <i class="bi bi-funnel me-2"></i>${t('passengerList.advancedFilter')}
             <span id="af-active-badge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark" style="display:none;">●</span>
           </button>
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
                   placeholder="${t('passengerList.search')}...">
          </div>
        </div>
        <div class="col-md-8 d-flex gap-2">
          <div class="btn-group shadow-sm">
            <button class="btn btn-outline-secondary filter-btn active" data-filter="all">${t('passengerList.filter.all')}</button>
            <button class="btn btn-outline-secondary filter-btn" data-filter="entered">${t('passengerList.filter.entered')}</button>
            <button class="btn btn-outline-secondary filter-btn" data-filter="pending">${t('passengerList.filter.pending')}</button>
            <button class="btn btn-outline-warning filter-btn" data-filter="new">${t('passengerList.source.new')}</button>
          </div>
          <div class="btn-group shadow-sm">
            <button class="btn btn-outline-secondary filter-btn" data-filter="M">${t('passengerList.filter.male')}</button>
            <button class="btn btn-outline-secondary filter-btn" data-filter="F">${t('passengerList.filter.female')}</button>
          </div>
        </div>
      </div>

      <div class="card bg-dark border-secondary shadow flex-grow-1 overflow-hidden d-flex flex-column">
        <div class="table-responsive flex-grow-1" style="overflow-y: auto;">
          <table class="table table-dark table-hover mb-0 align-middle">
            <thead class="sticky-top bg-dark">
              <tr>
                <th class="text-muted" style="width:40px">${t('reports.indexHeader')}</th>
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
            <tbody id="passenger-tbody">
              <!-- Rendered via JS -->
            </tbody>
          </table>
          <div id="scroll-sentinel" class="py-3 text-center"></div>
        </div>
      </div>
    </div>
  `;

  // ── US6 FIX: attach search listener to the DOM node ONCE — no re-render of the input ──
  const searchInput = document.getElementById('input-search');
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refreshTable, 100); // 100ms debounce per spec
  });

  // Filter buttons — only refreshTable, not a full re-mount
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.getAttribute('data-filter');
      refreshTable();
    });
  });

  // Advanced filter button
  document.getElementById('btn-advanced-filter').addEventListener('click', () => {
    openAdvancedFilterPanel();
  });

  // Export handler
  document.getElementById('btn-export').addEventListener('click', async () => {
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
  });

  // Event Delegation for Table Body (change + click)
  const tbody = document.getElementById('passenger-tbody');
  tbody.addEventListener('change', async (e) => {
    if (e.target.classList.contains('status-toggle')) {
      const passport = e.target.getAttribute('data-passport');
      const entered = e.target.checked;
      const result = await window.api.manifest.toggleEntered({ passport_number_normalized: passport, entered });
      if (!result.ok) {
        alert(result.message || t('common.error'));
        e.target.checked = !entered;
      } else {
        await loadData();
        refreshTable();
      }
    }
  });

  tbody.addEventListener('click', async (e) => {
    const badge = e.target.closest('.missing-fields-badge');
    if (badge) {
      const missingKeys = badge.getAttribute('data-missing').split(',').filter(Boolean);
      const localizedNames = missingKeys.map(f => t(`fieldRequirements.${f}`) || t(`import.table.${f}`) || f).join('، ');
      showMissingFieldsModal(localizedNames);
      return;
    }

    const btn = e.target.closest('.delete-btn');
    if (btn) {
      const passport = btn.getAttribute('data-passport');
      if (!confirm(t('common.confirm'))) return;
      const result = await window.api.manifest.delete({ passport_number_normalized: passport });
      if (!result.ok) {
        alert(result.message || t('common.error'));
      } else {
        await loadData();
        refreshTable();
      }
    }
  });

  // US7: Mount the advanced filter offcanvas panel
  mountAdvancedFilterPanel((filterState) => {
    currentAdvancedFilter = filterState;
    refreshTable();
  });
}

/** Fetch data from main process (only the raw full list; filtering happens client-side) */
async function loadData() {
  allPassengers = await window.api.manifest.list({ filter: 'all', search: '' });
}

function showMissingFieldsModal(fieldsStr) {
  const modalId = 'modal-missing-fields-detail';
  let modalEl = document.getElementById(modalId);
  if (!modalEl) {
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}-label" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content bg-dark text-white border-warning">
            <div id="${modalId}-header" class="modal-header border-warning bg-warning bg-opacity-25">
              <h5 id="${modalId}-label" class="modal-title text-warning">
                <i class="bi bi-exclamation-triangle-fill me-2"></i><span id="${modalId}-title-text" style="color: black;">${t('missingFieldsModal.title')}</span>
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
              <p id="${modalId}-prompt" class="fs-5 mb-2" style="color: black;">${t('missingFieldsModal.prompt')}</p>
              <div id="${modalId}-list" class="p-3 bg-black bg-opacity-50 text-warning rounded border border-secondary fs-5 fw-bold text-center"></div>
            </div>
            <div class="modal-footer border-warning">
              <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">${t('common.close')}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div.firstElementChild);
    modalEl = document.getElementById(modalId);
  } else {
    // Update dynamic text if locale changed
    document.getElementById(`${modalId}-title-text`).textContent = t('missingFieldsModal.title');
    document.getElementById(`${modalId}-prompt`).textContent = t('missingFieldsModal.prompt');
  }
  document.getElementById(`${modalId}-list`).textContent = fieldsStr || t('missingFieldsModal.empty');
  if (window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  } else {
    alert(`${t('missingFieldsModal.title')}:\n\n${fieldsStr}`);
  }
}

export async function renderPassengerList(container) {
  if (!shellRendered || container !== containerEl) {
    await mountShell(container);
  }
  await loadData();
  refreshTable();
}

function renderNextChunk() {
  const sentinel = document.getElementById('scroll-sentinel');
  const tbody = document.getElementById('passenger-tbody');
  if (!tbody) return;

  if (renderedCount >= currentPassengers.length) {
    if (sentinel) sentinel.style.display = 'none';
    if (renderedCount === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center p-5 text-muted">${t('common.empty')}</td></tr>`;
    }
    return;
  }

  const chunk = currentPassengers.slice(renderedCount, renderedCount + CHUNK_SIZE);
  const rowsHtml = chunk.map((p, i) => `
    <tr class="${p.is_entered ? 'table-success-dim' : ''}">
      <td class="text-muted text-center small">${renderedCount + i + 1}</td>
      <td><code>${esc(p.passport_number)}</code></td>
      <td class="fw-bold">${esc(p.name)}</td>
      <td>${esc(p.nationality)}</td>
      <td>${esc(p.gender)}</td>
      <td>${esc(p.date_of_birth)}</td>
      <td>
        ${p.source === 'added-at-gate'
      ? `<span class="badge me-1 text-dark" style="background:#f59e0b;">${t('passengerList.source.new')}</span>`
      : p.source === 'manual'
        ? `<span class="badge bg-info text-dark me-1">${t('passengerList.source.manual')}</span>`
        : `<span class="badge bg-dark border border-secondary text-muted me-1">${t('passengerList.source.original')}</span>`
    }
        ${p.is_entered
      ? `<span class="badge bg-success">${t('passengerList.filter.entered')}</span><br><small class="text-muted">${(p.entered_at || '').split('T')[1]?.split('.')[0] || ''}</small>`
      : `<span class="badge bg-secondary opacity-50">${t('passengerList.filter.pending')}</span>`
    }
        ${p.missingOptionalFields?.length > 0
      ? `<br><span class="badge bg-warning text-dark mt-1 missing-fields-badge cursor-pointer" data-missing="${esc(p.missingOptionalFields.join(','))}" title="انقر لعرض التفاصيل"><i class="bi bi-exclamation-circle me-1"></i>مفقود (${p.missingOptionalFields.length})</span>`
      : ''
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
  `).join('');

  if (renderedCount === 0) {
    tbody.innerHTML = rowsHtml;
  } else {
    tbody.insertAdjacentHTML('beforeend', rowsHtml);
  }

  renderedCount += chunk.length;
}
