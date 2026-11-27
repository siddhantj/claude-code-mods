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

test('more of the context window means more fireflies', async ($, on) => {
  let percent = 0
  const looks: ThemeSetArgs[] = []
  // Each hook here stands for the engine.
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent } } }) as never)
  on('theme.set', (_, e) => {
    looks.push(e as ThemeSetArgs)

    return { value: { isDrawn: true, requestId: 'backdrop' } } as never
  })
  on('ui.status', () => ({ value: {} }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 20))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
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
})
