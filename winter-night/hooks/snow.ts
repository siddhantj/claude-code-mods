// A winter night as a still ground: flat-colored paths the app paints itself,
// on a 256 by 144 canvas stretched to the window. A ground takes at most 64
// paths and no gradients, and fills even-odd, so the sky is stacked bands and
// no path crosses itself.
//
// How hard it snows follows `level`, 0 (a clear night, a few flakes) to
// LEVELS (a storm). Every flake and cloud comes from a seeded generator, so a
// higher level adds to the picture and leaves what was there in place.

import type { ThemeColor, ThemeVectorGround } from 'claude-code'

const W = 256
const H = 144
const HORIZON = 104

/** The steps between a clear night and a full storm. */
export const LEVELS = 20
/** From this level up it is a storm: wind, streaks, whiteout. */
export const STORM_LEVEL = 17

/** The flake color, also how a test counts them. */
export const FLAKE: ThemeColor = '#f4f7ff'

/** The level for `tokens` in use against the count at which auto-compaction runs. */
export function levelFor(tokens: number, threshold: number): number {
  if (threshold <= 0) {
    return 0
  }

  return Math.min(LEVELS, Math.max(0, Math.floor((tokens / threshold) * LEVELS)))
}

export function weather(level: number): string {
  if (level >= STORM_LEVEL) {
    return 'snowstorm'
  }

  if (level >= 13) {
    return 'heavy snow'
  }

  if (level >= 8) {
    return 'steady snow'
  }

  return level >= 3 ? 'light snow' : 'flurries'
}

/** How many flakes the still picture holds at `level`. */
export function flakeCount(level: number): number {
  const t = level / LEVELS

  return Math.round(14 + t * 150 + t * t * t * 260)
}

function rng(seed: number): () => number {
  let s = seed >>> 0

  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const n = (v: number): string => (Math.round(v * 100) / 100).toString()

function circle(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`
}

const rect = (y0: number, y1: number): string => `M0 ${n(y0)}H${W}V${n(y1)}H0Z`

type Path = { d: string; color: ThemeColor }

function mix(a: number, b: number, f: number): number {
  const channel = (shift: number): number =>
    Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * f)

  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

const hex = (color: number, alpha = 255): ThemeColor =>
  `#${color.toString(16).padStart(6, '0')}${alpha >= 255 ? '' : Math.max(0, Math.round(alpha)).toString(16).padStart(2, '0')}`

// Sky, top to bottom: a deep winter night, paler toward the snow. A storm
// greys it over.
const SKY_STOPS: readonly [number, number][] = [
  [0, 0x090d22],
  [0.5, 0x151c3c],
  [0.8, 0x273052],
  [1, 0x424a6c],
]
const SKY_BANDS = 18
const STORM_SKY = 0x333b57

function sky(t: number): Path[] {
  const grey = t * t * 0.6

  // Each band runs to the foot, the next painted over it, so no seam shows.
  return Array.from({ length: SKY_BANDS }, (_, i) => {
    const top = Math.pow(i / SKY_BANDS, 0.7)
    const at = Math.pow((i + 0.5) / SKY_BANDS, 0.7)
    const k = Math.max(0, SKY_STOPS.findIndex(([stop]) => stop >= at) - 1)
    const [t0, c0] = SKY_STOPS[k]!
    const [t1, c1] = SKY_STOPS[Math.min(k + 1, SKY_STOPS.length - 1)]!
    const color = mix(c0, c1, t1 === t0 ? 0 : (at - t0) / (t1 - t0))

    return { d: rect(top * HORIZON, H), color: hex(mix(color, STORM_SKY, grey)) }
  })
}

// Some stars, fewer and fainter as the cloud closes in, gone in a storm.
function stars(t: number): Path[] {
  const fade = Math.pow(Math.max(0, 1 - t / 0.8), 1.4)

  if (fade <= 0.04) {
    return []
  }

  const r = rng(11)
  let bright = ''
  let faint = ''

  for (let i = 0; i < 44; i++) {
    const x = r() * W
    const y = Math.pow(r(), 1.3) * 64
    const isBig = r() < 0.3
    const d = circle(x, y, isBig ? 0.3 : 0.19)

    if (isBig) {
      bright += d
    } else {
      faint += d
    }
  }

  return [
    { d: bright, color: hex(0xf4f0e0, 0xd0 * fade) },
    { d: faint, color: hex(0xf4f0e0, 0x80 * fade) },
  ]
}

// One cloud: a row of humps over a shallow belly, drawn as a single outline.
function cloud(x: number, y: number, width: number, seed: number): string {
  const r = rng(seed)
  const humps = 3 + Math.floor(r() * 3)
  const weights = Array.from({ length: humps }, (_, i) => 0.7 + r() * 0.6 + (i === Math.floor(humps / 2) ? 0.35 : 0))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let d = `M${n(x)} ${n(y)}`

  for (const w of weights) {
    const span = (w / total) * width
    d += `a${n(span / 2)} ${n(span * (0.42 + r() * 0.22))} 0 0 1 ${n(span)} 0`
  }

  return `${d}q${n(-width / 2)} ${n(width * 0.09)} ${n(-width)} 0Z`
}

// Three rows of cloud. Within a row each cloud keeps to its own slot, so no
// two in one path overlap.
const CLOUD_ROWS: readonly { y: number; slots: number; color: number }[] = [
  { y: 15, slots: 4, color: 0x2b3352 },
  { y: 33, slots: 3, color: 0x353d5e },
  { y: 52, slots: 4, color: 0x2f3757 },
]
// The order the slots fill in, row then slot.
const CLOUD_ORDER: readonly [number, number][] = [
  [1, 0], [0, 2], [2, 3], [0, 0], [2, 1], [1, 2], [0, 3], [2, 0], [1, 1], [0, 1], [2, 2],
]

function clouds(t: number): Path[] {
  const shown = Math.min(CLOUD_ORDER.length, 3 + Math.round(t * 8))
  const rows = CLOUD_ROWS.map(() => '')

  CLOUD_ORDER.slice(0, shown).forEach(([row, slot]) => {
    const { y, slots } = CLOUD_ROWS[row]!
    const r = rng(300 + row * 31 + slot * 7)
    const room = W / slots
    const width = room * (0.55 + r() * 0.35)
    const x = slot * room + r() * (room - width)

    rows[row] += cloud(x, y + (r() - 0.5) * 6, width, 500 + row * 13 + slot)
  })

  const paths = rows
    .map((d, row) => ({ d, color: hex(mix(CLOUD_ROWS[row]!.color, 0x565f7e, t * 0.6), 0xa0 + t * 0x50) }))
    .filter(path => path.d !== '')

  // A lid of cloud over the whole sky as the storm comes on.
  if (t > 0.6) {
    paths.push({ d: rect(0, 99), color: hex(0x4b5472, (t - 0.6) * 0x90) })
  }

  return paths
}

// A row of firs as one sawtooth outline.
function firs(seed: number, baseY: number, minH: number, maxH: number, count: number): string {
  const r = rng(seed)
  const step = W / count
  let d = `M0 ${H}V${baseY}`

  for (let i = 0; i < count; i++) {
    const x = i * step
    const h = minH + r() * (maxH - minH)

    d += `L${n(x + step * (0.35 + r() * 0.3))} ${n(baseY - h)}L${n(x + step)} ${n(baseY)}`
  }

  return `${d}V${H}Z`
}

function land(t: number): Path[] {
  // The drift at the foot deepens as more falls.
  const rise = t * 7

  return [
    // far hills under snow
    { d: 'M0 98C29 90 53 96 83 92S138 83 166 90S224 96 256 88V144H0Z', color: '#3b4570' },
    // firs
    { d: firs(21, 103, 3, 9, 46), color: '#131a30' },
    { d: firs(37, 108, 5, 13, 30), color: '#0e1427' },
    // the snowfield
    { d: 'M0 111C38 106 67 109 102 108S166 111 198 108S237 106 256 109V144H0Z', color: '#48537f' },
    { d: 'M0 122C48 118 83 121 128 119S208 122 256 118V144H0Z', color: '#56628f' },
    {
      d: `M0 ${n(134 - rise)}C40 ${n(130 - rise)} 76 ${n(135 - rise)} 120 ${n(132 - rise)}S212 ${n(136 - rise)} 256 ${n(131 - rise)}V144H0Z`,
      color: '#6a77a6',
    },
  ]
}

// Flakes in three depths, far to near, each spread over a few paths.
const DEPTHS: readonly { size: number; alpha: number; layers: number }[] = [
  { size: 0.36, alpha: 0x80, layers: 2 },
  { size: 0.6, alpha: 0xc0, layers: 3 },
  { size: 0.95, alpha: 0xff, layers: 3 },
]

function flakes(level: number): Path[] {
  const t = level / LEVELS
  // Wind: none in a light fall, hard in a storm, when each flake is a streak.
  const wind = level >= STORM_LEVEL ? 1.6 + (level - STORM_LEVEL) * 0.5 : Math.max(0, t - 0.4) * 1.2
  const layers = DEPTHS.map(depth => Array.from({ length: depth.layers }, () => ''))
  const count = flakeCount(level)

  for (let i = 0; i < count; i++) {
    const r = rng(1000 + i * 7919)
    const x = r() * W
    const y = r() * (H - 6)
    const k = Math.min(DEPTHS.length - 1, Math.floor(r() * r() * 3.4))
    const depth = DEPTHS[k]!
    const size = depth.size * (0.75 + r() * 0.5)
    const slot = i % depth.layers

    if (wind < 0.5) {
      layers[k]![slot] += circle(x, y, size)
    } else {
      // A streak down the wind: a thin slanted sliver.
      const dy = size * (2.2 + wind * 0.5)
      const dx = dy * Math.min(0.9, wind * 0.35)

      layers[k]![slot] +=
        `M${n(x)} ${n(y)}l${n(size * 0.9)} 0l${n(-dx)} ${n(dy)}l${n(-size * 0.9)} 0Z`
    }
  }

  return DEPTHS.flatMap((depth, k) =>
    layers[k]!
      .filter(d => d !== '')
      .map(d => ({ d, color: depth.alpha >= 255 ? FLAKE : hex(0xf4f7ff, depth.alpha) })),
  )
}

// Snow in the air between here and the hills: a veil that thickens to a whiteout.
function veil(t: number): Path[] {
  if (t <= 0.55) {
    return []
  }

  const thick = (t - 0.55) / 0.45

  return [{ d: rect(0, H), color: hex(0xb8c2dc, thick * 0x26) }]
}

const built = new Map<number, ThemeVectorGround>()

export function snowfall(level: number): ThemeVectorGround {
  let ground = built.get(level)

  if (ground === undefined) {
    const t = level / LEVELS
    const paths = [...sky(t), ...stars(t), ...clouds(t), ...land(t), ...veil(t), ...flakes(level)]

    ground = { vector: { viewBox: [W, H], paths } }
    built.set(level, ground)
  }

  return ground
}

const GLYPHS = ['·', '·', '•', '*', '❄']

/**
 * The terminal's snow at `step`, one string per row: flakes fall a little each
 * step, slanting with the wind, and a few stars hold still up top until the
 * cloud closes in.
 */
export function terminalSnow(level: number, columns: number, rows: number, step: number): string[] {
  const t = level / LEVELS
  const isStorm = level >= STORM_LEVEL
  const width = Math.max(1, columns - 1)
  const grid = Array.from({ length: rows }, () => Array.from({ length: width }, () => ' '))
  const area = (width * rows) / 4800

  if (t < 0.7) {
    const r = rng(77)

    for (let i = 0; i < Math.round(9 * area * (1 - t)); i++) {
      const row = grid[Math.floor(r() * rows * 0.35)]

      if (row !== undefined) {
        row[Math.floor(r() * width)] = r() < 0.3 ? '✦' : '.'
      }
    }
  }

  const count = Math.min(260, Math.round(area * (8 + t * 70 + (isStorm ? 90 : 0))))

  for (let i = 0; i < count; i++) {
    const r = rng(2000 + i * 104729)
    const x0 = r() * width
    const y0 = r() * rows
    const fall = (0.35 + r() * 0.65) * (isStorm ? 1.9 : 1)
    const wind = (isStorm ? 1.6 + r() * 1.4 : t * 0.5 * r()) * -1
    const x = (((x0 + step * wind) % width) + width) % width
    const y = (y0 + step * fall) % rows
    const row = grid[Math.floor(y)]

    if (row !== undefined) {
      row[Math.floor(x)] = isStorm && r() < 0.5 ? '/' : GLYPHS[Math.floor(r() * GLYPHS.length)]!
    }
  }

  return grid.map(row => row.join('').trimEnd() || ' ')
}
