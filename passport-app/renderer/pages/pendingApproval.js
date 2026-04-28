/**
 * Pending Approval Page
 * Displays a queue of scans that were not matched in the manifest.
 * Allows supervisor to approve or reject.
 */

import { t } from '../i18n/index.js';

export async function renderPendingApproval(container) {
  const entries = await window.api.pending.list();

  const html = `
    <div class="page-pending">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>${t('nav.pendingApproval')}</h1>
        <span class="badge bg-warning text-dark fs-5">${entries.length} ${t('nav.pendingApproval')}</span>
      </div>

      ${entries.length === 0 ? `
        <div class="alert alert-dark border-secondary text-center p-5">
           <i class="bi bi-inbox display-1 text-muted mb-3 d-block"></i>
           <p class="fs-4 text-muted">${t('pending.empty')}</p>
        </div>
      ` : `
        <div class="card bg-dark border-secondary shadow">
           <div class="table-responsive">
              <table class="table table-dark table-hover mb-0 align-middle">
                 <thead>
                    <tr>
                       <th>${t('import.table.passport')}</th>
                       <th>${t('import.table.name')}</th>
                       <th>${t('import.table.gender')}</th>
                       <th>${t('import.table.nationality')}</th>
                       <th>${t('import.table.dob')}</th>
                       <th class="text-end">${t('common.confirm')}</th>
                    </tr>
                 </thead>
                 <tbody>
                    ${entries.map(e => `
                      <tr>
                         <td><code>${e.passport_number_normalized}</code></td>
                         <td>${e.mrz_fields.name || `${e.mrz_fields.surname} ${e.mrz_fields.given_names}`}</td>
                         <td>${e.mrz_fields.gender || e.mrz_fields.sex}</td>
                         <td>${e.mrz_fields.nationality}</td>
                         <td>${e.mrz_fields.date_of_birth}</td>
                         <td class="text-end">
                            <div class="btn-group">
                               <button class="btn btn-success btn-sm btn-approve" data-id="${e.id}">
                                  <i class="bi bi-check-lg"></i> ${t('pending.approve')}
                               </button>
                               <button class="btn btn-outline-danger btn-sm btn-reject" data-id="${e.id}">
                                  <i class="bi bi-x-lg"></i> ${t('pending.reject')}
                               </button>
                            </div>
                         </td>
                      </tr>
                    `).join('')}
                 </tbody>
              </table>
           </div>
        </div>
      `}
    </div>
  `;

  container.innerHTML = html;

  // Event Listeners
  container.querySelectorAll('.btn-approve').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (confirm(t('common.confirm'))) {
        const result = await window.api.pending.approve({ id });
        if (result.ok) renderPendingApproval(container);
        else alert(result.message || t('common.error'));
      }
    };
  });

  container.querySelectorAll('.btn-reject').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (confirm(t('common.confirm'))) {
        const result = await window.api.pending.reject({ id });
        if (result.ok) renderPendingApproval(container);
        else alert(result.message || t('common.error'));
      }
    };
  });
}
