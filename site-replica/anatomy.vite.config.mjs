// Builds only the distance-travelled page (feature/distance-travelled) into
// the site as /anatomy/. Plain object: no 'vite' import, so it runs from here.
// Source: src/distance-travelled on the feature/distance-travelled branch.
// Point ANATOMY_SRC at that folder in a checkout of the branch.
const SRC = process.env.ANATOMY_SRC || '/Users/hamishduncan/Dev/photography-dt/src/distance-travelled'

// Site wrapper, added at build time so the three.js source stays as it is:
// the tab title and a way back to the photographs.
const siteWrapper = {
  name: 'site-anatomy',
  transformIndexHtml(html) {
    return html
      .replace(/<title>[^<]*<\/title>/, '<title>тисяча · anatomy of distance travelled</title>')
      .replace(/<body([^>]*)>/, `<body$1>
    <a class="site-back" href="../">← тисяча · photographs</a>
    <style>
      .site-back {
        position: fixed; top: 4px; left: 16px; z-index: 20;
        padding: 3px 0;
        font: 500 11px/14px 'JetBrains Mono', ui-monospace, monospace;
        letter-spacing: 0.08em;
        color: #f3e2b6;
        text-decoration: none;
      }
      .site-back:hover, .site-back:focus-visible { text-decoration: underline; text-underline-offset: 3px; }
      .site-back:focus-visible { outline: 1px solid #f3e2b6; outline-offset: 3px; }
    </style>`)
  },
}

export default {
  root: SRC,
  base: './',
  publicDir: false,
  logLevel: 'warn',
  plugins: [siteWrapper],
  build: {
    outDir: new URL('./anatomy', import.meta.url).pathname,
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
  },
}
