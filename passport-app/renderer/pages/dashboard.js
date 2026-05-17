/**
 * Dashboard Page
 * Provides a high-level overview of the current voyage.
 */

import { t } from '../i18n/index.js';

export async function renderDashboard(container) {
  const stats = await window.api.dashboard.stats();
  const totalAll = stats.total + (stats.totalNew || 0);
  const rawPercent = totalAll > 0 ? (stats.entered / totalAll) * 100 : 0;
  const enteredPercent = rawPercent > 0 && rawPercent < 1 ? rawPercent.toFixed(1) : Math.round(rawPercent);

  const html = `
    <div class="page-dashboard">
      <div class="d-flex align-items-center justify-content-between mb-4">
        <h1 class="mb-0">${t('nav.dashboard')}</h1>
        ${stats.ship_name ? `<span class="badge bg-dark border border-secondary fs-6 px-3 py-2"><i class="bi bi-ship me-2 text-accent"></i>${stats.ship_name}</span>` : ''}
      </div>

      <!-- Stats Cards -->
      <div class="row g-3 mb-4">
        ${renderStatCard('كشف المسافرون', stats.total, 'bi-people', 'text-info', renderNationalityBreakdown(stats.nationalityCounts))}
        ${renderStatCard('مسافرون جدد', stats.totalNew, 'bi-person-plus', 'text-accent')}
        ${renderStatCard(`${t('passengerList.filter.entered')} `, stats.entered, 'bi-check-circle', 'text-success', `${stats.originalEntered} أصلي + ${stats.newEntered} جديد`)}
        ${renderStatCard(t('nav.pendingApproval'), stats.pending, 'bi-hourglass-split', 'text-warning')}
        ${renderStatCard(t('reports.warnings'), stats.warnings, 'bi-exclamation-triangle', 'text-danger')}
        ${renderStatCard(t('dashboard.waitingNotScanned'), stats.waiting, 'bi-list-ul', 'text-secondary')}
      </div>

      <div class="row g-4">
        <!-- Progress -->
        <div class="col-lg-6">
          <div class="card bg-dark border-secondary shadow-sm h-100">
            <div class="card-body p-4">
              <h5 class="card-title mb-4">${t('passengerList.filter.entered')} (%)</h5>
              <div class="d-flex align-items-center justify-content-center h-100">
                <div class="text-center w-100">
                  <div class="display-1 fw-bold text-accent mb-2">${enteredPercent}%</div>
                  <div class="progress bg-black bg-opacity-50" style="height: 20px;">
                    <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: ${enteredPercent}%"></div>
                  </div>
                  <p class="mt-3 text-muted fs-5">${stats.entered} / ${stats.total + (stats.totalNew || 0)} ${t('nav.passengerList')}</p>
                  ${stats.totalNew > 0 ? `<p class="text-muted small mb-0">(${stats.originalEntered} أصلي + ${stats.newEntered} جديد)</p>` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Events -->
        <div class="col-lg-6">
          <div class="card bg-dark border-secondary shadow-sm h-100">
            <div class="card-body p-4">
              <h5 class="card-title mb-4">${t('nav.scanHistory')} (أحدث 5)</h5>
              <div class="list-group list-group-flush bg-transparent">
                ${stats.recentEvents.length === 0 ? `
                  <div class="text-center p-4 text-muted">${t('common.empty')}</div>
                ` : stats.recentEvents.map(e => `
                  <div class="list-group-item bg-transparent border-secondary text-white px-0 py-3">
                    <div class="d-flex justify-content-between align-items-start">
                      <div>
                        <div class="fw-bold">${e.passenger_name}</div>
                        <small class="text-muted">${(e.at || '').split('T')[1]?.split('.')[0] || ''}</small>
                      </div>
                      ${getOutcomeBadge(e.outcome)}
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="mt-4 text-center">
                <a href="#/history" class="btn btn-outline-secondary btn-sm">${t('nav.scanHistory')}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderStatCard(title, value, icon, colorClass, subtitle = '') {
  return `
    <div class="col">
      <div class="card bg-dark border-secondary shadow-sm h-100">
        <div class="card-body d-flex align-items-center p-3">
          <div class="rounded-circle bg-black bg-opacity-25 p-3 me-3">
            <i class="bi ${icon} fs-2 ${colorClass}"></i>
          </div>
          <div>
            <div class="text-muted small">${title}</div>
            <div class="fs-2 fw-bold">${value}</div>
            ${subtitle ? `<div class="text-muted" style="font-size:0.72rem;">${subtitle}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function getOutcomeBadge(outcome) {
  switch (outcome) {
    case 'green': return `<span class="badge bg-success">${t('scan.green.title')}</span>`;
    case 'yellow': return `<span class="badge bg-warning text-dark">${t('scan.yellow.title')}</span>`;
    case 'orange': return `<span class="badge bg-orange">${t('scan.orange.title')}</span>`;
    case 'read-failed': return `<span class="badge bg-danger">${t('scan.readFailed.title')}</span>`;
    case 'manual-entered': return `<span class="badge bg-info text-dark">${t('history.badge.manualEntered')}</span>`;
    case 'operator-undone': return `<span class="badge bg-secondary">${t('history.badge.undone')}</span>`;
    case 'pending-approved': return `<span class="badge bg-success">${t('history.badge.approvedManual')}</span>`;
    case 'pending-rejected': return `<span class="badge bg-danger">${t('history.badge.rejectedManual')}</span>`;
    default: return `<span class="badge bg-secondary">${outcome}</span>`;
  }
}

function renderNationalityBreakdown(counts) {
  if (!counts || Object.keys(counts).length === 0) return '';
  const items = Object.entries(counts).map(([nat, count]) => `${nat}: ${count}`).join(' | ');
  const collapseId = 'collapse-nat-breakdown';
  return `
    <div class="mt-1">
      <a class="text-info text-decoration-none small d-inline-flex align-items-center" data-bs-toggle="collapse" href="#${collapseId}" role="button" aria-expanded="false" aria-controls="${collapseId}">
        <i class="bi bi-chevron-expand me-1"></i>التفاصيل حسب الجنسية
      </a>
      <div class="collapse mt-2" id="${collapseId}">
        <div class="card card-body bg-black bg-opacity-50 p-2 text-light small border-secondary" style="font-size: 0.75rem;">
          ${items}
        </div>
      </div>
    </div>
  `;
}
