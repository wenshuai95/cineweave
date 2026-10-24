// Rules for the unified generation composer: keyboard, dismissal and retry state.
// Kept DOM-free so stage-D acceptance can be tested without a renderer.

/** Map a keydown event to a composer action. IME composition never triggers actions. */
export function generationKeyboardAction(event) {
  if (!event || event.isComposing) return null;
  if (event.key === 'Escape') return 'dismiss';
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') return 'submit';
  return null;
}

/**
 * Close behaviour for the composer. While a submitted task is running, dismissing the
 * panel must keep the task alive in the background instead of silently dropping it.
 */
export function generationCloseAction({busy = false, submitted = false} = {}) {
  return busy && submitted ? 'background' : 'close';
}

/** State after a failed/aborted attempt: the quote is consumed, so ask for a new one. */
export function generationQuoteReset() {
  return {quote: null, price: '', runLabel: '查看费用'};
}
