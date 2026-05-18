// ─────────────────────────────────────────
// views/budget.js — Budget Monitor
// ─────────────────────────────────────────

let bgtTypeChart = null;
let bgtProjChart = null;

const BGT_TYPE_NAMES = { sl:'Software License', hw:'Hardware', int:'Team Activity', ent:'Client Expense', dep:'Deployment' };
const BGT_TYPE_COLORS = { sl:'#185FA5', hw:'#5F5E5A', int:'#3B6D11', ent:'#854F0B', dep:'#3C3489' };
const BGT_PROJ_PALETTE = ['#185FA5','#3B6D11','#854F0B','#3C3489','#A32D2D','#0C447C','#97C459','#5F5E5A'];

function renderBudgetPieChart(canvasId, emptyId, chartRef, rows, labelFn, colorFn) {
  const canvas = document.getElementById(canvasId);
  const emptyEl = document.getElementById(emptyId);
  if(!canvas) return chartRef;

  if(chartRef) { chartRef.destroy(); chartRef = null; }

  const hasData = rows.length && rows.some(([, d]) => d.total > 0);
  canvas.style.display = hasData ? '' : 'none';
  if(emptyEl) emptyEl.classList.toggle('is-visible', !hasData);
  if(!hasData || typeof Chart === 'undefined') return null;

  const labels = rows.map(([key]) => labelFn(key));
  const data = rows.map(([, d]) => d.total);
  const colors = rows.map(([key], i) => colorFn(key, i));
  const total = data.reduce((s, v) => s + v, 0);

  chartRef = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: "'IBM Plex Sans Thai', sans-serif", size: 11 },
            padding: 10,
            boxWidth: 12
          }
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = ctx.parsed || 0;
              const pct = total ? Math.round(v / total * 100) : 0;
              return ` ${ctx.label}: ${money(v)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
  return chartRef;
}

function getBudgetMemos(range, project) {
  const now = new Date();
  return loadMemos().filter(memo => {
    if(project !== 'all' && memo.project !== project) return false;
    const dt = new Date(memo.updatedAt||memo.createdAt||0);
    if(range==='month') return dt.getFullYear()===now.getFullYear() && dt.getMonth()===now.getMonth();
    if(range==='last-month') {
      const last = new Date(now.getFullYear(), now.getMonth()-1, 1);
      return dt.getFullYear()===last.getFullYear() && dt.getMonth()===last.getMonth();
    }
    if(range==='3-months') return dt >= new Date(now.getFullYear(), now.getMonth()-2, 1);
    return true;
  });
}
function renderBudget() {
  const range   = val('#bgt-range') || 'month';
  const project = val('#bgt-project') || 'all';
  const memos    = getBudgetMemos(range, project);
  const completed = memos.filter(m => m.status==='completed');
  const pending   = memos.filter(m => !m.status || m.status==='pending');

  // Metric cards
  const totalAmt   = completed.reduce((s,m) => s+(Number(m.total)||0), 0);
  const pendingAmt = pending.reduce((s,m) => s+(Number(m.total)||0), 0);
  document.getElementById('bgt-total').textContent = money(totalAmt);
  document.getElementById('bgt-total-count').textContent = completed.length + ' รายการ';
  document.getElementById('bgt-pending-total').textContent = money(pendingAmt);
  document.getElementById('bgt-pending-count').textContent = pending.length + ' รายการ';

  // Group by type
  const byType = {};
  completed.forEach(m => {
    if(!byType[m.type]) byType[m.type] = { count:0, total:0 };
    byType[m.type].count++;
    byType[m.type].total += Number(m.total)||0;
  });
  const topType = Object.entries(byType).sort((a,b) => b[1].total-a[1].total)[0];
  document.getElementById('bgt-top-type').textContent = topType ? (BGT_TYPE_NAMES[topType[0]]||topType[0].toUpperCase()) : '—';
  document.getElementById('bgt-top-type-amt').textContent = topType ? money(topType[1].total) : '';

  // Group by project
  const byProj = {};
  completed.forEach(m => {
    const p = m.project||'ไม่ระบุ';
    if(!byProj[p]) byProj[p] = { count:0, total:0 };
    byProj[p].count++;
    byProj[p].total += Number(m.total)||0;
  });
  const topProj = Object.entries(byProj).sort((a,b) => b[1].total-a[1].total)[0];
  document.getElementById('bgt-top-proj').textContent = topProj ? topProj[0] : '—';
  document.getElementById('bgt-top-proj-amt').textContent = topProj ? money(topProj[1].total) : '';

  // By type table + pie chart
  const typeBody = document.getElementById('bgt-type-body');
  const typeRows = Object.entries(byType).sort((a,b) => b[1].total-a[1].total);
  bgtTypeChart = renderBudgetPieChart(
    'bgt-type-chart', 'bgt-type-chart-empty', bgtTypeChart, typeRows,
    key => BGT_TYPE_NAMES[key] || key.toUpperCase(),
    key => BGT_TYPE_COLORS[key] || '#B4B2A9'
  );
  typeBody.innerHTML = !typeRows.length
    ? '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-3)">ยังไม่มีข้อมูล</td></tr>'
    : typeRows.map(([type, d]) => {
        const pct = totalAmt ? Math.round(d.total/totalAmt*100) : 0;
        return `<tr>
          <td><span class="badge ${badgeClass(type)}">${type.toUpperCase()}</span></td>
          <td>${d.count}</td>
          <td class="mono">${money(d.total)}</td>
          <td><div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:var(--blue);border-radius:3px"></div>
            </div>
            <span style="font-size:10px;color:var(--text-3);white-space:nowrap">${pct}%</span>
          </div></td>
        </tr>`;
      }).join('');

  // By project table + pie chart
  const projBody = document.getElementById('bgt-proj-body');
  const projRows = Object.entries(byProj).sort((a,b) => b[1].total-a[1].total);
  bgtProjChart = renderBudgetPieChart(
    'bgt-proj-chart', 'bgt-proj-chart-empty', bgtProjChart, projRows,
    key => key,
    (_, i) => BGT_PROJ_PALETTE[i % BGT_PROJ_PALETTE.length]
  );
  projBody.innerHTML = !projRows.length
    ? '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-3)">ยังไม่มีข้อมูล</td></tr>'
    : projRows.map(([proj, d]) => {
        const pct = totalAmt ? Math.round(d.total/totalAmt*100) : 0;
        return `<tr>
          <td style="font-weight:500">${esc(proj)}</td>
          <td>${d.count}</td>
          <td class="mono">${money(d.total)}</td>
          <td><div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:var(--blue);border-radius:3px"></div>
            </div>
            <span style="font-size:10px;color:var(--text-3);white-space:nowrap">${pct}%</span>
          </div></td>
        </tr>`;
      }).join('');

  // All memos table
  const memoBody = document.getElementById('bgt-memo-body');
  const sorted = [...memos].sort((a,b) => new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
  memoBody.innerHTML = !sorted.length
    ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-3)">ยังไม่มีข้อมูล</td></tr>'
    : sorted.map(m => `<tr>
        <td class="mono" style="padding-left:16px">${esc(m.memoNo)}</td>
        <td><span class="badge ${badgeClass(m.type)}">${esc(String(m.type||'').toUpperCase())}</span></td>
        <td>${esc(m.project||'-')}</td>
        <td class="mono">${esc(money(m.total||0))}</td>
        <td>${esc(shortDate(m.updatedAt||m.createdAt))}</td>
        <td><span class="badge ${m.status==='completed'?'badge-green':m.status==='rejected'?'badge-red':'badge-amber'}">${m.status==='completed'?'Completed':m.status==='rejected'?'Rejected':'Pending'}</span></td>
      </tr>`).join('');
}
function exportBudgetCsv() {
  const range   = val('#bgt-range') || 'month';
  const project = val('#bgt-project') || 'all';
  const memos = getBudgetMemos(range, project);
  if(!memos.length) { alert('ไม่มีข้อมูลสำหรับ Export'); return; }
  const headers = ['Memo No','Type','Project','Amount','Status','Date'];
  const rows = memos.map(m => [m.memoNo||'', String(m.type||'').toUpperCase(), m.project||'', Number(m.total)||0, m.status||'pending', shortDate(m.updatedAt||m.createdAt)]);
  const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`budget-${range}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
