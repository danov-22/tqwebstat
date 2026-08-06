/* ─────────────────────────────────────────────────────────────────────────────
   TQ Statistics — script.js
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Config ──────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { key: 'ql',  label: 'Qualified Leads',                color: '#22c55e' },
  { key: 'snr', label: 'Silence/No Response/Voicemail',  color: '#8b5cf6' },
  { key: 'ni',  label: 'Not Interested',                 color: '#f59e0b', quality: 'optional' },
  { key: 'hu',  label: 'Hung Up',                        color: '#ef4444', quality: 'optional' },
  { key: 'dnc', label: 'Do Not Call',                    color: '#dc2626', quality: 'optional' },
  { key: 'ooo', label: 'Out of Office',                  color: '#14b8a6', quality: 'optional' },
  { key: 'lb',  label: 'Language Barrier',               color: '#06b6d4' },
  { key: 'fe',  label: 'Female',                         color: '#64748b' },
  { key: 'wn',  label: 'Wrong Number',                   color: '#94a3b8' }
];

/* ── State ───────────────────────────────────────────────────────────────── */
let scriptUrl     = '';
let selectedMonth = '';
let monthlyData   = [];
let todayCounts   = Object.fromEntries(CATEGORIES.map(c => [c.key, 0]));
todayCounts.fp    = 0;
todayCounts.mp    = 0;
let chartInstance = null;

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const banner       = document.getElementById('config-banner');
const monthSelect  = document.getElementById('month-select');
const chartLoading = document.getElementById('chart-loading');
const chartEmpty   = document.getElementById('chart-empty');
const chartWrap    = document.getElementById('chart-wrap');
const statsGrid    = document.getElementById('stats-grid');
const modalOverlay = document.getElementById('modal-overlay');
const scriptInput  = document.getElementById('script-url-input');
const toast        = document.getElementById('toast');
const themeButton  = document.getElementById('btn-theme');

/* ── Auth: show logged-in user name & logout ─────────────────────────────── */
(function setupAuth() {
  var nameEl = document.getElementById('header-username');
  if (nameEl) {
    nameEl.textContent = localStorage.getItem('tq_user_name') || '';
  }

  document.getElementById('btn-logout').addEventListener('click', function () {
    if (confirm('Log out?')) {
      localStorage.removeItem('tq_token');
      localStorage.removeItem('tq_token_expiry');
      localStorage.removeItem('tq_user_name');
      window.location.href = 'login.html';
    }
  });
})();

/* ── Init ────────────────────────────────────────────────────────────────── */
function getConfiguredScriptUrl() {
  return 'https://script.google.com/macros/s/AKfycbzO01wWjuYCgiPtdCaO74c7tiyufH7pJAVcorRGaYwOvnP6LrvhFX21Zc30xHnyWg5S/exec';
}

(function init() {
  scriptUrl = getConfiguredScriptUrl();

  const savedTheme = localStorage.getItem('tq_theme');
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }

  // Build month picker — last 12 months
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(now.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const opt   = document.createElement('option');
    opt.value       = value;
    opt.textContent = label;
    monthSelect.appendChild(opt);
  }

  selectedMonth = monthSelect.value;

  renderBanner();
  renderStatButtons();
  fetchMonthlyData();

  monthSelect.addEventListener('change', () => {
    selectedMonth = monthSelect.value;
    fetchMonthlyData();
  });

  document.getElementById('btn-settings').addEventListener('click', openModal);
  banner.addEventListener('click', openModal);
  banner.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(); });

  document.getElementById('btn-save').addEventListener('click', saveSettings);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
})();

/* ── Theme toggle ────────────────────────────────────────────────────────── */
themeButton.textContent =
  document.documentElement.dataset.theme === 'light' ? '🌙' : '☀️';

themeButton.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  const next    = current === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('tq_theme', next);
  themeButton.textContent = next === 'light' ? '🌙' : '☀️';
});

/* ── Banner ──────────────────────────────────────────────────────────────── */
function renderBanner() {
  if (scriptUrl.trim()) {
    banner.classList.remove('visible');
  } else {
    banner.classList.add('visible');
  }
}

/* ── Stat buttons ────────────────────────────────────────────────────────── */
function renderStatButtons() {
  statsGrid.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const card = document.createElement('div');
    card.className  = 'stat-card';
    card.dataset.key = cat.key;

    let qualityHTML = '';
    if (cat.quality === 'optional') {
      qualityHTML = `
        <div class="quality-box">
          <label class="quality-item">
            <input type="checkbox" class="quality-fp">
            <span>Full Pitch</span>
          </label>
          <label class="quality-item">
            <input type="checkbox" class="quality-mp">
            <span>Money Part</span>
          </label>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="stat-card-top">
        <span class="stat-label">${cat.label}</span>
        <span class="stat-count" style="color:${cat.color}" data-count="${cat.key}">0</span>
      </div>
      ${qualityHTML}
      <div class="stat-actions">
        <button class="btn btn-increment" data-action="inc" data-key="${cat.key}" ${!scriptUrl ? 'disabled' : ''}>+1</button>
        <button class="btn btn-undo" data-action="dec" data-key="${cat.key}" ${!scriptUrl ? 'disabled' : ''} aria-label="Undo">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 14 4 9l5-5"/>
            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>
          </svg>
        </button>
      </div>
    `;

    card.querySelectorAll('button[data-action]').forEach(button => {
      button.addEventListener('click', e => {
        e.stopPropagation();
        onStatClick(e);
      });
    });

    statsGrid.appendChild(card);
  });

  // ── Notebook button ───────────────────────────────────────────────────────
  const notebookCard       = document.createElement('div');
  notebookCard.className   = 'stat-card';
  notebookCard.innerHTML   = `
    <div class="stat-card-top">
      <span class="stat-label">Notebook</span>
    </div>
    <div class="stat-actions">
      <button class="btn btn-guide" onclick="openNotebook()">📖 Open</button>
    </div>
  `;
  statsGrid.appendChild(notebookCard);

  // Full Pitch / Money Part checkbox logic
  statsGrid.querySelectorAll('.quality-fp').forEach(fp => {
    fp.addEventListener('change', function () {
      const card = this.closest('.stat-card');
      const mp   = card.querySelector('.quality-mp');
      if (!this.checked) mp.checked = false;
    });
  });

  statsGrid.querySelectorAll('.quality-mp').forEach(mp => {
    mp.addEventListener('change', function () {
      const card = this.closest('.stat-card');
      const fp   = card.querySelector('.quality-fp');
      if (this.checked) fp.checked = true;
    });
  });
}

function openNotebook() {
  window.open(
    'https://docs.google.com/document/d/1WNxL3NBivYohkba4YVsNwYrqBvfKIy-OVJ-_73U-KJU/edit',
    '_blank'
  );
}

/* ── Click handler ───────────────────────────────────────────────────────── */
async function onStatClick(e) {
  const btn   = e.target.closest('[data-action]');
  if (!btn) return;
  const key   = btn.dataset.key;
  const delta = btn.dataset.action === 'inc' ? 1 : -1;
  await recordStat(key, delta, btn);
}

/* ── Fetch monthly data ──────────────────────────────────────────────────── */
async function fetchMonthlyData() {
  if (!scriptUrl || !selectedMonth) return;

  showChartState('loading');

  try {
    const res  = await fetch(`${scriptUrl}?month=${selectedMonth}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    monthlyData = data;

    monthlyData     = normalizeMonthlyData(monthlyData);
    selectedDayIndex = monthlyData.findIndex(d => d.date === todayISO());

    if (selectedDayIndex === -1) {
      monthlyData.push({ date: todayISO(), fp: 0, mp: 0, ql: 0 });
      CATEGORIES.forEach(cat => {
        monthlyData[monthlyData.length - 1][cat.key] = 0;
      });
      selectedDayIndex = monthlyData.length - 1;
    }

    const today    = todayISO();
    const todayRow = monthlyData.find(d => d.date === today);
    if (todayRow) {
      CATEGORIES.forEach(c => { todayCounts[c.key] = Number(todayRow[c.key]) || 0; });
      todayCounts.fp = Number(todayRow.fp) || 0;
      todayCounts.mp = Number(todayRow.mp) || 0;
    } else {
      CATEGORIES.forEach(c => { todayCounts[c.key] = 0; });
      todayCounts.fp = 0;
      todayCounts.mp = 0;
    }

    updateStatCounts();
    updateTotalCalls();
    renderChart(monthlyData);
    renderDailyPerformance();

  } catch (err) {
    showChartState('empty');
    showToast('Failed to fetch data. Check your script URL.', 'error');
  }
}

/* ── Sync button ─────────────────────────────────────────────────────────── */
document.getElementById('syncButton').addEventListener('click', async () => {
  const btn       = document.getElementById('syncButton');
  btn.disabled    = true;
  btn.textContent = 'Syncing...';

  try {
    await fetchMonthlyData();
    showToast('Synced ✓', 'success');
  } catch (err) {
    showToast('Sync failed', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '↻ Sync';
  }
});

/* ── Record stat ─────────────────────────────────────────────────────────── */
async function recordStat(category, delta, button = null) {
  if (!scriptUrl) {
    showToast('Apps Script URL missing', 'error');
    return;
  }

  todayCounts[category] = Math.max(0, (todayCounts[category] || 0) + delta);

  const payload = {
  username: localStorage.getItem("username"),
  date: todayISO(),
  category,
  delta
  };
  console.log(payload);
  let fpDelta = 0;
  let mpDelta = 0;

  if (category === 'ql') {
    payload.fp = true;
    payload.mp = true;
    fpDelta    = delta;
    mpDelta    = delta;
  } else if (['ni', 'hu', 'dnc', 'ooo'].includes(category)) {
    const card = document.querySelector(`.stat-card[data-key="${category}"]`);
    payload.fp = card.querySelector('.quality-fp').checked;
    payload.mp = card.querySelector('.quality-mp').checked;
    if (payload.fp) fpDelta = delta;
    if (payload.mp) mpDelta = delta;
  }

  if (fpDelta) todayCounts.fp = Math.max(0, (todayCounts.fp || 0) + fpDelta);
  if (mpDelta) todayCounts.mp = Math.max(0, (todayCounts.mp || 0) + mpDelta);

  updateStatCounts();
  updateChart();
  updateTotalCalls();
  renderDailyPerformance();

  try {
    const res    = await fetch(scriptUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    showToast('Saved ✓', 'success');
  } catch (error) {
    todayCounts[category] = Math.max(0, todayCounts[category] - delta);
    if (payload.fp) todayCounts.fp = Math.max(0, (todayCounts.fp || 0) - delta);
    if (payload.mp) todayCounts.mp = Math.max(0, (todayCounts.mp || 0) - delta);
    updateStatCounts();
    updateChart();
    updateTotalCalls();
    renderDailyPerformance();
    showToast('Save failed', 'error');
  }
}

/* ── Chart helpers ───────────────────────────────────────────────────────── */
function normalizeMonthlyData(data) {
  return data
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce((deduped, current) => {
      if (deduped.length && deduped[deduped.length - 1].date === current.date) {
        deduped[deduped.length - 1] = current;
      } else {
        deduped.push(current);
      }
      return deduped;
    }, []);
}

function updateChart() {
  const today = todayISO();
  monthlyData = normalizeMonthlyData(monthlyData);
  let row     = monthlyData.find(r => r.date === today);
  if (!row) {
    row = { date: today, fp: 0, mp: 0 };
    CATEGORIES.forEach(cat => { row[cat.key] = 0; });
    monthlyData.push(row);
  }
  row.fp = todayCounts.fp || 0;
  row.mp = todayCounts.mp || 0;
  CATEGORIES.forEach(cat => { row[cat.key] = todayCounts[cat.key] || 0; });
  monthlyData      = normalizeMonthlyData(monthlyData);
  selectedDayIndex = monthlyData.findIndex(d => d.date === today);
  if (selectedDayIndex === -1) selectedDayIndex = monthlyData.length - 1;
  renderChart(monthlyData);
}

function getDailyDials(day) {
  return CATEGORIES.reduce((sum, cat) => sum + (Number(day[cat.key]) || 0), 0);
}

function renderChart(data) {
  if (!data || data.length === 0) {
    showChartState('empty');
    return;
  }
  showChartState('chart');

  const labels   = data.map(d => new Date(d.date + 'T00:00:00').getDate());
  const datasets = [
    ...CATEGORIES.map(cat => ({
      label:           cat.label,
      data:            data.map(d => Number(d[cat.key]) || 0),
      borderColor:     cat.color,
      backgroundColor: cat.color,
      borderWidth:     2,
      pointRadius:     3,
      pointHoverRadius: 5,
      tension:         0.1,
    })),
    {
      label:           'Daily Dials',
      data:            data.map(day => getDailyDials(day)),
      borderColor:     getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#ffffff',
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#ffffff',
      borderWidth:     2,
      pointRadius:     3,
      pointHoverRadius: 5,
      tension:         0.1,
    }
  ];

  const ctx = document.getElementById('monthly-chart').getContext('2d');
  if (chartInstance) {
    chartInstance.data.labels   = labels;
    chartInstance.data.datasets = datasets;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', boxWidth: 12, font: { size: 12 } },
        },
        tooltip: {
          backgroundColor: '#1a1d27',
          borderColor:     '#2a2d3a',
          borderWidth:     1,
          titleColor:      '#e2e8f0',
          bodyColor:       '#94a3b8',
        },
      },
      scales: {
        x: {
          ticks: { color: '#7c8499', font: { size: 11 } },
          grid:  { color: 'rgba(255,255,255,.05)' },
        },
        y: {
          beginAtZero: true,
          ticks:       { color: '#7c8499', font: { size: 11 }, precision: 0 },
          grid:        { color: 'rgba(255,255,255,.05)' },
        },
      },
    },
  });
}

function showChartState(state) {
  chartLoading.style.display = state === 'loading' ? 'flex'  : 'none';
  chartEmpty.style.display   = state === 'empty'   ? 'flex'  : 'none';
  chartWrap.style.display    = state === 'chart'   ? 'block' : 'none';
}

/* ── Daily Performance ───────────────────────────────────────────────────── */
let selectedDayIndex = 0;

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderDailyPerformance() {
  if (!monthlyData.length) return;
  const row = monthlyData[selectedDayIndex];
  document.getElementById('daily-date').textContent = formatDate(row.date);
  document.getElementById('daily-ql').textContent   = row.ql || 0;
  document.getElementById('daily-fp').textContent   = row.fp || 0;
  document.getElementById('daily-mp').textContent   = row.mp || 0;
}

document.getElementById('day-prev').addEventListener('click', () => {
  if (selectedDayIndex > 0) {
    selectedDayIndex--;
    renderDailyPerformance();
  }
});

document.getElementById('day-next').addEventListener('click', () => {
  if (selectedDayIndex < monthlyData.length - 1) {
    selectedDayIndex++;
    renderDailyPerformance();
  }
});

/* ── Settings modal ──────────────────────────────────────────────────────── */
function openModal() {
  scriptInput.value = localStorage.getItem('tq_script_url') || '';
  modalOverlay.style.display = 'flex';
  setTimeout(() => scriptInput.focus(), 50);
}

function closeModal() {
  modalOverlay.style.display = 'none';
}

function saveSettings() {
  const url = scriptInput.value.trim();
  localStorage.setItem('tq_script_url', url);
  scriptUrl = url;
  closeModal();
  renderBanner();
  setButtonsDisabled(!scriptUrl);
  if (scriptUrl) fetchMonthlyData();
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
let toastTimer = null;
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className   = `toast toast-${type} show`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2000);
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateStatCounts() {
  CATEGORIES.forEach(cat => {
    const el = document.querySelector(`[data-count="${cat.key}"]`);
    if (el) el.textContent = todayCounts[cat.key] || 0;
  });
}

function updateTotalCalls() {
  const today    = todayISO();
  const todayRow = monthlyData.find(d => d.date === today);
  const todayTotal = todayRow
    ? CATEGORIES.reduce((sum, cat) => sum + (Number(todayRow[cat.key]) || 0), 0)
    : CATEGORIES.reduce((sum, cat) => sum + (Number(todayCounts[cat.key]) || 0), 0);

  document.getElementById('total-calls').textContent = todayTotal;

  let yesterdayTotal = 0, weekTotal = 0, monthTotal = 0, weekQL = 0, monthQL = 0;
  const [ty, tm, td] = today.split('-').map(Number);
  const todayDate    = new Date(ty, tm - 1, td, 12);
  const normalizedData = normalizeMonthlyData(monthlyData);

  normalizedData.forEach(day => {
    const [y, m, dayNum] = day.date.split('-').map(Number);
    const rowDate  = new Date(y, m - 1, dayNum, 12);
    const total    = CATEGORIES.reduce((sum, c) => sum + (Number(day[c.key]) || 0), 0);
    const diff     = (todayDate - rowDate) / 86400000;

    if (diff === 1) yesterdayTotal = total;
    monthTotal += total;
    if (diff >= 0 && diff < 7) weekTotal += total;
    monthQL += Number(day.ql) || 0;
    if (diff >= 0 && diff < 7) weekQL += Number(day.ql) || 0;
  });

  document.getElementById('yesterday-calls').textContent = yesterdayTotal;
  document.getElementById('week-calls').textContent      = weekTotal;
  document.getElementById('month-calls').textContent     = monthTotal;
  document.getElementById('week-ql').textContent         = weekQL;
  document.getElementById('month-ql').textContent        = monthQL;
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll('.btn-increment, .btn-undo').forEach(btn => {
    btn.disabled = disabled;
  });
}
