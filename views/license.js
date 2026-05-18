// ─────────────────────────────────────────────
//  views/license.js  —  License Monitor
// ─────────────────────────────────────────────
// Data source: loadMemos().filter(m => m.type === 'sl' && m.status === 'completed')
// Each SL memo has: sections[0].html (table), total, project, createdAt

function renderLicenseMonitor() {
  // TODO: implement
  // Suggested structure:
  // 1. 4 metric cards: active licenses, monthly cost, expiring ≤30 days, expired
  // 2. Alert section: licenses expiring soon (highlight red/amber)
  // 3. Full registry table: software name, seats, cost/month, renewal date, project, status badge
  // Note: renewal date = createdAt + months from SL form (need to store in saveMemo)
}
