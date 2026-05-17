/**
 * Advanced Filter Panel
 * Bootstrap offcanvas panel for multi-criterion filtering.
 *
 * FilterState shape:
 * {
 *   gender: 'M' | 'F' | '',
 *   nationality: string (3-letter ISO, '' = any),
 *   status: 'entered' | 'pending' | 'duplicate' | '' ,
 *   source: 'manifest' | 'manual' | 'added-at-gate' | '',
 *   dobFrom: string (YYYY-MM-DD, '' = any),
 *   dobTo: string (YYYY-MM-DD, '' = any),
 *   ageMin: number | '',
 *   ageMax: number | '',
 * }
 */

import { t } from '../i18n/index.js';

let onApplyCallback = null;
let panelMounted = false;

/**
 * Mount the offcanvas panel once into document.body.
 * @param {Function} onApply - Called with FilterState on Apply or Clear
 */
export function mountAdvancedFilterPanel(onApply) {
  onApplyCallback = onApply;
  if (panelMounted) { onApplyCallback = onApply; return; }
  panelMounted = true;

  const div = document.createElement('div');
  div.innerHTML = `
    <div class="offcanvas offcanvas-end bg-dark text-white border-secondary" tabindex="-1"
         id="advanced-filter-offcanvas" aria-labelledby="advancedFilterLabel" style="width:340px">
      <div class="offcanvas-header border-bottom border-secondary">
        <h5 class="offcanvas-title" id="advancedFilterLabel">
          <i class="bi bi-funnel-fill me-2 text-info"></i>${t('passengerList.advancedFilter')}
        </h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>

      <div class="offcanvas-body d-flex flex-column gap-4 py-3 overflow-auto">

        <!-- ── Gender ── -->
        <div>
          <label class="form-label fw-semibold text-info-emphasis small text-uppercase letter-spacing-1">
            <i class="bi bi-person-fill me-1"></i>${t('import.table.gender')}
          </label>
          <div class="btn-group w-100" id="af-gender-group">
            <button class="btn btn-sm btn-outline-secondary af-toggle-btn active" data-val="">${t('passengerList.filter.all')}</button>
            <button class="btn btn-sm btn-outline-primary af-toggle-btn" data-val="M">${t('passengerList.filter.male')}</button>
            <button class="btn btn-sm btn-outline-danger af-toggle-btn" data-val="F">${t('passengerList.filter.female')}</button>
          </div>
        </div>

        <!-- ── Nationality ── -->
        <div>
          <label class="form-label fw-semibold text-info-emphasis small text-uppercase" for="af-nationality">
            <i class="bi bi-flag-fill me-1"></i>${t('import.table.nationality')}
          </label>
          <input type="text" id="af-nationality"
                 class="form-control form-control-sm bg-dark text-white border-secondary"
                 placeholder="EGY, SAU, JOR …" maxlength="3" style="text-transform:uppercase">
        </div>

        <!-- ── Status (boarding outcome) ── -->
        <div>
          <label class="form-label fw-semibold text-info-emphasis small text-uppercase">
            <i class="bi bi-clipboard-check me-1"></i>${t('import.table.status')}
          </label>
          <div class="d-flex flex-wrap gap-1" id="af-status-group">
            <button class="btn btn-sm btn-outline-secondary af-toggle-btn active" data-val="">${t('passengerList.filter.all')}</button>
            <button class="btn btn-sm btn-outline-success af-toggle-btn" data-val="entered">${t('passengerList.filter.entered')}</button>
            <button class="btn btn-sm btn-outline-warning af-toggle-btn" data-val="pending">${t('passengerList.filter.pending')}</button>
            <button class="btn btn-sm btn-outline-danger af-toggle-btn" data-val="duplicate">${t('filters.duplicate') || 'Duplicate'}</button>
          </div>
        </div>

        <!-- ── Source ── -->
        <div>
          <label class="form-label fw-semibold text-info-emphasis small text-uppercase">
            <i class="bi bi-box-arrow-in-right me-1"></i>${t('filters.source') || 'Source'}
          </label>
          <div class="d-flex flex-wrap gap-1" id="af-source-group">
            <button class="btn btn-sm btn-outline-secondary af-toggle-btn active" data-val="">${t('passengerList.filter.all')}</button>
            <button class="btn btn-sm btn-outline-secondary af-toggle-btn" data-val="manifest">${t('passengerList.source.original')}</button>
            <button class="btn btn-sm btn-outline-info af-toggle-btn" data-val="manual">${t('passengerList.source.manual')}</button>
            <button class="btn btn-sm btn-outline-warning af-toggle-btn" data-val="added-at-gate">${t('passengerList.source.new')}</button>
          </div>
        </div>

        <!-- ── DOB Range ── -->
        <div>
          <label class="form-label fw-semibold text-info-emphasis small text-uppercase">
            <i class="bi bi-calendar-range me-1"></i>${t('filters.dobRange') || 'Date of Birth Range'}
          </label>
          <div class="d-flex gap-2 align-items-center">
            <div class="flex-grow-1">
              <label class="form-label small text-muted mb-1">${t('filters.from') || 'From'}</label>
              <input type="date" id="af-dob-from"
                     class="form-control form-control-sm bg-dark text-white border-secondary">
            </div>
            <div class="flex-grow-1">
              <label class="form-label small text-muted mb-1">${t('filters.to') || 'To'}</label>
              <input type="date" id="af-dob-to"
                     class="form-control form-control-sm bg-dark text-white border-secondary">
            </div>
          </div>
        </div>

        <!-- ── Age Range ── -->
        <div>
          <label class="form-label fw-semibold text-info-emphasis small text-uppercase">
            <i class="bi bi-person-bounding-box me-1"></i>${t('filters.ageRange') || 'Age Range'}
          </label>
          <div class="d-flex gap-2 align-items-center">
            <div class="flex-grow-1">
              <label class="form-label small text-muted mb-1">${t('filters.ageMin') || 'Min'}</label>
              <input type="number" id="af-age-min" min="0" max="120"
                     class="form-control form-control-sm bg-dark text-white border-secondary"
                     placeholder="0">
            </div>
            <div class="flex-grow-1">
              <label class="form-label small text-muted mb-1">${t('filters.ageMax') || 'Max'}</label>
              <input type="number" id="af-age-max" min="0" max="120"
                     class="form-control form-control-sm bg-dark text-white border-secondary"
                     placeholder="120">
            </div>
          </div>
        </div>

        <!-- ── Has Warning toggle ── -->
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="af-has-warning" role="switch">
          <label class="form-check-label" for="af-has-warning">
            <i class="bi bi-exclamation-triangle-fill text-warning me-1"></i>
            ${t('passengerList.filter.warnings')}
          </label>
        </div>

        <!-- ── Actions ── -->
        <div class="mt-auto d-flex gap-2 pt-2 border-top border-secondary">
          <button id="af-apply-btn" class="btn btn-primary flex-grow-1">
            <i class="bi bi-funnel-fill me-2"></i>${t('filters.apply')}
          </button>
          <button id="af-clear-btn" class="btn btn-outline-secondary">
            <i class="bi bi-x-circle me-2"></i>${t('filters.clear')}
          </button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(div.firstElementChild);

  // Multi-select toggle groups (Gender, Status, Source)
  document.querySelectorAll('#af-gender-group .af-toggle-btn, #af-status-group .af-toggle-btn, #af-source-group .af-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('[id$="-group"]');
      const isAllBtn = btn.dataset.val === '';

      if (isAllBtn) {
        // If clicking 'All', deactivate all other buttons in this group
        group.querySelectorAll('.af-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      } else {
        // Toggle the clicked button
        btn.classList.toggle('active');
        // Uncheck 'All' if any specific filter is selected
        const allBtn = group.querySelector('[data-val=""]');
        if (allBtn) allBtn.classList.remove('active');

        // If no buttons are active now, fallback to activating 'All'
        const anyActive = group.querySelector('.af-toggle-btn.active');
        if (!anyActive && allBtn) {
          allBtn.classList.add('active');
        }
      }
      _emit(); // Auto-apply instantly
    });
  });

  // Auto-apply on text/number/date/switch inputs
  ['af-nationality', 'af-dob-from', 'af-dob-to', 'af-age-min', 'af-age-max'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', e => {
      if (id === 'af-nationality') {
        const pos = e.target.selectionStart;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(pos, pos);
      }
      _emit(); // Auto-apply instantly
    });
  });

  document.getElementById('af-has-warning')?.addEventListener('change', () => {
    _emit(); // Auto-apply instantly
  });

  document.getElementById('af-apply-btn').addEventListener('click', () => {
    _emit();
    bootstrap.Offcanvas.getInstance(document.getElementById('advanced-filter-offcanvas'))?.hide();
  });

  document.getElementById('af-clear-btn').addEventListener('click', () => {
    _resetUI();
    _emit();
  });
}

function _resetUI() {
  document.querySelectorAll('#af-gender-group .af-toggle-btn, #af-status-group .af-toggle-btn, #af-source-group .af-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === '');
  });
  document.getElementById('af-nationality').value = '';
  document.getElementById('af-dob-from').value = '';
  document.getElementById('af-dob-to').value = '';
  document.getElementById('af-age-min').value = '';
  document.getElementById('af-age-max').value = '';
  document.getElementById('af-has-warning').checked = false;
}

function _emit() {
  const genders = Array.from(document.querySelectorAll('#af-gender-group .af-toggle-btn.active'))
    .map(b => b.dataset.val).filter(Boolean);
  const statuses = Array.from(document.querySelectorAll('#af-status-group .af-toggle-btn.active'))
    .map(b => b.dataset.val).filter(Boolean);
  const sources = Array.from(document.querySelectorAll('#af-source-group .af-toggle-btn.active'))
    .map(b => b.dataset.val).filter(Boolean);

  const nationality = (document.getElementById('af-nationality')?.value || '').trim().toUpperCase();
  const dobFrom     = document.getElementById('af-dob-from')?.value || '';
  const dobTo       = document.getElementById('af-dob-to')?.value || '';
  const ageMinRaw   = document.getElementById('af-age-min')?.value;
  const ageMaxRaw   = document.getElementById('af-age-max')?.value;
  const ageMin      = ageMinRaw !== '' ? parseInt(ageMinRaw, 10) : '';
  const ageMax      = ageMaxRaw !== '' ? parseInt(ageMaxRaw, 10) : '';
  const hasWarning  = document.getElementById('af-has-warning')?.checked || false;

  onApplyCallback?.({ genders, statuses, sources, nationality, dobFrom, dobTo, ageMin, ageMax, hasWarning });
}

/** Open the panel programmatically */
export function openAdvancedFilterPanel() {
  const el = document.getElementById('advanced-filter-offcanvas');
  if (el && window.bootstrap) {
    bootstrap.Offcanvas.getOrCreateInstance(el).show();
  }
}

/** Get current state of advanced filter panel directly */
export function getCurrentAdvancedFilter() {
  if (!panelMounted) return null;
  const genders = Array.from(document.querySelectorAll('#af-gender-group .af-toggle-btn.active'))
    .map(b => b.dataset.val).filter(Boolean);
  const statuses = Array.from(document.querySelectorAll('#af-status-group .af-toggle-btn.active'))
    .map(b => b.dataset.val).filter(Boolean);
  const sources = Array.from(document.querySelectorAll('#af-source-group .af-toggle-btn.active'))
    .map(b => b.dataset.val).filter(Boolean);

  const nationality = (document.getElementById('af-nationality')?.value || '').trim().toUpperCase();
  const dobFrom     = document.getElementById('af-dob-from')?.value || '';
  const dobTo       = document.getElementById('af-dob-to')?.value || '';
  const ageMinRaw   = document.getElementById('af-age-min')?.value;
  const ageMaxRaw   = document.getElementById('af-age-max')?.value;
  const ageMin      = ageMinRaw !== '' ? parseInt(ageMinRaw, 10) : '';
  const ageMax      = ageMaxRaw !== '' ? parseInt(ageMaxRaw, 10) : '';
  const hasWarning  = document.getElementById('af-has-warning')?.checked || false;

  return { genders, statuses, sources, nationality, dobFrom, dobTo, ageMin, ageMax, hasWarning };
}

/**
 * Count the number of active filter criteria in a FilterState.
 * @param {Object} filterState
 * @returns {number}
 */
export function countActiveFilters(filterState) {
  if (!filterState) return 0;
  const { genders, statuses, sources, nationality, dobFrom, dobTo, ageMin, ageMax, hasWarning } = filterState;
  let count = 0;
  if (genders && genders.length > 0) count += genders.length;
  if (statuses && statuses.length > 0) count += statuses.length;
  if (sources && sources.length > 0) count += sources.length;
  if (nationality) count++;
  if (dobFrom || dobTo) count++;   // DOB range counts as 1 criterion
  if (ageMin !== '' && ageMin != null) count++;
  if (ageMax !== '' && ageMax != null) count++;
  if (hasWarning) count++;
  return count;
}

/**
 * Apply a FilterState to a passenger list (client-side AND logic across categories, OR logic within arrays).
 * @param {Object[]} passengers
 * @param {Object} filterState
 * @returns {Object[]}
 */
export function applyFilterState(passengers, filterState) {
  if (!filterState) return passengers;
  const { genders, statuses, sources, nationality, dobFrom, dobTo, ageMin, ageMax, hasWarning } = filterState;

  const today = new Date();

  return passengers.filter(p => {
    // Gender (OR logic within genders array)
    if (genders && genders.length > 0 && !genders.includes(p.gender)) return false;

    // Nationality
    if (nationality && p.nationality !== nationality) return false;

    // Source (OR logic within sources array)
    if (sources && sources.length > 0 && !sources.includes(p.source)) return false;

    // Statuses (OR logic within statuses array)
    if (statuses && statuses.length > 0) {
      const match = statuses.some(st => {
        if (st === 'entered')   return p.is_entered;
        if (st === 'pending')   return !p.is_entered;
        if (st === 'duplicate') return p.is_duplicate;
        return false;
      });
      if (!match) return false;
    }

    // Has Warning flag
    if (hasWarning && !p.is_duplicate) return false;

    // DOB range
    if (dobFrom && p.date_of_birth && p.date_of_birth < dobFrom) return false;
    if (dobTo   && p.date_of_birth && p.date_of_birth > dobTo)   return false;

    // Age range (computed from DOB)
    if ((ageMin !== '' && ageMin != null) || (ageMax !== '' && ageMax != null)) {
      if (!p.date_of_birth) return false;
      const dob = new Date(p.date_of_birth);
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      if (ageMin !== '' && ageMin != null && age < ageMin) return false;
      if (ageMax !== '' && ageMax != null && age > ageMax) return false;
    }

    return true;
  });
}
