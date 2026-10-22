import type { ClientModule } from 'claude-code'

export type Row = { id: string; t: string; c?: string; r?: string; sh?: string }
export type TreeProps = {
  rows: Row[]
  active: string
  query: string
  footer: { t: string; tone: string; spin: boolean } | null
  preview?: { text: string; path: string; markdown: boolean; diff: boolean }
}
type Local = { phase: number; hover: number; search: boolean; q: string; stop?: () => void }

const TICK_MS = 90
const MAX_ROWS = 1_500
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const TONES: Record<string, string[]> = {
  purple: ['#a855f7', '#c084fc', '#d8b4fe', '#f3e8ff'],
  orange: ['#f97316', '#fb923c', '#fdba74', '#ffedd5'],
  green: ['#22c55e', '#4ade80', '#86efac', '#dcfce7'],
  teal: ['#14b8a6', '#2dd4bf', '#5eead4', '#ccfbf1'],
  blue: ['#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
  red: ['#ef4444', '#f87171', '#fca5a5', '#fee2e2'],
}

const shade = (i: number, phase: number, len: number, tone: string): string => {
  const palette = TONES[tone] ?? TONES.orange!
  const band = ((phase * 1.6) % (len + 8)) - 4
  const d = Math.abs(i - band)

  return palette[d < 0.8 ? 3 : d < 1.8 ? 2 : d < 2.8 ? 1 : 0]!
}

const Tree: ClientModule<TreeProps, Local> = (props, surface) => {
  const { Box, Text } = surface.elements
  let local = surface.state
  if (local === undefined) {
    local = { phase: 0, hover: -1, search: false, q: props.query }
    surface.setState(local)
  }
  const lit = props.rows.some(r => r.sh) || Boolean(props.footer?.spin)
  if (lit && !local.stop) {
    local.stop = surface.every(TICK_MS, () => {
      const cur = surface.state
      if (cur) surface.setState({ ...cur, phase: cur.phase + 1 })
    })
  } else if (!lit && local.stop) {
    local.stop()
    local.stop = undefined
  }

  surface.onPointer(e => {
    const cur = surface.state ?? local
    const y = e.y - 1
    if (e.type === 'leave' || y < 0 || y >= props.rows.length) {
      if (cur.hover !== -1) surface.setState({ ...cur, hover: -1 })
      return
    }
    if (e.type === 'move' && !e.button && cur.hover !== y) surface.setState({ ...cur, hover: y })
    if (e.type === 'down' && (e.button ?? 'left') === 'left') surface.post({ press: props.rows[y]!.id })
  })

  surface.onKey(e => {
    const cur = surface.state ?? local
    if (cur.search) {
      if (e.key === 'return') surface.setState({ ...cur, search: false })
      else if (e.key === 'backspace') {
        const q = [...cur.q].slice(0, -1).join('')
        surface.setState({ ...cur, q })
        surface.post({ query: q })
      } else if ([...e.key].length === 1 && !e.ctrl && !e.meta) {
        const q = cur.q + e.key
        surface.setState({ ...cur, q })
        surface.post({ query: q })
      }
      return
    }
    if (e.key === 's' || e.key === '/') surface.setState({ ...cur, search: true })
    else surface.post({ key: e.key, shift: Boolean(e.shift) })
  })

  if (props.preview) {
    const { Markdown, Code } = surface.elements
    const p = props.preview

    return p.markdown ? <Markdown text={p.text} /> : <Code source={p.text} path={p.path} format={p.diff ? 'diff' : 'source'} wrap="truncate-end" />
  }

  const frame = FRAMES[local.phase % FRAMES.length]!
  const paint = (text: string, tone: string | undefined, color: string | undefined) => {
    if (!tone) return <Text color={color}>{text}</Text>
    const chars = [...text]

    return <Text>{chars.map((ch, i) => <Text color={shade(i, local!.phase, chars.length, tone)}>{ch}</Text>)}</Text>
  }

  const shown = props.rows.slice(0, MAX_ROWS)
  const bar = local.search ? `/ ${local.q}▏` : props.query ? `/ ${props.query}` : 's search'

  return (
    <Box flexDirection="column">
      <Text dimColor={!local.search && !props.query} bold={local.search}>{bar}</Text>
      {shown.map((r, i) => (
        <Box flexDirection="row" height={1} overflow="hidden">
          <Box flexShrink={1} overflow="hidden">
            <Text inverse={r.id === props.active} underline={i === local!.hover}>{paint(r.t, r.sh, r.c)}</Text>
          </Box>
          <Box flexGrow={1} />
          {r.r ? <Text dimColor> {r.r}</Text> : null}
        </Box>
      ))}
      {props.rows.length > shown.length && <Text dimColor>  … {props.rows.length - shown.length} more, collapse folders or search</Text>}
      {props.footer && (
        <Text>{props.footer.spin ? `${frame} ` : ''}{paint(props.footer.t, props.footer.spin ? props.footer.tone : undefined, undefined)}</Text>
      )}
    </Box>
  )
}

export default Tree
