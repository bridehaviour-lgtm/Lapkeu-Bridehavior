// GANTI DENGAN URL WEB APP YANG BARU ANDA COPY DARI GOOGLE APPS SCRIPT
const API_URL = 'https://script.google.com/macros/s/AKfycbw60bH24-ThGbqmjV-DFn5cqVxXSzRM2K-6ievdWQ7G2Kgu398aeVoPA71gTgDb0BU/exec'; 
const SECRET_PIN = '123456'; 

let state = {
    jurnal: [], 
    coa: [],
    dashboard: { income: 0, expense: 0, netProfit: 0, cashInBank: 0, assets: 0, liabilities: 0, equity: 0 },
    activeFilter: null
};

// --- LOGIN & SIDEBAR NAVIGATION ---
document.getElementById('btn-login').addEventListener('click', async () => {
    if (document.getElementById('input-pin').value === SECRET_PIN) {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('dashboard-container').classList.remove('hidden');
        await fetchData();
        switchTab('dashboard');
    } else { 
        alert("PIN Otorisasi Salah!"); 
    }
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-slate-800', 'text-white', 'border-blue-500');
        el.classList.add('text-slate-400', 'border-transparent');
    });
    
    const tabElement = document.getElementById(`tab-${tabId}`);
    if (tabElement) tabElement.classList.remove('hidden');
    
    const btnElement = document.getElementById(`btn-${tabId}`);
    if (btnElement) {
        btnElement.classList.add('bg-slate-800', 'text-white', 'border-blue-500');
        btnElement.classList.remove('text-slate-400', 'border-transparent');
    }

    const titles = {
        'dashboard': 'Dashboard Finance',
        'jurnal': 'Buku Besar (Jurnal Umum)',
        'coa': 'Master COA & Pajak'
    };
    document.getElementById('page-title').innerText = titles[tabId] || 'Dashboard Finance';
    
    // Auto-close sidebar di tampilan mobile saat tab dipilih
    if (window.innerWidth < 1024) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('sidebar-overlay').classList.add('hidden');
    }

    if(tabId === 'dashboard') renderDashboard();
}

// Sidebar Mobile Toggle
document.getElementById('btn-open-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.remove('hidden');
});
document.getElementById('btn-close-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
});
document.getElementById('sidebar-overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
});

// --- FILTER LOGIC ---
document.getElementById('global-month').addEventListener('change', (e) => handleFilter(e.target.value, 'month'));
document.getElementById('global-date').addEventListener('change', (e) => handleFilter(e.target.value, 'date'));
document.getElementById('btn-clear-filter').addEventListener('click', () => handleFilter(null, 'clear'));

async function handleFilter(value, type) {
    state.activeFilter = value; 
    const btnClear = document.getElementById('btn-clear-filter');
    
    if(!value) {
        document.getElementById('global-month').value = '';
        document.getElementById('global-date').value = '';
        btnClear.classList.add('hidden');
    } else {
        btnClear.classList.remove('hidden');
        if (type === 'month') document.getElementById('global-date').value = '';
        if (type === 'date') document.getElementById('global-month').value = '';
    }
    
    await fetchData();
}

// --- FETCH DATA ---
async function fetchData() {
    const loadingEl = document.getElementById('app-loading');
    if (loadingEl) loadingEl.classList.remove('hidden');
    
    const filterParam = state.activeFilter ? `&filter=${state.activeFilter}` : '';
    
    try {
        const [resJurnal, resDash, resCoa] = await Promise.all([
            fetch(`${API_URL}?pin=${SECRET_PIN}&action=getJurnal`).then(r => r.json()),
            fetch(`${API_URL}?pin=${SECRET_PIN}&action=getFinancialDashboard${filterParam}`).then(r => r.json()),
            fetch(`${API_URL}?pin=${SECRET_PIN}&action=getCOA`).then(r => r.json())
        ]);

        if (resJurnal.status === 'error') { 
            console.error('Error Jurnal:', resJurnal.message); 
            // Jangan alert jika cuma sheet kosong
        } else {
            state.jurnal = resJurnal.data || [];
        }

        if (resDash.status === 'error') { 
            console.error('Error Dashboard:', resDash.message); 
        } else {
            state.dashboard = resDash.summary || { income: 0, expense: 0, netProfit: 0, cashInBank: 0, assets: 0, liabilities: 0, equity: 0 };
        }

        if (resCoa.status === 'success') {
            state.coa = resCoa.data || [];
        }

        renderAll();
    } catch (e) { 
        console.error("Fetch Error:", e);
        alert('Gagal mengambil data. Pastikan URL API App Script sudah benar dan sudah di-Deploy New Version.');
    } finally { 
        if (loadingEl) loadingEl.classList.add('hidden'); 
    }
}

function renderAll() {
    renderDashboard();
    renderJurnalTable();
    renderCOATable();
}

// --- RENDER DASHBOARD ---
function renderDashboard() {
    document.getElementById('dash-cash').innerText = formatRp(state.dashboard.cashInBank);
    document.getElementById('dash-income').innerText = formatRp(state.dashboard.income);
    document.getElementById('dash-expense').innerText = formatRp(state.dashboard.expense);
    document.getElementById('dash-profit').innerText = formatRp(state.dashboard.netProfit);
    
    document.getElementById('dash-assets').innerText = formatRp(state.dashboard.assets || 0);
    document.getElementById('dash-liabilities').innerText = formatRp(state.dashboard.liabilities || 0);
    document.getElementById('dash-equity').innerText = formatRp(state.dashboard.equity || 0);
    
    renderChart();
}

let cashflowChart;
function renderChart() {
    let dailyData = {};
    
    // Filter lokal untuk chart (memastikan sinkron dengan tabel)
    const filtered = state.jurnal.filter(j => {
        if (!state.activeFilter) return true;
        return String(j.tanggal).startsWith(state.activeFilter);
    });
    
    // Reverse agar urutan chart dari kiri ke kanan (tanggal lama ke baru)
    [...filtered].reverse().forEach(j => {
        const tgl = j.tanggal || 'Unknown';
        if (!dailyData[tgl]) dailyData[tgl] = { in: 0, out: 0 };
        
        const kat = String(j.kategori).trim().toUpperCase();
        if (kat === 'PENDAPATAN') dailyData[tgl].in += Number(j.nominal) || 0;
        if (kat === 'BEBAN OPERASIONAL') dailyData[tgl].out += Number(j.nominal) || 0;
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
                { label: 'Uang Masuk', data: dataIn.length > 0 ? dataIn : [0], backgroundColor: '#10b981', borderRadius: 4 },
                { label: 'Uang Keluar', data: dataOut.length > 0 ? dataOut : [0], backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: '#334155' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- RENDER TABEL JURNAL UMUM ---
function renderJurnalTable() {
    const tbody = document.getElementById('table-body-jurnal');
    const emptyState = document.getElementById('empty-state-jurnal');
    if(!tbody) return;

    tbody.innerHTML = '';
    
    const filtered = state.jurnal.filter(j => {
        if (!state.activeFilter) return true;
        return String(j.tanggal).startsWith(state.activeFilter);
    });
    
    if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        filtered.forEach(j => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-700/50 border-b border-slate-800 transition-colors";
            
            const linkBuktiHTML = (j.linkBukti && j.linkBukti !== '-' && j.linkBukti.trim() !== '') 
                ? `<a href="${j.linkBukti}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">Lihat Bukti</a>` 
                : '<span class="text-slate-600">-</span>';

            tr.innerHTML = `
                <td class="px-3 py-3 align-top">
                    <div class="font-bold text-white text-[11px]">${j.tanggal}</div>
                    <div class="text-[9px] text-slate-400 mt-1 uppercase">${j.refId || '-'}</div>
                </td>
                <td class="px-3 py-3 align-top">
                    <div class="text-[10px]"><span class="text-blue-400 font-bold inline-block w-3">D:</span> ${j.debit}</div>
                    <div class="text-[10px] mt-1"><span class="text-red-400 font-bold inline-block w-3">K:</span> ${j.kredit}</div>
                </td>
                <td class="px-3 py-3 align-top">
                    <div class="font-bold text-blue-300 text-[10px]">${j.subKategori}</div>
                    <div class="text-[9px] text-slate-400 mt-1">Prj: ${j.project || '-'}</div>
                </td>
                <td class="px-3 py-3 align-top text-right">
                    <div class="font-bold text-white text-[11px]">${formatRp(j.nominal)}</div>
                </td>
                <td class="px-3 py-3 align-top text-[9px] text-slate-400">
                    <span class="bg-slate-700 px-1.5 py-0.5 rounded text-[9px] mb-1 inline-block">${j.jenisPajak || 'Non-Pajak'}</span><br>
                    ${linkBuktiHTML}
                </td>
                <td class="px-3 py-3 align-top text-center">
                    <button onclick="deleteJurnal(${j.rowId})" class="text-red-500 hover:text-red-300 text-[10px] font-bold bg-red-500/10 px-2 py-1 rounded">Del</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// --- RENDER TABEL COA ---
function renderCOATable() {
    const tbody = document.getElementById('table-body-coa');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    state.coa.forEach(c => {
        const badge = c.isTaxDeductible 
            ? `<span class="bg-green-900/50 text-green-400 px-2 py-0.5 rounded text-[10px]">Ya (Deductible)</span>`
            : `<span class="bg-red-900/50 text-red-400 px-2 py-0.5 rounded text-[10px]">Koreksi Fiskal</span>`;
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800";
        tr.innerHTML = `<td class="px-4 py-3 font-medium text-white">${c.kategori}</td><td class="px-4 py-3 text-slate-300">${c.sub}</td><td class="px-4 py-3 text-center">${badge}</td>`;
        tbody.appendChild(tr);
    });
}

// --- CRUD JURNAL MANUAL ---
function openJurnalModal() {
    document.getElementById('form-jurnal').reset();
    document.getElementById('input-row-id').value = '';
    document.getElementById('input-tgl').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-jurnal-title').innerText = "Input Jurnal Manual";
    document.getElementById('modal-jurnal').classList.remove('hidden');
}

function closeJurnalModal() {
    document.getElementById('modal-jurnal').classList.add('hidden');
}

document.getElementById('form-jurnal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-jurnal');
    const originalText = btn.innerText;
    btn.innerHTML = 'Menyimpan...'; 
    btn.disabled = true;

    const rowId = document.getElementById('input-row-id').value;
    const payload = {
        pin: SECRET_PIN,
        action: rowId ? 'editJurnal' : 'addJurnal',
        rowId: rowId,
        tanggal: document.getElementById('input-tgl').value,
        refId: document.getElementById('input-ref').value || '-',
        debit: document.getElementById('input-debit').value,
        kredit: document.getElementById('input-kredit').value,
        nominal: document.getElementById('input-nominal').value,
        kategori: document.getElementById('input-kategori').value,
        subKategori: document.getElementById('input-sub').value,
        project: document.getElementById('input-project').value || '-',
        jenisPajak: document.getElementById('input-pajak').value || 'Non-Pajak',
        linkBukti: document.getElementById('input-bukti').value || '-',
        keterangan: document.getElementById('input-ket').value || '-'
    };

    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        closeJurnalModal();
        await fetchData(); 
    } catch (error) {
        alert("Gagal menyimpan jurnal. Periksa koneksi Anda.");
    } finally {
        btn.innerHTML = originalText; 
        btn.disabled = false;
    }
});

async function deleteJurnal(rowId) {
    if(!confirm("Yakin ingin menghapus jurnal ini secara permanen?")) return;
    document.getElementById('app-loading').classList.remove('hidden');
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ pin: SECRET_PIN, action: 'deleteJurnal', rowId }) });
        await fetchData();
    } catch(e) { 
        alert("Gagal menghapus data."); 
        document.getElementById('app-loading').classList.add('hidden');
    }
}

// --- IMPORT / EXPORT CSV ---
document.getElementById('btn-export').addEventListener('click', () => {
    const filtered = state.jurnal.filter(j => !state.activeFilter || j.tanggal.startsWith(state.activeFilter));
    if(filtered.length === 0) return alert("Tidak ada data untuk diexport");

    let csv = "Tanggal,ID_Referensi,Akun_Debit,Akun_Kredit,Nominal,Kategori_Laporan,Sub_Kategori,Project,Jenis_Pajak,Link_Bukti,Keterangan\n";
    filtered.forEach(j => {
        let row = [
            j.tanggal, j.refId, j.debit, j.kredit, j.nominal, 
            j.kategori, j.subKategori, j.project, j.jenisPajak, j.linkBukti, 
            `"${String(j.keterangan).replace(/"/g, '""')}"`
        ];
        csv += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `Jurnal_Keuangan_${state.activeFilter || 'All'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-csv-input').click());

document.getElementById('import-csv-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        if (lines.length < 2) {
            e.target.value = '';
            return alert("File CSV kosong atau format salah.");
        }

        let entries = [];
        for (let i = 1; i < lines.length; i++) {
            // RegEx untuk memisahkan baris CSV dengan aman meskipun ada tanda kutip di keterangannya
            const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
            const cleanRow = row.map(val => {
               let v = val ? val.trim() : "";
               if (v.startsWith('"') && v.endsWith('"')) v = v.substring(1, v.length - 1);
               return v;
            });
            
            if(cleanRow.length >= 5) {
                // Menyamakan standar format tanggal jika yang diimport menggunakan format DD-MM-YYYY
                let dateVal = cleanRow[0];
                if (/^\d{2}-\d{2}-\d{4}$/.test(dateVal)) {
                    let parts = dateVal.split('-');
                    dateVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    cleanRow[0] = dateVal;
                }
                entries.push(cleanRow);
            }
        }
        
        if (entries.length > 0 && confirm(`Impor ${entries.length} baris jurnal?`)) {
            const btn = document.getElementById('btn-import');
            btn.innerText = "Loading...";
            try {
                await fetch(API_URL, { 
                    method: 'POST', 
                    body: JSON.stringify({ pin: SECRET_PIN, action: 'importJurnal', entries: entries }) 
                });
                alert("Data berhasil diimpor!");
                fetchData();
            } catch(err) { 
                alert("Gagal impor data. Periksa koneksi internet Anda."); 
            } finally { 
                btn.innerText = "Import CSV"; 
            }
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

// Refresh Data Button
document.getElementById('btn-refresh').addEventListener('click', fetchData);

// Utility Rupiah
function formatRp(angka) {
    return 'Rp ' + Number(angka).toLocaleString('id-ID');
}
