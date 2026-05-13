const API_URL = 'https://script.google.com/macros/s/AKfycbw60bH24-ThGbqmjV-DFn5cqVxXSzRM2K-6ievdWQ7G2Kgu398aeVoPA71gTgDb0BU/exec'; 
const SECRET_PIN = '123456'; 

let state = {
    jurnal: [],
    coa: [],
    dashboard: { income: 0, expense: 0, netProfit: 0, cashInBank: 0 },
    activeFilter: null
};

// LOGIN & SIDEBAR
document.getElementById('btn-login').addEventListener('click', () => {
    if (document.getElementById('input-pin').value === SECRET_PIN) {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard-container').classList.remove('hidden');
        fetchData();
        switchTab('dashboard');
    } else { alert("PIN Otorisasi Salah!"); }
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('bg-slate-800', 'text-white', 'border-blue-500'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.getElementById(`btn-${tabId}`).classList.add('bg-slate-800', 'text-white', 'border-blue-500');
    if(tabId === 'dashboard') renderDashboard();
}

// FILTER LOGIC
document.getElementById('global-month').addEventListener('change', (e) => handleFilter(e.target.value));
document.getElementById('global-date').addEventListener('change', (e) => handleFilter(e.target.value));
document.getElementById('btn-clear-filter').addEventListener('click', () => handleFilter(null));

async function handleFilter(value) {
    state.activeFilter = value; // Format: YYYY-MM
    const btnClear = document.getElementById('btn-clear-filter');
    if(!value) {
        document.getElementById('global-month').value = '';
        document.getElementById('global-date').value = '';
        btnClear.classList.add('hidden');
    } else {
        btnClear.classList.remove('hidden');
    }
    await fetchData();
}

// FETCH DATA
async function fetchData() {
    document.getElementById('app-loading').classList.remove('hidden');
    // Kirim parameter filter ke backend
    const filterParam = state.activeFilter ? `&filter=${state.activeFilter}` : '';
    
    try {
        const [resJurnal, resDash, resCoa] = await Promise.all([
            fetch(`${API_URL}?pin=${SECRET_PIN}&action=getJurnal`).then(r => r.json()),
            fetch(`${API_URL}?pin=${SECRET_PIN}&action=getFinancialDashboard${filterParam}`).then(r => r.json()),
            fetch(`${API_URL}?pin=${SECRET_PIN}&action=getCOA`).then(r => r.json())
        ]);

        if (resJurnal.status === 'success') state.jurnal = resJurnal.data;
        if (resDash.status === 'success') state.dashboard = resDash.summary;
        if (resCoa.status === 'success') state.coa = resCoa.data;

        renderAll();
    } catch (e) { console.error(e); }
    finally { document.getElementById('app-loading').classList.add('hidden'); }
}

function renderAll() {
    renderDashboard();
    renderJurnalTable();
}

function renderDashboard() {
    document.getElementById('dash-cash').innerText = formatRp(state.dashboard.cashInBank);
    document.getElementById('dash-income').innerText = formatRp(state.dashboard.income);
    document.getElementById('dash-expense').innerText = formatRp(state.dashboard.expense);
    document.getElementById('dash-profit').innerText = formatRp(state.dashboard.netProfit);
    renderChart();
}

let cashflowChart;
function renderChart() {
    let dailyData = {};
    const filtered = state.jurnal.filter(j => !state.activeFilter || j.tanggal.startsWith(state.activeFilter));
    
    [...filtered].reverse().forEach(j => {
        if (!dailyData[j.tanggal]) dailyData[j.tanggal] = { in: 0, out: 0 };
        const kat = String(j.kategori).trim().toUpperCase();
        if (kat === 'PENDAPATAN') dailyData[j.tanggal].in += Number(j.nominal);
        if (kat === 'BEBAN OPERASIONAL') dailyData[j.tanggal].out += Number(j.nominal);
    });

    const labels = Object.keys(dailyData);
    if(cashflowChart) cashflowChart.destroy();
    const ctx = document.getElementById('chart-cashflow').getContext('2d');
    cashflowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Uang Masuk', data: labels.map(l => dailyData[l].in), backgroundColor: '#10b981' },
                { label: 'Uang Keluar', data: labels.map(l => dailyData[l].out), backgroundColor: '#ef4444' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderJurnalTable() {
    const tbody = document.getElementById('table-body-jurnal');
    tbody.innerHTML = '';
    const filtered = state.jurnal.filter(j => !state.activeFilter || j.tanggal.startsWith(state.activeFilter));
    
    if (filtered.length === 0) {
        document.getElementById('empty-state-jurnal').classList.remove('hidden');
    } else {
        document.getElementById('empty-state-jurnal').classList.add('hidden');
        filtered.forEach(j => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-700/50 border-b border-slate-800";
            tr.innerHTML = `
                <td class="px-3 py-3 font-bold text-white text-[11px]">${j.tanggal}<br><span class="text-[9px] text-slate-500 font-normal">${j.refId}</span></td>
                <td class="px-3 py-3 text-[10px]"><span class="text-blue-400">D:</span> ${j.debit}<br><span class="text-red-400">K:</span> ${j.kredit}</td>
                <td class="px-3 py-3"><div class="font-bold text-blue-300 text-[10px]">${j.subKategori}</div><div class="text-[9px] text-slate-500">${j.project}</div></td>
                <td class="px-3 py-3 text-right font-bold text-white text-[11px]">${formatRp(j.nominal)}</td>
                <td class="px-3 py-3 text-[9px] text-slate-400">${j.jenisPajak}<br>${j.linkBukti !== '-' ? '<a href="'+j.linkBukti+'" target="_blank" class="text-blue-400 underline">Bukti</a>' : '-'}</td>
                <td class="px-3 py-3 text-center"><button onclick="deleteJurnal(${j.rowId})" class="text-red-500 text-[10px]">Del</button></td>
            `;
            tbody.appendChild(tr);
        });
    }
}

async function deleteJurnal(rowId) {
    if(!confirm("Hapus data ini?")) return;
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({ pin: SECRET_PIN, action: 'deleteJurnal', rowId }) });
    fetchData();
}

function formatRp(angka) {
    return 'Rp ' + Number(angka).toLocaleString('id-ID');
}
