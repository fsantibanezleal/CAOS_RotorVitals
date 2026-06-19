export function toggleTheme(): void {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('rv-theme', next);
  } catch {
    /* ignore */
  }
}
