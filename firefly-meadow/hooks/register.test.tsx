import { expect, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

// The core color of a firefly, as meadow.ts draws it: each core is one closed circle.
const CORE = '#fbfcd2'

function fireflyCount(look: ThemeSetArgs | undefined): number {
  const backdrop = look?.backdrop
  const paths = backdrop !== undefined && 'vector' in backdrop ? (backdrop.vector?.paths ?? []) : []

  return paths
    .filter(p => typeof p !== 'string' && p.color === CORE)
    .reduce((sum, p) => sum + (typeof p === 'string' ? 0 : (p.d.match(/Z/g) ?? []).length), 0)
}

// The command as the person's Enter raises it.
const TYPED = {
  command: 'firefly-meadow',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 120 },
} as const

test('more of the context window means more fireflies', async ($, on) => {
  let percent = 0
  const looks: ThemeSetArgs[] = []
  // Each hook here stands for the engine.
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent } } }) as never)
  on('theme.set', (_, e) => {
    looks.push(e as ThemeSetArgs)

    return { value: { isDrawn: true, requestId: 'backdrop' } } as never
  })
  let clears = 0
  on('command.register', () => ({ value: { command: 'firefly-meadow' } }))
  on('theme.clear', () => {
    clears++

    return { value: { isDrawn: false, requestId: 'backdrop' } } as never
  })
  on('ui.status', () => ({ value: {} }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 20))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  // Off until the person asks: nothing is set at the start.
  expect(looks.length).toBe(0)

  const turnedOn = await $.command.run(TYPED)

  expect(turnedOn.text).toMatch(/on/)
  expect(fireflyCount(looks.at(-1))).toBe(12)
  expect(looks.at(-1)?.colors).toBeDefined()

  percent = 50
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await settle()
  expect(fireflyCount(looks.at(-1))).toBe(48)

  // The same step sets nothing again.
  const before = looks.length
  percent = 51
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await settle()
  expect(looks.length).toBe(before)

  percent = 100
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await settle()
  expect(fireflyCount(looks.at(-1))).toBe(87)

  // Off again: the theme is cleared and later tool calls set nothing.
  const turnedOff = await $.command.run(TYPED)
  const count = looks.length

  expect(turnedOff.text).toMatch(/off/)
  expect(clears).toBe(1)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await settle()
  expect(looks.length).toBe(count)
})
