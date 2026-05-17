import { t } from '../i18n/index.js';

/**
 * duplicateConfirmModal.js
 * Modal to ask the operator what to do when a fuzzy duplicate is found.
 */

let modalInstance = null;

/**π
 * Show the duplicate confirm modal
 * @param {Object} existing - The existing passenger record
 * @param {Object} incoming - The new incoming fields
 * @param {string[]} differences - Array of field names that differ (e.g. ['dob', 'nationality'])
 * @returns {Promise<'merge'|'keep-separate'|'cancel'>}
 */
export function showDuplicateModal(existing, incoming, differences) {
  return new Promise((resolve) => {
    // 1. Create or get DOM element
    let modalEl = document.getElementById('duplicate-confirm-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'duplicate-confirm-modal';
      modalEl.className = 'modal fade';
      modalEl.setAttribute('tabindex', '-1');
      modalEl.setAttribute('data-bs-backdrop', 'static');
      document.body.appendChild(modalEl);
    }

    // 2. Build HTML
    modalEl.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark text-white border-warning">
          <div class="modal-header border-secondary">
            <h5 class="modal-title text-warning"><i class="bi bi-exclamation-triangle-fill me-2"></i>${t('duplicate.title')}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>${t('duplicate.prompt')}</p>
            <div class="table-responsive">
              <table class="table table-dark table-bordered mt-3">
                <thead class="table-secondary text-dark">
                  <tr>
                    <th>${t('duplicate.field')}</th>
                    <th>${t('duplicate.existing')}</th>
                    <th>${t('duplicate.new')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${['name', 'date_of_birth', 'nationality'].map(field => {
                    const isDiff = differences.includes(field === 'date_of_birth' ? 'dob' : field);
                    return `
                      <tr class="${isDiff ? 'table-warning text-dark fw-bold' : ''}">
                        <td>${t(`fieldRequirements.${field === 'date_of_birth' ? 'dob' : field === 'name' ? 'givenName' : field}`) || field}</td>
                        <td>${existing[field] || ''}</td>
                        <td>${incoming[field] || ''}</td>
                      </tr>
                    `;
                  }).join('')}
                  <tr>
                    <td>${t('fieldRequirements.passportNumber')}</td>
                    <td>${existing.passport_number || existing.passport_number_normalized}</td>
                    <td>${incoming.passport_number || incoming.passportNumberKey || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer border-secondary">
            <button type="button" class="btn btn-secondary" id="btn-dup-cancel" data-bs-dismiss="modal">${t('common.cancel')}</button>
            <button type="button" class="btn btn-outline-warning" id="btn-dup-keep">${t('duplicate.keepSeparate')}</button>
            <button type="button" class="btn btn-warning text-dark" id="btn-dup-merge">${t('duplicate.merge')}</button>
          </div>
        </div>
      </div>
    `;

    // 3. Initialize Bootstrap Modal. Always dispose any prior instance first
    //    so we don't end up with two modal controllers attached to the same
    //    DOM element after a re-show (which was leaving the backdrop in place
    //    and freezing the second invocation).
    const prior = window.bootstrap.Modal.getInstance(modalEl);
    if (prior) {
      try { prior.dispose(); } catch (_) { /* ignore */ }
    }
    modalInstance = new window.bootstrap.Modal(modalEl);

    // 4. Attach event listeners
    let resolved = false;
    let pendingDecision = null;

    const handleResolve = (decision) => {
      if (resolved) return;
      resolved = true;
      pendingDecision = decision;
      // Don't resolve the promise yet — wait for Bootstrap's hide animation
      // to FULLY complete (and the backdrop/body class to be cleaned up).
      // Otherwise the caller can synchronously open the next modal on top of
      // a half-hidden backdrop, which makes the second modal look frozen.
      modalInstance.hide();
    };

    document.getElementById('btn-dup-cancel').onclick = () => handleResolve('cancel');
    document.getElementById('btn-dup-keep').onclick = () => handleResolve('keep-separate');
    document.getElementById('btn-dup-merge').onclick = () => handleResolve('merge');

    modalEl.addEventListener('hidden.bs.modal', () => {
      // Bootstrap sometimes leaves <body class="modal-open"> or a stray
      // backdrop when modals are shown/hidden in quick succession. Defensive
      // cleanup before resolving so the next modal opens cleanly.
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');

      try { modalInstance.dispose(); } catch (_) { /* ignore */ }
      resolve(pendingDecision || 'cancel');
    }, { once: true });

    // 5. Show
    modalInstance.show();
  });
}
