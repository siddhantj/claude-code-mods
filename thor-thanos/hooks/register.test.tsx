import { expect, mock, test } from 'claude-code/testing'
import type { UiBlitArgs } from 'claude-code'

import { encode, frame, LOOP_MS } from './scene'

const UNDERLAY = {
  plugin: 'thor-thanos',
  surface: 'terminal',
  component: 'Underlay',
  props: { columns: 120, rows: 40, isWorking: false, view: {} },
} as const

const GLYPHS = [0x20, 0x2580, 0x2584]

// The command as the person's Enter raises it in a fullscreen terminal.
const TYPED = {
  command: 'thor-thanos',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 120 },
} as const

test('the fight is off until /thor-thanos, then plays and stops', async ($, on) => {
  const clock = mock.clock(on)
  const blits: UiBlitArgs[] = []

  // Each hook here stands for the engine.
  on('command.register', () => ({ value: { command: 'thor-thanos' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.blit', (_, e) => {
    blits.push(e)

    return { value: {} }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // Off: the mod passes, so the engine's own answer stands.
  const before = await $.ui.mount(UNDERLAY)

  expect(await before.find({ type: 'Raster' })).toBeUndefined()
  await before.unmount()

  const on_ = await $.command.run(TYPED)

  expect(on_.text).toMatch(/on/)

  const ui = await $.ui.mount(UNDERLAY)
  const raster = await ui.find({ type: 'Raster', key: 'fight' })

  expect(raster?.props.columns).toBe(120)
  expect(raster?.props.rows).toBe(16)
  // The fight opens on its first beat.
  expect(raster?.props.cells).toBe(encode(frame(0, 120, 16)))

  // Ten frames a second, each the fight at that moment of its loop.
  await clock.advance(1000)
  expect(blits.length).toBeGreaterThanOrEqual(9)
  expect(blits.at(-1)).toMatchObject({ requestId: 'site:underlay', key: 'fight', columns: 120, rows: 16 })
  expect((blits.at(-1) as { cells: string }).cells).toBe(encode(frame(1000, 120, 16)))

  // And around again: the frame at 10.5 s is the frame at 0.5 s.
  await clock.advance(9500)
  expect((blits.at(-1) as { cells: string }).cells).toBe(encode(frame(500, 120, 16)))

  const off = await $.command.run(TYPED)
  const count = blits.length

  expect(off.text).toMatch(/off/)
  await clock.advance(1000)
  expect(blits.length).toBe(count)
  await ui.unmount()

  // Off again: the mod passes once more.
  const after = await $.ui.mount(UNDERLAY)

  expect(await after.find({ type: 'Raster' })).toBeUndefined()
  await after.unmount()
})

test('a window too small for the fighters draws nothing', async ($, on) => {
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'thor-thanos' } }))
  on('state.get', () => ({ value: { value: true, version: 1 } }) as never)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({ ...UNDERLAY, props: { ...UNDERLAY.props, columns: 50, rows: 12 } })

  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('the loop closes and every cell is one a Raster takes', () => {
  expect(encode(frame(0, 120, 16))).toBe(encode(frame(LOOP_MS, 120, 16)))

  for (let ms = 0; ms < LOOP_MS; ms += 100) {
    const words = frame(ms, 160, 16)
    const pairs = new Set<string>()
    let strays = 0

    expect(words.length).toBe(160 * 16 * 3)
    for (let i = 0; i < words.length; i += 3) {
      strays += GLYPHS.includes(words[i]!) ? 0 : 1
      pairs.add(`${words[i + 1]}:${words[i + 2]}`)
    }

    expect(strays).toBe(0)

    // A Raster paints 1024 distinct color pairs at once.
    expect(pairs.size).toBeLessThan(1024)
  }
})

test('both fighters, the lightning and the beam are in the clash', () => {
  const words = frame(7500, 160, 16)
  const colors = new Set<number>()

  for (let i = 0; i < words.length; i += 3) {
    colors.add(words[i + 1]!)
    colors.add(words[i + 2]!)
  }

  const has = (rgb: number, factor: number): boolean =>
    colors.has(
      (Math.round(((rgb >> 16) & 0xff) * factor) << 16) |
        (Math.round(((rgb >> 8) & 0xff) * factor) << 8) |
        Math.round((rgb & 0xff) * factor),
    )

  expect(has(0xc22630, 0.6)).toBe(true) // Thor's cape
  expect(has(0x8e5bb5, 0.6)).toBe(true) // Thanos
  expect(has(0xd4a437, 0.6)).toBe(true) // the gauntlet's gold
  expect(has(0x5fb8ff, 0.92)).toBe(true) // lightning
  expect(has(0x9b4dff, 0.92)).toBe(true) // the beam
})

test('on the main screen the command says why nothing shows', async ($, on) => {
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'thor-thanos' } }))

  const ran = await $.command.run({ ...TYPED, presentation: { isFullscreen: false, columns: 120 } })

  expect(ran.text).toMatch(/main screen/)
})
