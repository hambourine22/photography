/* ─────────────────────────────────────────────────────────────
 * editor.js — floating editing GUI for the replica.
 *
 * Capabilities
 *   • Toggle contenteditable on headings / paragraphs / nav labels
 *   • Replace any image (click-to-pick or drag-and-drop), with
 *     client-side resize via canvas and storage in IndexedDB
 *   • Live colour pickers bound to CSS variables + 5 preset palettes
 *   • WCAG AA contrast warning (bg vs text)
 *   • Box-model inspector with per-element outline + breakpoint label
 *   • Viewport preview (375 / 768 / 1280) via framed iframe
 *   • Export the current state as a standalone export.html
 *
 * All interactive controls are keyboard accessible, with visible
 * focus states and ARIA labels. The toolbar lives in a fixed root
 * at z-index 10000 so it never alters the page layout underneath.
 * ───────────────────────────────────────────────────────────── */

// ───── IndexedDB helpers ──────────────────────────────────────
// Keys renamed for тисяча so edits made to the old placeholder copy don't
// restore over the new content.
const DB_NAME = 'tysyacha-site';
const DB_STORE = 'images';
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function putImage(key, dataUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(dataUrl, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function getImage(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function deleteImage(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function allImages() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const out = {};
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).openCursor();
    req.onsuccess = e => {
      const cur = e.target.result;
      if (!cur) return resolve(out);
      out[cur.key] = cur.value;
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

// ───── State ──────────────────────────────────────────────────
const LS_COPY = 'tysyacha-copy';
const LS_COLOR = 'tysyacha-color';
// 1000 palette: pink-300, ink, blue-600, cream-200 (see styles.css tokens).
const DEFAULT_COLORS = {
  '--bg':      '#f3b6c8',
  '--text':    '#191919',
  '--accent':  '#276988',
  '--surface': '#f3e2b6',
  '--border':  '#191919',
};
const PRESETS = {
  Default:        DEFAULT_COLORS,
  'Replica red':  { '--bg':'#910d0d', '--text':'#000000', '--accent':'#910d0d', '--surface':'#eacbb4', '--border':'#ffffff' },
  Light:          { '--bg':'#f5f1ea', '--text':'#111111', '--accent':'#9c2a2a', '--surface':'#ffffff', '--border':'#d8cfbe' },
  Dark:           { '--bg':'#0f0f10', '--text':'#f3f3f3', '--accent':'#e8b4b4', '--surface':'#1b1b1d', '--border':'#2a2a2d' },
  Warm:           { '--bg':'#b4502c', '--text':'#2a1a10', '--accent':'#2a1a10', '--surface':'#f3dcc1', '--border':'#8a3a1b' },
  Mono:           { '--bg':'#1a1a1a', '--text':'#ededed', '--accent':'#9b9b9b', '--surface':'#2c2c2c', '--border':'#3a3a3a' },
  'High contrast':{ '--bg':'#000000', '--text':'#ffffff', '--accent':'#ffd400', '--surface':'#1a1a1a', '--border':'#ffffff' },
};

// ───── Utilities ──────────────────────────────────────────────
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function hexToRgb(hex) {
  const h = hex.replace('#','').trim();
  const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  const n = parseInt(full, 16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function luminance({ r,g,b }) {
  const [R,G,B] = [r,g,b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  });
  return 0.2126*R + 0.7152*G + 0.0722*B;
}
function contrast(a, b) {
  const L1 = luminance(hexToRgb(a));
  const L2 = luminance(hexToRgb(b));
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

async function resizeImage(file, maxWidth = 1600, maxBytes = 1_200_000) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  let quality = 0.88;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > maxBytes && quality > 0.4) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

// ───── Editor module ──────────────────────────────────────────
class Editor {
  constructor() {
    this.editOn = false;
    this.inspectOn = false;
    this.previewOn = false;
    this.colors = { ...DEFAULT_COLORS };
    this.root = null;
    this.panels = {};
    this.breakpointEl = null;
  }

  async init() {
    this.loadColors();
    this.annotateEditables();
    await this.restoreImages();
    this.restoreCopy();
    this.render();
    this.wireKeyboard();
    this.wireBreakpointLabel();
  }

  /* ─── Restoration ─── */
  loadColors() {
    const saved = JSON.parse(localStorage.getItem(LS_COLOR) || 'null');
    this.colors = saved ? { ...DEFAULT_COLORS, ...saved } : { ...DEFAULT_COLORS };
    this.applyColors();
  }
  applyColors() {
    for (const [k, v] of Object.entries(this.colors)) {
      document.documentElement.style.setProperty(k, v);
    }
  }
  async restoreImages() {
    const stored = await allImages();
    for (const [key, dataUrl] of Object.entries(stored)) {
      const img = $(`[data-image-key="${key}"] img`);
      if (img) img.src = dataUrl;
    }
  }
  restoreCopy() {
    const saved = JSON.parse(localStorage.getItem(LS_COPY) || '{}');
    for (const [id, html] of Object.entries(saved)) {
      const el = $(`[data-copy-id="${id}"]`);
      if (el) el.innerHTML = html;
    }
  }

  /* ─── Annotations ─── */
  annotateEditables() {
    const copySelectors = [
      '.enter-text', '.nav-link', '.project-title-copy',
      '#info-heading', '.info-panel h3', '.info-panel p',
    ];
    copySelectors.forEach((sel, idx) => {
      $$(sel).forEach((el, j) => {
        el.setAttribute('data-editable', 'copy');
        el.setAttribute('data-copy-id', `${sel.replace(/[^a-z0-9]/gi,'_')}_${idx}_${j}`);
      });
    });
    $$('.image-container').forEach((el, i) => {
      el.setAttribute('data-image-key', `img-${i}`);
      const drop = document.createElement('div');
      drop.className = 'editor-dropzone';
      drop.textContent = 'Drop image to replace';
      el.appendChild(drop);
      const ui = document.createElement('div');
      ui.className = 'editor-image-ui';
      ui.innerHTML = `
        <button type="button" class="editor-btn" data-img-replace aria-label="Replace image">Replace</button>
        <button type="button" class="editor-btn" data-img-reset aria-label="Reset image">Reset</button>`;
      el.appendChild(ui);
    });
  }

  /* ─── Render the toolbar + panels ─── */
  render() {
    const root = document.createElement('div');
    root.className = 'editor-root';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Editing toolbar');
    root.innerHTML = `
      <div class="editor-panel" id="panel-colors" role="dialog" aria-label="Colour palette" hidden>
        <h3>Palette</h3>
        <div class="editor-row">
          <label for="c-bg">Background</label>
          <input type="color" id="c-bg" data-var="--bg">
          <span class="editor-swatch" id="s-bg"></span>
        </div>
        <div class="editor-row">
          <label for="c-text">Text</label>
          <input type="color" id="c-text" data-var="--text">
          <span class="editor-swatch" id="s-text"></span>
        </div>
        <div class="editor-row">
          <label for="c-accent">Accent</label>
          <input type="color" id="c-accent" data-var="--accent">
          <span class="editor-swatch" id="s-accent"></span>
        </div>
        <div class="editor-row">
          <label for="c-surface">Surface</label>
          <input type="color" id="c-surface" data-var="--surface">
          <span class="editor-swatch" id="s-surface"></span>
        </div>
        <div class="editor-row">
          <label for="c-border">Border</label>
          <input type="color" id="c-border" data-var="--border">
          <span class="editor-swatch" id="s-border"></span>
        </div>
        <h3 style="margin-top:12px">Presets</h3>
        <div class="editor-presets" id="presets"></div>
        <button type="button" class="editor-btn" id="colors-reset">Reset to default</button>
        <div class="editor-warning" id="contrast-warning" role="status" hidden></div>
      </div>

      <div class="editor-panel" id="panel-preview" role="dialog" aria-label="Viewport preview" hidden>
        <h3>Viewport preview</h3>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="editor-btn" data-vw="375">375 px</button>
          <button type="button" class="editor-btn" data-vw="768">768 px</button>
          <button type="button" class="editor-btn" data-vw="1280">1280 px</button>
          <button type="button" class="editor-btn" data-vw="off">Off</button>
        </div>
      </div>

      <div class="editor-toolbar" role="toolbar" aria-label="Editor controls">
        <button type="button" class="editor-btn" id="btn-edit" aria-pressed="false" aria-label="Toggle edit mode">✎ Edit</button>
        <button type="button" class="editor-btn" id="btn-colors" aria-expanded="false" aria-controls="panel-colors" aria-label="Colour palette">◉ Colours</button>
        <button type="button" class="editor-btn" id="btn-inspect" aria-pressed="false" aria-label="Toggle box-model inspector">▦ Inspect</button>
        <button type="button" class="editor-btn" id="btn-preview" aria-expanded="false" aria-controls="panel-preview" aria-label="Viewport preview">▭ Preview</button>
        <button type="button" class="editor-btn" id="btn-export" aria-label="Export page as HTML">⬇ Export</button>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.panels.colors = $('#panel-colors', root);
    this.panels.preview = $('#panel-preview', root);
    this.wireControls();
    this.renderColorInputs();
    this.renderPresets();
    this.updateContrastWarning();
  }

  renderColorInputs() {
    for (const [k, v] of Object.entries(this.colors)) {
      const input = $(`input[data-var="${k}"]`, this.root);
      const swatch = $(`#s-${k.replace('--','')}`, this.root);
      if (input) input.value = v;
      if (swatch) swatch.style.background = v;
    }
  }
  renderPresets() {
    const container = $('#presets', this.root);
    container.innerHTML = '';
    for (const name of Object.keys(PRESETS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'editor-preset';
      b.textContent = name;
      b.setAttribute('aria-label', `Apply ${name} palette`);
      b.addEventListener('click', () => this.applyPreset(name));
      container.appendChild(b);
    }
  }
  applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    this.colors = { ...this.colors, ...p };
    this.applyColors();
    this.renderColorInputs();
    this.persistColors();
    this.updateContrastWarning();
  }
  updateContrastWarning() {
    const el = $('#contrast-warning', this.root);
    const bg = this.colors['--surface'];
    const fg = this.colors['--text'];
    const ratio = contrast(bg, fg);
    if (ratio < 4.5) {
      el.hidden = false;
      el.textContent = `Low contrast: ${ratio.toFixed(2)}:1 between text and surface (WCAG AA needs ≥ 4.5:1).`;
    } else {
      el.hidden = true;
    }
  }

  /* ─── Wiring ─── */
  wireControls() {
    $('#btn-edit', this.root).addEventListener('click', () => this.toggleEdit());
    $('#btn-colors', this.root).addEventListener('click', () => this.togglePanel('colors'));
    $('#btn-inspect', this.root).addEventListener('click', () => this.toggleInspect());
    $('#btn-preview', this.root).addEventListener('click', () => this.togglePanel('preview'));
    $('#btn-export', this.root).addEventListener('click', () => this.exportHTML());
    $('#colors-reset', this.root).addEventListener('click', () => this.applyPreset('Default'));

    $$('input[type="color"]', this.root).forEach(input => {
      input.addEventListener('input', e => {
        const varName = input.dataset.var;
        this.colors[varName] = e.target.value;
        document.documentElement.style.setProperty(varName, e.target.value);
        const swatch = $(`#s-${varName.replace('--','')}`, this.root);
        if (swatch) swatch.style.background = e.target.value;
        this.persistColors();
        this.updateContrastWarning();
      });
    });

    $$('[data-vw]', this.root).forEach(b =>
      b.addEventListener('click', () => this.setPreview(b.dataset.vw))
    );

    // Copy edits — autosave on input
    document.addEventListener('input', e => {
      const el = e.target.closest('[data-editable="copy"]');
      if (!el || !this.editOn) return;
      this.persistCopy(el);
    });

    // Image replace controls
    document.addEventListener('click', e => {
      const r = e.target.closest('[data-img-replace]');
      if (r) { e.stopPropagation(); return this.pickImage(r.closest('.image-container')); }
      const rs = e.target.closest('[data-img-reset]');
      if (rs) { e.stopPropagation(); return this.resetImage(rs.closest('.image-container')); }
      // In edit mode, clicking the image also opens picker
      if (this.editOn) {
        const container = e.target.closest('.image-container');
        if (container && !e.target.closest('.editor-image-ui')) {
          e.stopPropagation();
          this.pickImage(container);
        }
      }
    });

    // Drag-and-drop onto any image container
    $$('.image-container').forEach(c => {
      c.addEventListener('dragenter', e => { e.preventDefault(); c.classList.add('dragover'); });
      c.addEventListener('dragover',  e => { e.preventDefault(); c.classList.add('dragover'); });
      c.addEventListener('dragleave', () => c.classList.remove('dragover'));
      c.addEventListener('drop', async e => {
        e.preventDefault();
        c.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) await this.replaceImage(c, file);
      });
    });
  }

  wireKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.key.toLowerCase() === 'e' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.toggleEdit();
      }
      if (e.key === 'Escape') {
        if (this.previewOn) this.setPreview('off');
        if (this.inspectOn) this.toggleInspect();
        Object.values(this.panels).forEach(p => (p.hidden = true));
      }
    });
  }

  wireBreakpointLabel() {
    const label = document.createElement('div');
    label.className = 'editor-breakpoint-label';
    label.hidden = true;
    document.body.appendChild(label);
    this.breakpointEl = label;
    const update = () => {
      const w = window.innerWidth;
      let name = 'desktop (≥ 992)';
      if (w <= 479) name = 'mobile-s (≤ 479)';
      else if (w <= 767) name = 'mobile-l (≤ 767)';
      else if (w <= 991) name = 'tablet (≤ 991)';
      label.textContent = `${w}px — ${name}`;
    };
    update();
    window.addEventListener('resize', update);
  }

  /* ─── Toggles ─── */
  toggleEdit() {
    this.editOn = !this.editOn;
    document.body.classList.toggle('editor-on', this.editOn);
    $$('[data-editable="copy"]').forEach(el => {
      el.contentEditable = this.editOn ? 'true' : 'false';
      if (this.editOn) el.setAttribute('spellcheck', 'true');
    });
    const btn = $('#btn-edit', this.root);
    btn.setAttribute('aria-pressed', String(this.editOn));
    btn.textContent = this.editOn ? '✎ Editing' : '✎ Edit';
  }
  toggleInspect() {
    this.inspectOn = !this.inspectOn;
    document.body.classList.toggle('inspect-on', this.inspectOn);
    this.breakpointEl.hidden = !this.inspectOn;
    const btn = $('#btn-inspect', this.root);
    btn.setAttribute('aria-pressed', String(this.inspectOn));
  }
  togglePanel(name) {
    const panel = this.panels[name];
    const open = panel.hidden;
    panel.hidden = !open;
    const btn = $(`#btn-${name}`, this.root);
    btn.setAttribute('aria-expanded', String(open));
  }

  /* ─── Persistence ─── */
  persistColors() {
    localStorage.setItem(LS_COLOR, JSON.stringify(this.colors));
  }
  persistCopy(el) {
    const id = el.dataset.copyId;
    const saved = JSON.parse(localStorage.getItem(LS_COPY) || '{}');
    saved[id] = el.innerHTML;
    localStorage.setItem(LS_COPY, JSON.stringify(saved));
  }

  /* ─── Images ─── */
  pickImage(container) {
    if (!container) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) await this.replaceImage(container, file);
      input.remove();
    });
    input.click();
  }
  async replaceImage(container, file) {
    const key = container.dataset.imageKey;
    try {
      const dataUrl = await resizeImage(file, 1600);
      const img = container.querySelector('img');
      img.src = dataUrl;
      await putImage(key, dataUrl);
    } catch (err) {
      console.error('Image replace failed', err);
      alert('Could not load that image.');
    }
  }
  async resetImage(container) {
    const key = container.dataset.imageKey;
    await deleteImage(key);
    const img = container.querySelector('img');
    // Original src was set inline, so reload the page to restore it.
    location.reload();
  }

  /* ─── Viewport preview ─── */
  setPreview(mode) {
    const existing = $('#viewport-frame');
    if (existing) existing.remove();
    document.body.classList.remove('preview-on');
    if (mode === 'off') { this.previewOn = false; return; }
    const w = Number(mode);
    if (!Number.isFinite(w)) return;
    this.previewOn = true;
    document.body.classList.add('preview-on');

    const frame = document.createElement('div');
    frame.className = 'viewport-frame';
    frame.id = 'viewport-frame';
    const iframe = document.createElement('iframe');
    iframe.src = location.href.split('#')[0] + '?preview=1';
    iframe.style.width = w + 'px';
    iframe.style.height = Math.min(900, w * 1.5) + 'px';
    iframe.title = `Preview at ${w} pixels wide`;
    frame.appendChild(iframe);
    document.body.appendChild(frame);
  }

  /* ─── Export ─── */
  async exportHTML() {
    // Clone the live document, strip the editor UI, inline the stylesheet.
    const clone = document.documentElement.cloneNode(true);
    // Remove editor root and breakpoint label
    clone.querySelectorAll('.editor-root, .editor-breakpoint-label, .editor-dropzone, .editor-image-ui, #viewport-frame').forEach(n => n.remove());
    // Remove body classes added by editor
    const bodyClone = clone.querySelector('body');
    if (bodyClone) {
      bodyClone.classList.remove('editor-on', 'inspect-on', 'preview-on');
    }
    // Pull current CSS variables inline on :root
    const inlineVars = Object.entries(this.colors)
      .map(([k, v]) => `${k}: ${v};`).join('\n  ');

    // Fetch the stylesheet and prepend our variables
    let css = '';
    try {
      const res = await fetch('styles.css');
      css = await res.text();
    } catch { /* fall back to no inline CSS */ }

    const styleEl = clone.querySelector('link[href="styles.css"]');
    if (styleEl) styleEl.remove();
    const inlineStyle = document.createElement('style');
    inlineStyle.textContent = `:root{\n  ${inlineVars}\n}\n` + css;
    clone.querySelector('head').appendChild(inlineStyle);

    // Remove the external editor script so the export runs standalone
    clone.querySelectorAll('script[src="editor.js"]').forEach(s => s.remove());

    const html = '<!doctype html>\n' + clone.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

// ───── Bootstrap ──────────────────────────────────────────────
if (!/[?&]preview=1\b/.test(location.search)) {
  // Only mount the editor on the top-level page, not inside the preview iframe.
  const editor = new Editor();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => editor.init());
  } else {
    editor.init();
  }
}
