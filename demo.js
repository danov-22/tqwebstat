const root = document.documentElement;
const pageThemeButton = document.getElementById('demo-theme-toggle');
const app = document.querySelector('.tq-demo-app');
const appThemeButton = document.querySelector('[data-app-theme]');

function setTheme(theme) {
  root.dataset.demoTheme = theme;
  app?.classList.toggle('app-light', theme === 'light');
  const icon = theme === 'dark' ? '\u2600' : '\u263e';
  if (pageThemeButton) pageThemeButton.textContent = icon;
  if (appThemeButton) appThemeButton.textContent = icon;
  localStorage.setItem('webstat_demo_theme', theme);
}

setTheme(localStorage.getItem('webstat_demo_theme') || 'dark');
[pageThemeButton, appThemeButton].forEach(button => button?.addEventListener('click', () => {
  setTheme(root.dataset.demoTheme === 'dark' ? 'light' : 'dark');
}));

document.querySelectorAll('[data-demo-page]').forEach(button => button.addEventListener('click', () => {
  const page = button.dataset.demoPage;
  document.querySelectorAll('[data-demo-page]').forEach(item => item.classList.toggle('active', item.dataset.demoPage === page));
  document.querySelectorAll('[data-demo-view]').forEach(view => {
    const active = view.dataset.demoView === page;
    view.hidden = !active;
    view.classList.toggle('active', active);
  });
}));

document.querySelector('.tq-notice > button')?.addEventListener('click', event => {
  event.currentTarget.closest('.tq-notice').remove();
});

let selectedSeries = null;
document.querySelectorAll('[data-series-button]').forEach(button => button.addEventListener('click', () => {
  selectedSeries = selectedSeries === button.dataset.seriesButton ? null : button.dataset.seriesButton;
  document.querySelectorAll('[data-series-button]').forEach(item => item.classList.toggle('active', item.dataset.seriesButton === selectedSeries));
  document.querySelectorAll('.tq-chart [data-series]').forEach(line => line.classList.toggle('muted', selectedSeries && line.dataset.series !== selectedSeries));
}));

document.getElementById('demo-sync')?.addEventListener('click', event => {
  const button = event.currentTarget;
  button.textContent = 'Synced';
  setTimeout(() => { button.innerHTML = '&#8635; Sync'; }, 1200);
});

const fictionalDays = [
  ['Monday, September 1', 11, 4, 5],
  ['Tuesday, September 2', 14, 6, 7],
  ['Wednesday, September 3', 16, 7, 8]
];
let dayIndex = 1;
document.querySelectorAll('[data-day-step]').forEach(button => button.addEventListener('click', () => {
  dayIndex = Math.max(0, Math.min(fictionalDays.length - 1, dayIndex + Number(button.dataset.dayStep)));
  const [label, fp, mp, ql] = fictionalDays[dayIndex];
  document.getElementById('demo-day').textContent = label;
  const values = document.querySelectorAll('.tq-daily-numbers strong');
  values[0].textContent = fp;
  values[1].textContent = mp;
  values[2].textContent = ql;
}));

function changeCount(code, amount) {
  const target = document.querySelector(`[data-count="${code}"]`);
  if (!target) return;
  target.textContent = Math.max(0, Number(target.textContent) + amount);
  if (code === 'QL') document.getElementById('demo-ql-total').textContent = target.textContent;
}

document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => {
  const code = button.dataset.add;
  changeCount(code, 1);
  if (code === 'QL') {
    const input = document.getElementById('demo-ql-note');
    const note = input.value.trim() || 'Qualified lead recorded in the interactive demo.';
    const item = document.createElement('li');
    item.innerHTML = `<b>Now</b><span></span>`;
    item.querySelector('span').textContent = note;
    document.getElementById('demo-note-list').prepend(item);
    document.getElementById('demo-note-count').textContent = `${document.getElementById('demo-note-list').children.length} leads`;
    input.value = '';
  }
}));
document.querySelectorAll('[data-undo]').forEach(button => button.addEventListener('click', () => changeCount(button.dataset.undo, -1)));

const eyeButton = document.getElementById('demo-eye-break');
const eyeBall = document.getElementById('demo-eye-ball');
eyeButton?.addEventListener('mouseenter', () => eyeBall?.classList.add('active'));
eyeButton?.addEventListener('click', () => eyeBall?.classList.toggle('active'));
eyeBall?.addEventListener('pointerenter', () => {
  eyeBall.style.animationDelay = `${Math.random() * -5}s`;
});

document.querySelector('.tq-signout')?.addEventListener('click', event => {
  event.currentTarget.textContent = 'Demo only';
  setTimeout(() => { event.currentTarget.textContent = 'Sign Out'; }, 1200);
});

const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  }), { threshold: .1 });
  reveals.forEach(element => observer.observe(element));
} else {
  reveals.forEach(element => element.classList.add('visible'));
}
