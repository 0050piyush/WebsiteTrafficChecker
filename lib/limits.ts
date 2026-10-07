export function maxAuditPages(): number {
  const n = Number(process.env.MAX_AUDIT_PAGES);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1000) : 200;
}
