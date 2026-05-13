// === MASUKKAN URL API GOOGLE APPS SCRIPT KEUANGAN ANDA DI SINI ===
const API_URL = 'https://script.google.com/macros/s/AKfycbw60bH24-ThGbqmjV-DFn5cqVxXSzRM2K-6ievdWQ7G2Kgu398aeVoPA71gTgDb0BU/exec';
const SECRET_PIN = '123456'; 

let state = {
    jurnal: [],
    coa: [],
    dashboard: { income: 0, expense: 0, netProfit: 0, cashInBank: 0 }
};

const pageTitles = {
    'dashboard': 'Dashboard Finance',
    'jurnal': 'Buku Besar (Jurnal Umum)',
    'coa': 'Master COA & Pajak'
};

// --- INIT & NAVIGATION ---
document.getElementById('btn-login').addEventListener('click', async () => {
    const pin = document.getElementById('input-pin').value;
    if (pin === SECRET_PIN) {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard-container').classList.remove('hidden');
        await fetchData();
        switchTab('dashboard');
    } else {
        alert("PIN Otorisasi Salah!");
        document.getElementById('input-pin').value = '';
    }
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-slate-800', 'text-white', 'border-blue-500');
        el.classList.add('text-slate-400', 'border-transparent');
    });
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.getElementById(`btn-${tabId}`).classList.add('bg-slate-800', 'text-white', 'border-blue-500');
    document.getElementById('page-title').innerText = pageTitles[tabId];
    
    if (window.innerWidth < 1024) document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
}

// --- GLOBAL FILTER ---
document.getElementById('global-month').addEventListener('change', (e) => handleFilter('month', e.target.value));
document.getElementById('global-date').addEventListener('change', (e) => handleFilter('date', e.target.value));
document.getElementById('btn-clear-filter').addEventListener('click', () => handleFilter('clear', null));

async function handleFilter(type, value) {
    if (type === 'month') {
        document.getElementById('global-date').value = '';
        state.activeFilter = value; // Format YYYY-MM
    } else if (type === 'date') {
        document.getElementById('global-month').value = '';
        state.activeFilter = value; // Format YYYY-MM-DD
    } else {
        document.getElementById('global-date').value = '';
        document.getElementById('global-month').value = '';
        state.activeFilter = null;
    }

    const btnClear = document.getElementById('btn-clear-filter');
    state.activeFilter ? btnClear.classList.remove('hidden') : btnClear.classList.add('hidden');

    await fetchData(); // Fetch data based on new filter
}

// --- DATA FETCHING ---
async function fetchData() {
    showLoading(true);
    try {
        // Query param for filter
        let params = `?pin=${SECRET_PIN}&action=getJurnal`;
        let dashParams = `?pin=${SECRET_PIN}&action=getFinancialDashboard`;
        
        if (state.activeFilter) {
            // Very simple date bounding for backend
            let start, end;
            if (state.activeFilter.length === 7) { // Is Month
                start = `${state.activeFilter}-01`;
                end = `${state.activeFilter}-31`;
            } else { // Is Date
                start = state.activeFilter;
                end = state.activeFilter;
            }
            dashParams += `&start=${start}&end=${end}`;
        }

        // Fetch Data Paralel
        const [resJurnal, resDash, resCoa] = await Promise.all([
            fetch(API_URL + params).then(r => r.json()),
            fetch(API_URL + dashParams).then(r => r.json()),
            fetch(API_URL + `?pin=${SECRET_PIN}&action=getCOA`).then(r => r.json())
        ]);

        if (resJurnal.status === 'success') state.jurnal = resJurnal.data;
        if (resDash.status === 'success') state.dashboard = resDash.summary;
        if (resCoa.status === 'success') state.coa = resCoa.data;

        renderAll();
    } catch (e) {
        console.error(e);
        alert('Gagal menyinkronkan data dengan server.');
    } finally {
        showLoading(false);
    }
}

function showLoading(isLoading) {
    const el = document.getElementById('app-loading');
    isLoading ? el.classList.remove('hidden') : el.classList.add('hidden');
}

// --- RENDERING ---
function renderAll() {
    renderDashboard();
    renderJurnalTable();
    renderCOATable();
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
    // Kelompokkan Jurnal berdasarkan tanggal untuk chart
    let dailyData = {};
    
    // Filter jurnal yang tampil sesuai filter global
    let visibleJurnal = state.jurnal.filter(j => {
        if(!state.activeFilter) return true;
        return j.tanggal.startsWith(state.activeFilter);
    });

    // Kita reverse karena jurnal dari backend descending (terbaru di atas)
    [...visibleJurnal].reverse().forEach(j => {
        let tgl = j.tanggal;
        if (!dailyData[tgl]) dailyData[tgl] = { in: 0, out: 0 };
        if (j.kategori === 'Pendapatan') dailyData[tgl].in += Number(j.nominal);
        if (j.kategori === 'Beban Operasional') dailyData[tgl].out += Number(j.nominal);
    });

    const labels = Object.keys(dailyData);
    const dataIn = labels.map(l => dailyData[l].in);
    const dataOut = labels.map(l => dailyData[l].out);

    if(cashflowChart) cashflowChart.destroy();
    const ctx = document.getElementById('chart-cashflow').getContext('2d');
    
    Chart.defaults.color = '#94a3b8';
    cashflowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['Belum ada data'],
            datasets: [
                { label: 'Uang Masuk', data: dataIn, backgroundColor: '#3b82f6', borderRadius: 4 },
                { label: 'Uang Keluar', data: dataOut, backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { grid: { color: '#334155' } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
}

function renderJurnalTable() {
    const tbody = document.getElementById('table-body-jurnal');
    const emptyState = document.getElementById('empty-state-jurnal');
    tbody.innerHTML = '';

    let visibleJurnal = state.jurnal.filter(j => {
        if(!state.activeFilter) return true;
        return j.tanggal.startsWith(state.activeFilter);
    });

    if (visibleJurnal.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        visibleJurnal.forEach(j => {
            const tr = document.createElement('tr');
            tr.classList.add('hover:bg-slate-700/50', 'transition-colors');
            
            let colorKategori = 'text-slate-300';
            if(j.kategori === 'Pendapatan') colorKategori = 'text-blue-400';
            if(j.kategori === 'Beban Operasional') colorKategori = 'text-red-400';

            let linkIcon = j.linkBukti ? `<a href="${j.linkBukti}" target="_blank" class="text-blue-400 hover:underline">Lihat Bukti</a>` : '-';

            tr.innerHTML = `
                <td class="px-3 py-3 align-top">
                    <div class="font-bold text-white">${j.tanggal}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">${j.refId || '-'}</div>
                </td>
                <td class="px-3 py-3 align-top">
                    <div class="text-[11px]"><span class="text-slate-400 w-4 inline-block">(D)</span> ${j.debit}</div>
                    <div class="text-[11px] mt-1"><span class="text-slate-400 w-4 inline-block">(K)</span> ${j.kredit}</div>
                </td>
                <td class="px-3 py-3 align-top">
                    <div class="text-[11px] font-bold ${colorKategori}">${j.subKategori}</div>
                    <div class="text-[10px] text-slate-500 mt-1">Prj: ${j.project || '-'}</div>
                </td>
                <td class="px-3 py-3 align-top text-right">
                    <div class="font-bold text-white">${formatRp(j.nominal)}</div>
                </td>
                <td class="px-3 py-3 align-top">
                    <div class="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded inline-block mb-1">${j.jenisPajak || 'Non-Pajak'}</div>
                    <div class="text-[10px]">${linkIcon}</div>
                </td>
                <td class="px-3 py-3 align-top text-center space-x-2">
                    <button onclick="editJurnal(${j.rowId})" class="text-[10px] text-blue-400 hover:text-white">Edit</button>
                    <span class="text-slate-600">|</span>
                    <button onclick="deleteJurnal(${j.rowId})" class="text-[10px] text-red-400 hover:text-white">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function renderCOATable() {
    const tbody = document.getElementById('table-body-coa');
    tbody.innerHTML = '';
    state.coa.forEach(c => {
        const badge = c.isTaxDeductible 
            ? `<span class="bg-green-900/50 text-green-400 px-2 py-0.5 rounded text-[10px]">Ya (Deductible)</span>`
            : `<span class="bg-red-900/50 text-red-400 px-2 py-0.5 rounded text-[10px]">Koreksi Fiskal</span>`;
            
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-2 font-medium text-white">${c.kategori}</td>
            <td class="px-4 py-2 text-slate-300">${c.sub}</td>
            <td class="px-4 py-2 text-center">${badge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODAL & CRUD JURNAL ---
function openJurnalModal() {
    document.getElementById('form-jurnal').reset();
    document.getElementById('input-row-id').value = '';
    const today = new Date();
    document.getElementById('input-tgl').value = today.toISOString().split('T')[0];
    document.getElementById('modal-jurnal-title').innerText = "Input Jurnal Baru";
    document.getElementById('modal-jurnal').classList.remove('hidden');
}

function closeJurnalModal() {
    document.getElementById('modal-jurnal').classList.add('hidden');
}

function editJurnal(rowId) {
    const j = state.jurnal.find(x => x.rowId === rowId);
    if(j) {
        document.getElementById('input-row-id').value = j.rowId;
        document.getElementById('input-tgl').value = j.tanggal;
        document.getElementById('input-ref').value = j.refId;
        document.getElementById('input-debit').value = j.debit;
        document.getElementById('input-kredit').value = j.kredit;
        document.getElementById('input-nominal').value = j.nominal;
        document.getElementById('input-kategori').value = j.kategori;
        document.getElementById('input-sub').value = j.subKategori;
        document.getElementById('input-pajak').value = j.jenisPajak || 'Non-Pajak';
        document.getElementById('input-project').value = j.project;
        document.getElementById('input-bukti').value = j.linkBukti;
        document.getElementById('input-ket').value = j.keterangan;
        
        document.getElementById('modal-jurnal-title').innerText = "Edit Jurnal";
        document.getElementById('modal-jurnal').classList.remove('hidden');
    }
}

document.getElementById('form-jurnal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-jurnal');
    btn.innerHTML = 'Menyimpan...'; btn.disabled = true;

    const rowId = document.getElementById('input-row-id').value;
    const payload = {
        pin: SECRET_PIN,
        action: rowId ? 'editJurnal' : 'addJurnal',
        rowId: rowId,
        tanggal: document.getElementById('input-tgl').value,
        refId: document.getElementById('input-ref').value,
        debit: document.getElementById('input-debit').value,
        kredit: document.getElementById('input-kredit').value,
        nominal: document.getElementById('input-nominal').value,
        kategori: document.getElementById('input-kategori').value,
        subKategori: document.getElementById('input-sub').value,
        project: document.getElementById('input-project').value || '-',
        jenisPajak: document.getElementById('input-pajak').value,
        linkBukti: document.getElementById('input-bukti').value,
        keterangan: document.getElementById('input-ket').value
    };

    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        closeJurnalModal();
        await fetchData(); // Refresh data
    } catch (e) {
        alert("Gagal menyimpan jurnal.");
    } finally {
        btn.innerHTML = 'Simpan Jurnal'; btn.disabled = false;
    }
});

async function deleteJurnal(rowId) {
    if(!confirm("Yakin ingin menghapus entri jurnal ini secara permanen?")) return;
    try {
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ pin: SECRET_PIN, action: 'deleteJurnal', rowId: rowId }) 
        });
        await fetchData();
    } catch(e) { alert("Gagal menghapus."); }
}

// --- EXPORT / IMPORT CSV ---
document.getElementById('btn-export').addEventListener('click', () => {
    let visibleJurnal = state.jurnal.filter(j => {
        if(!state.activeFilter) return true;
        return j.tanggal.startsWith(state.activeFilter);
    });

    if(visibleJurnal.length === 0) return alert("Tidak ada data untuk diexport");

    let csv = "Tanggal,ID_Referensi,Akun_Debit,Akun_Kredit,Nominal,Kategori_Laporan,Sub_Kategori,Project,Jenis_Pajak,Link_Bukti,Keterangan\n";
    visibleJurnal.forEach(j => {
        let row = [
            j.tanggal, j.refId, j.debit, j.kredit, j.nominal, 
            j.kategori, j.subKategori, j.project, j.jenisPajak, j.linkBukti, 
            `"${String(j.keterangan).replace(/"/g, '""')}"`
        ];
        csv += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `Jurnal_Keuangan_${new Date().getTime()}.csv`;
    link.click();
});

document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-csv-input').click());

document.getElementById('import-csv-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) return alert("File kosong atau salah format.");

        let entries = [];
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
            const cleanRow = row.map(val => {
               let v = val ? val.trim() : "";
               if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
               return v;
            });
            if(cleanRow.length >= 5) entries.push(cleanRow); // Minimal ada nominal
        }
        
        if (confirm(`Impor ${entries.length} baris jurnal?`)) {
            document.getElementById('btn-import').innerText = "Loading...";
            try {
                await fetch(API_URL, { 
                    method: 'POST', 
                    body: JSON.stringify({ pin: SECRET_PIN, action: 'importJurnal', entries: entries }) 
                });
                alert("Berhasil diimpor!");
                fetchData();
            } catch(e) { alert("Gagal impor."); }
            finally { document.getElementById('btn-import').innerText = "Import CSV"; }
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

document.getElementById('btn-refresh').addEventListener('click', fetchData);

// Utility
function formatRp(angka) {
    return 'Rp ' + Number(angka).toLocaleString('id-ID');
}
