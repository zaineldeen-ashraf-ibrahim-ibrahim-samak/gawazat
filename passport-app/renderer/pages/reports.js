/**
 * Reports Page
 * Allows operator to generate and print PDF reports.
 */

import { t } from '../i18n/index.js';

export async function renderReports(container) {
  const html = `
    <div class="page-reports">
      <h1 class="mb-4">${t('nav.reports')}</h1>

      <div class="row g-4">
        ${renderReportCard('full', t('reports.full'), 'bi-file-earmark-pdf')}
        ${renderReportCard('entered', t('reports.entered'), 'bi-check-circle')}
        ${renderReportCard('pending', t('reports.pending'), 'bi-hourglass-split')}
        ${renderReportCard('warnings', t('reports.warnings'), 'bi-exclamation-triangle')}
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Event Listeners
  container.querySelectorAll('.btn-generate').forEach(btn => {
    btn.onclick = async () => {
      const kind = btn.getAttribute('data-kind');
      const result = await window.api.dialog.saveFile({
        title: t('history.export'),
        defaultPath: `report-${kind}-${new Date().toISOString().split('T')[0]}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (result && result.filePath) {
        btn.disabled = true;
        const exportResult = await window.api.reports.generatePdf({ kind, savePath: result.filePath });
        btn.disabled = false;
        
        if (exportResult.ok) alert(t('import.success'));
        else alert(exportResult.message || t('common.error'));
      }
    };
  });

  container.querySelectorAll('.btn-print').forEach(btn => {
    btn.onclick = async () => {
      const kind = btn.getAttribute('data-kind');
      btn.disabled = true;
      const result = await window.api.reports.print({ kind });
      btn.disabled = false;
      
      if (!result.ok) alert(result.message || t('common.error'));
    };
  });
}

function renderReportCard(kind, title, icon) {
  return `
    <div class="col-md-6 col-lg-3">
      <div class="card bg-dark border-secondary h-100 shadow-sm">
        <div class="card-body text-center p-4">
          <i class="bi ${icon} display-4 mb-3 text-info"></i>
          <h5 class="card-title mb-4">${title}</h5>
          <div class="d-grid gap-2">
            <button class="btn btn-primary btn-generate" data-kind="${kind}">
              <i class="bi bi-download me-2"></i>${t('history.export')}
            </button>
            <button class="btn btn-outline-light btn-print" data-kind="${kind}">
              <i class="bi bi-printer me-2"></i>${t('reports.full')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
