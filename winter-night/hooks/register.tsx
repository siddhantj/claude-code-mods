import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { makeColors } from './make-colors.js'
import { levelFor, snowfall, terminalSnow, weather } from './snow'

const NAME = 'winter-night'

// Off until the person asks. Kept for the session, so a reload leaves it.
const isOn = atom({ plugin: 'winter-night', key: 'isOn' } as const, false)

// A winter night: indigo ground, snow-white words, ice-blue accent.
const { theme, problems } = makeColors({
  label: 'Snowfall',
  only: 'dark',
  roles: { accent: '#8fc4ea', danger: '#d9645a', success: '#6fae8a', warning: '#e0a13c', pro: '#a58cd8' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#11152b',
        'surface-1': '#171c35',
        'surface-2': '#1d2340',
        'surface-3': '#212846',
        'text-primary': '#eef1fa',
        'text-secondary': '#cdd2e2',
        'text-muted': '#a4aabf',
      },
    },
  },
})

// Where auto-compaction runs when the engine doesn't say: this share of the window.
const FALLBACK_THRESHOLD = 0.9

// The level on screen. A reload starts it over, and session.start sets the
// theme again anyway.
let shown = -1
// The token count at which auto-compaction runs, read once a session and
// again after a compaction.
let threshold: number | undefined
// Moves the terminal's snow on, one step per timer tick.
let step = 0
let tick: Timer | undefined

// The desktop app (as of 2.1.331) paints a still ground but doesn't draw a
// live scene, and it repaints a theme only when it reconnects to the session.
// So the snowfall there is a still ground, and the theme is set again as the
// level changes: the newest set is the one the app shows when it next reconnects.
async function show($: EngineInterface, level: number): Promise<void> {
  shown = level
  await $.theme.set({ colors: theme, overrideColorScheme: 'dark', backdrop: snowfall(level) })
  $.ui.invalidate('ui.render')
}

async function readThreshold($: EngineInterface): Promise<void> {
  const { context } = await $.session.usage({ breakdown: 'summary' })

  threshold = context.breakdown?.autoCompactThreshold ?? context.window * FALLBACK_THRESHOLD
}

async function sync($: EngineInterface): Promise<void> {
  if (!(await read($, isOn))) {
    return
  }

  const { context } = await $.session.usage()
  const limit = threshold ?? context.window * FALLBACK_THRESHOLD
  const tokens = context.tokens ?? 0
  const wanted = levelFor(tokens, limit)

  $.ui.status(`❄ ${weather(wanted)} · ${Math.min(100, Math.round((tokens / limit) * 100))}% of the way to auto-compact`)

  if (wanted !== shown) {
    await show($, wanted)
  }
}

// The terminal draws no backdrop: its snow is glyphs that fall on a timer,
// in the fullscreen layout.
async function start($: EngineInterface): Promise<void> {
  shown = -1
  await readThreshold($).catch(() => undefined)
  await sync($).catch(() => show($, 0))
  tick?.cancel()
  tick = $.clock.every(700, () => {
    step++
    $.ui.invalidate('ui.render')
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await $.command.register({ name: NAME, description: 'Turn the winter night theme and its snow on or off' })

    // A reload stops the timer and keeps the switch: start it again.
    if (await read($, isOn)) {
      await start($)
    }

    return next(e)
  })

  on('command.run', { command: NAME }, async $ => {
    const next = !(await read($, isOn))

    await update($, isOn, () => next)

    if (next) {
      await start($)

      return {
        text: 'Winter night: on. Snow falls harder as the context window fills. Run /winter-night again to turn it off.',
        isTextDisplayOnly: true,
      }
    }

    tick?.cancel()
    tick = undefined
    shown = -1
    // The person asked for it gone: this clears the theme, whichever mod set it.
    await $.theme.clear()
    $.ui.status(undefined)
    $.ui.invalidate('ui.render')

    return { text: 'Winter night: off.', isTextDisplayOnly: true }
  }).catch(() => ({ text: 'Winter night could not change.', isTextDisplayOnly: true }))

  on('ui.render', { component: 'Underlay' }, async ($, e, next) => {
    if (!(await read($, isOn))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const { columns, rows } = e.props

    return (
      <Box flexDirection="column">
        {terminalSnow(Math.max(shown, 0), columns, rows, step).map((line, row) => (
          <Text key={`row${row}`} color="#c9d3ee">
            {line}
          </Text>
        ))}
      </Box>
    )
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
    await readThreshold($).catch(() => undefined)
    await sync($).catch(() => undefined)

    return result
  })
}
