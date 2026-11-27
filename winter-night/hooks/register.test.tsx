import { expect, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

import { flakeCount, FLAKE, LEVELS, levelFor, snowfall, STORM_LEVEL, terminalSnow, weather } from './snow'

function paths(look: ThemeSetArgs | undefined): { d: string; color: string }[] {
  const backdrop = look?.backdrop

  return backdrop !== undefined && 'vector' in backdrop
    ? (backdrop.vector?.paths ?? []).flatMap(p => (typeof p === 'string' ? [] : [{ d: p.d, color: String(p.color) }]))
    : []
}

const closed = (list: { d: string }[]): number => list.reduce((sum, p) => sum + (p.d.match(/Z/g) ?? []).length, 0)

// Flakes of every depth share the flake color, the far ones with an alpha.
const flakes = (look: ThemeSetArgs | undefined): number =>
  closed(paths(look).filter(p => p.color.startsWith(FLAKE)))

// The command as the person's Enter raises it.
const TYPED = {
  command: 'winter-night',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 120 },
} as const

test('the picture stays inside what a ground takes, at every level', async () => {
  for (let level = 0; level <= LEVELS; level++) {
    const { vector } = snowfall(level)

    expect(vector.paths.length <= 64).toBe(true)
  }

  expect(flakeCount(LEVELS) > flakeCount(10) * 2).toBe(true)
  expect(weather(0)).toBe('flurries')
  expect(weather(LEVELS)).toBe('snowstorm')
  expect(levelFor(95, 100) >= STORM_LEVEL).toBe(true)
})

test('more context means more snow, and a storm near auto-compaction', async ($, on) => {
  let tokens = 0
  const looks: ThemeSetArgs[] = []
  const statuses: string[] = []
  // Each hook here stands for the engine. Auto-compaction runs at 180,000.
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens, breakdown: { autoCompactThreshold: 180000 } } },
  }) as never)
  on('theme.set', (_, e) => {
    looks.push(e as ThemeSetArgs)

    return { value: { isDrawn: true, requestId: 'backdrop' } } as never
  })
  let clears = 0
  on('command.register', () => ({ value: { command: 'winter-night' } }))
  on('theme.clear', () => {
    clears++

    return { value: { isDrawn: false, requestId: 'backdrop' } } as never
  })
  on('ui.status', (_, e) => {
    statuses.push(JSON.stringify(e))

    return { value: {} } as never
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 20))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  // Off until the person asks: nothing is set at the start.
  expect(looks.length).toBe(0)

  const turnedOn = await $.command.run(TYPED)

  expect(turnedOn.text).toMatch(/on/)
  expect(flakes(looks.at(-1))).toBe(flakeCount(0))
  expect(looks.at(-1)?.colors).toBeDefined()

  tokens = 90000
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await settle()
  expect(flakes(looks.at(-1))).toBe(flakeCount(10))

  // The same step sets nothing again.
  const before = looks.length
  tokens = 91000
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await settle()
  expect(looks.length).toBe(before)

  tokens = 175000
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await settle()
  expect(flakes(looks.at(-1))).toBe(flakeCount(19))
  expect(statuses.at(-1)?.includes('snowstorm')).toBe(true)

  // Off again: the theme is cleared and later tool calls set nothing.
  const turnedOff = await $.command.run(TYPED)
  const count = looks.length

  expect(turnedOff.text).toMatch(/off/)
  expect(clears).toBe(1)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await settle()
  expect(looks.length).toBe(count)
})

test('the terminal gets falling snow, thicker in a storm', async () => {
  const count = (lines: string[]): number => lines.join('').replace(/ /g, '').length
  const calm = terminalSnow(2, 120, 40, 0)
  const storm = terminalSnow(LEVELS, 120, 40, 0)

  expect(calm.length).toBe(40)
  expect(calm.every(line => line.length <= 119)).toBe(true)
  expect(count(storm) > count(calm) * 3).toBe(true)
  // It moves from one step to the next.
  expect(terminalSnow(10, 120, 40, 1).join('|') !== terminalSnow(10, 120, 40, 0).join('|')).toBe(true)
})
