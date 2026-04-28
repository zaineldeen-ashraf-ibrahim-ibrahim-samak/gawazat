/**
 * Scan History Page
 * Displays a chronological log of all scan events.
 */

import { t } from '../i18n/index.js';

export async function renderScanHistory(container) {
  const events = await window.api.history.list();

  const html = `
    <div class="page-history h-100 d-flex flex-column">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>${t('nav.scanHistory')}</h1>
        <button id="btn-export-history" class="btn btn-outline-info">
          <i class="bi bi-file-earmark-excel me-2"></i>${t('history.export')}
        </button>
      </div>

      <div class="card bg-dark border-secondary shadow flex-grow-1 overflow-hidden">
        <div class="table-responsive h-100">
          <table class="table table-dark table-hover mb-0 align-middle">
            <thead class="sticky-top bg-dark">
              <tr>
                <th>${t('common.loading')}</th> <!-- Timestamp Placeholder -->
                <th>${t('import.table.status')}</th>
                <th>${t('import.table.passport')}</th>
                <th>${t('import.table.name')}</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              ${events.length === 0 ? `
                <tr><td colspan="5" class="text-center p-5 text-muted">${t('common.empty')}</td></tr>
              ` : events.map(e => `
                <tr>
                  <td class="text-muted small">${e.timestamp.replace('T', ' ').split('.')[0]}</td>
                  <td>${getOutcomeBadge(e.outcome)}</td>
                  <td><code>${e.passport_number_normalized || '---'}</code></td>
                  <td class="fw-bold">${e.passenger_name}</td>
                  <td><small class="badge bg-black border border-secondary">${e.mode}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Export handler
  document.getElementById('btn-export-history').onclick = async () => {
    const result = await window.api.dialog.saveFile({
      title: t('history.export'),
      defaultPath: `scan-history-${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (result && result.filePath) {
      const exportResult = await window.api.history.export({ savePath: result.filePath });
      if (exportResult.ok) alert(t('import.success'));
      else alert(exportResult.message || t('common.error'));
    }
  };
}

function getOutcomeBadge(outcome) {
  switch (outcome) {
    case 'green': return `<span class="badge bg-success">${t('scan.green.title')}</span>`;
    case 'yellow': return `<span class="badge bg-warning text-dark">${t('scan.yellow.title')}</span>`;
    case 'orange': return `<span class="badge bg-orange">${t('scan.orange.title')}</span>`;
    case 'read-failed': return `<span class="badge bg-danger">${t('scan.readFailed.title')}</span>`;
    case 'manual-entered': return `<span class="badge bg-info text-dark">Manual Entry</span>`;
    case 'operator-undone': return `<span class="badge bg-secondary">Undone</span>`;
    case 'pending-approved': return `<span class="badge bg-success">Approved (Manual)</span>`;
    case 'pending-rejected': return `<span class="badge bg-danger">Rejected (Manual)</span>`;
    default: return `<span class="badge bg-secondary">${outcome}</span>`;
  }
}
