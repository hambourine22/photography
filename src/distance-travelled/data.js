// ─── ANATOMY OF DISTANCE TRAVELLED · ROUTE DATA ──────────────────────────────
// Source: 1000·С002, лист 1 (анатомія) and лист 2 (ключ).
// Distances are great-circle between waypoints, as on the sheet. Longitudes are
// the towns' published centres, used only to draw the space axis.

export const TOTAL_KM = 2592

// tier = leader length on the route plane (long / mid / short), as hand-drawn
export const WAYPOINTS = [
    { code: 'Т01', name: 'BRISTOL',    km: 0,    lat: 51.45, lon: -2.59, tier: 'long'  },
    { code: 'Т02', name: 'READING',    km: 112,  lat: 51.45, lon: -0.97, tier: 'short' },
    { code: 'Т03', name: 'LONDON',     km: 171,  lat: 51.51, lon: -0.13, tier: 'mid'   },
    { code: 'Т04', name: 'MAIDSTONE',  km: 223,  lat: 51.27, lon:  0.52, tier: 'short' },
    { code: 'Т05', name: 'DOVER',      km: 280,  lat: 51.13, lon:  1.31, tier: 'mid'   },
    { code: 'Т06', name: 'CALAIS',     km: 323,  lat: 50.95, lon:  1.86, tier: 'long'  },
    { code: 'Т07', name: 'LIÈGE',      km: 587,  lat: 50.63, lon:  5.57, tier: 'mid'   },
    { code: 'Т08', name: 'KÖLN',       km: 690,  lat: 50.94, lon:  6.96, tier: 'short' },
    { code: 'Т09', name: 'DÜSSELDORF', km: 725,  lat: 51.23, lon:  6.78, tier: 'long'  },
    { code: 'Т10', name: 'HANOVER',    km: 965,  lat: 52.38, lon:  9.73, tier: 'long'  },
    { code: 'Т11', name: 'POTSDAM',    km: 1191, lat: 52.39, lon: 13.06, tier: 'short' },
    { code: 'Т12', name: 'BERLIN',     km: 1218, lat: 52.52, lon: 13.40, tier: 'mid'   },
    { code: 'Т13', name: 'POZNAŃ',     km: 1457, lat: 52.41, lon: 16.93, tier: 'short' },
    { code: 'Т14', name: 'KRAKÓW',     km: 1792, lat: 50.06, lon: 19.94, tier: 'long'  },
    { code: 'Т15', name: 'LVIV',       km: 2085, lat: 49.84, lon: 24.03, tier: 'short' },
    { code: 'Т16', name: 'RIVNE',      km: 2265, lat: 50.62, lon: 26.25, tier: 'mid'   },
    { code: 'Т17', name: 'ZHYTOMYR',   km: 2440, lat: 50.25, lon: 28.66, tier: 'short' },
    { code: 'Т18', name: 'FASTIV',     km: 2532, lat: 50.08, lon: 29.92, tier: 'mid'   },
    { code: 'Т19', name: 'KYIV',       km: 2592, lat: 50.45, lon: 30.52, tier: 'short', local: 'КИЇВ' },
]

// Days share their boundaries with waypoints, so every axis stays piecewise
// linear between waypoints.
export const DAYS = [
    { n: 999,  date: '18.11.2024', dow: 'понеділок', short: 'пн', leg: 'Е1', from: 0,    to: 323,  span: 'Т01 → Т06',      note: 'етап Е1'   },
    { n: 1000, date: '19.11.2024', dow: 'вівторок',  short: 'вт', leg: 'Е2', from: 323,  to: 965,  span: 'Т06 → Т10',      note: 'етап Е2'   },
    { n: 1001, date: '20.11.2024', dow: 'середа',    short: 'ср', leg: 'Е3', from: 965,  to: 1792, span: 'Т10 → Т14',      note: 'етап Е3'   },
    { n: 1002, date: '21.11.2024', dow: 'четвер',    short: 'чт', leg: 'Е4', from: 1792, to: 2085, span: 'Т14 → Т15 · М5', note: 'Е4 до М5'  },
    { n: 1003, date: '22.11.2024', dow: "п'ятниця",  short: 'пт', leg: 'Е4', from: 2085, to: 2592, span: 'Т15 → Т19',      note: 'Е4 до Т19' },
]

// Headings are as written on the hand sheet, not recomputed.
export const LEGS = [
    { code: 'Е1', from: 'BRISTOL', to: 'CALAIS',  dir: 'SW → ESE', deg: 120, start: 0,    end: 323  },
    { code: 'Е2', from: 'CALAIS',  to: 'HANOVER', dir: 'W → ENE',  deg: 70,  start: 323,  end: 965  },
    { code: 'Е3', from: 'HANOVER', to: 'KRAKÓW',  dir: 'W → ESE',  deg: 110, start: 965,  end: 1792 },
    { code: 'Е4', from: 'KRAKÓW',  to: 'KYIV',    dir: 'W → ENE',  deg: 65,  start: 1792, end: 2592 },
]

export const CROSSINGS = [
    { code: 'М1', label: 'Dover–Calais · ferry', long: 'Dover → Calais · sea crossing, drawn dashed · Т05–Т06', km: 301.5, ferry: true, from: 280, to: 323 },
    { code: 'М2', label: 'FR–BE',                long: 'France → Belgium · етап Е2',                             km: 442 },
    { code: 'М3', label: 'BE–DE',                long: 'Belgium → Germany · етап Е2',                            km: 628 },
    { code: 'М4', label: 'DE–PL',                long: 'Germany → Poland · етап Е3',                             km: 1557 },
    { code: 'М5', label: 'PL–UA · кордон',       long: 'Poland → Ukraine · кордон · Т14–Т15',                    km: 1973, border: true },
]

export const FRAMES = [
    { code: '1000·Е1·Т05·Ф001', slug: 'dover-ferries',     km: 280  },
    { code: '1000·Е4·Т19·Ф001', slug: 'kyiv-mykhailivska', km: 2592, alignRight: true },
]
