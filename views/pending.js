// ─────────────────────────────────────────────
//  views/pending.js  —  pending list, approve, reject
// ─────────────────────────────────────────────

function pendingMemos() {
  return loadMemos()
    .filter(m => m.status === 'pending')
    .sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
}
function pendingAge(iso) {
  if(!iso) return 'รอ 0 วัน';
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  return `รอ ${days} วัน`;
}
function renderPendingMemos() {
  const list = document.getElementById('pending-list');
  if(!list) return;
  const memos = pendingMemos();
  const total = memos.reduce((s,m) => s+(Number(m.total)||0), 0);
  const el = id => document.getElementById(id);
  if(el('pending-count')) el('pending-count').textContent = memos.length;
  if(el('pending-total')) el('pending-total').textContent = money(total);
  if(el('pending-latest')) el('pending-latest').textContent = memos[0]?.memoNo || '-';
  // update sidebar badge
  const badge = document.querySelector('#memo-sub .sb-badge');
  if(badge) badge.textContent = memos.length;
  if(!memos.length) {
    list.innerHTML = `<div class="placeholder" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:38px 20px"><h3>ยังไม่มี Memo ที่รออนุมัติ</h3><p>สร้าง Memo แล้วกด Save & Generate PDF เพื่อให้รายการมาแสดงที่นี่</p></div>`;
    return;
  }
  list.innerHTML = memos.map(memo => `
    <div class="pend-card">
      <div class="pend-top">
        <div>
          <div class="pend-title">${esc(memo.memoNo)} — ${esc(memo.typeLabel)}</div>
          <div class="pend-meta">
            <span class="badge ${badgeClass(memo.type)}">${esc(String(memo.type||'').toUpperCase())}</span>
            ${esc(memo.project||'-')} &nbsp;&middot;&nbsp; ${esc(memo.reviewerName||'-')} &nbsp;&middot;&nbsp; ${esc(shortDate(memo.createdAt))}
            <span class="badge badge-amber">${esc(pendingAge(memo.createdAt))}</span>
          </div>
        </div>
        <div class="pend-amount">${esc(money(memo.total||0))}</div>
      </div>
      <div class="pend-detail">${esc(memo.subject||'-')} &nbsp;&middot;&nbsp; เหตุผล: ${esc(memo.reason||'-')}</div>
      <div class="pend-actions">
        <button class="btn-approve" onclick="approveMemo(${JSON.stringify(memo.memoNo)})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Approve
        </button>
        <button class="btn-reject" onclick="rejectMemo(${JSON.stringify(memo.memoNo)})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Reject
        </button>
        <button class="btn-sm" onclick="openMemoPdf(${JSON.stringify(memo.memoNo)})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          ดู PDF
        </button>
      </div>
    </div>`).join('');
}
function approveMemo(memoNo) {
  if(!confirm(`Approve ${memoNo}?`)) return;
  const memo = updateMemoStatus(memoNo, 'completed');
  if(memo) alert(`${memoNo} Approved แล้ว ✓`);
}
function rejectMemo(memoNo) {
  const reason = prompt(`ระบุเหตุผล Reject สำหรับ ${memoNo}`);
  if(reason === null) return;
  const memo = updateMemoStatus(memoNo, 'rejected', { rejectionReason: reason.trim()||'-' });
  if(memo) alert(`${memoNo} Rejected แล้ว`);
}
