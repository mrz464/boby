/* ============================================================
   Dashboard Penjualan — script.js
   Chart.js 4 + Vanilla JS | Data source: data/sales_data.json
   ============================================================ */

'use strict';

// ── Global palette ──────────────────────────────────────────
const PALETTE = [
  '#3b5bdb', '#4dabf7', '#38d9a9', '#ffd43b',
  '#ff6b6b', '#cc5de8', '#f783ac', '#a9e34b',
  '#63e6be', '#ffa94d',
];
const GRID_COLOR = 'rgba(0,0,0,0.05)';
const FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

// Register default font
Chart.defaults.font.family = FONT_FAMILY;
Chart.defaults.font.size   = 12;
Chart.defaults.color       = '#6b7280';

// ── State ────────────────────────────────────────────────────
let allData       = [];
let filteredData  = [];
let chartInstances = {};

// Pagination
const PAGE_SIZE = 10;
let currentPage = 1;

// Month names
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                     'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// ── Utility helpers ──────────────────────────────────────────
const $ = id => document.getElementById(id);

function formatRupiah(n) {
  if (n >= 1e9)  return 'Rp ' + (n / 1e9).toFixed(2)  + ' M';
  if (n >= 1e6)  return 'Rp ' + (n / 1e6).toFixed(1)  + ' jt';
  if (n >= 1e3)  return 'Rp ' + (n / 1e3).toFixed(0)  + ' rb';
  return 'Rp ' + n.toFixed(0);
}

function formatFullRupiah(n) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function revenue(t) {
  return t.qty * t.price * (1 - t.discount);
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    acc[k] = (acc[k] || 0) + revenue(item);
    return acc;
  }, {});
}

function groupBySum(arr, key, valueFn) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    acc[k] = (acc[k] || 0) + valueFn(item);
    return acc;
  }, {});
}

function sortedEntries(obj, desc = true) {
  return Object.entries(obj).sort((a, b) => desc ? b[1] - a[1] : a[1] - b[1]);
}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// ── Loading overlay ──────────────────────────────────────────
function showLoading() {
  const el = document.createElement('div');
  el.id = 'loading-overlay';
  el.innerHTML = `
    <div class="spinner"></div>
    <p class="mt-4 text-sm text-gray-500 font-medium">Memuat data…</p>
  `;
  document.body.appendChild(el);
}
function hideLoading() {
  const el = $('loading-overlay');
  if (el) el.remove();
}

// ── Main entry ───────────────────────────────────────────────
showLoading();
fetch('data/sales_data.json')
  .then(r => {
    if (!r.ok) throw new Error('Failed to fetch sales_data.json');
    return r.json();
  })
  .then(json => {
    allData = json.transactions.map(t => ({
      ...t,
      month: parseInt(t.date.split('-')[1], 10),
    }));
    filteredData = [...allData];
    hideLoading();
    init();
  })
  .catch(err => {
    hideLoading();
    document.querySelector('main').innerHTML =
      `<div class="text-center py-20 text-red-500 font-semibold">
        ⚠️ Gagal memuat data: ${err.message}<br>
        <span class="text-sm text-gray-400">Pastikan file dijalankan dari server lokal (mis. Live Server).</span>
      </div>`;
  });

// ── Init ─────────────────────────────────────────────────────
function init() {
  populateFilters();
  bindFilters();
  $('last-updated').textContent = 'Updated: ' + new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  renderAll();
}

// ── Populate filter dropdowns ────────────────────────────────
function populateFilters() {
  const regions    = [...new Set(allData.map(t => t.region))].sort();
  const categories = [...new Set(allData.map(t => t.category))].sort();
  const channels   = [...new Set(allData.map(t => t.channel))].sort();

  fillSelect('filter-region',   regions);
  fillSelect('filter-category', categories);
  fillSelect('filter-channel',  channels);

  MONTH_NAMES.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.textContent = m;
    $('filter-month').appendChild(opt);
  });
}

function fillSelect(id, values) {
  const sel = $(id);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

// ── Bind filter events ───────────────────────────────────────
function bindFilters() {
  ['filter-region', 'filter-category', 'filter-channel', 'filter-month']
    .forEach(id => $(id).addEventListener('change', applyFilters));
  $('btn-reset').addEventListener('click', () => {
    ['filter-region', 'filter-category', 'filter-channel', 'filter-month']
      .forEach(id => $(id).value = '');
    applyFilters();
  });
}

function applyFilters() {
  const region   = $('filter-region').value;
  const category = $('filter-category').value;
  const channel  = $('filter-channel').value;
  const month    = $('filter-month').value ? parseInt($('filter-month').value) : null;

  filteredData = allData.filter(t =>
    (!region   || t.region   === region)   &&
    (!category || t.category === category) &&
    (!channel  || t.channel  === channel)  &&
    (!month    || t.month    === month)
  );

  currentPage = 1;
  renderAll();
}

// ── Render everything ────────────────────────────────────────
function renderAll() {
  renderKPIs();
  renderSalesTrend();
  renderRevenueRegion();
  renderRevenueCategory();
  renderSalesRep();
  renderCustomerType();
  renderPaymentMethod();
  renderSalesChannel();
  renderScatter();
  renderTop10();
  renderQtyCategory();
  renderTable();
}

// ── KPI Cards ────────────────────────────────────────────────
function renderKPIs() {
  const totalRev  = filteredData.reduce((s, t) => s + revenue(t), 0);
  const totalTrx  = filteredData.length;
  const totalQty  = filteredData.reduce((s, t) => s + t.qty, 0);
  const avgDisc   = filteredData.length
    ? filteredData.reduce((s, t) => s + t.discount, 0) / filteredData.length
    : 0;

  $('kpi-revenue').textContent = formatRupiah(totalRev);
  $('kpi-revenue-sub').textContent = formatFullRupiah(totalRev);

  $('kpi-trx').textContent = totalTrx.toLocaleString('id-ID');
  $('kpi-trx-sub').textContent = `Avg. ${formatRupiah(totalTrx ? totalRev / totalTrx : 0)} / transaksi`;

  $('kpi-qty').textContent = totalQty.toLocaleString('id-ID') + ' unit';
  $('kpi-qty-sub').textContent = `Avg. ${(totalTrx ? totalQty / totalTrx : 0).toFixed(1)} unit / transaksi`;

  $('kpi-disc').textContent = (avgDisc * 100).toFixed(1) + '%';
  $('kpi-disc-sub').textContent = `Total diskon: ${formatRupiah(filteredData.reduce((s,t) => s + t.qty * t.price * t.discount, 0))}`;
}

// ── Sales Trend ──────────────────────────────────────────────
function renderSalesTrend() {
  destroyChart('chart-trend');

  const monthly = {};
  MONTH_NAMES.forEach((_, i) => { monthly[i + 1] = 0; });
  filteredData.forEach(t => { monthly[t.month] = (monthly[t.month] || 0) + revenue(t); });

  const labels = MONTH_NAMES;
  const data   = Object.values(monthly);

  chartInstances['chart-trend'] = new Chart($('chart-trend'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (Rp)',
        data,
        borderColor: PALETTE[0],
        backgroundColor: 'rgba(59,91,219,0.08)',
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: PALETTE[0],
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + formatRupiah(ctx.parsed.y)
          }
        }
      },
      scales: {
        y: {
          grid: { color: GRID_COLOR },
          ticks: {
            callback: v => formatRupiah(v)
          }
        },
        x: { grid: { color: GRID_COLOR } }
      }
    }
  });
}

// ── Revenue per Region ───────────────────────────────────────
function renderRevenueRegion() {
  destroyChart('chart-region');

  const grouped = groupBy(filteredData, 'region');
  const entries = sortedEntries(grouped);
  const labels  = entries.map(e => e[0]);
  const data    = entries.map(e => e[1]);

  chartInstances['chart-region'] = new Chart($('chart-region'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        backgroundColor: PALETTE.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + formatRupiah(ctx.parsed.x) } }
      },
      scales: {
        x: {
          grid: { color: GRID_COLOR },
          ticks: { callback: v => formatRupiah(v) }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

// ── Revenue per Category ─────────────────────────────────────
function renderRevenueCategory() {
  destroyChart('chart-category');

  const grouped = groupBy(filteredData, 'category');
  const entries = sortedEntries(grouped);
  const labels  = entries.map(e => e[0]);
  const data    = entries.map(e => e[1]);

  chartInstances['chart-category'] = new Chart($('chart-category'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        backgroundColor: [PALETTE[0], PALETTE[2], PALETTE[4]],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + formatRupiah(ctx.parsed.y) } }
      },
      scales: {
        y: {
          grid: { color: GRID_COLOR },
          ticks: { callback: v => formatRupiah(v) }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

// ── Sales per Rep ────────────────────────────────────────────
function renderSalesRep() {
  destroyChart('chart-rep');

  const grouped = groupBy(filteredData, 'rep');
  const entries = sortedEntries(grouped);
  const labels  = entries.map(e => e[0]);
  const data    = entries.map(e => e[1]);

  chartInstances['chart-rep'] = new Chart($('chart-rep'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        backgroundColor: PALETTE.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + formatRupiah(ctx.parsed.x) } }
      },
      scales: {
        x: {
          grid: { color: GRID_COLOR },
          ticks: { callback: v => formatRupiah(v) }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

// ── Customer Type Distribution ───────────────────────────────
function renderCustomerType() {
  destroyChart('chart-customer');

  const grouped = groupBy(filteredData, 'customer_type');
  const labels  = Object.keys(grouped);
  const data    = Object.values(grouped);

  chartInstances['chart-customer'] = new Chart($('chart-customer'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [PALETTE[0], PALETTE[2]],
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, font: { size: 12 } }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatRupiah(ctx.raw)}` } }
      }
    }
  });
}

// ── Payment Method ───────────────────────────────────────────
function renderPaymentMethod() {
  destroyChart('chart-payment');

  const grouped = filteredData.reduce((acc, t) => {
    acc[t.payment] = (acc[t.payment] || 0) + 1;
    return acc;
  }, {});

  const labels = Object.keys(grouped);
  const data   = Object.values(grouped);

  chartInstances['chart-payment'] = new Chart($('chart-payment'), {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [PALETTE[1], PALETTE[3], PALETTE[5]],
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} transaksi` } }
      }
    }
  });
}

// ── Sales Channel ─────────────────────────────────────────────
function renderSalesChannel() {
  destroyChart('chart-channel');

  const grouped = filteredData.reduce((acc, t) => {
    acc[t.channel] = (acc[t.channel] || 0) + revenue(t);
    return acc;
  }, {});

  const labels = Object.keys(grouped);
  const data   = Object.values(grouped);

  chartInstances['chart-channel'] = new Chart($('chart-channel'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: [PALETTE[0], PALETTE[6], PALETTE[8]],
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatRupiah(ctx.raw)}` } }
      }
    }
  });
}

// ── Scatter: Discount vs Revenue ─────────────────────────────
function renderScatter() {
  destroyChart('chart-scatter');

  // Group by unique product + discount combo for readability
  const categoryColors = {};
  const categories = [...new Set(filteredData.map(t => t.category))];
  categories.forEach((c, i) => { categoryColors[c] = PALETTE[i % PALETTE.length]; });

  const datasets = categories.map((cat, i) => {
    const points = filteredData
      .filter(t => t.category === cat)
      .map(t => ({ x: +(t.discount * 100).toFixed(1), y: revenue(t) }));
    return {
      label: cat,
      data: points,
      backgroundColor: PALETTE[i % PALETTE.length] + 'bb',
      pointRadius: 6,
      pointHoverRadius: 9,
    };
  });

  chartInstances['chart-scatter'] = new Chart($('chart-scatter'), {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` Diskon: ${ctx.parsed.x}% | Revenue: ${formatRupiah(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Diskon (%)', font: { size: 11 } },
          grid: { color: GRID_COLOR },
          ticks: { callback: v => v + '%' }
        },
        y: {
          title: { display: true, text: 'Revenue', font: { size: 11 } },
          grid: { color: GRID_COLOR },
          ticks: { callback: v => formatRupiah(v) }
        }
      }
    }
  });
}

// ── Top 10 Highest Sales ──────────────────────────────────────
function renderTop10() {
  destroyChart('chart-top10');

  const sorted = [...filteredData]
    .sort((a, b) => revenue(b) - revenue(a))
    .slice(0, 10);

  const labels = sorted.map(t => `${t.id} · ${t.product}`);
  const data   = sorted.map(t => revenue(t));
  const colors = sorted.map((_, i) => i === 0 ? '#f97316' : PALETTE[0] + 'cc');

  chartInstances['chart-top10'] = new Chart($('chart-top10'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        backgroundColor: colors,
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + formatRupiah(ctx.parsed.x) } }
      },
      scales: {
        x: {
          grid: { color: GRID_COLOR },
          ticks: { callback: v => formatRupiah(v) }
        },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

// ── Qty per Category ──────────────────────────────────────────
function renderQtyCategory() {
  destroyChart('chart-qty-category');

  const grouped = groupBySum(filteredData, 'category', t => t.qty);
  const entries = sortedEntries(grouped);
  const labels  = entries.map(e => e[0]);
  const data    = entries.map(e => e[1]);

  chartInstances['chart-qty-category'] = new Chart($('chart-qty-category'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Qty Terjual',
        data,
        backgroundColor: [PALETTE[0], PALETTE[2], PALETTE[4]],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString('id-ID')} unit` } }
      },
      scales: {
        y: {
          grid: { color: GRID_COLOR },
          ticks: { callback: v => v.toLocaleString('id-ID') }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

// ── Data Table ────────────────────────────────────────────────
function renderTable() {
  const total = filteredData.length;
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  currentPage = Math.min(currentPage, pages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = filteredData.slice(start, start + PAGE_SIZE);

  const tbody = $('table-body');
  tbody.innerHTML = '';

  if (slice.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-gray-400">Tidak ada data ditemukan.</td></tr>`;
  } else {
    slice.forEach((t, i) => {
      const rev  = revenue(t);
      const ctBadge = t.customer_type === 'Corporate'
        ? `<span class="badge badge-corporate">Corporate</span>`
        : `<span class="badge badge-retail">Retail</span>`;
      const chBadge = t.channel === 'Online'
        ? `<span class="badge badge-online">Online</span>`
        : t.channel === 'Offline'
          ? `<span class="badge badge-offline">Offline</span>`
          : `<span class="badge badge-reseller">Reseller</span>`;

      const row = document.createElement('tr');
      row.className = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60';
      row.innerHTML = `
        <td class="px-4 py-2.5 font-mono text-xs text-gray-400">${t.id}</td>
        <td class="px-4 py-2.5 text-xs text-gray-600">${t.date}</td>
        <td class="px-4 py-2.5 font-medium text-gray-800 text-xs">${t.product}</td>
        <td class="px-4 py-2.5 text-xs text-gray-500">${t.category}</td>
        <td class="px-4 py-2.5 text-center text-xs">${t.qty}</td>
        <td class="px-4 py-2.5 text-xs text-gray-600">${formatFullRupiah(t.price)}</td>
        <td class="px-4 py-2.5 text-center text-xs ${t.discount > 0.1 ? 'text-red-500 font-semibold' : 'text-gray-500'}">${(t.discount * 100).toFixed(0)}%</td>
        <td class="px-4 py-2.5 text-xs font-semibold text-brand">${formatRupiah(rev)}</td>
        <td class="px-4 py-2.5 text-xs text-gray-500">${t.region}</td>
        <td class="px-4 py-2.5 text-xs text-gray-600">${t.rep}</td>
        <td class="px-4 py-2.5">${ctBadge}</td>
        <td class="px-4 py-2.5">${chBadge}</td>
      `;
      tbody.appendChild(row);
    });
  }

  $('table-info').textContent =
    `Menampilkan ${start + 1}–${Math.min(start + PAGE_SIZE, total)} dari ${total} transaksi`;

  $('btn-prev').disabled = currentPage <= 1;
  $('btn-next').disabled = currentPage >= pages;
}

// ── Table pagination ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('btn-prev').addEventListener('click', () => { currentPage--; renderTable(); });
  $('btn-next').addEventListener('click', () => { currentPage++; renderTable(); });
});
