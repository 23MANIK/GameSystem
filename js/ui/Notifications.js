/**
 * Scale Architect - Toast Notification System
 * Non-intrusive toast notification queue with type-specific cyberpunk badges,
 * auto-dismiss timers, manual dismissal, and maximum queue enforcement.
 *
 * Toasts never cover another pop-up's buttons: while a modal, bottom sheet or
 * popover is open (see Layers.js) new toasts wait, and the newest of them show
 * once it closes. A toast that waited longer than HOLD_MAX_MS is dropped (it is
 * still in the Alerts tab).
 */

import { toastsHeldBy, watchLayers } from './Layers.js';

export const HOLD_MAX_MS = 30000;

export default class Notifications {
  /**
   * @param {HTMLElement} [container] - Container element (#notifications-container)
   * @param {number} [maxVisible=4] - Maximum simultaneous visible toasts
   */
  constructor(container = null, maxVisible = 4) {
    this.container = container || document.getElementById('notifications-container');
    this.maxVisible = maxVisible;
    this.activeToasts = []; // Array of { element, timer }
    this.held = []; // Waiting while another pop-up owns the screen: { message, type, duration, at }
    watchLayers(({ held }) => { if (!held) this.flushHeld(); });
  }

  /** Show the newest waiting toasts (up to maxVisible) now that the screen is free. */
  flushHeld() {
    if (!this.held.length || toastsHeldBy()) return;
    const now = Date.now();
    const fresh = this.held.filter(t => now - t.at <= HOLD_MAX_MS).slice(-this.maxVisible);
    this.held = [];
    for (const t of fresh) this.show(t.message, t.type, t.duration);
  }

  /**
   * Display a new toast notification.
   * @param {string} message - Message text or markup
   * @param {'info'|'success'|'warning'|'error'} [type='info'] - Severity category
   * @param {number} [duration=4000] - Lifespan in milliseconds before auto-dismiss
   * @returns {HTMLElement} The created toast element
   */
  show(message, type = 'info', duration = 4000) {
    if (toastsHeldBy()) {
      this.held.push({ message, type, duration, at: Date.now() });
      if (this.held.length > this.maxVisible) this.held.shift();
      return null;
    }
    if (!this.container) {
      this.container = document.getElementById('notifications-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'notifications-container';
        this.container.className = 'notifications-container';
        document.body.appendChild(this.container);
      }
    }

    // Enforce max queue length by dismissing oldest active toasts
    while (this.activeToasts.length >= this.maxVisible) {
      const oldest = this.activeToasts[0];
      if (oldest) {
        this.dismiss(oldest.element);
      }
    }

    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    const icon = icons[type] || 'ℹ️';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.style.cursor = 'pointer';

    toast.innerHTML = `
      <span class="toast-icon" style="font-size: 16px; flex-shrink: 0;">${icon}</span>
      <div class="toast-content" style="flex: 1; min-width: 0;">
        <span class="toast-message" style="font-size: 12px; line-height: 1.4; word-break: break-word;">${message}</span>
      </div>
      <span class="toast-close" style="font-size: 12px; opacity: 0.6; padding-left: 8px; flex-shrink: 0;" aria-label="Dismiss">✕</span>
    `;

    // Manual click dismiss
    toast.addEventListener('click', () => {
      this.dismiss(toast);
    });

    this.container.appendChild(toast);

    // Auto-dismiss timer
    const timer = setTimeout(() => {
      this.dismiss(toast);
    }, duration);

    const toastEntry = { element: toast, timer };
    this.activeToasts.push(toastEntry);

    return toast;
  }

  /**
   * Dismiss and animate out a specific toast element.
   * @param {HTMLElement} toastElement
   */
  dismiss(toastElement) {
    const idx = this.activeToasts.findIndex(t => t.element === toastElement);
    if (idx !== -1) {
      const entry = this.activeToasts[idx];
      if (entry.timer) clearTimeout(entry.timer);
      this.activeToasts.splice(idx, 1);
    }

    toastElement.classList.add('dismissing');
    toastElement.style.transition = 'opacity 0.25s ease, transform 0.25s ease, max-height 0.25s ease, margin 0.25s ease';
    toastElement.style.opacity = '0';
    toastElement.style.transform = 'translateX(60px) scale(0.9)';
    toastElement.style.maxHeight = '0';
    toastElement.style.marginBottom = '0';
    toastElement.style.paddingTop = '0';
    toastElement.style.paddingBottom = '0';

    setTimeout(() => {
      if (toastElement.parentNode) {
        toastElement.remove();
      }
    }, 260);
  }

  /**
   * Convenience helper for info messages.
   */
  info(message, duration = 4000) {
    return this.show(message, 'info', duration);
  }

  /**
   * Convenience helper for success messages.
   */
  success(message, duration = 4000) {
    return this.show(message, 'success', duration);
  }

  /**
   * Convenience helper for warning messages.
   */
  warning(message, duration = 4500) {
    return this.show(message, 'warning', duration);
  }

  /**
   * Convenience helper for error messages.
   */
  error(message, duration = 5000) {
    return this.show(message, 'error', duration);
  }

  /**
   * Dismiss all currently visible toasts immediately.
   */
  clear() {
    this.held = [];
    for (const t of [...this.activeToasts]) {
      this.dismiss(t.element);
    }
    this.activeToasts = [];
  }

  /**
   * Cleanup container and timers.
   */
  destroy() {
    this.clear();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
