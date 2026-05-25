// ─────────────────────────────────────────
// views/cost.js — Cost Dashboard
// License (auto) + Infra OPEX (manual) + Budget + Forecast
// ─────────────────────────────────────────

const INFRA_KEY   = 'orbit-pmo-infra-v1';
const BUDGET_COST_KEY = 'orbit-pmo-cost-budgets-v1';

// ── Storage ──
function loadInfraCosts() {
  try { const d = JSON.parse(localStorage.getItem(INFRA_KEY)||'{}'); return d||{}; }
  catch(e) { return {}; }
}
function storeInfraCosts(d) {
  try { localStorage.setItem(INFRA_KEY, JSON.stringify(d)); } catch(e) {}
}
function loadCostBudgets() {
  try { const d = JSON.parse(localStorage.getItem(BUDGET_COST_KEY)||'{}'); return d||{}; }
  catch(e) { return {}; }
}
function storeCostBudgets(d) {
  try { localStorage.setItem(BUDGET_COST_KEY, JSON.stringify(d)); } catch(e) {}
}

// ── Helpers ──
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CUR_MONTH = new Date().getMonth(); // 0-indexed

function getLicenseCostByProject() {
  // Pull from getAllLicenses if available
  if(typeof getAllLicenses !== 'function') return {};
  const licenses = getAllLicenses();
  const result = {};
  licenses.forEach(l => {
    const proj = l.project || '(ไม่ระบุ)';
    const prog = l.name || 'Other';
    const monthly = (l.pricePerMonth||0) * (l.seats||1);
    if(!result[proj]) result[proj] = {};
    result[proj][prog] = (result[proj][prog]||0) + monthly;
  });
  return result;
}

function getApprovedMemosByProject() {
  const memos = loadMemos().filter(m => m.status === 'completed' && m.type === 'sl');
  const result = {};
  memos.forEach(m => {
    const proj = m.project || '(ไม่ระบุ)';
    if(!result[proj]) result[proj] = 0;
    result[proj] += Number(m.total)||0;
  });
  return result;
}

// ── Main render ──
function renderCost() {
  const infraCosts  = loadInfraCosts();   // { project: { program: monthlyTHB } }
  const costBudgets = loadCostBudgets();  // { project: { program: annualTHB } }
  const licByProj   = getLicenseCostByProject();

  // All projects union
  const allProjects = [...new Set([
    ...Object.keys(licByProj),
    ...Object.keys(infraCosts),
    ...Object.keys(costBudgets),
  ])].sort();

  // All infra programs union
  const allInfraPrograms = [...new Set(
    Object.values(infraCosts).flatMap(p => Object.keys(p))
  )].sort();

  // Compute per-project totals
  let totalLicense = 0, totalInfra = 0, totalBudget = 0;
  const projData = allProjects.map(proj => {
    const licCost  = Object.values(licByProj[proj]||{}).reduce((s,v)=>s+v,0);
    const infraCost= Object.values(infraCosts[proj]||{}).reduce((s,v)=>s+v,0);
    const budgetAmt= Number(costBudgets[proj]?.total||0);
    totalLicense += licCost;
    totalInfra   += infraCost;
    totalBudget  += budgetAmt;
    return { proj, licCost, infraCost, total: licCost+infraCost, budgetAmt };
  });

  const totalActual = totalLicense + totalInfra;
  const remaining   = Math.max(0, totalBudget - totalActual);
  const ytd = totalActual * (CUR_MONTH + 1);
  const yearEndForecast = totalActual * 12;
  const variance = totalBudget ? Math.round(((totalActual - totalBudget/12) / (totalBudget/12)) * 100) : 0;

  // ── KPI Cards ──
  const kpi = document.getElementById('cost-kpi');
  if(kpi) kpi.innerHTML = `
    <div class="metric-card"><div class="metric-label">Total Monthly Cost</div>
      <div class="metric-val" style="color:var(--blue)">${money(totalActual)}</div>
      <div class="metric-sub">License + Infra</div></div>
    <div class="metric-card"><div class="metric-label">License Cost</div>
      <div class="metric-val" style="color:var(--green)">${money(totalLicense)}</div>
      <div class="metric-sub">จาก License Monitor</div></div>
    <div class="metric-card"><div class="metric-label">Infra Cost (OPEX)</div>
      <div class="metric-val" style="color:var(--amber)">${money(totalInfra)}</div>
      <div class="metric-sub">AWS, DataDog ฯลฯ</div></div>
    <div class="metric-card"><div class="metric-label">Annual Budget</div>
      <div class="metric-val">${money(totalBudget)}</div>
      <div class="metric-sub">Monthly: ${money(totalBudget/12)}</div></div>
    <div class="metric-card"><div class="metric-label">Year-End Forecast</div>
      <div class="metric-val" style="color:${yearEndForecast > totalBudget && totalBudget ? 'var(--red)' : 'var(--text)'}">${money(yearEndForecast)}</div>
      <div class="metric-sub">${variance > 0 ? `▲ Over ${variance}%` : variance < 0 ? `▼ Under ${Math.abs(variance)}%` : 'On track'}</div></div>`;

  // ── Cost by Project Table ──
  const projBody = document.getElementById('cost-proj-body');
  const monthsLeft = 12 - CUR_MONTH; // remaining months including current
  if(projBody) {
    if(!projData.length) {
      projBody.innerHTML = `<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--text-3)">ยังไม่มีข้อมูล — กรอก Infra Cost หรือเพิ่ม License ก่อน</td></tr>`;
    } else {
      projBody.innerHTML = projData.map(d => {
        const util = d.budgetAmt ? Math.round((d.total/(d.budgetAmt/12))*100) : null;
        const stCls = util > 110 ? 'badge-red' : util > 90 ? 'badge-amber' : 'badge-green';
        // Year-end forecast: YTD actual + remaining months at current run rate
        const ytdActual = d.total * (CUR_MONTH + 1);
        const forecast  = ytdActual + (d.total * (11 - CUR_MONTH));
        const fcastCls  = d.budgetAmt && forecast > d.budgetAmt ? 'color:var(--red)' : 'color:var(--text)';
        return `<tr>
          <td style="padding-left:14px;font-weight:500">${esc(d.proj)}</td>
          <td class="mono">${money(d.licCost)}</td>
          <td class="mono">${money(d.infraCost)}</td>
          <td class="mono" style="font-weight:700">${money(d.total)}</td>
          <td class="mono">${d.budgetAmt ? money(d.budgetAmt/12) : '—'}</td>
          <td class="mono" style="${fcastCls}">${money(forecast)}</td>
          <td style="text-align:center">${util !== null ? `<span class="badge ${stCls}">${util}%</span>` : '<span style="color:var(--text-3)">—</span>'}</td>
        </tr>`;
      }).join('') + `<tr style="background:var(--bg);font-weight:600">
        <td style="padding-left:14px">Total</td>
        <td class="mono">${money(totalLicense)}</td>
        <td class="mono">${money(totalInfra)}</td>
        <td class="mono" style="color:var(--blue)">${money(totalActual)}</td>
        <td class="mono">${totalBudget ? money(totalBudget/12) : '—'}</td>
        <td class="mono" style="${yearEndForecast > totalBudget && totalBudget ? 'color:var(--red)' : ''}">${money(yearEndForecast)}</td>
        <td></td>
      </tr>`;
    }
  }

  // ── Infra Cost: Program × Project Matrix ──
  const infraThead = document.getElementById('cost-infra-thead');
  const infraBody  = document.getElementById('cost-infra-body');
  if(infraThead && infraBody) {
    if(!allInfraPrograms.length) {
      infraThead.innerHTML = '';
      infraBody.innerHTML = `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--text-3)">ยังไม่มีข้อมูล Infra — กด "+ Add Infra Cost" เพื่อเพิ่ม</td></tr>`;
    } else {
      // All projects that have infra data
      const infraProjects = [...new Set(Object.keys(infraCosts))].sort();

      const thS = 'padding:8px 12px;font-size:11px;font-weight:600;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap';
      infraThead.innerHTML = `<tr>
        <th style="${thS};text-align:left;padding-left:14px">Program</th>
        ${infraProjects.map(p => `<th style="${thS}">${esc(p)}</th>`).join('')}
        <th style="${thS}">Total/Mo</th>
        <th style="${thS}">Actions</th>
      </tr>`;

      const tdS = 'padding:7px 12px;border-bottom:1px solid var(--border);font-size:12px;text-align:right';
      infraBody.innerHTML = allInfraPrograms
        .sort((a,b) => {
          const ta = infraProjects.reduce((s,p)=>s+(infraCosts[p]?.[a]||0),0);
          const tb = infraProjects.reduce((s,p)=>s+(infraCosts[p]?.[b]||0),0);
          return tb - ta;
        })
        .map(prog => {
          const rowTotal = infraProjects.reduce((s,p) => s+(infraCosts[p]?.[prog]||0), 0);
          return `<tr>
            <td style="${tdS};text-align:left;padding-left:14px;font-weight:500">${esc(prog)}</td>
            ${infraProjects.map(proj => {
              const val = infraCosts[proj]?.[prog];
              return val
                ? `<td style="${tdS};cursor:pointer" onclick="openInfraModal('${esc(proj)}','${esc(prog)}')" title="Click to edit">${money(val)}</td>`
                : `<td style="${tdS};color:var(--text-3)">—</td>`;
            }).join('')}
            <td style="${tdS};font-weight:700;color:var(--blue)">${money(rowTotal)}</td>
            <td style="${tdS};text-align:center;white-space:nowrap">
              <button class="btn-sm" style="padding:2px 7px;font-size:11px" onclick="openInfraModalForProgram('${esc(prog)}')" title="Edit">✎</button>
              <button class="btn-sm" style="padding:2px 7px;font-size:11px;color:var(--red)" onclick="deleteInfraProgram('${esc(prog)}')" title="Delete all entries for this program">✕</button>
            </td>
          </tr>`;
        }).join('') + `<tr style="background:var(--bg)">
          <td style="${tdS};text-align:left;padding-left:14px;font-weight:600;color:var(--text-2)">Total</td>
          ${infraProjects.map(proj => {
            const projTotal = allInfraPrograms.reduce((s,prog) => s+(infraCosts[proj]?.[prog]||0), 0);
            return `<td style="${tdS};font-weight:600">${projTotal ? money(projTotal) : '—'}</td>`;
          }).join('')}
          <td style="${tdS};font-weight:700;color:var(--blue)">${money(allInfraPrograms.reduce((s,prog) => s+infraProjects.reduce((ss,p)=>ss+(infraCosts[p]?.[prog]||0),0), 0))}</td>
          <td></td>
        </tr>`;
    }
  }

  // ── Render Chart ──
  renderCostChart(totalLicense, totalInfra, totalBudget);
}

function renderCostChart(license, infra, budget) {
  const canvas = document.getElementById('cost-chart');
  if(!canvas || typeof Chart === 'undefined') return;
  if(canvas._chart) canvas._chart.destroy();

  const monthlyBudget = budget / 12;
  const labels = MONTHS;
  const actual = labels.map((_, i) => i <= CUR_MONTH ? license + infra : null);
  const budgetLine = labels.map(() => monthlyBudget > 0 ? monthlyBudget : null);
  const forecast = labels.map((_, i) => i > CUR_MONTH ? license + infra : null);

  canvas._chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'License', data: labels.map((_, i) => i <= CUR_MONTH ? license : null),
          backgroundColor: '#3B6D11', stack: 'actual' },
        { label: 'Infra', data: labels.map((_, i) => i <= CUR_MONTH ? infra : null),
          backgroundColor: '#185FA5', stack: 'actual' },
        { label: 'Forecast', data: forecast,
          backgroundColor: 'rgba(24,95,165,0.2)', stack: 'actual' },
        { label: 'Budget', data: budgetLine, type: 'line',
          borderColor: '#A32D2D', borderDash: [4,4], borderWidth: 2,
          pointRadius: 0, fill: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, ticks: { callback: v => '฿'+Number(v).toLocaleString('th-TH') } }
      }
    }
  });
}

// ── Infra Cost Modal ──
function openInfraModal(project, program) {
  const s = typeof loadSettings === 'function' ? loadSettings() : null;
  const projects = s?.projects || ['AOA-MP','TTB','Geo9','Release 2.1','Release 3'];
  const infraCosts = loadInfraCosts();

  document.getElementById('infra-modal').style.display = 'flex';
  document.getElementById('infra-form').innerHTML = `
    <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px">
      <div class="fg"><label>Project *</label>
        <select id="inf-project" class="ri">
          <option value="">— เลือกโครงการ —</option>
          ${projects.map(p=>`<option value="${esc(p)}" ${p===project?'selected':''}>${esc(p)}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label>Program *</label>
        <input id="inf-program" class="ri" placeholder="เช่น AWS, DataDog, BrowserStack" value="${esc(program||'')}">
      </div>
      <div class="fg"><label>Monthly Cost (THB) *</label>
        <input id="inf-monthly" class="ri" type="number" min="0" placeholder="0"
          value="${project && program ? (infraCosts[project]?.[program]||'') : ''}">
      </div>
      <div class="fg"><label>Type</label>
        <select id="inf-type" class="ri">
          <option value="General">General</option>
          <option value="AI">AI</option>
          <option value="Cloud">Cloud</option>
          <option value="Monitoring">Monitoring</option>
          <option value="Testing">Testing</option>
        </select>
      </div>
    </div>`;
}
function closeInfraModal() { document.getElementById('infra-modal').style.display = 'none'; }

// Edit all projects for a given program
function openInfraModalForProgram(prog) {
  const s = typeof loadSettings === 'function' ? loadSettings() : null;
  const projects = s?.projects || ['AOA-MP','TTB','Geo9','Release 2.1','Release 3'];
  const infraCosts = loadInfraCosts();
  // Include any existing projects for this program too
  const existingProjects = Object.keys(infraCosts).filter(p => infraCosts[p]?.[prog] !== undefined);
  const allP = [...new Set([...projects, ...existingProjects])].sort();

  document.getElementById('infra-modal').style.display = 'flex';
  document.getElementById('infra-form').innerHTML = `
    <p style="font-size:12px;color:var(--text-2);margin-bottom:12px">แก้ค่า <strong>${esc(prog)}</strong> ต่อโครงการ (THB/เดือน)</p>
    <input type="hidden" id="inf-program" value="${esc(prog)}">
    <input type="hidden" id="inf-project" value="__multi__">
    ${allP.map(p => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:130px;font-size:12px;font-weight:500">${esc(p)}</div>
        <input class="ri" type="number" min="0" placeholder="0 = ลบ"
          data-proj="${esc(p)}" style="flex:1"
          value="${infraCosts[p]?.[prog] || ''}">
      </div>`).join('')}`;
}

// Delete entire program row across all projects
function deleteInfraProgram(prog) {
  if(!confirm(`ลบ "${prog}" ออกจากทุกโครงการ?`)) return;
  const costs = loadInfraCosts();
  Object.keys(costs).forEach(proj => { delete costs[proj][prog]; });
  storeInfraCosts(costs);
  renderCost();
}

function saveInfraCost() {
  const projectVal = document.getElementById('inf-project')?.value;
  const program    = document.getElementById('inf-program')?.value?.trim();
  if(!program) { alert('กรุณากรอก Program'); return; }

  const costs = loadInfraCosts();

  if(projectVal === '__multi__') {
    // Multi-project mode from openInfraModalForProgram
    const inputs = document.querySelectorAll('#infra-form input[data-proj]');
    inputs.forEach(inp => {
      const proj = inp.dataset.proj;
      const val  = parseFloat(inp.value)||0;
      if(!costs[proj]) costs[proj] = {};
      if(val > 0) costs[proj][program] = val;
      else delete costs[proj][program];
    });
  } else {
    // Single-project mode from openInfraModal
    const project = projectVal;
    const monthly = parseFloat(document.getElementById('inf-monthly')?.value)||0;
    if(!project) { alert('กรุณากรอก Project'); return; }
    if(!costs[project]) costs[project] = {};
    if(monthly > 0) costs[project][program] = monthly;
    else delete costs[project][program];
  }

  storeInfraCosts(costs);
  closeInfraModal();
  renderCost();
}

// ── Budget Modal ──
function openBudgetCostModal() {
  const s = typeof loadSettings === 'function' ? loadSettings() : null;
  const projects = s?.projects || ['AOA-MP','TTB','Geo9','Release 2.1','Release 3'];
  const costBudgets = loadCostBudgets();
  const infraCosts  = loadInfraCosts();
  const licByProj   = getLicenseCostByProject();

  const allProjects = [...new Set([
    ...projects, ...Object.keys(infraCosts), ...Object.keys(licByProj)
  ])].sort();

  document.getElementById('budget-cost-modal').style.display = 'flex';
  document.getElementById('budget-cost-form').innerHTML = `
    <p style="font-size:12px;color:var(--text-2);margin-bottom:14px">ตั้ง Annual Budget ต่อโครงการ (THB) — แก้ได้ตลอดเวลา</p>
    ${allProjects.map(proj => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:140px;font-size:12px;font-weight:500">${esc(proj)}</div>
        <input class="ri" type="number" min="0" placeholder="Annual budget (THB)"
          data-proj="${esc(proj)}" style="flex:1"
          value="${costBudgets[proj]?.total || ''}">
      </div>`).join('')}`;
}
function closeBudgetCostModal() { document.getElementById('budget-cost-modal').style.display = 'none'; }

function saveBudgetCost() {
  const inputs = document.querySelectorAll('#budget-cost-form input[data-proj]');
  const budgets = loadCostBudgets();
  inputs.forEach(inp => {
    const proj = inp.dataset.proj;
    const val = parseFloat(inp.value)||0;
    if(val > 0) budgets[proj] = { total: val, updatedAt: new Date().toISOString() };
    else delete budgets[proj];
  });
  storeCostBudgets(budgets);
  closeBudgetCostModal();
  renderCost();
}

document.addEventListener('click', e => {
  if(e.target === document.getElementById('infra-modal')) closeInfraModal();
  if(e.target === document.getElementById('budget-cost-modal')) closeBudgetCostModal();
});
