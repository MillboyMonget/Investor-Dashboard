// Havana Hub — Investor Dashboard (static, localStorage based)
const LS_KEY = 'havana_investor_v1';

// state
let state = {
  investors: [],    // {id, name, amount, date, method, returns}
  payouts: []       // {id, investorId, amount, date}
};

function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadState(){ const raw = localStorage.getItem(LS_KEY); if(raw) state = JSON.parse(raw); else saveState(); }

// helpers
function idGen(){ return 'id_' + Math.random().toString(36).slice(2,9); }
function number(n){ return Number(n || 0); }
function format(val){ return (Math.round(val*100)/100).toLocaleString(); }

// UI elements
const totalRaisedEl = document.getElementById('totalRaised');
const totalPayoutsEl = document.getElementById('totalPayouts');
const investorCountEl = document.getElementById('investorCount');

const investorTableBody = document.querySelector('#investorTable tbody');
const payoutTableBody = document.querySelector('#payoutTable tbody');
const payoutInvestorSelect = document.getElementById('payoutInvestor');

const ctxPie = document.getElementById('ownershipPie').getContext('2d');
const ctxBar = document.getElementById('contributionBar').getContext('2d');
let pieChart, barChart;

function calcTotals(){
  const total = state.investors.reduce((s,i)=> s + number(i.amount), 0);
  const payoutsTotal = state.payouts.reduce((s,p) => s + number(p.amount), 0);
  return { total, payoutsTotal };
}

function updateDashboard(){
  const { total, payoutsTotal } = calcTotals();
  totalRaisedEl.textContent = format(total);
  totalPayoutsEl.textContent = format(payoutsTotal);
  investorCountEl.textContent = state.investors.length;
  renderInvestorsTable();
  renderPayoutsTable();
  renderCharts();
}

function renderInvestorsTable(){
  investorTableBody.innerHTML = '';
  payoutInvestorSelect.innerHTML = '<option value="">Select investor</option>';
  const total = calcTotals().total || 1;
  state.investors.forEach(inv=>{
    const ownership = total>0 ? (number(inv.amount) / total) * 100 : 0;
    const roi = inv.amount ? (number(inv.returns || 0) / number(inv.amount)) * 100 : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escape(inv.name)}</td>
      <td>GHS ${format(inv.amount)}</td>
      <td>${format(ownership)}%</td>
      <td>GHS ${format(inv.returns || 0)}</td>
      <td>${isFinite(roi) ? format(roi) : 0}%</td>
      <td>
        <button class="btn btn-sm btn-outline-primary edit" data-id="${inv.id}">Edit</button>
        <button class="btn btn-sm btn-outline-danger del" data-id="${inv.id}">Delete</button>
      </td>
    `;
    investorTableBody.appendChild(tr);

    const opt = document.createElement('option'); opt.value = inv.id; opt.text = inv.name; payoutInvestorSelect.appendChild(opt);
  });

  // attach events
  document.querySelectorAll('.edit').forEach(b=>b.onclick = ()=> editInvestor(b.dataset.id));
  document.querySelectorAll('.del').forEach(b=> b.onclick = ()=> { if(confirm('Remove investor?')){ state.investors = state.investors.filter(x=>x.id!==b.dataset.id); saveState(); updateDashboard(); }});
}

function renderPayoutsTable(){
  payoutTableBody.innerHTML = '';
  state.payouts.forEach(p=>{
    const inv = state.investors.find(i=>i.id===p.investorId);
    const invested = inv ? number(inv.amount) : 0;
    const totalPaid = state.payouts.filter(x=>x.investorId===p.investorId).reduce((s,r)=>s+number(r.amount),0);
    const balance = invested - totalPaid;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escape(inv ? inv.name : 'Unknown')}</td><td>GHS ${format(p.amount)}</td><td>${p.date}</td><td>GHS ${format(balance)}</td>`;
    payoutTableBody.appendChild(tr);
  });
}

// charts
function renderCharts(){
  const labels = state.investors.map(i=>i.name);
  const data = state.investors.map(i=>number(i.amount));
  if(!pieChart){
    pieChart = new Chart(ctxPie, {
      type:'pie',
      data:{ labels, datasets:[{ data, backgroundColor: buildColors(data.length) }] },
      options: { responsive:true }
    });
  } else { pieChart.data.labels = labels; pieChart.data.datasets[0].data = data; pieChart.update(); }

  if(!barChart){
    barChart = new Chart(ctxBar, {
      type:'bar',
      data:{ labels, datasets:[{ label:'Contribution (GHS)', data, backgroundColor: buildColors(data.length) }]},
      options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
    });
  } else { barChart.data.labels = labels; barChart.data.datasets[0].data = data; barChart.update(); }
}

function buildColors(n){
  const base = ['#0f9bd7','#ffd166','#06d6a0','#ff6b6b','#845ec2','#4d8076','#ff9f1c','#00b4d8','#8b5cf6','#ffbc42'];
  const out = [];
  for(let i=0;i<n;i++) out.push(base[i % base.length]);
  return out;
}

function escape(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

// investor forms
document.getElementById('addInvestorBtn').onclick = ()=>{
  const name = document.getElementById('investorName').value.trim();
  const amount = Number(document.getElementById('investedAmount').value || 0);
  const date = document.getElementById('investedDate').value;
  const method = document.getElementById('paymentMethod').value;
  if(!name || !amount) return alert('Name and amount required');
  // check if exists by name (simple)
  const existing = state.investors.find(i=>i.name.toLowerCase()===name.toLowerCase());
  if(existing){
    existing.amount = number(existing.amount) + amount;
    existing.date = date || existing.date;
    existing.method = method || existing.method;
  } else {
    state.investors.push({ id:idGen(), name, amount, date, method, returns:0 });
  }
  saveState(); updateDashboard();
  document.getElementById('investorName').value=''; document.getElementById('investedAmount').value=''; document.getElementById('investedDate').value=''; document.getElementById('paymentMethod').value='';
};

// edit
function editInvestor(id){
  const inv = state.investors.find(i=>i.id===id);
  if(!inv) return;
  const newName = prompt('Investor name', inv.name);
  if(newName===null) return;
  const newAmount = prompt('Total invested (GHS)', inv.amount);
  if(newAmount===null) return;
  inv.name = newName;
  inv.amount = Number(newAmount);
  saveState(); updateDashboard();
}

// payouts
document.getElementById('addPayoutBtn').onclick = ()=>{
  const invId = document.getElementById('payoutInvestor').value;
  const amt = Number(document.getElementById('payoutAmount').value || 0);
  const dt = document.getElementById('payoutDate').value;
  if(!invId || !amt) return alert('Select investor and amount');
  state.payouts.push({ id:idGen(), investorId:invId, amount:amt, date: dt || new Date().toISOString().slice(0,10) });
  saveState(); updateDashboard();
  document.getElementById('payoutAmount').value=''; document.getElementById('payoutDate').value='';
};

// export / import
document.getElementById('exportJson').onclick = ()=> {
  const blob = new Blob([JSON.stringify(state, null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='havana_investors_export.json'; a.click(); URL.revokeObjectURL(url);
};

document.getElementById('exportCsv').onclick = ()=> {
  // export investors CSV
  const rows = state.investors.map(i=> [i.name, i.amount, i.date || '', i.method || '', i.returns || 0].map(x=>`"${(x||'').toString().replace(/"/g,'""')}"`).join(','));
  const header = '"Name","Amount","Date","Method","Returns"';
  const csv = [header].concat(rows).join('\n');
  const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='investors.csv'; a.click(); URL.revokeObjectURL(url);
};

document.getElementById('importFile').onchange = (e)=> {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=> {
    try {
      const text = ev.target.result;
      if(file.name.endsWith('.json')){
        const obj = JSON.parse(text);
        state = obj;
        saveState(); updateDashboard(); alert('Imported JSON');
      } else {
        // naive CSV import into investors
        const lines = text.trim().split(/\r?\n/);
        const header = lines.shift().split(',').map(h => h.replace(/"/g,'').toLowerCase());
        lines.forEach(l=>{
          const cols = l.split(',').map(c=>c.replace(/(^"|"$)/g,''));
          const obj = {};
          header.forEach((h,i)=> obj[h]=cols[i]||'');
          state.investors.push({ id:idGen(), name: obj.name || 'Unknown', amount: Number(obj.amount || 0), date: obj.date || '', method: obj.method || '', returns: Number(obj.returns || 0) });
        });
        saveState(); updateDashboard(); alert('Imported CSV');
      }
    } catch(err){ alert('Import failed: ' + err.message); }
  };
  reader.readAsText(file);
};

// init
function init(){
  loadState();
  updateDashboard();
}

init();