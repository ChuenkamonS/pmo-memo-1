// ─────────────────────────────────────────
// views/pending.js — Enhanced Pending Memo
// ─────────────────────────────────────────

// ── Budget Ceiling Storage ──
const BUDGET_KEY = 'orbit-pmo-budgets-v1';
const DEFAULT_BUDGETS = { 'AOA-MP':500000, 'TTB':500000, 'Geo9':300000, 'Release 2.1':300000, 'Release 3':500000 };

function loadBudgets() {
  try { const b = JSON.parse(localStorage.getItem(BUDGET_KEY)||'null'); return b || {...DEFAULT_BUDGETS}; }
  catch(e) { return {...DEFAULT_BUDGETS}; }
}
function storeBudgets(b) {
  try { localStorage.setItem(BUDGET_KEY, JSON.stringify(b)); } catch(e) {}
}
function getProjectBudget(project) { return loadBudgets()[project] || 0; }
function getProjectUsed(project) {
  return loadMemos()
    .filter(m => m.project === project && m.status === 'completed')
    .reduce((s,m) => s+(Number(m.total)||0), 0);
}

// ── Helpers ──
function pendingAge(iso) {
  if(!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}
function amountThreshold(amount) {
  if(amount >= 500000) return { cls:'badge-red',   label:'Critical' };
  if(amount >= 100000) return { cls:'badge-amber',  label:'Warning'  };
  return                      { cls:'badge-green',  label:'Normal'   };
}
function priorityBadge(p) {
  return { urgent:{ cls:'badge-red', label:'Urgent' }, critical:{ cls:'badge-red', label:'Critical' } }[p]
    || { cls:'badge-gray', label:'Normal' };
}
function currentUser() { return 'Chuen K.'; }
function appendAuditLog(memos, memoNo, action, comment) {
  const idx = memos.findIndex(m => m.memoNo === memoNo);
  if(idx<0) return;
  if(!memos[idx].auditLog) memos[idx].auditLog = [];
  memos[idx].auditLog.push({ actor:currentUser(), action, comment:comment||'', timestamp:new Date().toISOString() });
}

// ── Tab state ──
let _pendingTab = 'awaiting';
let _pendingSearch = '';

function switchPendingTab(tab) {
  _pendingTab = tab;
  document.querySelectorAll('.pend-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderPendingContent();
}

// ── Main render ──
function renderPendingMemos() {
  const list = document.getElementById('pending-list');
  if(!list) return;
  const allMemos = loadMemos();
  const pending  = allMemos.filter(m => !m.status || m.status === 'pending');
  const totalAmt = pending.reduce((s,m) => s+(Number(m.total)||0), 0);
  const el = id => document.getElementById(id);
  if(el('pending-count'))  el('pending-count').textContent  = pending.length;
  if(el('pending-total'))  el('pending-total').textContent  = money(totalAmt);
  if(el('pending-latest')) el('pending-latest').textContent = pending[0]?.memoNo || '-';
  const badge = document.querySelector('#memo-sub .sb-badge');
  if(badge) badge.textContent = pending.length;
  // Tab counts
  const counts = { awaiting:pending.length, submitted:allMemos.filter(m=>['pending','completed','rejected'].includes(m.status)).length, rejected:allMemos.filter(m=>m.status==='rejected').length, drafts:allMemos.filter(m=>m.status==='draft').length };
  Object.entries(counts).forEach(([tab,count]) => {
    const el = document.querySelector(`.pend-tab-btn[data-tab="${tab}"] .tab-count`);
    if(el) el.textContent = count > 0 ? count : '';
  });
  renderPendingContent();
}

function renderPendingContent() {
  const list = document.getElementById('pending-list');
  if(!list) return;
  let memos = loadMemos();
  if(_pendingTab==='awaiting')  memos = memos.filter(m => !m.status || m.status==='pending');
  if(_pendingTab==='submitted') memos = memos.filter(m => ['pending','completed','rejected'].includes(m.status));
  if(_pendingTab==='rejected')  memos = memos.filter(m => m.status==='rejected');
  if(_pendingTab==='drafts')    memos = memos.filter(m => m.status==='draft');
  if(_pendingSearch) {
    const s = _pendingSearch.toLowerCase();
    memos = memos.filter(m => (m.memoNo||'').toLowerCase().includes(s)||(m.project||'').toLowerCase().includes(s)||(m.reviewerName||'').toLowerCase().includes(s));
  }
  const typeF    = val('#pend-filter-type')    ||'all';
  const projF    = val('#pend-filter-project') ||'all';
  const prioF    = val('#pend-filter-priority')||'all';
  if(typeF!=='all') memos = memos.filter(m=>m.type===typeF);
  if(projF!=='all') memos = memos.filter(m=>m.project===projF);
  if(prioF!=='all') memos = memos.filter(m=>(m.priority||'normal')===prioF);
  memos.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));

  if(!memos.length) {
    list.innerHTML = `<div class="placeholder" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:38px 20px"><h3>${_pendingTab==='awaiting'?'ไม่มี Memo ที่รออนุมัติ':'ไม่มีข้อมูล'}</h3><p>${_pendingTab==='awaiting'?'สร้าง Memo แล้วกด Save & Generate PDF':'ยังไม่มีรายการในหมวดนี้'}</p></div>`;
    return;
  }
  list.innerHTML = memos.map(m=>buildPendingCard(m)).join('');
  list.onclick = function(e) {
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const no = btn.dataset.memo;
    if(btn.dataset.action==='approve') openApproveModal(no);
    else if(btn.dataset.action==='reject') openRejectModal(no);
    else if(btn.dataset.action==='detail') openDetailModal(no);
    else if(btn.dataset.action==='toggle') toggleDesc(btn);
  };
}

function buildPendingCard(memo) {
  const days   = pendingAge(memo.createdAt);
  const amt    = Number(memo.total)||0;
  const thresh = amountThreshold(amt);
  const prio   = priorityBadge(memo.priority||'normal');
  const stage  = memo.approvalStage || 'Pending A1';
  const budget = getProjectBudget(memo.project);
  const used   = getProjectUsed(memo.project);
  const usedPct  = budget ? Math.round(used/budget*100) : 0;
  const afterPct = budget ? Math.round((used+amt)/budget*100) : 0;
  const isOwn  = memo.reviewerName === currentUser();
  const canAct = _pendingTab==='awaiting' && !isOwn;

  const chain = (memo.approvalChain||[{ role:'A1', name:memo.reviewerName||'—', done:false }])
    .map((s,i,arr) => `<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px">${s.done?'✅':'⏳'} <span style="color:var(--text-2)">${esc(s.role)}: ${esc(s.name)}</span></span>${i<arr.length-1?' <span style="color:var(--text-3)">→</span> ':''}`).join('');

  const budgetBar = budget ? `<div style="margin-top:8px;padding:8px 10px;background:var(--bg);border-radius:var(--r-sm);font-size:11px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:var(--text-2)">Budget: <strong>${money(budget)}</strong></span>
      <span style="color:${afterPct>100?'var(--red)':afterPct>85?'var(--amber)':'var(--text-2)'}">After approval: <strong>${afterPct}%</strong></span>
    </div>
    <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.min(usedPct,100)}%;background:var(--blue);border-radius:3px"></div></div>
    <div style="display:flex;justify-content:space-between;margin-top:3px;color:var(--text-3)">
      <span>Used: ${money(used)} (${usedPct}%)</span>
      <span style="color:${afterPct>100?'var(--red)':'var(--text-3)'}">+${money(amt)} → ${money(used+amt)}</span>
    </div></div>` : '';

  return `<div class="pend-card">
    <div class="pend-top">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
          <div class="pend-title">${esc(memo.memoNo)} — ${esc(memo.typeLabel||'-')}</div>
          <span class="badge ${thresh.cls}">${thresh.label}</span>
          ${memo.priority&&memo.priority!=='normal'?`<span class="badge ${prio.cls}">${prio.label}</span>`:''}
          <span class="badge badge-purple" style="font-size:9px">${esc(stage)}</span>
        </div>
        <div class="pend-meta">
          <span class="badge ${badgeClass(memo.type)}">${esc(String(memo.type||'').toUpperCase())}</span>
          ${esc(memo.project||'-')} &middot; ${esc(memo.reviewerName||'-')} &middot;
          Submitted: ${esc(shortDate(memo.createdAt))} &middot;
          <span style="color:${days>7?'var(--red)':days>3?'var(--amber)':'var(--text-3)'}">รอ ${days} วัน</span>
          ${memo.attachments?.length?`&middot; 📎 ${memo.attachments.length}`:''}
        </div>
      </div>
      <div class="pend-amount">${esc(money(amt))}</div>
    </div>
    <div class="pend-detail desc-text" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(memo.subject||'-')} &middot; ${esc(memo.reason||'-')}</div>
    <button data-action="toggle" data-memo="${esc(memo.memoNo)}" class="btn-sm" style="padding:2px 8px;font-size:10px;margin:2px 0 6px">ดูเพิ่มเติม ▾</button>
    <div style="font-size:11px;margin-bottom:4px">${chain}</div>
    ${budgetBar}
    ${isOwn&&_pendingTab==='awaiting'?'<div style="font-size:11px;color:var(--amber);margin-top:6px">⚠ ไม่สามารถอนุมัติ Memo ของตัวเองได้</div>':''}
    <div class="pend-actions" style="margin-top:10px">
      ${canAct?`<button class="btn-approve" data-action="approve" data-memo="${esc(memo.memoNo)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Approve</button>
      <button class="btn-reject" data-action="reject" data-memo="${esc(memo.memoNo)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject</button>`:''}
      <button class="btn-sm" data-action="detail" data-memo="${esc(memo.memoNo)}">👁 View Details</button>
      ${memo.status==='rejected'?`<span class="badge badge-red" style="align-self:center">Rejected: ${esc(memo.rejectionReason||'-')}</span>`:''}
    </div>
  </div>`;
}

function toggleDesc(btn) {
  const desc = btn.closest('.pend-card').querySelector('.desc-text');
  const collapsed = desc.style.webkitLineClamp !== 'unset';
  desc.style.webkitLineClamp = collapsed ? 'unset' : '2';
  desc.style.overflow = collapsed ? 'visible' : 'hidden';
  btn.textContent = collapsed ? 'ย่อ ▴' : 'ดูเพิ่มเติม ▾';
}

// ── Approve Modal ──
function openApproveModal(memoNo) {
  const memo = loadMemos().find(m=>m.memoNo===memoNo);
  if(!memo) return;
  document.getElementById('approve-memo-no').textContent  = memo.memoNo;
  document.getElementById('approve-project').textContent  = memo.project||'-';
  document.getElementById('approve-amount').textContent   = money(Number(memo.total)||0);
  document.getElementById('approve-subject').textContent  = memo.subject||'-';
  document.getElementById('approve-note').value           = '';
  document.getElementById('approve-modal').dataset.memo   = memoNo;
  document.getElementById('approve-modal').style.display  = 'flex';
}
function closeApproveModal() { document.getElementById('approve-modal').style.display='none'; }
function confirmApprove() {
  const memoNo = document.getElementById('approve-modal').dataset.memo;
  const note   = document.getElementById('approve-note').value.trim();
  const memos  = loadMemos();
  appendAuditLog(memos, memoNo, 'approved', note);
  storeMemos(memos);
  updateMemoStatus(memoNo, 'completed', { approvalNote:note, approvedBy:currentUser() });
  closeApproveModal();
  alert(`✓ ${memoNo} Approved แล้ว`);
}

// ── Reject Modal ──
function openRejectModal(memoNo) {
  const memo = loadMemos().find(m=>m.memoNo===memoNo);
  if(!memo) return;
  document.getElementById('reject-memo-no').textContent = memo.memoNo;
  document.getElementById('reject-reason-select').value = '';
  document.getElementById('reject-comment').value = '';
  document.getElementById('reject-modal').dataset.memo  = memoNo;
  document.getElementById('reject-modal').style.display = 'flex';
}
function closeRejectModal() { document.getElementById('reject-modal').style.display='none'; }
function confirmReject() {
  const memoNo  = document.getElementById('reject-modal').dataset.memo;
  const reason  = document.getElementById('reject-reason-select').value;
  const comment = document.getElementById('reject-comment').value.trim();
  if(!reason) { alert('กรุณาเลือกเหตุผลการ Reject'); return; }
  const full = reason==='Other' ? (comment||'Other') : (comment?`${reason}: ${comment}`:reason);
  const memos = loadMemos();
  appendAuditLog(memos, memoNo, 'rejected', full);
  storeMemos(memos);
  updateMemoStatus(memoNo, 'rejected', { rejectionReason:full, rejectedBy:currentUser() });
  closeRejectModal();
  alert(`${memoNo} Rejected แล้ว`);
}

// ── Detail Modal ──
function openDetailModal(memoNo) {
  const memo = loadMemos().find(m=>m.memoNo===memoNo);
  if(!memo) return;
  const auditLog = (memo.auditLog||[]).map(e=>`<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)"><div style="font-size:11px;color:var(--text-3);white-space:nowrap">${esc(shortDate(e.timestamp))}</div><div style="font-size:11px;color:var(--text-2)"><strong>${esc(e.actor)}</strong> — ${esc(e.action)}${e.comment?`<br><span style="color:var(--text-3)">${esc(e.comment)}</span>`:''}</div></div>`).join('')||'<div style="font-size:11px;color:var(--text-3);padding:8px 0">ยังไม่มีประวัติ</div>';
  const sections = (memo.sections||[]).map(s=>`<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:6px">${esc(s.title)}</div>${s.html}</div>`).join('');
  const isOwn = memo.reviewerName===currentUser();
  const canAct = (!memo.status||memo.status==='pending') && !isOwn;
  document.getElementById('detail-content').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <div style="font-size:16px;font-weight:700">${esc(memo.memoNo)}</div>
      <span class="badge ${badgeClass(memo.type)}">${esc(String(memo.type||'').toUpperCase())}</span>
      <span class="badge ${memo.status==='completed'?'badge-green':memo.status==='rejected'?'badge-red':'badge-amber'}">${memo.status==='completed'?'Completed':memo.status==='rejected'?'Rejected':'Pending'}</span>
    </div>
    <div class="form-grid" style="margin-bottom:12px">
      <div><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase">วันที่</div><div>${esc(memo.date||'-')}</div></div>
      <div><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase">โครงการ</div><div>${esc(memo.project||'-')}</div></div>
      <div><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase">เรียน</div><div>${esc(memo.to||'-')}</div></div>
      <div><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase">วงเงิน</div><div style="font-size:16px;font-weight:700;color:var(--blue-800)">${esc(money(memo.total||0))}</div></div>
    </div>
    <div style="margin-bottom:10px"><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;margin-bottom:4px">เหตุผล</div><div style="font-size:13px">${esc(memo.reason||'-')}</div></div>
    <div style="margin-bottom:14px">${sections}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;background:var(--bg);border-radius:var(--r-sm);margin-bottom:14px">
      <div><div style="font-size:10px;color:var(--text-3);font-weight:600;margin-bottom:2px">REVIEWER</div><div style="font-weight:600">${esc(memo.reviewerName||'-')}</div><div style="font-size:11px;color:var(--text-3)">${esc(memo.reviewerTitle||'-')}</div></div>
      <div><div style="font-size:10px;color:var(--text-3);font-weight:600;margin-bottom:2px">APPROVER</div><div style="font-weight:600">${esc(memo.approverName||'-')}</div><div style="font-size:11px;color:var(--text-3)">${esc(memo.approverTitle||'-')}</div></div>
    </div>
    ${memo.approvalNote?`<div style="padding:10px;background:var(--green-50);border-radius:var(--r-sm);margin-bottom:10px;font-size:12px"><strong>Approval Note:</strong> ${esc(memo.approvalNote)}</div>`:''}
    ${memo.rejectionReason?`<div style="padding:10px;background:var(--red-50);border-radius:var(--r-sm);margin-bottom:10px;font-size:12px"><strong>Rejection Reason:</strong> ${esc(memo.rejectionReason)}</div>`:''}
    <div><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;margin-bottom:8px">Audit Log</div>${auditLog}</div>`;
  const acts = document.getElementById('detail-actions');
  acts.innerHTML = canAct
    ? `<button class="btn-primary" onclick="closeDetailModal();openApproveModal('${esc(memo.memoNo)}')">✓ Approve</button>
       <button class="btn-reject" onclick="closeDetailModal();openRejectModal('${esc(memo.memoNo)}')">✕ Reject</button>`
    : '';
  acts.innerHTML += `<button class="btn-sm" onclick="openMemoPdf('${esc(memo.memoNo)}')">📄 PDF</button>`;
  document.getElementById('detail-modal').style.display = 'flex';
}
function closeDetailModal() { document.getElementById('detail-modal').style.display='none'; }

// ── Budget Settings ──
function openBudgetSettings() {
  const b = loadBudgets();
  const projects = ['AOA-MP','TTB','Geo9','Release 2.1','Release 3'];
  document.getElementById('budget-settings-body').innerHTML = projects.map(p=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:110px;font-size:13px;font-weight:500">${esc(p)}</div>
      <input type="number" class="budget-ceiling-input" data-project="${esc(p)}" value="${b[p]||0}"
        style="flex:1;font-size:13px;padding:6px 10px;border:1px solid var(--border-md);border-radius:var(--r-sm)">
      <div style="font-size:11px;color:var(--text-3);white-space:nowrap">Used: ${money(getProjectUsed(p))}</div>
    </div>`).join('');
  document.getElementById('budget-settings-modal').style.display='flex';
}
function closeBudgetSettings() { document.getElementById('budget-settings-modal').style.display='none'; }
function saveBudgetSettings() {
  const b = loadBudgets();
  document.querySelectorAll('.budget-ceiling-input').forEach(inp => { b[inp.dataset.project]=Number(inp.value)||0; });
  storeBudgets(b);
  closeBudgetSettings();
  renderPendingMemos();
  alert('บันทึก Budget Ceiling แล้ว');
}

// ── backward compat ──
function approveMemo(memoNo) { openApproveModal(memoNo); }
function rejectMemo(memoNo)  { openRejectModal(memoNo); }
