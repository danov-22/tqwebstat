/* ══════════════════════════════════════════════════════════════════
   TQ Statistics — Main JavaScript  v2
   ══════════════════════════════════════════════════════════════════ */

/* ── Hardcoded Apps Script URL ───────────────────────────────────── */
// ← PASTE YOUR APPS SCRIPT WEB APP URL HERE
const API_URL = 'https://script.google.com/macros/s/AKfycbzO01wWjuYCgiPtdCaO74c7tiyufH7pJAVcorRGaYwOvnP6LrvhFX21Zc30xHnyWg5S/exec';

/* ── Category definitions ────────────────────────────────────────── */
// key   = must match Apps Script colMap
// label = full text shown on the button
// abbr  = short text used ONLY on chart legend lines
// quality: true → shows Full Pitch / Money Part checkboxes
// isQL: true    → special split-panel card with notes
const CATEGORIES = [
  { key: 'ql',  label: 'Qualified Lead',        abbr: 'QL',  color: '#22c55e', isQL: true },
  { key: 'vm',  label: 'Voicemail',             abbr: 'VM',  color: '#8b5cf6' },
  { key: 'snr', label: 'Silence / No Response', abbr: 'SNR', color: '#64748b' },
  { key: 'ooo', label: 'Out of Office',         abbr: 'OOO', color: '#14b8a6', quality: true },
  { key: 'ni',  label: 'Not Interested',        abbr: 'NI',  color: '#f59e0b', quality: true },
  { key: 'hu',  label: 'Hung Up',               abbr: 'HU',  color: '#ef4444', quality: true },
  { key: 'dnc', label: 'Do Not Call',           abbr: 'DNC', color: '#dc2626', quality: true },
  { key: 'lb',  label: 'Language Barrier',      abbr: 'LB',  color: '#06b6d4' },
  { key: 'wn',  label: 'Wrong Number',          abbr: 'WN',  color: '#94a3b8' }
];

/* ── App state ───────────────────────────────────────────────────── */
let scriptUrl         = API_URL;
let currentUser       = null;
let selectedMonth     = '';
let monthlyData       = [];   // [{date, ql, vm, snr, ...}, ...]
let qlNotesByDate     = {};   // {'YYYY-MM-DD': [{leadNumber, note}, ...]}
let selectedDayIndex  = 0;
let chartInstance     = null;
let dailyChartInstance = null;

let todayCounts = Object.fromEntries(CATEGORIES.map(c => [c.key, 0]));
todayCounts.fp  = 0;
todayCounts.mp  = 0;

/* ── DOM refs ────────────────────────────────────────────────────── */
const authPage     = document.getElementById('auth-page');
const appPage      = document.getElementById('app-page');
const authError    = document.getElementById('auth-error');
const banner       = document.getElementById('config-banner');
const monthSelect  = document.getElementById('month-select');
const statsGrid    = document.getElementById('stats-grid');
const modalOverlay = document.getElementById('modal-overlay');
const scriptInput  = document.getElementById('script-url-input');
const toast        = document.getElementById('toast');
const themeBtn     = document.getElementById('btn-theme');

/* ════════════════════════════════════════════════════════════════════
   THEME  (apply before anything renders)
   ════════════════════════════════════════════════════════════════════ */
(function applyTheme() {
  const saved = localStorage.getItem('tq_theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  themeBtn.textContent = saved === 'light' ? '🌙' : '☀️';
})();

themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('tq_theme', next);
  themeBtn.textContent = next === 'light' ? '🌙' : '☀️';
});

/* ════════════════════════════════════════════════════════════════════
   AUTH
   ════════════════════════════════════════════════════════════════════ */
function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const regForm   = document.getElementById('register-form');
  const tabLogin  = document.getElementById('tab-login');
  const tabReg    = document.getElementById('tab-register');
  clearAuthError();
  if (tab === 'login') {
    loginForm.style.display = ''; regForm.style.display = 'none';
    tabLogin.classList.add('active'); tabReg.classList.remove('active');
  } else {
    loginForm.style.display = 'none'; regForm.style.display = '';
    tabReg.classList.add('active'); tabLogin.classList.remove('active');
  }
}

function showAuthError(msg) { authError.textContent = msg; authError.classList.add('visible'); }
function clearAuthError()   { authError.textContent = ''; authError.classList.remove('visible'); }

async function handleLogin(e) {
  e.preventDefault(); clearAuthError();
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const btn      = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const res = await postToScript({ action: 'login', username, password });
    if (res.error) { showAuthError(res.error); return; }
    onLoginSuccess(res.username);
  } catch { showAuthError('Could not reach the Apps Script. Check your URL in script.js.'); }
  finally { btn.disabled = false; btn.textContent = 'Sign In'; }
}

async function handleRegister(e) {
  e.preventDefault(); clearAuthError();
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const confirm  = document.getElementById('reg-pass2').value;
  const btn      = document.getElementById('reg-btn');
  if (password !== confirm) { showAuthError('Passwords do not match.'); return; }
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const res = await postToScript({ action: 'register', username, password });
    if (res.error) { showAuthError(res.error); return; }
    onLoginSuccess(res.username);
  } catch { showAuthError('Could not reach the Apps Script. Check your URL in script.js.'); }
  finally { btn.disabled = false; btn.textContent = 'Create Account'; }
}

function onLoginSuccess(username) {
  currentUser = username;
  localStorage.setItem('tq_user', username);
  authPage.style.display = 'none';
  appPage.classList.add('visible');
  document.getElementById('user-greeting').textContent = 'Welcome, ' + username + '!';
  initApp();
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('tq_user');
  appPage.classList.remove('visible');
  authPage.style.display = '';
  switchTab('login');
  monthlyData    = [];
  qlNotesByDate  = {};
  todayCounts    = Object.fromEntries(CATEGORIES.map(c => [c.key, 0]));
  todayCounts.fp = 0; todayCounts.mp = 0;
  if (chartInstance)      { chartInstance.destroy();      chartInstance      = null; }
  if (dailyChartInstance) { dailyChartInstance.destroy(); dailyChartInstance = null; }
}

document.getElementById('btn-logout').addEventListener('click', doLogout);

/* ── HTTP helpers ────────────────────────────────────────────────── */
async function postToScript(payload) {
  const res = await fetch(scriptUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/* ════════════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════════════ */
function initApp() {
  banner.classList.remove('visible'); // URL is hardcoded, no banner needed

  renderStatButtons();
  buildMonthPicker();
  fetchMonthlyData();

  // Month picker
  monthSelect.addEventListener('change', () => {
    selectedMonth = monthSelect.value;
    fetchMonthlyData();
  });

  // Sync button
  document.getElementById('syncButton').addEventListener('click', async () => {
    const btn = document.getElementById('syncButton');
    btn.disabled = true; btn.textContent = 'Syncing…';
    try { await fetchMonthlyData(); showToast('Synced ✓', 'success'); }
    catch { showToast('Sync failed', 'error'); }
    finally { btn.disabled = false; btn.textContent = '↻ Sync'; }
  });

  // Settings modal (kept so user can still see the URL)
  document.getElementById('btn-settings').addEventListener('click', openModal);
  document.getElementById('btn-save').addEventListener('click', saveSettings);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

  // Daily nav
  document.getElementById('day-prev').addEventListener('click', () => {
    if (selectedDayIndex > 0) { selectedDayIndex--; renderDailyPerformance(); }
  });
  document.getElementById('day-next').addEventListener('click', () => {
    if (selectedDayIndex < monthlyData.length - 1) { selectedDayIndex++; renderDailyPerformance(); }
  });

  // Daily performance hover → trend chart
  const dailyCard      = document.getElementById('daily-perf-card');
  const dailySummary   = document.getElementById('daily-summary');
  const dailyChartWrap = document.getElementById('daily-chart-wrap');

  dailyCard.addEventListener('mouseenter', () => {
    if (!monthlyData.length) return;
    dailySummary.style.opacity = '0.25';
    dailyChartWrap.style.display = 'block';
    renderDailyTrendChart();
  });
  dailyCard.addEventListener('mouseleave', () => {
    dailySummary.style.opacity = '';
    dailyChartWrap.style.display = 'none';
  });
}

function buildMonthPicker() {
  monthSelect.innerHTML = '';
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(); d.setDate(1); d.setMonth(now.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const opt   = document.createElement('option');
    opt.value = value; opt.textContent = label;
    monthSelect.appendChild(opt);
  }
  selectedMonth = monthSelect.value;
}

/* ════════════════════════════════════════════════════════════════════
   STAT BUTTONS
   ════════════════════════════════════════════════════════════════════ */
function renderStatButtons() {
  statsGrid.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const card = document.createElement('div');

    if (cat.isQL) {
      // ── Special full-width QL split-panel card ──────────────────
      card.className  = 'stat-card stat-card-ql';
      card.dataset.key = cat.key;

      card.innerHTML = `
        <div class="ql-card-inner">

          <!-- LEFT: input + button -->
          <div class="ql-panel-left">
            <div class="stat-card-top">
              <span class="stat-label">${cat.label}</span>
              <span class="stat-count" style="color:${cat.color}" data-count="${cat.key}">0</span>
            </div>

            <div class="ql-comment-wrap">
              <div class="ql-comment-label">Note for this lead (optional)</div>
              <textarea
                class="ql-comment-input"
                placeholder="Short note about this lead…"
                rows="3"
                maxlength="280"
              ></textarea>
            </div>

            <div class="stat-actions">
              <button class="btn btn-increment" data-action="inc" data-key="${cat.key}">+ Qualified Lead</button>
              <button class="btn btn-undo"      data-action="dec" data-key="${cat.key}" aria-label="Undo">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- DIVIDER -->
          <div class="ql-panel-divider"></div>

          <!-- RIGHT: notes history for today -->
          <div class="ql-panel-right">
            <div class="ql-notes-header">Today's Notes</div>
            <div class="ql-notes-list" id="ql-notes-today">
              <div class="ql-notes-empty">No notes yet</div>
            </div>
          </div>

        </div>
      `;

    } else {
      // ── Regular stat card ───────────────────────────────────────
      card.className  = 'stat-card';
      card.dataset.key = cat.key;

      const qualityHTML = cat.quality ? `
        <div class="quality-box">
          <label class="quality-item">
            <input type="checkbox" class="quality-fp" />
            <span>Full Pitch</span>
          </label>
          <label class="quality-item">
            <input type="checkbox" class="quality-mp" />
            <span>Money Part</span>
          </label>
        </div>` : '';

      card.innerHTML = `
        <div class="stat-card-top">
          <span class="stat-label">${cat.label}</span>
          <span class="stat-count" style="color:${cat.color}" data-count="${cat.key}">0</span>
        </div>
        ${qualityHTML}
        <div class="stat-actions">
          <button class="btn btn-increment" data-action="inc" data-key="${cat.key}">${cat.label}</button>
          <button class="btn btn-undo"      data-action="dec" data-key="${cat.key}" aria-label="Undo">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
            </svg>
          </button>
        </div>
      `;
    }

    // Button click listeners
    card.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); onStatClick(e); });
    });

    statsGrid.appendChild(card);
  });

  // FP/MP checkbox dependency
  statsGrid.querySelectorAll('.quality-fp').forEach(fp => {
    fp.addEventListener('change', function () {
      const mp = this.closest('.stat-card').querySelector('.quality-mp');
      if (!this.checked) mp.checked = false;
    });
  });
  statsGrid.querySelectorAll('.quality-mp').forEach(mp => {
    mp.addEventListener('change', function () {
      const fp = this.closest('.stat-card').querySelector('.quality-fp');
      if (this.checked) fp.checked = true;
    });
  });
}

/* ── Click handler ───────────────────────────────────────────────── */
async function onStatClick(e) {
  const btn   = e.target.closest('[data-action]');
  if (!btn) return;
  const key   = btn.dataset.key;
  const delta = btn.dataset.action === 'inc' ? 1 : -1;
  await recordStat(key, delta);
}

/* ════════════════════════════════════════════════════════════════════
   RECORD STAT
   ════════════════════════════════════════════════════════════════════ */
async function recordStat(category, delta) {
  if (!currentUser) { showToast('Not logged in', 'error'); return; }

  // 1. Optimistic local update
  todayCounts[category] = Math.max(0, (todayCounts[category] || 0) + delta);

  const card = document.querySelector(`.stat-card[data-key="${category}"]`);
  const cat  = CATEGORIES.find(c => c.key === category);

  let fpDelta = 0, mpDelta = 0;
  let qlNote  = '';

  if (category === 'ql') {
    fpDelta = delta;
    mpDelta = delta;
    if (delta === 1 && card) {
      const ta = card.querySelector('.ql-comment-input');
      if (ta) { qlNote = ta.value.trim(); }
    }
  } else if (cat && cat.quality && card) {
    const fp = card.querySelector('.quality-fp');
    const mp = card.querySelector('.quality-mp');
    if (fp && fp.checked) fpDelta = delta;
    if (mp && mp.checked) mpDelta = delta;
  }

  if (fpDelta) todayCounts.fp = Math.max(0, (todayCounts.fp || 0) + fpDelta);
  if (mpDelta) todayCounts.mp = Math.max(0, (todayCounts.mp || 0) + mpDelta);

  // Optimistically add the note to local state
  let optimisticLeadNum = null;
  if (category === 'ql' && delta === 1) {
    const today = todayISO();
    if (!qlNotesByDate[today]) qlNotesByDate[today] = [];
    optimisticLeadNum = qlNotesByDate[today].length + 1;
    qlNotesByDate[today].push({ leadNumber: optimisticLeadNum, note: qlNote });
    renderQLNotesToday();
  }

  updateStatCounts();
  updateChart();
  updateTotalCalls();
  renderDailyPerformance();

  // 2. Build payload (note: field renamed ql_note in v2)
  const payload = {
    action:    'stat',
    date:      todayISO(),
    username:  currentUser,
    category:  category,
    delta:     delta,
    fp:        fpDelta !== 0,
    mp:        mpDelta !== 0,
    ql_note:   qlNote   // v2 field name
  };

  // 3. Save
  try {
    const result = await postToScript(payload);
    if (result.error) throw new Error(result.error);
    showToast('Saved ✓', 'success');

    // Clear textarea after save
    if (category === 'ql' && delta === 1 && card) {
      const ta = card.querySelector('.ql-comment-input');
      if (ta) ta.value = '';
    }
  } catch (err) {
    // Roll back
    todayCounts[category] = Math.max(0, (todayCounts[category] || 0) - delta);
    if (fpDelta) todayCounts.fp = Math.max(0, (todayCounts.fp || 0) - fpDelta);
    if (mpDelta) todayCounts.mp = Math.max(0, (todayCounts.mp || 0) - mpDelta);
    // Roll back optimistic note
    if (category === 'ql' && delta === 1 && optimisticLeadNum !== null) {
      const today = todayISO();
      if (qlNotesByDate[today]) {
        qlNotesByDate[today] = qlNotesByDate[today].filter(n => n.leadNumber !== optimisticLeadNum);
      }
      renderQLNotesToday();
    }
    updateStatCounts();
    updateChart();
    updateTotalCalls();
    renderDailyPerformance();
    showToast('Save failed — check connection', 'error');
  }
}

/* ════════════════════════════════════════════════════════════════════
   FETCH MONTHLY DATA  (v2: response is {days, ql_notes})
   ════════════════════════════════════════════════════════════════════ */
async function fetchMonthlyData() {
  if (!scriptUrl || !selectedMonth || !currentUser) return;
  showChartState('loading');

  try {
    const url = `${scriptUrl}?action=stats&month=${selectedMonth}&username=${encodeURIComponent(currentUser)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();

    if (json.error) throw new Error(json.error);

    // Handle v2 response shape { days, ql_notes } or legacy array
    const days     = Array.isArray(json) ? json : (json.days    || []);
    const qlNotes  = Array.isArray(json) ? []   : (json.ql_notes || []);

    monthlyData = normalizeMonthlyData(days);

    // Build qlNotesByDate lookup
    qlNotesByDate = {};
    qlNotes.forEach(n => {
      const d = n.date;
      if (!qlNotesByDate[d]) qlNotesByDate[d] = [];
      qlNotesByDate[d].push({ leadNumber: n.leadNumber, note: n.note });
    });
    // Sort each day's notes by lead number
    Object.keys(qlNotesByDate).forEach(d => {
      qlNotesByDate[d].sort((a, b) => a.leadNumber - b.leadNumber);
    });

    // Ensure today's row exists
    const todayStr = todayISO();
    let todayIdx   = monthlyData.findIndex(d => d.date === todayStr);
    if (todayIdx === -1) {
      const emptyRow = { date: todayStr, fp: 0, mp: 0 };
      CATEGORIES.forEach(c => { emptyRow[c.key] = 0; });
      monthlyData.push(emptyRow);
      monthlyData = normalizeMonthlyData(monthlyData);
      todayIdx    = monthlyData.findIndex(d => d.date === todayStr);
    }
    selectedDayIndex = todayIdx;

    // Sync today's counts from sheet
    const todayRow = monthlyData.find(d => d.date === todayStr);
    if (todayRow) {
      CATEGORIES.forEach(c => { todayCounts[c.key] = Number(todayRow[c.key]) || 0; });
      todayCounts.fp = Number(todayRow.fp) || 0;
      todayCounts.mp = Number(todayRow.mp) || 0;
    }

    updateStatCounts();
    updateTotalCalls();
    renderChart(monthlyData);
    renderDailyPerformance();
    renderQLNotesToday();

  } catch (err) {
    showChartState('empty');
    showToast('Failed to load data — check your Apps Script URL', 'error');
  }
}

/* ── Normalise (sort + deduplicate) ─────────────────────────────── */
function normalizeMonthlyData(data) {
  return data.slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce((acc, cur) => {
      if (acc.length && acc[acc.length - 1].date === cur.date) {
        acc[acc.length - 1] = cur;
      } else {
        acc.push(cur);
      }
      return acc;
    }, []);
}

/* ── Optimistic chart update ─────────────────────────────────────── */
function updateChart() {
  const today = todayISO();
  monthlyData = normalizeMonthlyData(monthlyData);
  let row = monthlyData.find(r => r.date === today);
  if (!row) {
    row = { date: today, fp: 0, mp: 0 };
    CATEGORIES.forEach(c => { row[c.key] = 0; });
    monthlyData.push(row);
  }
  row.fp = todayCounts.fp || 0;
  row.mp = todayCounts.mp || 0;
  CATEGORIES.forEach(c => { row[c.key] = todayCounts[c.key] || 0; });
  monthlyData      = normalizeMonthlyData(monthlyData);
  selectedDayIndex = monthlyData.findIndex(d => d.date === today);
  if (selectedDayIndex === -1) selectedDayIndex = monthlyData.length - 1;
  renderChart(monthlyData);
}

/* ════════════════════════════════════════════════════════════════════
   MONTHLY CHART
   ════════════════════════════════════════════════════════════════════ */
function getDailyDials(day) {
  return CATEGORIES.reduce((s, c) => s + (Number(day[c.key]) || 0), 0);
}

function renderChart(data) {
  if (!data || !data.length) { showChartState('empty'); return; }
  showChartState('chart');

  const labels    = data.map(d => new Date(d.date + 'T00:00:00').getDate());
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e2e8f0';

  const datasets = [
    ...CATEGORIES.map(cat => ({
      label:           cat.abbr,   // ← acronym on chart legend only
      data:            data.map(d => Number(d[cat.key]) || 0),
      borderColor:     cat.color,
      backgroundColor: cat.color,
      borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.2
    })),
    {
      label:           'Total',
      data:            data.map(d => getDailyDials(d)),
      borderColor:     textColor,
      backgroundColor: textColor,
      borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.2,
      borderDash: [5, 3]
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
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: '#1a1d27', borderColor: '#2a2d3a', borderWidth: 1, titleColor: '#e2e8f0', bodyColor: '#94a3b8' }
      },
      scales: {
        x: { ticks: { color: '#7c8499', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { beginAtZero: true, ticks: { color: '#7c8499', font: { size: 11 }, precision: 0 }, grid: { color: 'rgba(255,255,255,.04)' } }
      }
    }
  });
}

function showChartState(state) {
  document.getElementById('chart-loading').style.display = state === 'loading' ? 'flex'  : 'none';
  document.getElementById('chart-empty').style.display   = state === 'empty'   ? 'flex'  : 'none';
  document.getElementById('chart-wrap').style.display    = state === 'chart'   ? 'block' : 'none';
}

/* ════════════════════════════════════════════════════════════════════
   DAILY PERFORMANCE  (numbers + QL notes)
   ════════════════════════════════════════════════════════════════════ */
function renderDailyPerformance() {
  if (!monthlyData.length) return;
  const row = monthlyData[selectedDayIndex];

  document.getElementById('daily-date').textContent = formatDate(row.date);
  document.getElementById('daily-fp').textContent   = row.fp  || 0;
  document.getElementById('daily-mp').textContent   = row.mp  || 0;
  document.getElementById('daily-ql').textContent   = row.ql  || 0;

  // QL notes for this day
  const notesList  = qlNotesByDate[row.date] || [];
  const notesEl    = document.getElementById('daily-ql-notes-list');
  const countEl    = document.getElementById('daily-ql-notes-count');
  if (!notesEl) return;

  const total = notesList.length;
  countEl.textContent = total > 0 ? `${total} lead${total > 1 ? 's' : ''}` : '';

  if (total === 0) {
    notesEl.innerHTML = '<div class="ql-notes-empty">No QL notes for this day</div>';
    return;
  }

  notesEl.innerHTML = notesList.map(n => `
    <div class="ql-note-item">
      <span class="ql-note-num">Lead ${n.leadNumber}</span>
      ${n.note ? `<span class="ql-note-text">${escapeHtml(n.note)}</span>` : '<span class="ql-note-text ql-note-no-text">—</span>'}
    </div>
  `).join('');
}

/** Render the right-panel notes list inside the QL card (today only) */
function renderQLNotesToday() {
  const container = document.getElementById('ql-notes-today');
  if (!container) return;

  const notes = qlNotesByDate[todayISO()] || [];
  if (notes.length === 0) {
    container.innerHTML = '<div class="ql-notes-empty">No notes yet</div>';
    return;
  }

  container.innerHTML = [...notes].reverse().map(n => `
    <div class="ql-note-item">
      <span class="ql-note-num">Lead ${n.leadNumber}</span>
      ${n.note ? `<span class="ql-note-text">${escapeHtml(n.note)}</span>` : '<span class="ql-note-text ql-note-no-text">—</span>'}
    </div>
  `).join('');
}

/* ── Hover trend chart (FP/MP/QL for the month) ──────────────────── */
function renderDailyTrendChart() {
  if (!monthlyData.length) return;
  const labels = monthlyData.map(d => new Date(d.date + 'T00:00:00').getDate());
  const fpData = monthlyData.map(d => Number(d.fp)  || 0);
  const mpData = monthlyData.map(d => Number(d.mp)  || 0);
  const qlData = monthlyData.map(d => Number(d.ql)  || 0);

  const ctx = document.getElementById('daily-trend-chart').getContext('2d');
  if (dailyChartInstance) {
    dailyChartInstance.data.labels           = labels;
    dailyChartInstance.data.datasets[0].data = fpData;
    dailyChartInstance.data.datasets[1].data = mpData;
    dailyChartInstance.data.datasets[2].data = qlData;
    dailyChartInstance.update();
    return;
  }
  dailyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'FP', data: fpData, borderColor: '#3b82f6', borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.2, fill: false },
        { label: 'MP', data: mpData, borderColor: '#f59e0b', borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.2, fill: false },
        { label: 'QL', data: qlData, borderColor: '#22c55e', borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.2, fill: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8', boxWidth: 10, font: { size: 10 } } },
        tooltip: { backgroundColor: '#1a1d27', borderColor: '#2a2d3a', borderWidth: 1, titleColor: '#e2e8f0', bodyColor: '#94a3b8' }
      },
      scales: {
        x: { ticks: { color: '#7c8499', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { beginAtZero: true, ticks: { color: '#7c8499', font: { size: 10 }, precision: 0 }, grid: { color: 'rgba(255,255,255,.04)' } }
      }
    }
  });
}

/* ════════════════════════════════════════════════════════════════════
   TOTALS
   ════════════════════════════════════════════════════════════════════ */
function updateStatCounts() {
  CATEGORIES.forEach(c => {
    const el = document.querySelector(`[data-count="${c.key}"]`);
    if (el) el.textContent = todayCounts[c.key] || 0;
  });
}

function updateTotalCalls() {
  const today = todayISO();
  const norm  = normalizeMonthlyData(monthlyData);
  let todayTotal = 0, yesterdayTotal = 0, weekTotal = 0, monthTotal = 0, weekQL = 0, monthQL = 0;

  const tDate = new Date(...today.split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v)));
  tDate.setHours(12);

  norm.forEach(day => {
    const p    = day.date.split('-').map(Number);
    const rDate = new Date(p[0], p[1]-1, p[2], 12);
    const total = CATEGORIES.reduce((s, c) => s + (Number(day[c.key]) || 0), 0);
    const diff  = (tDate - rDate) / 86400000;
    if (diff === 0)          todayTotal     = total;
    if (diff === 1)          yesterdayTotal = total;
    if (diff >= 0 && diff < 7) { weekTotal += total;  weekQL  += Number(day.ql) || 0; }
    monthTotal += total;
    monthQL    += Number(day.ql) || 0;
  });

  if (todayTotal === 0)
    todayTotal = CATEGORIES.reduce((s, c) => s + (todayCounts[c.key] || 0), 0);

  document.getElementById('total-calls').textContent     = todayTotal;
  document.getElementById('yesterday-calls').textContent = yesterdayTotal;
  document.getElementById('week-calls').textContent      = weekTotal;
  document.getElementById('month-calls').textContent     = monthTotal;
  document.getElementById('week-ql').textContent         = weekQL;
  document.getElementById('month-ql').textContent        = monthQL;
}

/* ════════════════════════════════════════════════════════════════════
   SETTINGS MODAL  (shows current hardcoded URL for reference)
   ════════════════════════════════════════════════════════════════════ */
function openModal() {
  scriptInput.value = API_URL;
  modalOverlay.style.display = 'flex';
}
function closeModal()   { modalOverlay.style.display = 'none'; }
function saveSettings() {
  // URL is hardcoded in script.js; the modal is read-only info
  closeModal();
  showToast('URL is hardcoded in script.js — edit that file to change it.', 'info');
}

/* ════════════════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className   = `toast toast-${type} show`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

/* ════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════ */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ════════════════════════════════════════════════════════════════════
   BOOT — resume session if user was previously logged in
   ════════════════════════════════════════════════════════════════════ */
(function boot() {
  const savedUser = localStorage.getItem('tq_user');
  if (savedUser && API_URL && !API_URL.includes('YOUR_SCRIPT_ID')) {
    currentUser = savedUser;
    authPage.style.display = 'none';
    appPage.classList.add('visible');
    document.getElementById('user-greeting').textContent = 'Welcome, ' + savedUser + '!';
    initApp();
  }
})();
