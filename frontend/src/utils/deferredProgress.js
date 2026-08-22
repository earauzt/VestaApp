/** Progress of a deferred purchase from remaining vs total installments. */
export function deferredInstallmentProgress(totalInstallments, remainingInstallments) {
  const total = Number(totalInstallments) || 0;
  const remaining = Math.max(0, Number(remainingInstallments) || 0);
  const paid = total > 0 ? Math.max(0, Math.min(total, total - remaining)) : 0;
  const percentPaid = total > 0 ? (paid / total) * 100 : 0;
  return { total, remaining, paid, percentPaid };
}

export function isBudgetSaveEnabled(isDirty, saving) {
  return Boolean(isDirty) && !saving;
}
