import type { EngineInterface, Register } from 'claude-code'

import { makeColors } from './make-colors.js'
import { meadow } from './meadow'

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
    shown = -1
    await sync($).catch(() => show($, FEWEST))

    return next(e)
  })

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
