// The meadow at dusk as a still ground: flat-colored paths the app paints
// itself, on a 256 by 144 canvas stretched to the window. A ground takes at
// most 64 paths and no gradients, so the sky is stacked bands and each glow
// is a few translucent rings.
//
// Every firefly comes from a seeded generator, so firefly 7 always sits in
// the same spot: a higher count adds new ones and leaves the rest in place.

import type { ThemeColor, ThemeVectorGround } from 'claude-code'

const W = 256
const H = 144

// The firefly core color, also how a test counts them.
export const CORE: ThemeColor = '#fbfcd2'

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

function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${n(cx - rx)} ${n(cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0Z`
}

const rect = (y0: number, y1: number): string => `M0 ${n(y0)}H${W}V${n(y1)}H0Z`

type Path = { d: string; color: ThemeColor }

// Sky, top to bottom: deep indigo to a violet dusk with an ember horizon.
// A ground has no gradients, so the sky is bands, closer together toward the
// horizon where the color turns fastest.
const SKY_STOPS: readonly [number, number][] = [
  [0, 0x0d1028],
  [0.42, 0x1d1b45],
  [0.66, 0x4a2c5a],
  [0.8, 0x8a4a55],
  [0.9, 0xc47a4e],
  [1, 0xd08a52],
]
const SKY_BANDS = 26
const HORIZON = 104

function skyColor(at: number): ThemeColor {
  const i = Math.max(0, SKY_STOPS.findIndex(([t]) => t >= at) - 1)
  const [t0, c0] = SKY_STOPS[i]!
  const [t1, c1] = SKY_STOPS[Math.min(i + 1, SKY_STOPS.length - 1)]!
  const f = t1 === t0 ? 0 : (at - t0) / (t1 - t0)
  const mix = (shift: number): number =>
    Math.round(((c0 >> shift) & 255) + (((c1 >> shift) & 255) - ((c0 >> shift) & 255)) * f)
  const hex = (mix(16) << 16) | (mix(8) << 8) | mix(0)

  return `#${hex.toString(16).padStart(6, '0')}`
}

function sky(): Path[] {
  // Each band runs to the foot, the next painted over it, so no seam shows
  // where two meet.
  return Array.from({ length: SKY_BANDS }, (_, i) => {
    const top = Math.pow(i / SKY_BANDS, 0.7)
    const middle = Math.pow((i + 0.5) / SKY_BANDS, 0.7)

    return { d: rect(top * HORIZON, H), color: skyColor(middle) }
  })
}

function stars(): Path[] {
  const r = rng(11)
  let bright = ''
  let faint = ''

  for (let i = 0; i < 52; i++) {
    const x = r() * W
    const y = Math.pow(r(), 1.3) * 62
    const big = r() < 0.3
    const d = circle(x, y, big ? 0.28 : 0.18)

    if (big) {
      bright += d
    } else {
      faint += d
    }
  }

  return [
    { d: bright, color: '#f4ecd8cc' },
    { d: faint, color: '#f4ecd87a' },
  ]
}

function grass(seed: number, baseY: number, minH: number, maxH: number, count: number): string {
  const r = rng(seed)
  let d = ''

  for (let i = 0; i < count; i++) {
    const x = (i / count) * W + (r() - 0.5) * 2.2
    const h = minH + r() * (maxH - minH)
    const lean = (r() - 0.5) * 4.2
    const w = 0.32 + r() * 0.48
    d += `M${n(x - w)} ${baseY}Q${n(x + lean * 0.3)} ${n(baseY - h * 0.6)} ${n(x + lean)} ${n(baseY - h)}Q${n(x + lean * 0.5 + w)} ${n(baseY - h * 0.5)} ${n(x + w)} ${baseY}Z`
  }

  return d
}

function land(): Path[] {
  return [
    // the last light, pooled behind the hills
    { d: ellipse(180, 101, 100, 26), color: '#f2b56b0c' },
    { d: ellipse(180, 102, 66, 16), color: '#f2b56b10' },
    { d: ellipse(180, 103, 34, 8), color: '#f6c47e18' },
    // far hills
    { d: 'M0 98C29 90 53 96 83 92S138 83 166 90S224 96 256 88V144H0Z', color: '#33274f' },
    // tree line
    {
      d: 'M0 102C10 101 14 96 21 98S30 93 38 97S48 94 56 99S69 96 75 100S96 102 112 101S131 98 138 94S149 96 154 92S165 95 170 99S192 102 208 100S227 95 234 97S246 94 256 98V144H0Z',
      color: '#251d40',
    },
    // near meadow
    { d: 'M0 115C38 110 67 113 102 112S166 115 198 112S237 110 256 113V144H0Z', color: '#1a1a36' },
    { d: grass(21, 123, 4.8, 12.5, 150), color: '#161a31' },
    { d: 'M0 128C48 125 83 127 128 126S208 128 256 125V144H0Z', color: '#11142a' },
    { d: grass(37, 144, 8, 21, 110), color: '#0c0f22' },
  ]
}

// Rings from the outside in. Each ring sits in one of a few paths, firefly by
// firefly in turn, so two glows that overlap rarely share a path: the even-odd
// fill would cut a hole where they cross.
const RINGS: readonly { scale: number; color: ThemeColor; layers: number }[] = [
  { scale: 5.2, color: '#d7e85c0f', layers: 6 },
  { scale: 3.2, color: '#e3ef6e1c', layers: 6 },
  { scale: 1.9, color: '#eef58a40', layers: 4 },
  { scale: 1, color: CORE, layers: 3 },
]

function fireflies(count: number): Path[] {
  const layers = RINGS.map(ring => Array.from({ length: ring.layers }, () => ''))

  for (let i = 0; i < count; i++) {
    const r = rng(1000 + i * 7919)
    const x = 6 + r() * (W - 12)
    // Thickest over the grass, but up across the sky too, so they show
    // around the conversation and not only behind the message box.
    const y = 140 - Math.pow(r(), 1.25) * 128
    // Some caught mid-glow, some dimmer, as a still frame of a twinkling field.
    const size = (0.45 + r() * 0.4) * (r() < 0.35 ? 0.7 : 1)

    RINGS.forEach((ring, k) => {
      const slot = i % ring.layers
      layers[k]![slot] += circle(x, y, size * ring.scale)
    })
  }

  return RINGS.flatMap((ring, k) =>
    layers[k]!.filter(d => d !== '').map(d => ({ d, color: ring.color })),
  )
}

const built = new Map<number, ThemeVectorGround>()

export function meadow(count: number): ThemeVectorGround {
  let ground = built.get(count)

  if (ground === undefined) {
    const paths = [...sky(), ...stars(), ...land(), ...fireflies(count)]
    ground = { vector: { viewBox: [W, H], paths } }
    built.set(count, ground)
  }

  return ground
}
