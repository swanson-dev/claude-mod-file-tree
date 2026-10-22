const NERD: Record<string, string> = {
  md: '\u{e73e}', ts: '\u{e628}', tsx: '\u{e7ba}', js: '\u{e74e}', jsx: '\u{e7ba}', py: '\u{e606}', json: '\u{e60b}',
  rs: '\u{e7a8}', go: '\u{e627}', cs: '\u{f031b}', yml: '\u{e6a8}', yaml: '\u{e6a8}', toml: '\u{e6b2}', html: '\u{e736}',
  css: '\u{e749}', sh: '\u{f489}', png: '\u{f1c5}', jpg: '\u{f1c5}', svg: '\u{f1c5}', lock: '\u{f023}',
}
const PLAIN: Record<string, string> = {
  md: '¶', ts: '‹›', tsx: '‹›', js: '‹›', jsx: '‹›', py: '‹›', rs: '‹›', go: '‹›', cs: '‹›', sh: '‹›', html: '‹›', css: '‹›',
  json: '{}', yml: '≡', yaml: '≡', toml: '≡', png: '▣', jpg: '▣', svg: '▣', lock: '◈',
}

export type GlyphSet = 'nerd' | 'plain'

export const icon = (name: string, isDir: boolean, isOpen: boolean, set: GlyphSet): string => {
  if (isDir) return set === 'nerd' ? (isOpen ? '\u{f07c}' : '\u{f07b}') : isOpen ? '▾' : '▸'
  const ext = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : ''

  return set === 'nerd' ? (NERD[ext] ?? '\u{f15b}') : (PLAIN[ext] ?? '·')
}

export const age = (now: number, mtimeMs: number): string => {
  const s = Math.max(0, Math.round((now - mtimeMs) / 1000))
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  const d = new Date(mtimeMs)
  const month = d.toLocaleString('en', { month: 'short' })

  return now - mtimeMs > 365 * 86400_000 ? String(d.getFullYear()) : `${month} ${d.getDate()}`
}

export const bytes = (n: number): string => {
  if (n < 1024) return `${n}B`
  const units = ['K', 'M', 'G', 'T']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }

  return `${v < 10 ? v.toFixed(1) : Math.round(v)}${units[i]}`
}
