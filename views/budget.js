// ─────────────────────────────────────────
// views/budget.js — Budget Monitor
// ─────────────────────────────────────────

let bgtTypeChart = null;
let bgtTrendChart = null;

const BGT_TYPE_NAMES = { sl:'Software License', hw:'Hardware', int:'Team Activity', ent:'Client Expense', dep:'Deployment' };
const BGT_TYPE_COLORS = { sl:'#185FA5', hw:'#5F5E5A', int:'#3B6D11', ent:'#854F0B', dep:'#3C3489' };

function memoDate(m){ return new Date(m.updatedAt||m.approvedAt||m.createdAt||0); }
function memoStatusKey(m){
  if(m.status==='completed') return 'completed';
  if(!m.status || m.status==='pending') return 'pending';
  if(m.status==='rejected') return 'rejected';
  if(m.status==='cancelled') return 'cancelled';
  return m.status||'pending';
}
function statusBadge(st){
  if(st==='completed') return 'badge-green';
  if(st==='pending') return 'badge-amber';
  if(st==='rejected'||st==='cancelled') return 'badge-red';
  return 'badge-gray';
}

function getBudgetMemos(range, project) {
  const now = new Date();
  return loadMemos().filter(memo => {
    if(project !== 'all' && memo.project !== project) return false;
    const dt = memoDate(memo);
    if(range==='month') return dt.getFullYear()===now.getFullYear() && dt.getMonth()===now.getMonth();
    if(range==='last-month') {
      const last = new Date(now.getFullYear(), now.getMonth()-1, 1);
      return dt.getFullYear()===last.getFullYear() && dt.getMonth()===last.getMonth();
    }
    if(range==='3-months') return dt >= new Date(now.getFullYear(), now.getMonth()-2, 1);
    return true;
  });
}

function renderBudgetTrend(allMemos){
  const canvas = document.getElementById('bgt-trend-chart');
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    const wrap = canvas.parentElement; if (wrap) wrap.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:12px">ไม่สามารถแสดงกราฟได้ (Chart library ไม่พร้อม)</div>';
    return;
  }
  if (bgtTrendChart) bgtTrendChart.destroy();
  const labels=[]; const data=[];
  const now = new Date();
  for(let i=11;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    labels.push(d.toLocaleDateString('th-TH',{month:'short', year:'2-digit'}));
    const sum = allMemos.filter(m=>memoStatusKey(m)==='completed').filter(m=>{
      const md = memoDate(m);
      const mk = `${md.getFullYear()}-${String(md.getMonth()+1).padStart(2,'0')}`;
      return mk===key;
    }).reduce((s,m)=>s+(Number(m.total)||0),0);
    data.push(sum);
  }
  bgtTrendChart = new Chart(canvas, {type:'line', data:{labels,datasets:[{label:'Monthly Spend', data, borderColor:'#185FA5', backgroundColor:'rgba(24,95,165,.12)', tension:.28, fill:true}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>money(v)}}}}});
}

function renderBudgetPieChart(canvasId, chartRef, rows, labelFn, colorFn, onClick){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return null;
  if(typeof Chart === 'undefined') {
    const wrap = canvas.parentElement; if (wrap) wrap.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:12px">ไม่สามารถแสดงกราฟได้ (Chart library ไม่พร้อม)</div>';
    return null;
  }
  if(chartRef) { chartRef.destroy(); chartRef = null; }
  if (!rows.length) {
    const wrap = canvas.parentElement; if (wrap) wrap.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:12px">ยังไม่มีข้อมูลสำหรับกราฟ</div>';
    return null;
  }
  const labels = rows.map(([key]) => labelFn(key));
  const data = rows.map(([, d]) => d.total);
  const colors = rows.map(([key], i) => colorFn(key, i));
  chartRef = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]},
    options: { responsive: true, maintainAspectRatio:false, cutout:'58%', onClick:(_,els)=>{ if(els.length && onClick){ const idx=els[0].index; onClick(rows[idx][0]); } } }
  });
  return chartRef;
}

function renderBudget() {
  const range = val('#bgt-range') || 'month';
  const projectSel = val('#bgt-project') || 'all';
  const all = getBudgetMemos(range, projectSel);
  const approved = all.filter(m => memoStatusKey(m)==='completed');
  const pending = all.filter(m => memoStatusKey(m)==='pending');

  const approvedAmt = approved.reduce((s,m)=>s+(Number(m.total)||0),0);
  const pendingAmt = pending.reduce((s,m)=>s+(Number(m.total)||0),0);
  const forecastAmt = approvedAmt + pendingAmt;

  document.getElementById('bgt-total').textContent = money(approvedAmt);
  document.getElementById('bgt-total-count').textContent = approved.length + ' รายการ';
  document.getElementById('bgt-pending-total').textContent = money(pendingAmt);
  document.getElementById('bgt-pending-count').textContent = pending.length + ' รายการ';
  document.getElementById('bgt-forecast-total').textContent = money(forecastAmt);

  const budgets = typeof loadBudgets==='function' ? loadBudgets() : {};
  const budgetTotal = Object.values(budgets).reduce((s,v)=>s+(Number(v)||0),0);
  const utilPct = budgetTotal ? Math.round((approvedAmt / budgetTotal)*100) : 0;
  document.getElementById('bgt-util').textContent = `${utilPct}% Utilized`;

  const allProjects = [...new Set(all.map(m=>m.project||'ไม่ระบุ'))];
  let near=0;
  const projRows=[];
  allProjects.forEach(p=>{
    const projMemos = all.filter(m=>(m.project||'ไม่ระบุ')===p);
    const app = projMemos.filter(m=>memoStatusKey(m)==='completed').reduce((s,m)=>s+(Number(m.total)||0),0);
    const pen = projMemos.filter(m=>memoStatusKey(m)==='pending').reduce((s,m)=>s+(Number(m.total)||0),0);
    const budget = Number(budgets[p]||0);
    const util = budget ? Math.round((app / budget)*100) : 0;
    if(util>=80) near++;
    const rem = Math.max(0,budget-app);
    const st = util>90 ? 'Over Budget' : util>=70 ? 'Near Limit' : 'Normal';
    projRows.push({project:p,budget,approved:app,pending:pen,remaining:rem,util,st});
  });
  document.getElementById('bgt-near-limit').textContent = `${near} Projects > 80%`;

  const byType = {};
  approved.forEach(m=>{ if(!byType[m.type]) byType[m.type]={count:0,total:0}; byType[m.type].count++; byType[m.type].total += Number(m.total)||0; });
  const typeRows = Object.entries(byType).sort((a,b)=>b[1].total-a[1].total);
  bgtTypeChart = renderBudgetPieChart('bgt-type-chart', bgtTypeChart, typeRows, k=>BGT_TYPE_NAMES[k]||k.toUpperCase(), k=>BGT_TYPE_COLORS[k]||'#bbb');
  renderBudgetTrend(all);

  document.getElementById('bgt-alerts').innerHTML = projRows.filter(r=>r.util>=70).map(r=>`<span class="badge ${r.util>90?'badge-red':'badge-amber'}">${esc(r.project)} ${r.util}%</span>`).join(' ') || '<span style="color:var(--text-3)">ไม่มีแจ้งเตือน</span>';

  const sumBody = document.getElementById('bgt-summary-body');
  sumBody.innerHTML = !projRows.length ? '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--text-3)">ยังไม่มีข้อมูล</td></tr>' : projRows.map(r=>`<tr><td>${esc(r.project)}</td><td class="mono">${money(r.budget)}</td><td class="mono">${money(r.approved)}</td><td class="mono">${money(r.pending)}</td><td class="mono">${money(r.remaining)}</td><td>${r.util}%</td><td><span class="badge ${r.st==='Over Budget'?'badge-red':r.st==='Near Limit'?'badge-amber':'badge-green'}">${r.st}</span></td></tr>`).join('');

  const q=(val('#bgt-search')||'').toLowerCase().trim();
  const fType=val('#bgt-filter-type')||'all'; const fStatus=val('#bgt-filter-status')||'all'; const min=val('#bgt-min'); const max=val('#bgt-max');
  let memos=[...all];
  if(fType!=='all') memos=memos.filter(m=>m.type===fType);
  if(fStatus!=='all') memos=memos.filter(m=>memoStatusKey(m)===fStatus);
  if(min!==''&& !Number.isNaN(Number(min))) memos=memos.filter(m=>(Number(m.total)||0)>=Number(min));
  if(max!==''&& !Number.isNaN(Number(max))) memos=memos.filter(m=>(Number(m.total)||0)<=Number(max));
  if(q) memos=memos.filter(m=>`${m.memoNo} ${m.project} ${m.requesterName||''} ${m.subject||''}`.toLowerCase().includes(q));
  memos.sort((a,b)=>memoDate(b)-memoDate(a));

}

function exportBudgetCsv() { /* keep existing behavior */
  const range=val('#bgt-range')||'month'; const project=val('#bgt-project')||'all';
  const memos=getBudgetMemos(range,project); if(!memos.length){ alert('ไม่มีข้อมูลสำหรับ Export'); return; }
  const headers=['Memo No','Type','Project','Requester','Approver','Amount','Status','Date'];
  const rows=memos.map(m=>[m.memoNo||'', String(m.type||'').toUpperCase(), m.project||'', m.requesterName||m.reviewerName||'', m.approverName||m.approvedBy||'', Number(m.total)||0, memoStatusKey(m), shortDate(m.updatedAt||m.createdAt)]);
  const csv=[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`budget-${range}-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
