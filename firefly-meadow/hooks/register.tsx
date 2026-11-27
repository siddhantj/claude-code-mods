import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { makeColors } from './make-colors.js'
import { meadow } from './meadow'

const NAME = 'firefly-meadow'

// Off until the person asks. Kept for the session, so a reload leaves it.
const isOn = atom({ plugin: 'firefly-meadow', key: 'isOn' } as const, false)

// Twelve at an empty window, eighty-seven at a full one, three more for every
// 4% of context. Steps, not a slope: each change sets the whole theme again.
const STEP_PERCENT = 4
const PER_STEP = 3
const FEWEST = 12

export function countFor(percent: number): number {
  const filled = Math.min(100, Math.max(0, percent))

  return FEWEST + Math.floor(filled / STEP_PERCENT) * PER_STEP
}

// A dusk made for the dark: indigo ground, firefly-gold accent.
const { theme, problems } = makeColors({
  label: 'Firefly meadow',
  only: 'dark',
  roles: { accent: '#cfdc54', danger: '#d9645a', success: '#6fae6a', warning: '#e0a13c', pro: '#a58cd8' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#13152b',
        'surface-1': '#191c35',
        'surface-2': '#1f2240',
        'surface-3': '#232746',
        'text-primary': '#f2ebda',
        'text-secondary': '#d2cabd',
        'text-muted': '#aaa5a8',
      },
    },
  },
})

// The count on screen. A reload starts it over, and session.start sets the
// theme again anyway.
let shown = -1

// The desktop app (as of 2.1.331) paints a still ground but doesn't draw a
// live scene, and it repaints a theme only when it reconnects to the session.
// So the meadow is a still ground, and the theme is set again as the count
// changes: the newest set is the one the app shows when it next reconnects.
async function show($: EngineInterface, count: number): Promise<void> {
  shown = count
  const set = await $.theme.set({ colors: theme, overrideColorScheme: 'dark', backdrop: meadow(count) })
  $.ui.status(set.isDrawn ? undefined : set.reason)
}

async function sync($: EngineInterface): Promise<void> {
  if (!(await read($, isOn))) {
    return
  }

  const { context } = await $.session.usage()
  const wanted = countFor(context.percent ?? 0)

  if (wanted !== shown) {
    await show($, wanted)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await $.command.register({ name: NAME, description: 'Turn the firefly meadow theme on or off' })
    shown = -1
    await sync($).catch(() => show($, FEWEST))

    return next(e)
  })

  on('command.run', { command: NAME }, async $ => {
    const next = !(await read($, isOn))

    await update($, isOn, () => next)
    shown = -1

    if (next) {
      await sync($).catch(() => show($, FEWEST))

      return {
        text: 'Firefly meadow: on. Fireflies multiply as the context window fills. Run /firefly-meadow again to turn it off.',
        isTextDisplayOnly: true,
      }
    }

    // The person asked for it gone: this clears the theme, whichever mod set it.
    await $.theme.clear()
    $.ui.status(undefined)

    return { text: 'Firefly meadow: off.', isTextDisplayOnly: true }
  }).catch(() => ({ text: 'Firefly meadow could not change.', isTextDisplayOnly: true }))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await sync($).catch(() => undefined)

    return result
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    void sync($).catch(() => undefined)

    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    await sync($).catch(() => undefined)

    return result
  })
}
