// ─────────────────────────────────────────────
//  modal.js — Modal open/close management
// ─────────────────────────────────────────────

const OPEN_CLASS = 'open';

// ── GENERIC MODAL ─────────────────────────────

export function openModal(overlayId) {
  document.getElementById(overlayId)?.classList.add(OPEN_CLASS);
}

export function closeModal(overlayId) {
  document.getElementById(overlayId)?.classList.remove(OPEN_CLASS);
}

export function isOpen(overlayId) {
  return document.getElementById(overlayId)?.classList.contains(OPEN_CLASS) ?? false;
}

// ── OVERLAY CLICK CLOSE ───────────────────────

export function initModalOverlayClose(overlayId) {
  const overlay = document.getElementById(overlayId);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlayId);
  });
}

// ── KEYBOARD CLOSE ────────────────────────────

export function initEscapeClose(overlayIds) {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlayIds.forEach(closeModal);
  });
}
