// ─────────────────────────────────────────
// views/budget.js — Budget Monitor
// ─────────────────────────────────────────

let bgtTypeChart = null;
let bgtProjChart = null;
let bgtTrendChart = null;

const BGT_TYPE_NAMES = { sl:'Software License', hw:'Hardware', int:'Team Activity', ent:'Client Expense', dep:'Deployment' };
const BGT_TYPE_COLORS = { sl:'#4E79A7', hw:'#76B7B2', int:'#59A14F', ent:'#F28E2B', dep:'#B07AA1' };
const BGT_PROJ_PALETTE = ['#4E79A7','#F28E2B','#59A14F','#E15759','#76B7B2','#EDC948','#B07AA1','#FF9DA7','#9C755F','#BAB0AC'];

function memoDate(m){ return new Date(m.updatedAt||m.approvedAt||m.createdAt||0); }
function memoStatusKey(m){
  if(m.status==='completed') return 'completed';
  if(!m.status || m.status==='pending') return 'pending';
  if(m.status==='rejected') return 'rejected';
  return m.status||'pending';
}
function statusBadge(st){
  if(st==='completed') return 'badge-green';
  if(st==='pending') return 'badge-amber';
  if(st==='rejected') return 'badge-red';
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
  if(!canvas || typeof Chart === 'undefined') return;
  if(bgtTrendChart) bgtTrendChart.destroy();
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
  bgtTrendChart = new Chart(canvas, {
    type:'line',
    data:{labels,datasets:[{label:'Monthly Spend', data, borderColor:'#185FA5', backgroundColor:'rgba(24,95,165,.12)', tension:.28, fill:true}]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>money(v)}}}}
  });
}

function renderBudgetTypeChart(rows){
  const canvas = document.getElementById('bgt-type-chart');
  if(!canvas || typeof Chart === 'undefined') return;
  if(bgtTypeChart) { bgtTypeChart.destroy(); bgtTypeChart = null; }
  if(!rows.length) return;
  bgtTypeChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: rows.map(([k]) => BGT_TYPE_NAMES[k]||k.toUpperCase()),
      datasets: [{ data: rows.map(([,d])=>d.total), backgroundColor: rows.map(([k])=>BGT_TYPE_COLORS[k]||'#bbb'), borderWidth:2, borderColor:'#fff' }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'55%',
      plugins:{
        legend:{position:'bottom', labels:{font:{size:11}, padding:12}},
        tooltip:{ callbacks:{ label: ctx => {
          const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
          const pct = total ? Math.round(ctx.parsed/total*100) : 0;
          return ` ${ctx.label}: ${money(ctx.parsed)} (${pct}%)`;
        }}}
      }
    },
    plugins:[{
      id:'pct-labels-type',
      afterDatasetDraw(chart){
        const {ctx, data} = chart;
        const total = data.datasets[0].data.reduce((a,b)=>a+b,0);
        chart.getDatasetMeta(0).data.forEach((arc, i) => {
          const val = data.datasets[0].data[i];
          const pct = total ? Math.round(val/total*100) : 0;
          if(pct < 8) return;
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const r = (arc.outerRadius + arc.innerRadius) / 2;
          const x = arc.x + Math.cos(angle) * r;
          const y = arc.y + Math.sin(angle) * r;
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px IBM Plex Sans Thai, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${pct}%`, x, y);
          ctx.restore();
        });
      }
    }]
  });
}

function renderBudgetProjChart(rows){
  const canvas = document.getElementById('bgt-proj-chart');
  const legend = document.getElementById('bgt-proj-legend');
  if(!canvas || typeof Chart === 'undefined') return;
  if(bgtProjChart) { bgtProjChart.destroy(); bgtProjChart = null; }
  if(!rows.length) {
    if(legend) legend.innerHTML = '<span style="color:var(--text-3)">ยังไม่มีข้อมูล</span>';
    return;
  }

  const totalAmt = rows.reduce((s,[,d])=>s+d.total, 0);
  const colors = rows.map(([,],i) => BGT_PROJ_PALETTE[i % BGT_PROJ_PALETTE.length]);

  bgtProjChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: rows.map(([k]) => k),
      datasets: [{ data: rows.map(([,d])=>d.total), backgroundColor: colors, borderWidth:2, borderColor:'#fff' }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'52%',
      plugins:{
        legend:{ display:false },
        tooltip:{ callbacks:{ label: ctx => {
          const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
          const pct = total ? Math.round(ctx.parsed/total*100) : 0;
          return ` ${ctx.label}: ${money(ctx.parsed)} (${pct}%)`;
        }}}
      }
    },
    plugins:[{
      id:'pct-labels',
      afterDatasetDraw(chart){
        const {ctx, data} = chart;
        const total = data.datasets[0].data.reduce((a,b)=>a+b,0);
        chart.getDatasetMeta(0).data.forEach((arc, i) => {
          const val = data.datasets[0].data[i];
          const pct = total ? Math.round(val/total*100) : 0;
          if(pct < 5) return; // skip tiny slices
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const r = (arc.outerRadius + arc.innerRadius) / 2;
          const x = arc.x + Math.cos(angle) * r;
          const y = arc.y + Math.sin(angle) * r;
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px IBM Plex Sans Thai, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${pct}%`, x, y);
          ctx.restore();
        });
      }
    }]
  });

  // Custom legend with % and amount
  if(legend) {
    legend.innerHTML = rows.map(([proj, d], i) => {
      const pct = totalAmt ? Math.round(d.total/totalAmt*100) : 0;
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="width:12px;height:12px;border-radius:3px;flex-shrink:0;background:${colors[i]}"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:12px;color:var(--text)">${esc(proj)}</div>
          <div style="font-size:11px;color:var(--text-2)">${money(d.total)} &nbsp;·&nbsp; ${pct}%</div>
        </div>
        <div style="font-size:10px;font-weight:600;color:var(--text-3)">${d.count} memo</div>
      </div>`;
    }).join('');
  }
}

function renderBudget() {
  const range = val('#bgt-range') || 'month';
  const projectSel = val('#bgt-project') || 'all';
  const all = getBudgetMemos(range, projectSel);
  const approved = all.filter(m => memoStatusKey(m)==='completed');

  const approvedAmt = approved.reduce((s,m)=>s+(Number(m.total)||0),0);

  document.getElementById('bgt-total').textContent         = money(approvedAmt);
  document.getElementById('bgt-total-count').textContent   = approved.length + ' รายการ';

  const budgets = typeof loadBudgets==='function' ? loadBudgets() : {};
  const budgetTotal = Object.values(budgets).reduce((s,v)=>s+(Number(v)||0),0);
  const utilPct = budgetTotal ? Math.round((approvedAmt/budgetTotal)*100) : 0;
  document.getElementById('bgt-util').textContent = `${utilPct}% Utilized`;

  // Near limit count
  const allProjects = [...new Set(all.map(m=>m.project||'ไม่ระบุ'))];
  let near = 0;
  const projRows = [];
  allProjects.forEach(p => {
    const projMemos = all.filter(m=>(m.project||'ไม่ระบุ')===p);
    const app = projMemos.filter(m=>memoStatusKey(m)==='completed').reduce((s,m)=>s+(Number(m.total)||0),0);
    const budget = Number(budgets[p]||0);
    const util = budget ? Math.round((app/budget)*100) : 0;
    if(util>=80) near++;
    const rem = Math.max(0, budget-app);
    const st = util>90 ? 'Over Budget' : util>=70 ? 'Near Limit' : 'Normal';
    projRows.push({project:p, budget, approved:app, remaining:rem, util, st});
  });
  document.getElementById('bgt-near-limit').textContent = `${near} Projects > 80%`;

  // By type chart
  const byType = {};
  approved.forEach(m => {
    if(!byType[m.type]) byType[m.type]={count:0,total:0};
    byType[m.type].count++; byType[m.type].total += Number(m.total)||0;
  });
  const typeRows = Object.entries(byType).sort((a,b)=>b[1].total-a[1].total);
  renderBudgetTypeChart(typeRows);

  // By project chart — ALL projects with %
  const byProj = {};
  approved.forEach(m => {
    const p = m.project||'ไม่ระบุ';
    if(!byProj[p]) byProj[p]={count:0,total:0};
    byProj[p].count++; byProj[p].total += Number(m.total)||0;
  });
  const projAggRows = Object.entries(byProj).sort((a,b)=>b[1].total-a[1].total);
  renderBudgetProjChart(projAggRows);

  // Trend chart
  renderBudgetTrend(all);

  // Project summary table
  const sumBody = document.getElementById('bgt-summary-body');
  sumBody.innerHTML = !projRows.length
    ? '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--text-3)">ยังไม่มีข้อมูล</td></tr>'
    : projRows.map(r=>`<tr>
        <td>${esc(r.project)}</td>
        <td class="mono">${money(r.budget)}</td>
        <td class="mono">${money(r.approved)}</td>
        <td class="mono">${money(r.remaining)}</td>
        <td>${r.util}%</td>
        <td><span class="badge ${r.st==='Over Budget'?'badge-red':r.st==='Near Limit'?'badge-amber':'badge-green'}">${r.st}</span></td>
      </tr>`).join('');
}

function exportBudgetCsv() {
  const range = val('#bgt-range')||'month';
  const project = val('#bgt-project')||'all';
  const memos = getBudgetMemos(range, project);
  if(!memos.length) { alert('ไม่มีข้อมูลสำหรับ Export'); return; }
  const headers = ['Memo No','Type','Project','Requester','Approver','Amount','Status','Date'];
  const rows = memos.map(m=>[m.memoNo||'', String(m.type||'').toUpperCase(), m.project||'', m.requesterName||m.reviewerName||'', m.approverName||m.approvedBy||'', Number(m.total)||0, memoStatusKey(m), shortDate(m.updatedAt||m.createdAt)]);
  const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`budget-${range}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
