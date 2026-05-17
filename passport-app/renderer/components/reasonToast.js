import { t } from '../i18n/index.js';

/**
 * Display a Bootstrap Toast for a Reason object
 * @param {Object} reasonObj - The Reason object containing code, message, field, suggestion
 * @param {string} reasonObj.code - ReasonCode (e.g., 'REQUIRED_FIELD_MISSING')
 * @param {string} [reasonObj.message] - Fallback or explicit message
 * @param {string} [reasonObj.field] - Optional field associated with the reason
 * @param {string} [reasonObj.suggestion] - Optional suggestion for the user
 * @param {'danger'|'warning'|'info'} [type='danger'] - Toast color style
 */
export function showReasonToast(reasonObj, type = 'danger') {
  if (!reasonObj) return;

  const code = typeof reasonObj === 'string' ? reasonObj : reasonObj.code;
  const rawMsg = typeof reasonObj === 'string' ? null : reasonObj.message;
  const field = typeof reasonObj === 'string' ? null : reasonObj.field;
  const suggestion = typeof reasonObj === 'string' ? null : reasonObj.suggestion;

  // Resolve localized message
  let localizedMessage = t(`reasons.${code}`);
  if (!localizedMessage || localizedMessage === `reasons.${code}`) {
    localizedMessage = rawMsg || code || t('common.error');
  }

  let container = document.getElementById('reason-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'reason-toast-container';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '1150';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${type} border-0 shadow-lg`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  let extraHtml = '';
  if (field) {
    const fieldName = t(`fieldRequirements.${field}`) || t(`import.table.${field}`) || field;
    extraHtml += `<div class="mt-1 small opacity-75"><i class="bi bi-tag-fill me-1"></i>${fieldName}</div>`;
  }
  if (suggestion) {
    extraHtml += `<div class="mt-1 small bg-black bg-opacity-25 p-2 rounded border border-light border-opacity-25"><i class="bi bi-lightbulb-fill me-1 text-warning"></i>${suggestion}</div>`;
  }

  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fs-6 py-3 w-100">
        <div class="d-flex align-items-center fw-bold mb-1">
          <i class="bi bi-exclamation-octagon-fill me-2 fs-5"></i>
          <span>${localizedMessage}</span>
          <span class="badge bg-black bg-opacity-50 ms-auto font-monospace small">${code}</span>
        </div>
        ${extraHtml}
      </div>
      <button type="button" class="btn-close btn-close-white me-3 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toastEl);
  const tInstance = new window.bootstrap.Toast(toastEl, { delay: 6000 });
  tInstance.show();

  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}
