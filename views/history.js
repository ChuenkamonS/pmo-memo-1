// ─────────────────────────────────────────
// views/history.js — history table, filter, CSV
// ─────────────────────────────────────────
function statusLabel(status) { return status==='completed'?'Completed':status==='rejected'?'Rejected':status; }
function statusBadgeClass(status) { return status==='completed'?'badge-green':status==='rejected'?'badge-red':'badge-gray'; }
function inHistoryRange(memo, range) {
  if(range==='all') return true;
  const dt = new Date(memo.updatedAt||memo.createdAt||0);
  if(Number.isNaN(dt.getTime())) return false;
  const now = new Date();
  if(range==='month') return dt.getFullYear()===now.getFullYear() && dt.getMonth()===now.getMonth();
  if(range==='last-month') {
    const last = new Date(now.getFullYear(), now.getMonth()-1, 1);
    return dt.getFullYear()===last.getFullYear() && dt.getMonth()===last.getMonth();
  }
  if(range==='3-months') return dt >= new Date(now.getFullYear(), now.getMonth()-2, 1);
  return true;
}
function filteredHistoryMemos() {
  const status  = val('#hist-status')||'all';
  const type    = val('#hist-type')||'all';
  const project = val('#hist-project')||'all';
  const range   = val('#hist-range')||'month';
  return loadMemos()
    .filter(m => ['completed','rejected'].includes(m.status))
    .filter(m =>
      (status==='all'  || m.status===status) &&
      (type==='all'    || m.type===type) &&
      (project==='all' || m.project===project) &&
      inHistoryRange(m, range)
    )
    .sort((a,b) => new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
}
function renderHistoryMemos() {
  const body = document.getElementById('history-body');
  if(!body) return;
  const memos = filteredHistoryMemos();
  if(!memos.length) {
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:34px 16px;color:var(--text-3)">ยังไม่มี Memo ใน History ตามเงื่อนไขที่เลือก</td></tr>`;
    return;
  }
  body.innerHTML = memos.map(memo => `
    <tr>
      <td class="mono" style="padding-left:16px">${esc(memo.memoNo)}</td>
      <td><span class="badge ${badgeClass(memo.type)}">${esc(String(memo.type||'').toUpperCase())}</span></td>
      <td>${esc(memo.project||'-')}</td>
      <td class="mono">${esc(money(memo.total||0))}</td>
      <td>${esc(shortDate(memo.updatedAt||memo.createdAt))}</td>
      <td><span class="badge ${statusBadgeClass(memo.status)}">${esc(statusLabel(memo.status))}</span></td>
      <td style="font-size:11px;color:var(--text-2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(memo.rejectionReason||'')}">
        ${memo.rejectionReason ? esc(memo.rejectionReason) : '<span style="color:var(--text-3)">—</span>'}
      </td>
      <td style="text-align:center"><button class="btn-sm" data-action="pdf" data-memo="${esc(memo.memoNo)}" style="padding:3px 8px;margin:0 auto">&#128196;</button></td>
    </tr>`).join('');
  const tbl = body.closest('table');
  if(tbl) tbl.onclick = e => { const b=e.target.closest('[data-action="pdf"]'); if(b) openMemoPdf(b.dataset.memo); };
}
function exportHistoryCsv() {
  const memos = filteredHistoryMemos();
  if(!memos.length) { alert('ไม่มีข้อมูลสำหรับ Export'); return; }
  const headers = ['Memo No','Type','Project','Amount','Status','Created At','Updated At','Subject','Reason','Rejection Reason'];
  const rows = memos.map(m => [m.memoNo||'', String(m.type||'').toUpperCase(), m.project||'', Number(m.total)||0, statusLabel(m.status), m.createdAt||'', m.updatedAt||'', m.subject||'', m.reason||'', m.rejectionReason||'']);
  const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`memo-history-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
