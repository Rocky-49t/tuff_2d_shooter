/**
 * True when focus is in a control that should receive typing/game keys
 * instead of the Phaser canvas.
 */
export function isDomTypingFocused() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
  if (el.isContentEditable) return true;
  if (el.closest?.('input, textarea, select, [contenteditable="true"]')) return true;
  return false;
}
