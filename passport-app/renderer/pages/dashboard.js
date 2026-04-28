/**
 * Dashboard Page
 * Provides a high-level overview of the current voyage.
 */

import { t } from '../i18n/index.js';

export async function renderDashboard(container) {
  const stats = await window.api.dashboard.stats();
  const enteredPercent = stats.total > 0 ? Math.round((stats.entered / stats.total) * 100) : 0;

  const html = `
    <div class="page-dashboard">
      <h1 class="mb-4">${t('nav.dashboard')}</h1>

      <!-- Stats Cards -->
      <div class="row g-4 mb-4">
        ${renderStatCard(t('passengerList.filter.all'), stats.total, 'bi-people', 'text-info')}
        ${renderStatCard(t('passengerList.filter.entered'), stats.entered, 'bi-check-circle', 'text-success')}
        ${renderStatCard(t('nav.pendingApproval'), stats.pending, 'bi-hourglass-split', 'text-warning')}
        ${renderStatCard(t('reports.warnings'), stats.warnings, 'bi-exclamation-triangle', 'text-danger')}
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
                  <p class="mt-3 text-muted fs-5">${stats.entered} / ${stats.total} ${t('nav.passengerList')}</p>
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

function renderStatCard(title, value, icon, colorClass) {
  return `
    <div class="col-md-3">
      <div class="card bg-dark border-secondary shadow-sm h-100">
        <div class="card-body d-flex align-items-center p-4">
          <div class="rounded-circle bg-black bg-opacity-25 p-3 me-3">
            <i class="bi ${icon} fs-2 ${colorClass}"></i>
          </div>
          <div>
            <div class="text-muted small">${title}</div>
            <div class="fs-2 fw-bold">${value}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getOutcomeBadge(outcome) {
  switch (outcome) {
    case 'green': return `<span class="badge bg-success">✓</span>`;
    case 'yellow': return `<span class="badge bg-warning text-dark">!</span>`;
    case 'orange': return `<span class="badge bg-orange">X2</span>`;
    case 'read-failed': return `<span class="badge bg-danger">ERR</span>`;
    default: return `<span class="badge bg-secondary">${outcome}</span>`;
  }
}
