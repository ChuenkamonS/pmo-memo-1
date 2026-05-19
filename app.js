// ─────────────────────────────────────────
// app.js — shared utils, storage, nav, PDF
// ─────────────────────────────────────────

// ── Date helpers ──
const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
function thaiDate(d) { return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`; }
const TODAY = thaiDate(new Date());
const todayISO = new Date().toISOString().slice(0,10);

// ── Shared utils ──
function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function val(sel, root=document) { return root.querySelector(sel)?.value?.trim() || ''; }
function money(n) { return '฿' + (Number(n)||0).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
function shortDate(iso) {
  if(!iso) return '-';
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()+543).slice(-2)}`;
}
function dateInput(v) {
  if(!v) return '-';
  const d = new Date(v + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? v : thaiDate(d);
}
function badgeClass(type) {
  return { sl:'badge-blue', hw:'badge-gray', int:'badge-green', ent:'badge-amber', dep:'badge-purple' }[type] || 'badge-gray';
}
function table(headers, rows, numericIndexes=[]) {
  return `<table class="pdf-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((c,i)=>`<td class="${numericIndexes.includes(i)?'num':''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// ── Storage ──
const MEMO_KEY = 'orbit-pmo-memos-v1';
let _memMemos = [];
function canUseLocalStorage() {
  try { localStorage.setItem('_t','1'); localStorage.removeItem('_t'); return true; }
  catch(e) { return false; }
}
const HAS_LS = canUseLocalStorage();
function loadMemos() {
  if(!HAS_LS) return _memMemos;
  try { const p = JSON.parse(localStorage.getItem(MEMO_KEY)||'[]'); return Array.isArray(p)?p:[]; }
  catch(e) { return _memMemos; }
}
function storeMemos(memos) {
  _memMemos = Array.isArray(memos) ? memos : [];
  if(!HAS_LS) return;
  try { localStorage.setItem(MEMO_KEY, JSON.stringify(_memMemos)); }
  catch(e) { console.warn('localStorage write failed'); }
}
function currentMemoPrefix() {
  const d = new Date();
  return `ORB-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}`;
}
function nextMemoNo() {
  const prefix = currentMemoPrefix();
  const max = loadMemos().reduce((m,memo) => {
    const match = String(memo.memoNo||'').match(new RegExp(`^${prefix}-(\\d{3})$`));
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `${prefix}-${String(max+1).padStart(3,'0')}`;
}
function setNextMemoNo() {
  const el = document.getElementById('f-memo-no');
  if(el && !el.value.trim()) el.value = nextMemoNo();
}
function saveMemo(data) {
  const now = new Date().toISOString();
  const memos = loadMemos();
  const idx = memos.findIndex(m => m.memoNo === data.memoNo);
  const saved = { ...data, id:data.memoNo, status:'pending',
    createdAt: idx>=0 ? memos[idx].createdAt : now, updatedAt: now };
  if(idx>=0) memos[idx]=saved; else memos.push(saved);
  storeMemos(memos);
  return saved;
}
function updateMemoStatus(memoNo, status, extra={}) {
  const memos = loadMemos();
  const idx = memos.findIndex(m => m.memoNo === memoNo);
  if(idx<0) { alert('ไม่พบ Memo ที่เลือก'); return null; }
  memos[idx] = { ...memos[idx], ...extra, status, updatedAt: new Date().toISOString() };
  if(status==='completed') memos[idx].approvedAt = memos[idx].updatedAt;
  if(status==='rejected')  memos[idx].rejectedAt = memos[idx].updatedAt;
  storeMemos(memos);
  renderPendingMemos();
  renderHistoryMemos();
  return memos[idx];
}

// ── Navigation ──
function swView(id, el, title) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sb-sub-item').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(s => s.classList.remove('active'));
  document.getElementById('view-'+id).classList.add('active');
  document.getElementById('page-title').textContent = title;
  if(el) el.classList.add('active');
  if(['create','pending','history'].includes(id)) document.getElementById('nav-memo').classList.add('active');
  if(id === 'budget') renderBudget();
  if(id === 'license') renderLicense();
  if(id === 'device') renderDevice();
}
function toggleMemoSub(el) {
  el.classList.add('active');
  swView('create', document.querySelector('#memo-sub .sb-sub-item'), 'Create Memo');
}

// ── PDF ──
function renderMemoPdf(data) {
  const amountLine = data.total ? `<div class="pdf-total"><span>รวมเป็นเงิน</span><span>${esc(money(data.total))}</span></div>` : '';
  const wordsLine = data.amountWords ? `<p class="pdf-muted">(${esc(data.amountWords)})</p>` : '';
  return `<div class="pdf-page">
    <div class="pdf-head"><div><div class="pdf-brand">Orbit Digital</div><div class="pdf-subbrand">PMO Memo Approval</div></div><div class="pdf-memo-no">${esc(data.memoNo)}<br>${esc(data.typeLabel)}</div></div>
    <div class="pdf-title">บันทึกข้อความ</div>
    <div class="pdf-meta"><div class="pdf-label">วันที่</div><div>${esc(data.date)}</div><div class="pdf-label">เรื่อง</div><div>${esc(data.subject)}</div><div class="pdf-label">เรียน</div><div>${esc(data.to||'-')}</div><div class="pdf-label">โครงการ</div><div>${esc(data.project||'-')}</div></div>
    <p>ด้วยฝ่าย PMO มีความประสงค์ขออนุมัติรายการตามรายละเอียดด้านล่าง เพื่อสนับสนุนการดำเนินงานของโครงการให้เป็นไปตามแผนงาน</p>
    <div class="pdf-section"><div class="pdf-section-title">เหตุผลในการขออนุมัติ</div><p>${esc(data.reason||'-')}</p></div>
    ${data.sections.map(s=>`<div class="pdf-section"><div class="pdf-section-title">${esc(s.title)}</div>${s.html}</div>`).join('')}
    ${amountLine}${wordsLine}
    <div class="pdf-alert">เอกสารนี้สร้างจากระบบ PMO Dashboard โดยอัตโนมัติ กรุณาตรวจสอบรายละเอียดก่อนนำส่งเพื่ออนุมัติจริง</div>
    <div class="pdf-signatures"><div class="pdf-sign-box"><div class="pdf-sign-line"></div><div>${esc(data.reviewerName)}</div><div class="pdf-muted">${esc(data.reviewerTitle)}</div><div class="pdf-muted">${esc(data.reviewerDate)}</div></div><div class="pdf-sign-box"><div class="pdf-sign-line"></div><div>${esc(data.approverName)}</div><div class="pdf-muted">${esc(data.approverTitle)}</div><div class="pdf-muted">${esc(data.approverDate)}</div></div></div>
  </div>`;
}
async function downloadMemoPdf(data) {
  const stage = document.getElementById('pdf-stage');
  stage.innerHTML = renderMemoPdf(data);
  const filename = (data.memoNo||'memo') + '-' + (data.type||'draft') + '.pdf';
  async function fetchWithRetry(url, opts, ms=55000, retries=2) {
    for(let i=0; i<=retries; i++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        const r = await fetch(url, {...opts, signal:ctrl.signal});
        clearTimeout(t); return r;
      } catch(e) { clearTimeout(t); if(i===retries) throw e; await new Promise(r=>setTimeout(r,2000)); }
    }
  }
  try {
    const html = stage.firstElementChild?.outerHTML || stage.innerHTML;
    const resp = await fetchWithRetry('https://memo-pdf-server.onrender.com/generate-pdf', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ html, filename })
    });
    if(!resp.ok) throw new Error('Server '+resp.status);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
    URL.revokeObjectURL(url);
  } catch(err) {
    console.warn('PDF server failed, fallback to print', err);
    document.body.classList.add('printing-pdf');
    try { window.print(); } finally { document.body.classList.remove('printing-pdf'); }
  }
}
function openMemoPdf(memoNo) {
  const memo = loadMemos().find(m => m.memoNo === memoNo);
  if(!memo) { alert('ไม่พบ Memo'); return; }
  downloadMemoPdf(memo);
}

// ── Init ──
function initApp() {
  ['f-date','f-signdate','f-apprdate','sl-ratedate'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = todayISO;
  });
  setNextMemoNo();
  renderPendingMemos();
  renderHistoryMemos();
  rebuildAcct();
  setInterval(() => fetch('https://memo-pdf-server.onrender.com/ping').catch(()=>{}), 4*60*1000);
}
