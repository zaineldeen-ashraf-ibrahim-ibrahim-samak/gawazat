/**
 * Simple hash-based router for renderer
 */

import { renderImport } from './pages/import.js';
import { renderScan } from './pages/scan.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderPendingApproval } from './pages/pendingApproval.js';
import { renderPassengerList } from './pages/passengerList.js';
import { renderScanHistory } from './pages/scanHistory.js';
import { renderSettings } from './pages/settings.js';
import { renderReports } from './pages/reports.js';

const routes = {
  '/': renderDashboard,
  '/dashboard': renderDashboard,
  '/import': renderImport,
  '/scan': renderScan,
  '/passengers': renderPassengerList,
  '/history': renderScanHistory,
  '/reports': renderReports,
  '/pending': renderPendingApproval,
  '/settings': renderSettings
};

let contentArea = null;
let currentDispose = null;

/**
 * Pages call this from their render function to register cleanup that runs
 * before the page is replaced (navigation or refresh). Removes accumulated
 * global listeners, intervals, subscriptions, etc.
 */
export function onPageDispose(fn) {
  currentDispose = fn;
}

export function initRouter(container) {
  if (!contentArea) {
    window.addEventListener('hashchange', handleRoute);
  }
  contentArea = container;
  handleRoute(); // Initial route
}

export function navigate(path) {
  window.location.hash = path;
}

export function refreshCurrentRoute() {
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const renderer = routes[hash];

  // Run any cleanup the current page registered before we tear it down.
  if (typeof currentDispose === 'function') {
    try { currentDispose(); } catch (e) { console.warn('Page dispose error:', e); }
    currentDispose = null;
  }

  if (renderer) {
    contentArea.innerHTML = '';
    renderer(contentArea);
  } else {
    contentArea.innerHTML = '<h1>404 Not Found</h1>';
  }
}
