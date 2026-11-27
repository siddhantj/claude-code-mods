// The fight, as a pure function: a time and a size in, pixels or cells out.
// Nothing here touches the engine, so it can be drawn and checked anywhere.

export const LOOP_MS = 10_000

const NONE = -1
// A pixel carrying this bit is an effect (lightning, beam, stones): it keeps
// most of its brightness while everything else is dimmed.
const FX = 0x1000000
const DIM = 0.6
const FX_DIM = 0.92
// Bit 24 alone is the terminal's own default color, in a Raster cell.
const DEFAULT_COLOR = 0x01000000

type Palette = Record<string, number>
type Key = readonly [number, number]

const THOR_PALETTE: Palette = {
  h: 0xf0cf6e, // hair
  s: 0xe7ae82, // skin
  b: 0xc2923f, // beard
  e: 0x202028, // eye
  a: 0x2a3142, // armor
  A: 0x9aa4b8, // armor plates
  c: 0xc22630, // cape
  C: 0x86161f, // cape shade
  l: 0x343c52, // legs
  k: 0x5a4130, // boots
}

const THANOS_PALETTE: Palette = {
  p: 0x8e5bb5, // skin
  P: 0x5d3880, // chin ridges
  e: 0xffffff | 0x1000000, // eye, kept bright
  g: 0xd4a437, // gold
  G: 0x9a7420, // gold shade
  n: 0x2f3f70, // navy armor
}

// Thor faces right. His front arm and Stormbreaker are drawn over this.
const THOR_TOP = [
  '....hhhhh.....',
  '...hhhhhhh....',
  '...hhhsses....',
  '...hhhssss....',
  '...hh.bbbb....',
  '..cc..bbb.....',
  '.cccAaaaaAA...',
  '.ccaaaAAaaAA..',
  'ccCaaaaaaaa...',
  'ccCaaAAAaaa...',
  'ccC.aaaaaa....',
  'ccC.aAAAAa....',
]
const THOR_STAND = [
  'cC..lll.lll...',
  'cC..lll.lll...',
  'c...lll.lll...',
  'c...ll...ll...',
  '....kk...kk...',
  '....kkk..kkk..',
]
const THOR_STRIDE = [
  'cC..lllllll...',
  'cC.lll..lll...',
  'c..lll...lll..',
  'c.lll.....ll..',
  '..kk......kk..',
  '.kkk......kkk.',
]

// Thanos faces left. His gauntlet arm is drawn over this.
const THANOS_TOP = [
  '.......pppppp........',
  '......pppppppp.......',
  '......PPPppppp.......',
  '......pepppppp.......',
  '......pppppppp.......',
  '......PpPpPppp.......',
  '......PpPpPpp........',
  '.......pPpPp.........',
  '...GggggpppgggggG....',
  '..GgggnggggggngggG...',
  '..gggnnngggggnnnggg..',
  '...gnnnnngggnnnnnpp..',
  '....nnnnnggnnnnn.pp..',
  '....nnnnnnnnnnnn.pp..',
  '.....nnnnnnnnnn..pp..',
  '.....GggggggggG......',
]
const THANOS_STAND = [
  '.....nnnnn.nnnn......',
  '.....nnnn...nnnn.....',
  '.....nnnn...nnnn.....',
  '.....nnnn...nnnn.....',
  '.....nnnn...nnnn.....',
  '.....gggg...gggg.....',
  '....ggggg..ggggg.....',
]
const THANOS_STRIDE = [
  '.....nnnnnnnnnnn.....',
  '....nnnn....nnnn.....',
  '...nnnn......nnnn....',
  '...nnnn......nnnn....',
  '...nnnn......nnnn....',
  '...gggg......gggg....',
  '..ggggg.....ggggg....',
]

const THOR_ROWS = THOR_TOP.length + THOR_STAND.length
const THOR_CENTER = 7
const THOR_SHOULDER = { x: 10, y: 7 }
const THANOS_ROWS = THANOS_TOP.length + THANOS_STAND.length
const THANOS_CENTER = 10
const THANOS_SHOULDER = { x: 3, y: 10 }

const SKIN = 0xe7ae82
const BRACER = 0x9aa4b8
const WOOD = 0x8a5a2b
const STEEL = 0xaab4c6
const STEEL_DARK = 0x6b7486
const EDGE = 0xe6eef8 | FX
const GOLD = 0xd4a437
const GOLD_DARK = 0x9a7420
const PURPLE_SKIN = 0x8e5bb5

// Power, space, reality, soul on the knuckles; mind on the back of the hand;
// time on the thumb.
const STONES = [0xb04dff, 0x3f8cff, 0xff3b3b, 0xff9a2e, 0xffe14a, 0x3ddc6a]

const BOLT_CORE = 0xeaf7ff | FX
const BOLT_GLOW = 0x5fb8ff | FX
const BEAM_CORE = 0xf3ddff | FX
const BEAM_GLOW = 0x9b4dff | FX
const SPARK = 0xfff2a8 | FX
const WHITE = 0xffffff | FX
const DUST = 0x8a8078

class Canvas {
  readonly pixels: Int32Array
  readonly width: number
  readonly height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.pixels = new Int32Array(width * height).fill(NONE)
  }

  set(x: number, y: number, color: number): void {
    const px = Math.round(x)
    const py = Math.round(y)

    if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
      this.pixels[py * this.width + px] = color
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: number, thick = 1): void {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))

    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps
      const y = y0 + ((y1 - y0) * i) / steps

      for (let dx = 0; dx < thick; dx++) {
        for (let dy = 0; dy < thick; dy++) {
          this.set(x + dx - (thick - 1) / 2, y + dy - (thick - 1) / 2, color)
        }
      }
    }
  }

  disc(cx: number, cy: number, radius: number, color: number): void {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
          this.set(x, y, color)
        }
      }
    }
  }

  ring(cx: number, cy: number, radius: number, color: number): void {
    for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
      for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
        const distance = Math.hypot(x - cx, y - cy)

        if (Math.abs(distance - radius) < 0.6) {
          this.set(x, y, color)
        }
      }
    }
  }
}

// The same answer for the same numbers: every frame can be drawn again.
function chance(a: number, b = 0): number {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453

  return value - Math.floor(value)
}

// A value along keyframes, straight between each pair.
function along(t: number, keys: readonly Key[]): number {
  const first = keys[0]!
  const last = keys[keys.length - 1]!

  if (t <= first[0]) {
    return first[1]
  }

  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]!
    const [t0, v0] = keys[i - 1]!

    if (t <= t1) {
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0 || 1)
    }
  }

  return last[1]
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function sprite(
  canvas: Canvas,
  rows: readonly string[],
  palette: Palette,
  left: number,
  top: number,
  lean: number,
): void {
  rows.forEach((row, r) => {
    const shift = Math.round(lean * (1 - r / (rows.length - 1)))

    for (let c = 0; c < row.length; c++) {
      const color = palette[row[c]!]

      if (color !== undefined) {
        canvas.set(left + c + shift, top + r, color)
      }
    }
  })
}

// Stormbreaker from the hand: a wooden haft, an axe blade on one side of the
// head and a hammer block on the other. Returns where the head is.
function stormbreaker(
  canvas: Canvas,
  handX: number,
  handY: number,
  degrees: number,
): { x: number; y: number } {
  const angle = radians(degrees)
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const length = 9
  const reach = length + 7

  for (let y = Math.floor(handY - reach); y <= Math.ceil(handY + reach); y++) {
    for (let x = Math.floor(handX - reach); x <= Math.ceil(handX + reach); x++) {
      const dx = x - handX
      const dy = y - handY
      // u runs along the haft, v across it. The blade side is the one that
      // leads a downward swing.
      const u = dx * ux + dy * uy
      const v = -dx * uy + dy * ux

      if (u >= -2.5 && u <= length && Math.abs(v) <= 0.5) {
        canvas.set(x, y, WOOD)
      }

      const along_ = u - (length - 1)

      if (v > 0.5 && v <= 5.5 && Math.abs(along_) <= 1.2 + v * 0.55) {
        canvas.set(x, y, v > 4.5 ? EDGE : v > 2.5 ? STEEL : STEEL_DARK)
      }

      if (v < -0.5 && v >= -4.5 && Math.abs(along_) <= 2.2) {
        canvas.set(x, y, v < -3.5 ? STEEL : STEEL_DARK)
      }

      if (Math.abs(v) <= 0.5 && Math.abs(along_) <= 2.2) {
        canvas.set(x, y, STEEL_DARK)
      }
    }
  }

  return { x: handX + ux * (length - 1), y: handY + uy * (length - 1) }
}

// The gauntlet: a gold fist with the six stones, the knuckles leading left.
function gauntlet(canvas: Canvas, handX: number, handY: number, glow: number): void {
  const x = Math.round(handX)
  const y = Math.round(handY)

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      canvas.set(x + dx, y + dy, dx === 2 || dy === 2 ? GOLD_DARK : GOLD)
    }
  }

  const lit = glow > 0 ? FX : 0

  canvas.set(x - 2, y - 2, STONES[0]! | FX)
  canvas.set(x - 2, y - 1, STONES[1]! | FX)
  canvas.set(x - 2, y, STONES[2]! | FX)
  canvas.set(x - 2, y + 1, STONES[3]! | FX)
  canvas.set(x, y - 1, STONES[4]! | FX)
  canvas.set(x, y, STONES[4]! | lit)
  canvas.set(x + 1, y + 2, STONES[5]! | FX)
}

// A jagged bolt between two points; `seed` picks the jags.
function bolt(
  canvas: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  jitter: number,
  color: number,
): void {
  const distance = Math.hypot(x1 - x0, y1 - y0)
  const parts = Math.max(2, Math.round(distance / 4))
  const nx = -(y1 - y0) / (distance || 1)
  const ny = (x1 - x0) / (distance || 1)
  let px = x0
  let py = y0

  for (let i = 1; i <= parts; i++) {
    const offset = i === parts ? 0 : (chance(seed, i) - 0.5) * 2 * jitter
    const x = x0 + ((x1 - x0) * i) / parts + nx * offset
    const y = y0 + ((y1 - y0) * i) / parts + ny * offset

    canvas.line(px, py, x, y, color)
    px = x
    py = y
  }
}

function burst(canvas: Canvas, x: number, y: number, age: number, seed: number): void {
  const size = 1 + age * 14

  canvas.set(x, y, WHITE)

  for (let ray = 0; ray < 8; ray++) {
    const angle = (ray * Math.PI) / 4 + chance(seed, ray) * 0.5
    const reach = size * (0.6 + chance(seed + 3, ray) * 0.6)

    canvas.set(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, ray % 2 ? SPARK : WHITE)
    if (reach > 2) {
      canvas.set(x + Math.cos(angle) * reach * 0.5, y + Math.sin(angle) * reach * 0.5, SPARK)
    }
  }
}

function ground(canvas: Canvas): void {
  const { width, height } = canvas
  const top = [0x64584e, 0x554a42, 0x70645a]
  const under = [0x3d3530, 0x48403a]

  for (let x = 0; x < width; x++) {
    canvas.set(x, height - 2, top[Math.floor(chance(x, 1) * top.length)]!)
    canvas.set(x, height - 1, under[Math.floor(chance(x, 2) * under.length)]!)
    if (chance(x, 3) > 0.94) {
      canvas.set(x, height - 3, 0x554a42)
    }
  }
}

/**
 * The fight at `ms` into its loop, as `width * height` pixels: -1 where
 * nothing is drawn, else `0xRRGGBB` with bit 24 set on an effect pixel.
 */
export function paint(ms: number, width: number, height: number): Int32Array {
  const canvas = new Canvas(width, height)
  const t = (((ms % LOOP_MS) + LOOP_MS) % LOOP_MS) / 1000
  // Effects that flicker change ten times a second, whatever the frame rate.
  const flick = Math.floor(t * 10)
  const feet = height - 2
  const center = Math.round(width / 2)
  const span = Math.max(24, Math.round(width * 0.31))
  const thorHome = center - span
  const thanosHome = center + span
  const thorMelee = center - 10
  const thanosMelee = center + 11
  const knock = 7

  ground(canvas)

  // Thanos, the back layer.
  const thanosX = Math.round(
    along(t, [
      [1.2, thanosHome],
      [2.3, thanosMelee],
      [3.65, thanosMelee],
      [3.75, thanosMelee + 3],
      [4.0, thanosMelee + 1],
      [5.0, thanosHome],
      [8.35, thanosHome],
      [8.9, thanosHome + knock],
      [9.4, thanosHome + knock],
      [10, thanosHome],
    ]),
  )
  const thanosLift = t > 4 && t < 5 ? Math.round(4 * Math.sin(Math.PI * (t - 4))) : 0
  const thanosLean = along(t, [
    [3.65, 0],
    [3.72, 3],
    [4.0, 0],
    [8.35, 0],
    [8.5, 3],
    [9.3, 3],
    [9.6, 0],
  ])
  const thanosAim = along(t, [
    [1.2, -30],
    [1.4, 100],
    [2.3, 100],
    [2.45, -50],
    [2.85, -50],
    [2.98, -20],
    [3.1, 0],
    [3.3, 0],
    [3.5, -30],
    [3.65, -30],
    [3.72, -80],
    [4.0, -30],
    [5.0, -30],
    [5.3, -80],
    [6.2, -80],
    [6.4, 0],
    [8.35, 0],
    [8.5, -60],
    [9.3, -60],
    [9.7, -30],
  ])
  const thanosReach = along(t, [
    [1.2, 4],
    [1.4, 6],
    [2.85, 6],
    [2.98, 2],
    [3.1, 9],
    [3.3, 9],
    [3.5, 4],
    [3.65, 4],
    [3.72, 6],
    [4.0, 4],
    [5.0, 4],
    [5.3, 7],
    [6.2, 7],
    [6.4, 8],
    [8.35, 8],
    [8.5, 5],
    [9.3, 5],
    [9.7, 4],
  ])
  const thanosRuns = (t > 1.2 && t < 2.3) || (t > 9.4 && t < 10)
  const thanosStride = thanosRuns && Math.floor(t / 0.15) % 2 === 0
  const thanosIdle = t < 1.2 || (t > 5 && t < 8.3) ? Math.floor(t / 0.6) % 2 : 0
  const thanosTop = feet - THANOS_ROWS - thanosLift + thanosIdle
  const thanosLeft = thanosX - THANOS_CENTER

  sprite(canvas, THANOS_TOP, THANOS_PALETTE, thanosLeft, thanosTop, thanosLean * 0.6)
  sprite(
    canvas,
    thanosStride ? THANOS_STRIDE : THANOS_STAND,
    THANOS_PALETTE,
    thanosLeft,
    thanosTop + THANOS_TOP.length,
    0,
  )

  const thanosShoulderX = thanosLeft + THANOS_SHOULDER.x + Math.round(thanosLean * 0.4)
  const thanosShoulderY = thanosTop + THANOS_SHOULDER.y
  // His forward is left, so the aim is mirrored.
  const fistX = thanosShoulderX - Math.cos(radians(thanosAim)) * thanosReach
  const fistY = thanosShoulderY + Math.sin(radians(thanosAim)) * thanosReach
  const charging = t > 5.2 && t < 8.3

  canvas.line(thanosShoulderX, thanosShoulderY, fistX, fistY, PURPLE_SKIN, 3)
  gauntlet(canvas, fistX, fistY, charging ? 1 : 0)

  // Thor.
  const thorX = Math.round(
    along(t, [
      [1.2, thorHome],
      [2.3, thorMelee],
      [3.1, thorMelee],
      [3.2, thorMelee - 2],
      [3.45, thorMelee],
      [4.0, thorMelee],
      [5.0, thorHome],
      [8.35, thorHome],
      [8.9, thorHome - knock],
      [9.4, thorHome - knock],
      [10, thorHome],
    ]),
  )
  const thorLift =
    t > 4 && t < 5
      ? Math.round(5 * Math.sin(Math.PI * (t - 4)))
      : t > 3.5 && t < 3.8
        ? Math.round(2 * Math.sin((Math.PI * (t - 3.5)) / 0.3))
        : 0
  const thorLean = along(t, [
    [3.1, 0],
    [3.18, -2],
    [3.45, 0],
    [8.35, 0],
    [8.5, -3],
    [9.3, -3],
    [9.6, 0],
  ])
  const thorArm = along(t, [
    [1.2, 30],
    [1.4, -70],
    [2.3, -70],
    [2.42, -90],
    [2.55, 20],
    [2.8, 20],
    [3.05, -20],
    [3.45, 110],
    [3.65, -60],
    [3.95, -60],
    [4.3, -45],
    [4.8, -45],
    [5.0, -60],
    [6.2, -60],
    [6.4, -5],
    [8.35, -5],
    [8.5, -45],
    [9.3, -45],
    [9.7, 30],
  ])
  const thorHaft = along(t, [
    [1.2, -70],
    [1.4, -100],
    [2.3, -100],
    [2.42, -90],
    [2.55, 10],
    [2.8, 10],
    [3.05, -60],
    [3.45, 120],
    [3.65, -70],
    [3.95, -70],
    [4.3, -60],
    [6.2, -60],
    [6.4, 0],
    [8.35, 0],
    [8.5, -110],
    [9.3, -110],
    [9.7, -70],
  ])
  const thorRuns = (t > 1.2 && t < 2.3) || (t > 9.4 && t < 10)
  const thorStride = thorRuns && Math.floor(t / 0.15) % 2 === 0
  const thorIdle = t < 1.2 || (t > 5 && t < 8.3) ? Math.floor((t + 0.3) / 0.6) % 2 : 0
  const thorTop = feet - THOR_ROWS - thorLift + thorIdle
  const thorLeft = thorX - THOR_CENTER

  sprite(canvas, THOR_TOP, THOR_PALETTE, thorLeft, thorTop, thorLean * 0.6)
  sprite(
    canvas,
    thorStride ? THOR_STRIDE : THOR_STAND,
    THOR_PALETTE,
    thorLeft,
    thorTop + THOR_TOP.length,
    0,
  )

  const thorShoulderX = thorLeft + THOR_SHOULDER.x + Math.round(thorLean * 0.4)
  const thorShoulderY = thorTop + THOR_SHOULDER.y
  const handX = thorShoulderX + Math.cos(radians(thorArm)) * 5
  const handY = thorShoulderY + Math.sin(radians(thorArm)) * 5

  canvas.line(thorShoulderX, thorShoulderY, handX, handY, SKIN, 2)
  const head = stormbreaker(canvas, handX, handY, thorHaft)

  canvas.set(handX, handY, BRACER)

  // Blows landing in the melee.
  for (const [at, x, y] of [
    [2.55, center + 3, feet - 13],
    [3.1, center - 5, feet - 12],
    [3.65, center + 6, feet - 15],
  ] as const) {
    if (t >= at && t < at + 0.3) {
      burst(canvas, x, y, t - at, at * 10)
    }
  }

  // Thor calls the storm; the stones wake.
  if (t > 5.25 && t < 6.3) {
    if (chance(flick, 7) > 0.25) {
      // The strip has little sky, so the bolt comes in at a slant.
      const skyX = head.x + 12 + (chance(flick, 8) - 0.5) * 14

      bolt(canvas, skyX, 0, head.x, head.y, flick, 2.5, BOLT_GLOW)
      bolt(canvas, skyX, 0, head.x, head.y, flick + 50, 1.2, BOLT_CORE)
    }

    if (chance(flick, 9) > 0.45) {
      const earthX = thorX + 9 + chance(flick, 10) * 12

      bolt(canvas, head.x, head.y, earthX, feet - 1, flick + 5, 2.5, BOLT_GLOW)
    }

    for (let i = 0; i < 4; i++) {
      canvas.set(
        head.x + (chance(flick, 20 + i) - 0.5) * 9,
        head.y + (chance(flick, 30 + i) - 0.5) * 9,
        i % 2 ? BOLT_CORE : BOLT_GLOW,
      )
    }
  }

  if (charging) {
    for (let i = 0; i < 6; i++) {
      const angle = t * 5 + (i * Math.PI) / 3
      const radius = 4 + (flick % 2)

      canvas.set(
        fistX + Math.cos(angle) * radius,
        fistY + Math.sin(angle) * radius * 0.8,
        STONES[i]! | FX,
      )
    }
  }

  // The beams, and where they meet.
  if (t >= 6.4 && t < 8.3) {
    const grow = Math.min(1, (t - 6.4) / 0.4)
    const clashX = center + Math.sin((t - 6.4) * 2.4) * width * 0.05
    const clashY = feet - 12
    const boltEndX = head.x + (clashX - head.x) * grow
    const boltEndY = head.y + (clashY - head.y) * grow
    const fromX = fistX - 3
    const beamEndX = fromX + (clashX - fromX) * grow
    const beamLength = Math.abs(fromX - beamEndX)

    bolt(canvas, head.x, head.y, boltEndX, boltEndY, flick, 2.2, BOLT_GLOW)
    bolt(canvas, head.x, head.y, boltEndX, boltEndY, flick + 9, 1.6, BOLT_GLOW)
    bolt(canvas, head.x, head.y, boltEndX, boltEndY, flick + 21, 0.7, BOLT_CORE)

    for (let i = 0; i <= beamLength; i++) {
      const x = fromX - i
      const y = fistY + ((clashY - fistY) * i) / (beamLength || 1) + Math.sin(i * 0.45 - t * 16) * 0.6

      canvas.set(x, y - 1, BEAM_GLOW)
      canvas.set(x, y + 1, BEAM_GLOW)
      canvas.set(x, y, BEAM_CORE)
      if (chance(i, flick) > 0.9) {
        canvas.set(x, y + (chance(i, flick + 1) > 0.5 ? 2 : -2), STONES[i % 6]! | FX)
      }
    }

    if (grow >= 1) {
      const swell = 2 + ((t - 6.8) / 1.5) * 2.5 + (flick % 2) * 0.6

      canvas.disc(clashX, clashY, swell + 1, flick % 2 ? BOLT_GLOW : BEAM_GLOW)
      canvas.disc(clashX, clashY, swell, WHITE)
      for (let ray = 0; ray < 7; ray++) {
        const angle = chance(flick, 40 + ray) * Math.PI * 2
        const reach = swell + 2 + chance(flick, 50 + ray) * 4

        canvas.set(
          clashX + Math.cos(angle) * reach,
          clashY + Math.sin(angle) * reach * 0.8,
          ray % 2 ? BOLT_CORE : BEAM_CORE,
        )
      }
    }
  }

  // The blast that throws them both back.
  if (t >= 8.3 && t < 8.9) {
    const age = (t - 8.3) / 0.6
    const blastY = feet - 12

    if (age < 0.3) {
      canvas.disc(center, blastY, 5 - age * 6, WHITE)
    }

    canvas.ring(center, blastY, 5 + age * 16, age < 0.5 ? SPARK : 0xff9a2e | FX)
    if (age > 0.25) {
      canvas.ring(center, blastY, 2 + age * 10, age < 0.7 ? BEAM_GLOW : BOLT_GLOW)
    }
  }

  // Dust where they skid.
  if (t > 8.4 && t < 9.3) {
    for (let i = 0; i < 5; i++) {
      canvas.set(thorX + 4 + chance(flick, 60 + i) * 8, feet - 1 - chance(flick, 70 + i) * 3, DUST)
      canvas.set(thanosX - 5 - chance(flick, 80 + i) * 8, feet - 1 - chance(flick, 90 + i) * 3, DUST)
    }
  }

  return canvas.pixels
}

const dimmed = new Map<number, number>()

function tone(pixel: number): number {
  let color = dimmed.get(pixel)

  if (color === undefined) {
    const factor = pixel & FX ? FX_DIM : DIM
    const r = Math.round(((pixel >> 16) & 0xff) * factor)
    const g = Math.round(((pixel >> 8) & 0xff) * factor)
    const b = Math.round((pixel & 0xff) * factor)

    color = (r << 16) | (g << 8) | b
    dimmed.set(pixel, color)
  }

  return color
}

/**
 * The fight at `ms`, as a Raster's cells for `columns * rows`: two pixels to a
 * cell, drawn with half blocks. An empty cell is a space on the terminal's
 * own background, which an underlay leaves unpainted.
 */
export function frame(ms: number, columns: number, rows: number): Uint32Array {
  const pixels = paint(ms, columns, rows * 2)
  const words = new Uint32Array(columns * rows * 3)

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const upper = pixels[row * 2 * columns + column]!
      const lower = pixels[(row * 2 + 1) * columns + column]!
      const at = (row * columns + column) * 3

      if (upper === NONE && lower === NONE) {
        words[at] = 0x20
        words[at + 1] = DEFAULT_COLOR
        words[at + 2] = DEFAULT_COLOR
      } else if (lower === NONE) {
        words[at] = 0x2580
        words[at + 1] = tone(upper)
        words[at + 2] = DEFAULT_COLOR
      } else if (upper === NONE) {
        words[at] = 0x2584
        words[at + 1] = tone(lower)
        words[at + 2] = DEFAULT_COLOR
      } else {
        words[at] = 0x2580
        words[at + 1] = tone(upper)
        words[at + 2] = tone(lower)
      }
    }
  }

  return words
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * The cells as a Raster takes them: standard padded base64 of the words'
 * bytes, little-endian. Written out so it runs wherever the module does.
 */
export function encode(words: Uint32Array): string {
  const bytes = new Uint8Array(words.length * 4)

  words.forEach((word, i) => {
    bytes[i * 4] = word & 0xff
    bytes[i * 4 + 1] = (word >>> 8) & 0xff
    bytes[i * 4 + 2] = (word >>> 16) & 0xff
    bytes[i * 4 + 3] = (word >>> 24) & 0xff
  })

  const parts: string[] = []

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)

    parts.push(
      BASE64[triple >> 18]! +
        BASE64[(triple >> 12) & 63]! +
        (b === undefined ? '=' : BASE64[(triple >> 6) & 63]!) +
        (c === undefined ? '=' : BASE64[triple & 63]!),
    )
  }

  return parts.join('')
}
