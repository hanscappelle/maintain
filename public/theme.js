const themeToggle = document.querySelector('#theme-toggle');
const themeIcon = themeToggle.querySelector('[aria-hidden="true"]');

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(isDark));
  const label = garageI18n.t(isDark ? 'enableLight' : 'enableDark');
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
  themeIcon.textContent = isDark ? '☀' : '☾';
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#151a17' : '#f6f7f4';
}

setTheme(document.documentElement.dataset.theme);

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  window.localStorage.setItem('garageboek-theme', theme);
});
