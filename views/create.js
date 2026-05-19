// ─────────────────────────────────────────
// views/create.js — form, type, validate, PDF collect
// ─────────────────────────────────────────

let selectedType = null;
const TYPE_LABELS = { sl:'Software License', hw:'Hardware', int:'Team Activity', ent:'Client Expense', dep:'Deployment' };
const TYPE_CFG = {
  sl:  { title:'รายการ Software *', to:'ประธานเจ้าหน้าที่บริหาร', apprTitle:'ประธานเจ้าหน้าที่บริหาร',
         reasons:['เป็นโปรแกรมที่ได้รับการอนุมัติและใช้งานอยู่เดิม เพื่อให้การดำเนินโครงการเป็นไปอย่างต่อเนื่องและมีประสิทธิภาพ','เป็นโปรแกรมใหม่ที่จำเป็นต้องใช้เพื่อพัฒนาโครงการ','เพื่ออัปเกรดการใช้งานโปรแกรมให้รองรับการทำงานของทีมที่เพิ่มขึ้น'] },
  hw:  { title:'รายการ Hardware *', to:'ประธานเจ้าหน้าที่บริหาร', apprTitle:'ประธานเจ้าหน้าที่บริหาร',
         reasons:['เพื่อใช้ในการพัฒนาและทดสอบระบบของโครงการ','เพื่อทดแทนอุปกรณ์เดิมที่เสื่อมสภาพและไม่สามารถใช้งานได้','เพื่อรองรับการขยายทีมและเพิ่มประสิทธิภาพการทำงาน'] },
  int: { title:'รายชื่อผู้เข้าร่วม *', to:'Project director โครงการ', apprTitle:'ผู้อำนวยการโครงการ',
         reasons:['เพื่อเสริมสร้างกำลังใจในการปฏิบัติงาน และส่งเสริมการทำงานเป็นทีม','เพื่อเสริมสร้างความสัมพันธ์ในทีมและพัฒนาการทำงานร่วมกัน'] },
  ent: { title:'รายละเอียดงานเลี้ยงรับรอง', to:'ประธานเจ้าหน้าที่บริหาร', apprTitle:'ประธานเจ้าหน้าที่บริหาร',
         reasons:['เพื่อขอบคุณลูกค้าในโครงการ','เพื่อเสริมสร้างความสัมพันธ์กับลูกค้า'] },
  dep: { title:'รายละเอียด Deployment', to:'ผู้อำนวยการโครงการ', apprTitle:'ผู้อำนวยการโครงการ',
         reasons:['เพื่อความละเอียดในการเบิกแยก Online / Onsite','เพื่อสนับสนุนการ Deployment ให้เป็นไปอย่างราบรื่นและมีประสิทธิภาพ'] }
};

function selectType(type, btn) {
  selectedType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.querySelectorAll('.fs').forEach(s => s.classList.remove('active'));
  document.getElementById('fs-'+type).classList.add('active');
  const cfg = TYPE_CFG[type];
  document.getElementById('detail-title').textContent = cfg.title;
  document.getElementById('f-to').value = cfg.to;
  document.getElementById('f-appr-title').value = cfg.apprTitle;
  const rs = document.getElementById('f-reason');
  rs.innerHTML = '<option value="">— เลือกเหตุผล —</option>';
  cfg.reasons.forEach(r => { const o=document.createElement('option'); o.value=r; o.textContent=r; rs.appendChild(o); });
  rs.innerHTML += '<option value="other">อื่นๆ (กรอกเอง)</option>';
  document.getElementById('form-hint').style.display = 'none';
  document.getElementById('form-body').style.display = 'block';
  document.getElementById('acct-card').style.display = type==='sl' ? 'block' : 'none';
  document.getElementById('rev-num').textContent = type==='sl' ? '5' : '4';
}

function toggleOtherProject() {
  const sel = document.getElementById('f-project');
  const wrap = document.getElementById('project-other-wrap');
  if(wrap) wrap.style.display = sel.value==='other' ? 'block' : 'none';
  if(sel.value==='other') document.getElementById('f-project-other')?.focus();
}
function toggleOther() {
  const sel = document.getElementById('f-reason');
  document.getElementById('other-wrap').style.display = sel.value==='other' ? 'block' : 'none';
}

// ── Calculations ──
function calcSL() {
  let t = 0;
  document.querySelectorAll('#sl-rows .item-row').forEach(r => {
    t += (parseFloat(r.querySelector('.sl-price')?.value)||0) *
         (parseInt(r.querySelector('.sl-mo')?.value)||0) *
         (parseInt(r.querySelector('.sl-qty')?.value)||0);
  });
  document.getElementById('sl-total').textContent = '฿'+t.toLocaleString('th-TH');
}
function calcHW() {
  let t = 0;
  document.querySelectorAll('#hw-rows .item-row').forEach(r => {
    t += (parseFloat(r.querySelector('.hw-price')?.value)||0) *
         (parseInt(r.querySelector('.hw-qty')?.value)||0);
  });
  document.getElementById('hw-total').textContent = '฿'+t.toLocaleString('th-TH');
}
function calcINT() {
  const pp = parseFloat(document.getElementById('int-pp')?.value)||0;
  const n  = document.querySelectorAll('.int-name').length;
  document.getElementById('int-total').textContent = '฿'+(pp*n).toLocaleString('th-TH');
}

// ── Row helpers ──
const TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
function rmRow(btn, cid) {
  const c = document.getElementById(cid);
  if(c.querySelectorAll('.item-row').length > 1) btn.closest('.item-row').remove();
}
function addSLRow() {
  const d = document.createElement('div'); d.className='item-row'; d.style.gridTemplateColumns='3fr 1.2fr 0.8fr 0.8fr 30px';
  d.innerHTML = `<input class="ri" type="text" placeholder="ชื่อ Software"><input class="ri sl-price" type="number" placeholder="ราคา" oninput="calcSL()"><input class="ri sl-mo" type="number" value="12" oninput="calcSL()"><input class="ri sl-qty" type="number" placeholder="จำนวน" oninput="calcSL()"><button class="rm-btn" onclick="rmRow(this,'sl-rows');calcSL()" title="ลบ">${TRASH}</button>`;
  document.getElementById('sl-rows').appendChild(d);
}
function addHWRow() {
  const d = document.createElement('div'); d.className='item-row'; d.style.gridTemplateColumns='3fr 1.4fr 1fr 30px';
  d.innerHTML = `<input class="ri" type="text" placeholder="ชื่ออุปกรณ์"><input class="ri hw-price" type="number" placeholder="ราคา" oninput="calcHW()"><input class="ri hw-qty" type="number" placeholder="จำนวน" oninput="calcHW()"><button class="rm-btn" onclick="rmRow(this,'hw-rows');calcHW()" title="ลบ">${TRASH}</button>`;
  document.getElementById('hw-rows').appendChild(d);
}
function addName(cid, cls, doCalc) {
  const c = document.getElementById(cid);
  const n = c.querySelectorAll('.row-name').length + 1;
  const d = document.createElement('div'); d.className='row-name';
  const calc = doCalc ? ';calcINT()' : '';
  d.innerHTML = `<span class="name-num">${n}.</span><input class="ri ${cls}" type="text" placeholder="ชื่อ-นามสกุล ตำแหน่ง" oninput="${doCalc?'calcINT()':''}"><button class="rm-btn" onclick="rmName(this,'${cid}')${calc}" title="ลบ">${TRASH}</button>`;
  c.appendChild(d);
}
function rmName(btn, cid) {
  const c = document.getElementById(cid);
  if(c.querySelectorAll('.row-name').length > 1) btn.closest('.row-name').remove();
  c.querySelectorAll('.name-num').forEach((el,i) => el.textContent=(i+1)+'.');
}

// ── Account table ──
function getAcctCols() { return Array.from(document.querySelectorAll('.acct-col')).map(i=>i.value.trim()).filter(c=>c); }
function rebuildAcct() {
  const cols = getAcctCols(); const show = cols.length ? cols : ['Col 1'];
  const head = document.getElementById('acct-head');
  const body = document.getElementById('acct-body');
  head.innerHTML = `<tr style="background:var(--bg)"><th style="padding:6px 10px;text-align:left;border:1px solid var(--border);font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase">Email</th>${show.map(c=>`<th style="padding:6px 10px;text-align:center;border:1px solid var(--border);font-size:10px;font-weight:600;color:var(--text-3);width:80px">${c}</th>`).join('')}<th style="width:36px;border:1px solid var(--border)"></th></tr>`;
  Array.from(body.querySelectorAll('tr')).forEach(tr => {
    const email = tr.querySelector('.acct-email')?.value||'';
    const vals  = Array.from(tr.querySelectorAll('.acct-val')).map(s=>s.value);
    tr.innerHTML = _buildAcctRow(email, vals, show.length);
  });
  if(!body.children.length) addAcctRow();
}
function _buildAcctRow(email, vals, n) {
  let h = `<td style="padding:3px 6px;border:1px solid var(--border)"><input type="text" class="ri acct-email" placeholder="email@orbitdigital.co.th" value="${email}" style="font-size:11px;padding:3px 7px"></td>`;
  for(let i=0;i<n;i++) h += `<td style="padding:3px 6px;border:1px solid var(--border);text-align:center"><select class="acct-val" style="font-size:11px;padding:2px 4px;width:100%;border:1px solid var(--border-md);border-radius:4px"><option${vals[i]==='-'||!vals[i]?' selected':''}>-</option><option${vals[i]==='✓'?' selected':''}>✓</option></select></td>`;
  h += `<td style="padding:3px 4px;border:1px solid var(--border);text-align:center"><button class="rm-btn" onclick="this.closest('tr').remove()" style="width:24px;height:24px" title="ลบ">${TRASH}</button></td>`;
  return h;
}
function addAcctRow() {
  const n = getAcctCols().length || 1;
  const tr = document.createElement('tr');
  tr.innerHTML = _buildAcctRow('', [], n);
  document.getElementById('acct-body').appendChild(tr);
}

// ── Collect & Validate ──
function selectedReason() {
  const r = val('#f-reason');
  return r==='other' ? val('#f-reason-other') : r;
}
function memoSubject(data) {
  if(data.subject) return data.subject;
  const p = data.project ? `โครงการ ${data.project}` : 'โครงการ';
  return ({ sl:`ขออนุมัติจัดซื้อ Software License สำหรับ${p}`,
            hw:`ขออนุมัติจัดซื้อ Hardware สำหรับ${p}`,
            int:`ขออนุมัติค่าใช้จ่าย Team Activity สำหรับ${p}`,
            ent:`ขออนุมัติค่าใช้จ่ายรับรองลูกค้าสำหรับ${p}`,
            dep:`ขออนุมัติค่าใช้จ่าย Deployment สำหรับ${p}` }[data.type]) || 'ขออนุมัติ Memo';
}
function collectMemoData() {
  const revCard = document.querySelector('#rev-num')?.closest('.card');
  const revInputs = Array.from(revCard?.querySelectorAll('input')||[]).map(i=>i.value.trim());
  const data = {
    type: selectedType, typeLabel: TYPE_LABELS[selectedType]||'-',
    memoNo: val('#f-memo-no'), date: dateInput(val('#f-date')),
    project: val('#f-project')==='other' ? val('#f-project-other') : val('#f-project'),
    to: val('#f-to'), subject: val('#f-subject'), reason: selectedReason(),
    requesterName:  val('#f-requester-name') || 'Chuen K.',
    requesterTitle: val('#f-requester-title') || 'PMO',
    submittedAt:    new Date().toISOString(),
    reviewerName: revInputs[0]||'-', reviewerTitle: revInputs[1]||'-',
    reviewerDate: dateInput(revInputs[2]) || TODAY,
    approverName: revInputs[3]||'-', approverTitle: revInputs[4]||'-',
    approverDate: dateInput(revInputs[5]) || TODAY,
    sections: [], total: 0, amountWords: ''
  };
  data.subject = memoSubject(data);
  if(data.type==='sl') {
    const rows = Array.from(document.querySelectorAll('#sl-rows .item-row')).map((row,i) => {
      const inp = row.querySelectorAll('input');
      const price=Number(inp[1]?.value)||0, months=Number(inp[2]?.value)||0, qty=Number(inp[3]?.value)||0;
      return { no:i+1, name:inp[0]?.value.trim()||'-', price, months, qty, subtotal:price*months*qty };
    });
    data.total = rows.reduce((s,r)=>s+r.subtotal, 0);
    data.amountWords = val('#fs-sl .form-grid .fg:nth-child(2) input');
    data.sections.push({ title:'รายการ Software', html:table(['#','ชื่อ Software','฿/เดือน','เดือน','จำนวน','รวม'], rows.map(r=>[r.no,r.name,money(r.price),r.months,r.qty,money(r.subtotal)]), [2,5]) });
    const acctCols = getAcctCols();
    const acctRows = Array.from(document.querySelectorAll('#acct-body tr')).map(tr=>[val('.acct-email',tr),...Array.from(tr.querySelectorAll('.acct-val')).map(s=>s.value)]).filter(r=>r.some(Boolean));
    if(acctCols.length && acctRows.length) data.sections.push({ title:'ตาราง Account', html:table(['Email',...acctCols], acctRows, []) });
  }
  if(data.type==='hw') {
    const rows = Array.from(document.querySelectorAll('#hw-rows .item-row')).map((row,i) => {
      const inp = row.querySelectorAll('input');
      const price=Number(inp[1]?.value)||0, qty=Number(inp[2]?.value)||0;
      return { no:i+1, name:inp[0]?.value.trim()||'-', price, qty, subtotal:price*qty };
    });
    data.total = rows.reduce((s,r)=>s+r.subtotal,0);
    data.amountWords = val('#fs-hw .form-grid .fg:nth-child(1) input');
    const owner = val('#fs-hw .form-grid .fg:nth-child(2) input');
    data.sections.push({ title:'รายการ Hardware', html:table(['#','ชื่ออุปกรณ์','ราคา/ชิ้น','จำนวน','รวม'], rows.map(r=>[r.no,r.name,money(r.price),r.qty,money(r.subtotal)]), [2,4]) });
    if(owner) data.sections.push({ title:'ผู้รับผิดชอบดูแลอุปกรณ์', html:`<p>${esc(owner)}</p>` });
  }
  if(data.type==='int') {
    const fs = document.querySelector('#fs-int');
    const inp = fs.querySelectorAll('input');
    const pp = Number(inp[2]?.value)||0;
    const names = Array.from(fs.querySelectorAll('.int-name')).map((i,idx)=>[idx+1,i.value.trim()||'-']);
    data.total = pp*names.length;
    data.amountWords = inp[3]?.value.trim()||'';
    data.sections.push({ title:'รายละเอียดกิจกรรม', html:`<p>ไตรมาส/ครั้งที่: ${esc(inp[0]?.value||'-')}<br>วันที่: ${esc(dateInput(inp[1]?.value))}<br>วงเงิน/คน: ${esc(money(pp))}</p>` });
    data.sections.push({ title:'รายชื่อผู้เข้าร่วม', html:table(['#','ชื่อ-นามสกุล / ตำแหน่ง'], names, []) });
  }
  if(data.type==='ent') {
    const inp = document.querySelectorAll('#fs-ent input');
    data.total = Number(inp[5]?.value)||0;
    data.amountWords = inp[6]?.value.trim()||'';
    data.sections.push({ title:'รายละเอียดงานเลี้ยงรับรอง', html:`<p>ลูกค้า: ${esc(inp[0]?.value||'-')}<br>วันที่: ${esc(dateInput(inp[1]?.value))} ${esc(inp[2]?.value||'')}<br>สถานที่: ${esc(inp[3]?.value||'-')}<br>จำนวน: ${esc(inp[4]?.value||'-')} คน</p>` });
  }
  if(data.type==='dep') {
    const fs = document.querySelector('#fs-dep');
    const inp = fs.querySelectorAll('input');
    data.amountWords = inp[4]?.value.trim()||'';
    const names = Array.from(fs.querySelectorAll('.dep-name')).map((i,idx)=>[idx+1,i.value.trim()||'-']);
    data.sections.push({ title:'รายละเอียด Deployment', html:`<p>ช่วงวันที่: ${esc(dateInput(inp[0]?.value))} - ${esc(dateInput(inp[1]?.value))}<br>สถานที่: ${esc(inp[2]?.value||'-')}<br>รูปแบบ: ${esc(fs.querySelector('select')?.value||'-')}<br>วงเงินอำนาจ: ${esc(inp[5]?.value||'-')} บาท</p>` });
    if(names.length) data.sections.push({ title:'รายชื่อพนักงาน', html:table(['#','ชื่อ-นามสกุล / ตำแหน่ง'], names, []) });
  }
  return data;
}
function validateMemo(data) {
  const missing = [];
  if(!data.type) missing.push('ประเภท Memo');
  if(!val('#f-project')) missing.push('โครงการ');
  else if(val('#f-project')==='other' && !val('#f-project-other')) missing.push('ชื่อโครงการ');
  if(!data.to) missing.push('เรียน');
  if(!data.reason) missing.push('เหตุผลในการขอ');
  if(!val('#f-requester-name')) missing.push('ชื่อผู้ขอ');
  if(!data.reviewerName || data.reviewerName==='-') missing.push('ชื่อ Reviewer');
  if(!data.approverName || data.approverName==='-') missing.push('ชื่อ Approver');
  if(data.type==='sl' && !Array.from(document.querySelectorAll('#sl-rows .item-row input:first-child')).some(i=>i.value.trim()))
    missing.push('รายการ Software (อย่างน้อย 1 รายการ)');
  if(data.type==='hw' && !Array.from(document.querySelectorAll('#hw-rows .item-row input:first-child')).some(i=>i.value.trim()))
    missing.push('รายการ Hardware (อย่างน้อย 1 รายการ)');
  if(data.type==='int' && !Array.from(document.querySelectorAll('.int-name')).some(i=>i.value.trim()))
    missing.push('รายชื่อผู้เข้าร่วม (อย่างน้อย 1 คน)');
  if(data.type==='ent' && !document.querySelector('#fs-ent input')?.value?.trim())
    missing.push('ชื่อลูกค้า / บริษัท');
  if(missing.length) { alert('กรุณากรอกข้อมูลให้ครบ:\n\n• '+missing.join('\n• ')); return false; }
  return true;
}
async function generateMemoPdf() {
  const data = collectMemoData();
  if(!validateMemo(data)) return;
  try {
    const saved = saveMemo(data);
    renderPendingMemos();
    await downloadMemoPdf(saved);
    setNextMemoNo();
    alert(`บันทึก ${saved.memoNo} ใน Pending แล้ว และสร้าง PDF เรียบร้อย`);
  } catch(e) {
    console.error(e);
    alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
}
function resetMemoForm() {
  if(confirm('ล้างข้อมูลที่กรอกหรือไม่?')) location.reload();
}
