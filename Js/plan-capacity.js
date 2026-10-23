export function planEndsAt(entry, definition = {}) {
  const value = entry.endDate;
  const end = typeof value?.toMillis === 'function' ? value.toMillis()
    : value && typeof value === 'object' && Number.isFinite(value.seconds) ? value.seconds * 1000 : Number(value);
  if (Number.isFinite(end) && end > 0) return end;
  const start = Number(entry.startDate || entry.createdAt);
  const days = Number(entry.durationDays || definition.durationDays || 7);
  return Number.isFinite(start) && start > 0 && Number.isFinite(days) && days > 0
    ? start + days * 86400000 : Infinity;
}
export function belongsToPlan(entry, definition) {
  if (entry.planId) return entry.planId === definition.id;
  return typeof entry.description === 'string' && !!definition.title
    && entry.description.startsWith('Aplicação: ' + definition.title + ' (');
}
export function activePlanCount(entries, definition, now = Date.now()) {
  return entries.filter(entry => (!entry.type || entry.type === 'produto_adquirido') && belongsToPlan(entry, definition)
    && !['concluido','cancelado','rejeitado','estornado','terminado'].includes(entry.status)
    && planEndsAt(entry, definition) > now).length;
}
