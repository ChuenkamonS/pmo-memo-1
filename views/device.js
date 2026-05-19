// ─────────────────────────────────────────
// views/device.js — Device Registry
// Storage key: orbit-pmo-devices-v1
// ─────────────────────────────────────────

const DEVICE_KEY = 'orbit-pmo-devices-v1';

function loadDevices() {
  try { const d = JSON.parse(localStorage.getItem(DEVICE_KEY)||'[]'); return Array.isArray(d)?d:[]; }
  catch(e) { return []; }
}
function storeDevices(devices) {
  try { localStorage.setItem(DEVICE_KEY, JSON.stringify(devices)); } catch(e) {}
}
function nextDeviceId() {
  const devices = loadDevices();
  const max = devices.reduce((m,d) => Math.max(m, Number(d.id)||0), 0);
  return max + 1;
}

// ── Status / Condition helpers ──
function deviceStatusBadge(status) {
  return {
    'in-use':      { label:'In Use',      cls:'badge-blue' },
    'available':   { label:'Available',   cls:'badge-green' },
    'maintenance': { label:'Maintenance', cls:'badge-amber' },
    'retired':     { label:'Retired',     cls:'badge-gray' },
  }[status] || { label: status, cls:'badge-gray' };
}
function deviceConditionBadge(condition) {
  return {
    'new':  { label:'New',  cls:'badge-green' },
    'good': { label:'Good', cls:'badge-blue' },
    'fair': { label:'Fair', cls:'badge-amber' },
    'poor': { label:'Poor', cls:'badge-red' },
  }[condition] || { label: condition, cls:'badge-gray' };
}
function warrantyStatus(warrantyDate) {
  if(!warrantyDate) return null;
  const now = new Date();
  const exp = new Date(warrantyDate);
  const days = Math.floor((exp - now) / 86400000);
  if(days < 0)   return { label:'หมดอายุแล้ว', cls:'badge-red' };
  if(days <= 30) return { label:`อีก ${days} วัน`, cls:'badge-amber' };
  return { label: shortDate(warrantyDate), cls:'badge-green' };
}

// ── Pull from HW Memos ──
function syncFromHWMemos() {
  const hwMemos = loadMemos().filter(m => m.type === 'hw' && m.status === 'completed');
  const devices = loadDevices();
  let added = 0;

  hwMemos.forEach(memo => {
    const section = memo.sections?.find(s => s.title === 'รายการ Hardware');
    if(!section) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(section.html, 'text/html');
    doc.querySelectorAll('tbody tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if(cells.length < 2) return;
      const name = cells[1]?.textContent?.trim();
      if(!name || name === '-') return;
      // Skip if already imported from this memo
      const exists = devices.some(d => d.memoRef === memo.memoNo && d.name === name);
      if(exists) return;
      devices.push({
        id: nextDeviceId() + added,
        name,
        type: 'other',
        serial: '',
        assetTag: '',
        owner: memo.reviewerName || '',
        assignedDate: memo.approvedAt?.slice(0,10) || '',
        project: memo.project || '',
        returnDate: '',
        warranty: '',
        condition: 'good',
        status: 'in-use',
        memoRef: memo.memoNo,
        note: `Auto-imported from ${memo.memoNo}`,
        createdAt: new Date().toISOString()
      });
      added++;
    });
  });

  if(added > 0) {
    storeDevices(devices);
    return added;
  }
  return 0;
}

// ── Render ──
function renderDevice() {
  // Auto-sync from HW memos silently
  syncFromHWMemos();

  const typeFilter    = val('#dev-filter-type') || 'all';
  const statusFilter  = val('#dev-filter-status') || 'all';
  const projectFilter = val('#dev-filter-project') || 'all';

  let devices = loadDevices();

  // Metrics (before filter)
  const total    = devices.length;
  const inUse    = devices.filter(d => d.status === 'in-use').length;
  const available= devices.filter(d => d.status === 'available').length;
  const wExpired = devices.filter(d => d.warranty && new Date(d.warranty) < new Date()).length;

  document.getElementById('dev-total').textContent = total;
  document.getElementById('dev-total-sub').textContent = total ? `${inUse} in use` : '';
  document.getElementById('dev-inuse').textContent = inUse;
  document.getElementById('dev-available').textContent = available;
  document.getElementById('dev-warranty-expired').textContent = wExpired;

  // Apply filters
  if(typeFilter !== 'all')    devices = devices.filter(d => d.type === typeFilter);
  if(statusFilter !== 'all')  devices = devices.filter(d => d.status === statusFilter);
  if(projectFilter !== 'all') devices = devices.filter(d => d.project === projectFilter);

  const tbody = document.getElementById('dev-table-body');
  if(!devices.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:34px 16px;color:var(--text-3)">ยังไม่มีอุปกรณ์ — กด Add Device หรือ Approve HW Memo เพื่อ import อัตโนมัติ</td></tr>`;
    return;
  }

  tbody.innerHTML = devices.map(d => {
    const statusB    = deviceStatusBadge(d.status);
    const conditionB = deviceConditionBadge(d.condition);
    const warr       = warrantyStatus(d.warranty);
    return `<tr>
      <td style="padding-left:16px;font-weight:500">${esc(d.name)}${d.assetTag ? `<br><span style="font-size:10px;color:var(--text-3)">${esc(d.assetTag)}</span>` : ''}</td>
      <td><span style="font-size:11px;color:var(--text-2)">${esc(d.type)}</span></td>
      <td><span style="font-family:var(--font-mono,monospace);font-size:11px">${esc(d.serial||'—')}</span></td>
      <td>${esc(d.owner||'—')}${d.assignedDate ? `<br><span style="font-size:10px;color:var(--text-3)">${esc(shortDate(d.assignedDate))}</span>` : ''}</td>
      <td>${esc(d.project||'—')}</td>
      <td><span class="badge ${conditionB.cls}">${esc(conditionB.label)}</span></td>
      <td>${warr ? `<span class="badge ${warr.cls}">${esc(warr.label)}</span>` : '<span style="color:var(--text-3);font-size:11px">—</span>'}</td>
      <td style="text-align:center"><span class="badge ${statusB.cls}">${esc(statusB.label)}</span></td>
      <td style="text-align:center">
        <button class="btn-sm" data-action="edit" data-id="${d.id}" style="padding:3px 8px;margin-bottom:3px">✎</button>
        <button class="btn-sm" data-action="delete" data-id="${d.id}" style="padding:3px 8px;color:var(--red)">✕</button>
      </td>
    </tr>`;
  }).join('');

  // Event delegation
  tbody.onclick = function(e) {
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    const id = Number(btn.dataset.id);
    if(btn.dataset.action === 'edit')   openDeviceModal(id);
    if(btn.dataset.action === 'delete') deleteDevice(id);
  };
}

// ── Modal ──
function openDeviceModal(id) {
  const modal = document.getElementById('device-modal');
  modal.style.display = 'flex';

  if(id) {
    const device = loadDevices().find(d => d.id === id);
    if(!device) return;
    document.getElementById('dev-modal-title').textContent = 'Edit Device';
    document.getElementById('dev-edit-id').value = id;
    document.getElementById('dev-name').value = device.name || '';
    document.getElementById('dev-type').value = device.type || 'mobile';
    document.getElementById('dev-serial').value = device.serial || '';
    document.getElementById('dev-asset').value = device.assetTag || '';
    document.getElementById('dev-owner').value = device.owner || '';
    document.getElementById('dev-assigned-date').value = device.assignedDate || '';
    document.getElementById('dev-project').value = device.project || '';
    document.getElementById('dev-return-date').value = device.returnDate || '';
    document.getElementById('dev-warranty').value = device.warranty || '';
    document.getElementById('dev-condition').value = device.condition || 'good';
    document.getElementById('dev-status').value = device.status || 'in-use';
    document.getElementById('dev-memo-ref').value = device.memoRef || '';
    document.getElementById('dev-note').value = device.note || '';
  } else {
    document.getElementById('dev-modal-title').textContent = 'Add Device';
    document.getElementById('dev-edit-id').value = '';
    ['dev-name','dev-serial','dev-asset','dev-owner','dev-assigned-date',
     'dev-project','dev-return-date','dev-warranty','dev-memo-ref','dev-note']
      .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('dev-type').value = 'mobile';
    document.getElementById('dev-condition').value = 'good';
    document.getElementById('dev-status').value = 'in-use';
    // Default assigned date to today
    document.getElementById('dev-assigned-date').value = new Date().toISOString().slice(0,10);
  }
}
function closeDeviceModal() {
  document.getElementById('device-modal').style.display = 'none';
}
function saveDevice() {
  const name = document.getElementById('dev-name').value.trim();
  if(!name) { alert('กรุณากรอก Device Name'); return; }

  const editId = document.getElementById('dev-edit-id').value;
  const devices = loadDevices();
  const now = new Date().toISOString();

  const deviceData = {
    name,
    type:         document.getElementById('dev-type').value,
    serial:       document.getElementById('dev-serial').value.trim(),
    assetTag:     document.getElementById('dev-asset').value.trim(),
    owner:        document.getElementById('dev-owner').value.trim(),
    assignedDate: document.getElementById('dev-assigned-date').value,
    project:      document.getElementById('dev-project').value,
    returnDate:   document.getElementById('dev-return-date').value,
    warranty:     document.getElementById('dev-warranty').value,
    condition:    document.getElementById('dev-condition').value,
    status:       document.getElementById('dev-status').value,
    memoRef:      document.getElementById('dev-memo-ref').value.trim(),
    note:         document.getElementById('dev-note').value.trim(),
    updatedAt:    now,
  };

  if(editId) {
    const idx = devices.findIndex(d => d.id === Number(editId));
    if(idx >= 0) devices[idx] = { ...devices[idx], ...deviceData };
  } else {
    devices.push({ id: nextDeviceId(), ...deviceData, createdAt: now });
  }

  storeDevices(devices);
  closeDeviceModal();
  renderDevice();
}
function deleteDevice(id) {
  const device = loadDevices().find(d => d.id === id);
  if(!device) return;
  if(!confirm(`ลบ "${device.name}" ออกจากระบบ?`)) return;
  storeDevices(loadDevices().filter(d => d.id !== id));
  renderDevice();
}

// ── Export ──
function exportDeviceCsv() {
  const devices = loadDevices();
  if(!devices.length) { alert('ไม่มีข้อมูลสำหรับ Export'); return; }
  const headers = ['ID','Device Name','Type','Serial No','Asset Tag','Owner','Assigned Date','Project','Return Date','Warranty','Condition','Status','Memo Ref','Note'];
  const rows = devices.map(d => [
    d.id, d.name, d.type, d.serial||'', d.assetTag||'',
    d.owner||'', d.assignedDate||'', d.project||'', d.returnDate||'',
    d.warranty||'', d.condition||'', d.status||'', d.memoRef||'', d.note||''
  ]);
  const csv = [headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download = `devices-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// Close modal on backdrop click
document.addEventListener('click', function(e) {
  const modal = document.getElementById('device-modal');
  if(e.target === modal) closeDeviceModal();
});
