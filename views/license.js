// ─────────────────────────────────────────
// views/license.js — License Monitor
// Data source: SL memos with status='completed'
// ─────────────────────────────────────────

function parseLicenseFromMemo(memo) {
  const licenses = [];
  if(memo.type !== 'sl' || memo.status !== 'completed') return licenses;

  const purchaseDate = memo.approvedAt || memo.updatedAt || memo.createdAt;
  const section = memo.sections?.find(s => s.title === 'รายการ Software');
  if(!section) return licenses;

  const parser = new DOMParser();
  const doc = parser.parseFromString(section.html, 'text/html');
  const rows = doc.querySelectorAll('tbody tr');

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if(cells.length < 6) return;
    const name     = cells[1]?.textContent?.trim();
    const priceStr = cells[2]?.textContent?.replace(/[฿,]/g,'').trim();
    const months   = parseInt(cells[3]?.textContent) || 12;
    const seats    = parseInt(cells[4]?.textContent) || 1;
    const price    = parseFloat(priceStr) || 0;
    if(!name || name === '-') return;

    const start = new Date(purchaseDate);
    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + months);

    licenses.push({
      name, seats, pricePerMonth: price, months,
      purchaseDate, expiry: expiry.toISOString(),
      project: memo.project, memoNo: memo.memoNo
    });
  });

  return licenses;
}

function getLicenseStatus(expiryISO) {
  const now = new Date();
  const expiry = new Date(expiryISO);
  const daysLeft = Math.floor((expiry - now) / 86400000);
  if(daysLeft < 0)   return { label:'หมดอายุแล้ว',         badge:'badge-red',   days: daysLeft };
  if(daysLeft <= 30) return { label:`อีก ${daysLeft} วัน`, badge:'badge-amber', days: daysLeft };
  return               { label:'Active',                   badge:'badge-green', days: daysLeft };
}

function renderLicense() {
  const allMemos = loadMemos().filter(m => m.type === 'sl' && m.status === 'completed');
  const licenses = allMemos.flatMap(parseLicenseFromMemo);

  let activeCount = 0, expiringCount = 0, expiredCount = 0, monthlyCost = 0;
  licenses.forEach(lic => {
    const s = getLicenseStatus(lic.expiry);
    if(s.days < 0)        expiredCount++;
    else if(s.days <= 30) expiringCount++;
    else                  activeCount++;
    if(s.days >= 0)       monthlyCost += lic.pricePerMonth * lic.seats;
  });

  document.getElementById('lic-active').textContent = activeCount;
  document.getElementById('lic-active-cost').textContent = activeCount ? money(monthlyCost) + '/เดือน' : '';
  document.getElementById('lic-expiring').textContent = expiringCount;
  document.getElementById('lic-expired').textContent = expiredCount;
  document.getElementById('lic-monthly').textContent = money(monthlyCost);

  const alertSection = document.getElementById('lic-alert-section');
  const alertList    = document.getElementById('lic-alert-list');
  const urgent = licenses
    .filter(lic => { const s = getLicenseStatus(lic.expiry); return s.days >= 0 && s.days <= 30; })
    .sort((a,b) => new Date(a.expiry) - new Date(b.expiry));

  if(urgent.length) {
    alertSection.style.display = 'block';
    alertList.innerHTML = urgent.map(lic => {
      const s = getLicenseStatus(lic.expiry);
      return `<div class="pend-card" style="margin-bottom:8px">
        <div class="pend-top">
          <div>
            <div class="pend-title">${esc(lic.name)}</div>
            <div class="pend-meta">
              ${esc(lic.project||'-')} &nbsp;&middot;&nbsp;
              ${esc(lic.seats)} seats &nbsp;&middot;&nbsp;
              ${esc(money(lic.pricePerMonth * lic.seats))}/เดือน
            </div>
          </div>
          <span class="badge ${s.badge}">${esc(s.label)}</span>
        </div>
        <div style="font-size:11px;color:var(--text-2)">
          หมดอายุ: ${esc(shortDate(lic.expiry))} &nbsp;&middot;&nbsp; Memo: ${esc(lic.memoNo)}
        </div>
      </div>`;
    }).join('');
  } else {
    alertSection.style.display = 'none';
  }

  const tbody = document.getElementById('lic-table-body');
  if(!licenses.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:34px 16px;color:var(--text-3)">ยังไม่มีข้อมูล — Approve SL Memo เพื่อให้รายการ License มาแสดงที่นี่</td></tr>`;
    return;
  }

  const sorted = [...licenses].sort((a,b) => new Date(a.expiry) - new Date(b.expiry));
  tbody.innerHTML = sorted.map(lic => {
    const s = getLicenseStatus(lic.expiry);
    return `<tr>
      <td style="padding-left:16px;font-weight:500">${esc(lic.name)}</td>
      <td>${esc(lic.seats)}</td>
      <td class="mono">${esc(money(lic.pricePerMonth * lic.seats))}</td>
      <td>${esc(shortDate(lic.purchaseDate))}</td>
      <td>${esc(shortDate(lic.expiry))}</td>
      <td>${esc(lic.project||'-')}</td>
      <td style="text-align:center"><span class="badge ${s.badge}">${esc(s.label)}</span></td>
    </tr>`;
  }).join('');
}
