// Development only (not deployed): with ?grid in the URL on a local host,
// draws the Info page's 12 columns and their gutters over it, built from
// the same tokens as the layout (--grid-max, --grid-margin, --grid-cols,
// --grid-gutter), so it follows them at every breakpoint.
(() => {
  const panel = document.getElementById('info');
  if (!panel) return;

  const style = document.createElement('style');
  style.textContent = `
    .grid-overlay {
      position: sticky;
      top: 0;
      z-index: 2;
      height: 100vh;
      margin-bottom: -100vh;
      pointer-events: none;
    }
    .grid-overlay .wrap,
    .grid-overlay .g12 { height: 100%; }
    .grid-overlay .g12 > span {
      grid-column: auto / span 1;
      background: var(--focus);
      opacity: 0.1;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'grid-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `<div class="wrap"><div class="g12">${'<span></span>'.repeat(12)}</div></div>`;
  panel.prepend(overlay);
})();
