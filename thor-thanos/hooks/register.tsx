import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { encode, frame, LOOP_MS } from './scene'

const NAME = 'thor-thanos'
// The underlay's own address, which a blit names to repaint its Raster.
const SITE = 'site:underlay'
const KEY = 'fight'
// Sixteen rows is 32 pixels: room for Thanos, a raised axe and a little sky.
const STRIP_ROWS = 16
// Rows left free under the strip for the message box and its footer.
const ABOVE_PROMPT = 5
const FRAME_MS = 100
// Below this the fighters would not fit, so nothing is drawn.
const FEWEST_COLUMNS = 60
const FEWEST_ROWS = 10

// Off until the person asks. Kept for the session, so a reload leaves it.
const isOn = atom({ plugin: 'thor-thanos', key: 'isOn' } as const, false)

export function stripRows(windowRows: number): number {
  return Math.min(STRIP_ROWS, windowRows - ABOVE_PROMPT - 2)
}

function cells(ms: number, columns: number, rows: number): string {
  return encode(frame(ms, columns, rows))
}

let timer: Timer | undefined
// When the loop began, so the fight opens on its first beat.
let startedAt = 0
let playedMs = 0
// The Raster as last drawn: a blit has to name the mounted size.
let mounted: { columns: number; rows: number } | undefined

async function step($: EngineInterface): Promise<void> {
  playedMs = ((await $.clock.now()) - startedAt) % LOOP_MS

  if (mounted === undefined) {
    return
  }

  const { columns, rows } = mounted

  // Refused while nothing is mounted (a resize, another view): the next
  // frame tries again.
  await $.ui.blit({ requestId: SITE, key: KEY, cells: cells(playedMs, columns, rows), columns, rows })
}

async function play($: EngineInterface): Promise<void> {
  timer?.cancel()
  startedAt = await $.clock.now()
  playedMs = 0
  timer = $.clock.every(FRAME_MS, () => {
    step($).catch(() => {})
  })
}

function stop(): void {
  timer?.cancel()
  timer = undefined
  mounted = undefined
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: NAME,
      description: 'Turn the Thor vs Thanos fight behind the chat on or off',
    })

    // A reload stops the timer and keeps the switch: start it again.
    if (await read($, isOn)) {
      await play($)
    }

    return next(e)
  })

  on('command.run', { command: NAME }, async ($, e) => {
    const next = !(await read($, isOn))

    if (next) {
      await play($)
    } else {
      stop()
    }

    await update($, isOn, () => next)

    if (!next) {
      return { text: 'Thor vs Thanos: off.', isTextDisplayOnly: true }
    }

    // The engine stamps where the answer shows; only the main screen is a
    // place the underlay is never raised.
    const isMainScreen = e.presentation?.isFullscreen === false

    return {
      text: isMainScreen
        ? 'Thor vs Thanos is on, but this terminal is on the main screen, where nothing can be drawn behind the chat. It shows in the fullscreen layout.'
        : 'Thor vs Thanos: on. The fight plays along the bottom, behind the chat. Run /thor-thanos again to stop it.',
      isTextDisplayOnly: true,
    }
  }).catch(() => ({ text: 'Thor vs Thanos could not start.', isTextDisplayOnly: true }))

  on('ui.render', { component: 'Underlay' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !(await read($, isOn))) {
      return next(e)
    }

    const { columns } = e.props
    const rows = stripRows(e.props.rows)

    if (columns < FEWEST_COLUMNS || rows < FEWEST_ROWS) {
      mounted = undefined

      return next(e)
    }

    const { Box, Raster } = $.ui.resolve(e)

    mounted = { columns, rows }

    return (
      <Box>
        <Box position="absolute" left={0} bottom={ABOVE_PROMPT}>
          <Raster key={KEY} columns={columns} rows={rows} cells={cells(playedMs, columns, rows)} />
        </Box>
      </Box>
    )
  })
}
