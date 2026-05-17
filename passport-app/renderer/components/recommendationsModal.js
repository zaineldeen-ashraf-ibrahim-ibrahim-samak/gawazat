import { t } from '../i18n/index.js';

/**
 * recommendationsModal.js
 * Shown when a scan doesn't match the manifest exactly. Lists the closest
 * manifest candidates so the operator can:
 *   - select one (board as that passenger),
 *   - send the scan to pending approval,
 *   - cancel and record a read-failed event.
 *
 * Returns a Promise<{ decision, candidateId? }>.
 */
export function showRecommendationsModal(incoming, candidates) {
  return new Promise((resolve) => {
    let modalEl = document.getElementById('recommend-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'recommend-modal';
      modalEl.className = 'modal fade';
      modalEl.setAttribute('tabindex', '-1');
      modalEl.setAttribute('data-bs-backdrop', 'static');
      document.body.appendChild(modalEl);
    }

    const incomingName = incoming?.name
      || [incoming?.familyName, incoming?.givenName].filter(Boolean).join(' ')
      || [incoming?.surname, incoming?.given_names].filter(Boolean).join(' ')
      || '---';
    const incomingPassport = incoming?.passportNumberKey || incoming?.passport_number || incoming?.document_number || '---';
    const incomingDob = incoming?.dob || incoming?.date_of_birth || '---';
    const incomingNat = incoming?.nationality || '---';

    const rows = candidates.map((c, idx) => {
      const p = c.passenger || {};
      const diffSet = new Set(c.differences || []);
      const diffBadge = (field) => diffSet.has(field)
        ? `<span class="badge bg-warning text-dark ms-1 small">${t('recommend.differs') || 'differs'}</span>` : '';
      return `
        <tr>
          <td class="text-center align-middle">${idx + 1}</td>
          <td class="align-middle fw-bold">${p.name || '---'} ${diffBadge('name')}</td>
          <td class="align-middle"><code>${p.passport_number_normalized || p.passport_number || '---'}</code> ${diffBadge('passportNumber')}</td>
          <td class="align-middle">${p.date_of_birth || '---'} ${diffBadge('dob')}</td>
          <td class="align-middle">${p.nationality || '---'} ${diffBadge('nationality')}</td>
          <td class="align-middle text-end">
            <button class="btn btn-success btn-sm btn-pick" data-id="${p.id}">
              <i class="bi bi-check2-circle me-1"></i>${t('recommend.useThis') || 'هذا هو'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    modalEl.innerHTML = `
      <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content" style="background: var(--panel); color: var(--text); border: 1px solid var(--accent);">
          <div class="modal-header" style="border-color: var(--border);">
            <h5 class="modal-title"><i class="bi bi-stars me-2" style="color: var(--accent);"></i>${t('recommend.title') || 'مرشحون مطابقون'}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>${t('recommend.prompt') || 'لم نجد تطابقاً تاماً. هل المسافر أحد هؤلاء؟'}</p>

            <div class="p-3 mb-3 rounded" style="background: var(--bg-secondary); border: 1px solid var(--border);">
              <div class="text-uppercase small mb-2" style="color: var(--text-dim);">${t('recommend.scanned') || 'بيانات المسح'}</div>
              <div class="row g-2 small">
                <div class="col-md-3"><strong>${t('import.table.name')}:</strong> ${incomingName}</div>
                <div class="col-md-3"><strong>${t('import.table.passport')}:</strong> <code>${incomingPassport}</code></div>
                <div class="col-md-3"><strong>${t('import.table.dob')}:</strong> ${incomingDob}</div>
                <div class="col-md-3"><strong>${t('import.table.nationality')}:</strong> ${incomingNat}</div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th class="text-center" style="width:40px">#</th>
                    <th>${t('import.table.name')}</th>
                    <th>${t('import.table.passport')}</th>
                    <th>${t('import.table.dob')}</th>
                    <th>${t('import.table.nationality')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || `<tr><td colspan="6" class="text-center text-muted p-4">${t('common.empty')}</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer" style="border-color: var(--border);">
            <button type="button" class="btn btn-outline-danger" id="btn-rec-cancel">
              <i class="bi bi-x-octagon me-1"></i>${t('recommend.cancel') || 'إلغاء (خطأ)'}
            </button>
            <button type="button" class="btn btn-warning text-dark" id="btn-rec-pending">
              <i class="bi bi-hourglass-split me-1"></i>${t('recommend.toPending') || 'إرسال للمعلقين'}
            </button>
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

    modalEl.querySelectorAll('.btn-pick').forEach(btn => {
      btn.onclick = () => done({ decision: 'select-existing', candidateId: btn.getAttribute('data-id') });
    });
    document.getElementById('btn-rec-pending').onclick = () => done({ decision: 'pending' });
    document.getElementById('btn-rec-cancel').onclick = () => done({ decision: 'cancel' });
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (!resolved) done({ decision: 'cancel' });
    }, { once: true });

    modalInstance.show();
  });
}
