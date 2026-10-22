import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { gitActions, readCandidates } from './bash'
import { age, bytes, icon } from './icons'
import type { TreeProps } from './tree'
import type { Change, Column, TreeEntry } from '../types'

const PANE = 'file-tree'
const GLOW_MS = 8_000
const OP_MS = 8_000
const MAX_RESULTS = 200
const MAX_PREVIEW = 100_000
const DOUBLE_MS = 500
const COLORS = { M: '#e5c07b', A: '#98c379', '?': '#98c379', D: '#e06c75', R: '#61afef', dir: '#61afef' } as const
const TONE = { read: 'purple', write: 'orange' } as const

const open = atom({ plugin: 'file-tree', key: 'open' } as const, [])
const tree = atom({ plugin: 'file-tree', key: 'tree' } as const, {})
const changes = atom({ plugin: 'file-tree', key: 'changes' } as const, {})
const branch = atom({ plugin: 'file-tree', key: 'branch' } as const, '')
const files = atom({ plugin: 'file-tree', key: 'files' } as const, [])
const query = atom({ plugin: 'file-tree', key: 'query' } as const, '')
const selected = atom({ plugin: 'file-tree', key: 'selected' } as const, '')
const cursor = atom({ plugin: 'file-tree', key: 'cursor' } as const, '')
const touched = atom({ plugin: 'file-tree', key: 'touched' } as const, {})
const sizes = atom({ plugin: 'file-tree', key: 'sizes' } as const, {})
const column = atom({ plugin: 'file-tree', key: 'column' } as const, 'date')
const preview = atom({ plugin: 'file-tree', key: 'preview' } as const, null)
const gitop = atom({ plugin: 'file-tree', key: 'gitop' } as const, null)
const press = atom({ plugin: 'file-tree', key: 'press' } as const, { id: '', at: 0 })

type Settings = { reads: boolean; writes: boolean; follow: boolean; open: string; glyphs: string }
let settings: Settings = { reads: true, writes: true, follow: true, open: 'preview', glyphs: 'auto' }
let ignored = new Set(['.git', 'node_modules', '.tmp'])

type Node = { id: string; name: string; isDir: boolean; depth: number; size: number; mtimeMs: number }

const join = (dir: string, name: string) => (dir === '.' ? name : `${dir}/${name}`)
const parent = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.')
const ancestors = (path: string) => path.split('/').slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join('/'))

const load = async ($: any, dir: string) => {
  const found = await $.fs.list(dir).catch(() => [])
  const entries: TreeEntry[] = found
    .filter((one: { name: string }) => !ignored.has(one.name))
    .map((one: { name: string; kind: string; size: number; mtimeMs: number }) => ({ name: one.name, isDir: one.kind === 'dir', size: one.size, mtimeMs: one.mtimeMs }))
    .sort((a: TreeEntry, b: TreeEntry) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
  await update($, tree, all => ({ ...all, [dir]: entries }))
}

const git = async ($: any, args: string[], ok: number[] = [0]) => {
  const run = await $.process.run(['git', ...args], { timeoutMs: 10_000 }).catch(() => undefined)
  return run && ok.includes(run.exitCode) ? (run.stdout as string) : undefined
}

const loadGit = async ($: any) => {
  const status = await git($, ['status', '--porcelain=v1', '-b', '-uall'])
  const next: Record<string, Change> = {}
  let head = ''
  for (const line of (status ?? '').split('\n')) {
    if (line.startsWith('## ')) head = line.slice(3)
    else if (line.length > 3) {
      const code = line.slice(0, 2).replace(' ', '')[0] ?? 'M'
      next[line.slice(3).split(' -> ').pop()!.replace(/^"|"$/g, '')] = { code, add: 0, del: 0 }
    }
  }
  for (const line of ((await git($, ['diff', '--numstat', 'HEAD'])) ?? '').split('\n')) {
    const [add, del, path] = line.split('\t')
    if (path && next[path]) next[path] = { ...next[path]!, add: Number(add) || 0, del: Number(del) || 0 }
  }
  const listed = (await git($, ['ls-files', '-co', '--exclude-standard'])) ?? ''
  await update($, changes, () => next)
  await update($, branch, () => head)
  await update($, files, () => listed.split('\n').filter(p => p && !p.split('/').some(n => ignored.has(n))).slice(0, 20_000))
}

const loadSizes = async ($: any) => {
  const all = await read($, tree)
  const dirs = [...new Set(['.', ...Object.keys(all)])].flatMap(dir => (all[dir] ?? []).filter(e => e.isDir).map(e => join(dir, e.name))).slice(0, 60)
  const done = await Promise.all(dirs.map(async dir => {
    const run = await $.process.run(['du', '-sk', dir], { timeoutMs: 8_000 }).catch(() => undefined)
    const kb = run && run.exitCode === 0 ? Number(String(run.stdout).split('\t')[0]) : NaN

    return Number.isFinite(kb) ? ([dir, kb * 1024] as const) : undefined
  }))
  await update($, sizes, cur => ({ ...cur, ...Object.fromEntries(done.filter(Boolean) as [string, number][]) }))
}

const refresh = async ($: any) => {
  const dirs = ['.', ...(await read($, open))]
  await Promise.all([...dirs.map(dir => load($, dir)), loadGit($)])
  if ((await read($, column)) === 'size') await loadSizes($)
}

const visible = async ($: any): Promise<Node[]> => {
  const [expanded, all, flat, q] = await Promise.all([read($, open), read($, tree), read($, files), read($, query)])
  const needle = q.trim().toLowerCase()
  if (needle) {
    return flat.filter(p => p.toLowerCase().includes(needle)).slice(0, MAX_RESULTS)
      .map(p => ({ id: p, name: p, isDir: false, depth: 0, size: 0, mtimeMs: 0 }))
  }
  const isOpen = new Set(expanded)
  const out: Node[] = []
  const walk = (dir: string, depth: number) => {
    for (const entry of all[dir] ?? []) {
      const id = join(dir, entry.name)
      out.push({ id, name: entry.name, isDir: entry.isDir, depth, size: entry.size, mtimeMs: entry.mtimeMs })
      if (entry.isDir && isOpen.has(id)) walk(id, depth + 1)
    }
  }
  walk('.', 0)

  return out
}

const toggle = async ($: any, dir: string, force?: boolean) => {
  const isOpen = (await read($, open)).includes(dir)
  if (isOpen === force) return
  if (!isOpen) await load($, dir)
  await update($, open, list => (isOpen ? list.filter(p => p !== dir) : [...list, dir]))
  if (!isOpen && (await read($, column)) === 'size') void loadSizes($)
}

const reveal = async ($: any, path: string) => {
  const dirs = ancestors(path)
  await Promise.all(dirs.map(dir => load($, dir)))
  await update($, open, list => [...new Set([...list, ...dirs])])
}

const glow = async ($: any, path: string, kind: 'read' | 'write') => {
  const until = (await $.clock.now()) + GLOW_MS
  await update($, touched, all => ({ ...all, [path]: { kind, until } }))
  $.clock.after(GLOW_MS + 100, () => void update($, touched, all => {
    const { [path]: gone, ...rest } = all
    return gone && gone.until <= until ? rest : all
  }))
}

const relative = async ($: any, file: string) => {
  const cwd: string = await $.session.cwd()
  const rel = file.startsWith(`${cwd}/`) ? file.slice(cwd.length + 1) : file

  return rel.replace(/^\.\//, '').replace(/\/$/, '')
}

const touch = async ($: any, file: string, kind: 'read' | 'write') => {
  const rel = await relative($, file)
  if (rel.startsWith('/') || rel.startsWith('..') || rel === '' || rel.split('/').some(n => ignored.has(n))) return
  await reveal($, rel)
  await glow($, rel, kind)
  if (settings.follow) await update($, cursor, () => rel)
}

const showDiff = async ($: any, path: string) => {
  const isUntracked = (await read($, changes))[path]?.code === '?'
  const text = isUntracked
    ? await git($, ['diff', '--no-index', '--', '/dev/null', path], [0, 1])
    : await git($, ['diff', 'HEAD', '--', path])
  const body = (text ?? '').slice(0, MAX_PREVIEW * 2)
  await update($, preview, () => ({ path, mode: 'diff', text: body, note: body ? `diff: ${path}` : `no changes: ${path}` }))
}

const showFile = async ($: any, path: string) => {
  const text = await $.fs.read(path).catch(() => undefined)
  const body = typeof text === 'string' ? text.slice(0, MAX_PREVIEW) : ''
  await update($, preview, () => ({ path, mode: 'file', text: body, note: typeof text === 'string' ? path : `cannot preview ${path}` }))
}

const openFile = async ($: any, path: string) => {
  await update($, selected, () => path)
  if (settings.open === 'preview' || !settings.open.trim()) return showFile($, path)
  const words = settings.open.trim().split(/\s+/)
  const argv = words.some(w => w.includes('{path}')) ? words.map(w => w.replaceAll('{path}', path)) : [...words, path]
  await $.process.run(argv, { timeoutMs: 10_000 }).catch(() => undefined)
}

const closePreview = ($: any) => update($, preview, () => null)

const cycle = async ($: any) => {
  const next = ({ date: 'age', age: 'size', size: 'date' } as Record<Column, Column>)[await read($, column)]
  await update($, column, () => next)
  if (next === 'size') await loadSizes($)
}

const move = async ($: any, key: string) => {
  const nodes = await visible($)
  if (nodes.length === 0) return
  const current = await read($, cursor)
  const i = Math.max(0, nodes.findIndex(n => n.id === current))
  const here = nodes[i]!
  const go = (j: number) => update($, cursor, () => nodes[Math.max(0, Math.min(nodes.length - 1, j))]!.id)
  if (key === 'j' || key === 'down') await go(i + 1)
  else if (key === 'k' || key === 'up') await go(i - 1)
  else if (key === 'home' || key === 'g') await go(0)
  else if (key === 'end' || key === 'G') await go(nodes.length - 1)
  else if (key === 'l' || key === 'right') {
    if (here.isDir && !(await read($, open)).includes(here.id)) await toggle($, here.id, true)
    else await go(i + 1)
  } else if (key === 'h' || key === 'left') {
    if (here.isDir && (await read($, open)).includes(here.id)) await toggle($, here.id, false)
    else await update($, cursor, () => (parent(here.id) === '.' ? here.id : parent(here.id)))
  } else if (key === 'o' || key === 'return') {
    if (here.isDir) await toggle($, here.id)
    else await openFile($, here.id)
  } else if (key === 'd') await showDiff($, here.id)
  else if (key === 'r') await refresh($)
  else if (key === 'z') await cycle($)
}

const pressRow = async ($: any, id: string) => {
  const now = await $.clock.now()
  const last = await read($, press)
  await update($, press, () => ({ id, at: now }))
  await update($, cursor, () => id)
  const nodes = await visible($)
  const node = nodes.find(n => n.id === id)
  if (!node) return
  if (node.isDir) return toggle($, id)
  if (last.id === id && now - last.at < DOUBLE_MS) return openFile($, id)
  await update($, selected, cur => (cur === id ? '' : id))
}

const bashEffects = async ($: any, command: string, stdout: string, failed: boolean, started: boolean) => {
  const actions = gitActions(command)
  if (actions.length) {
    const first = actions[0]!
    const label = (key: 'running' | 'done') => actions.map(a => a[key]).join(' · ')
    if (started) await update($, gitop, () => ({ label: label('running'), tone: first.tone, state: 'running' }))
    else {
      await update($, gitop, () => ({ label: failed ? `${label('running')} failed` : label('done'), tone: failed ? 'red' : first.tone, state: failed ? 'failed' : 'done' }))
      $.clock.after(OP_MS, () => void update($, gitop, cur => (cur && cur.state !== 'running' ? null : cur)))
    }
  }
  if (started) return
  if (settings.reads && !failed) {
    const listed = stdout.split('\n').slice(0, 40).map(l => l.split(':')[0]!.trim())
    const candidates = [...new Set([...readCandidates(command), ...(readCandidates(command).length ? listed : [])])].slice(0, 25)
    const rels = await Promise.all(candidates.map(c => relative($, c)))
    const exists = await Promise.all(rels.map(r => (r && !r.startsWith('/') && !r.startsWith('..') ? $.fs.exists(r).catch(() => false) : false)))
    const hits = rels.filter((_, i) => exists[i]).slice(0, 5)
    for (const rel of hits) await touch($, rel, 'read')
  }
  await refresh($)
}

const start = async ($: any) => {
  await refresh($)
  return $.ui.open({ id: PANE, title: 'Files' })
}

export const register: Register = (on, options) => {
  const activity = String(options.activity ?? 'reads and writes')
  ignored = new Set(['.git', 'node_modules', '.tmp', ...String(options.ignore ?? '').split(/[\s,]+/).filter(Boolean)])
  settings = {
    reads: activity === 'reads and writes' || activity === 'reads',
    writes: activity === 'reads and writes' || activity === 'writes',
    follow: options.follow !== 'off',
    open: String(options.open ?? 'preview'),
    glyphs: String(options.glyphs ?? 'auto'),
  }
  const startOpen = options.start !== 'off'
  const startColumn = (['date', 'age', 'size'].includes(String(options.column)) ? String(options.column) : 'date') as Column

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'file-tree', description: 'Show the working directory as a file tree in a pane' })
    await update($, column, () => startColumn)
    if (startOpen) void start($)
    else void refresh($)

    return next(e)
  })

  on('command.run', { command: 'file-tree' }, async $ => {
    await start($)

    return { text: 'File tree pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const isShell = e.tool === 'Bash'
    const command = isShell ? e.command : ''
    if (isShell) void bashEffects($, command, '', false, true)
    const result = await next(e)
    if (result.deny) {
      if (isShell) void update($, gitop, () => null)
      return result
    }
    const path = 'file_path' in e && typeof e.file_path === 'string' ? e.file_path : ''
    if (isShell) {
      const out = result.result && typeof result.result === 'object' ? (result.result as { stdout?: unknown }).stdout : ''
      void bashEffects($, command, typeof out === 'string' ? out : '', Boolean(result.isError), false)
    } else if (path && (e.tool === 'Edit' || e.tool === 'Write') && settings.writes) {
      void touch($, path, 'write').then(() => refresh($))
    } else if (path && e.tool === 'Read' && settings.reads) void touch($, path, 'read')

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    const path = await read($, selected)
    if (!path || e.command) return next(e)

    return next({ ...e, text: `${e.text}\n\n[Selected in file tree: ${path}]` })
  })

  on('ui.message', { requestId: PANE, element: 'tree' }, async ($, e) => {
    const data = e.data as { key?: unknown; press?: unknown; query?: unknown } | null
    if (!data || typeof data !== 'object') return {}
    if (typeof data.query === 'string') {
      await update($, query, () => data.query as string)
      const first = (await visible($))[0]
      if (first) await update($, cursor, () => first.id)
    } else if (typeof data.press === 'string') await pressRow($, data.press)
    else if (typeof data.key === 'string') {
      if (await read($, preview)) {
        if (['h', 'left', 'b', 'backspace'].includes(data.key)) await closePreview($)
        else if (data.key === 'd') {
          const p = (await read($, preview))!
          if (p.mode === 'diff') await showFile($, p.path)
          else await showDiff($, p.path)
        }
      } else await move($, data.key)
    }

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    if (!('Client' in elements)) return <Text dimColor>The file tree needs a surface with client modules.</Text>
    const { Client } = elements
    const [all, changed, head, q, picked, here, lit, col, size, prev, op] = await Promise.all([
      visible($), read($, changes), read($, branch), read($, query), read($, selected), read($, cursor),
      read($, touched), read($, column), read($, sizes), read($, preview), read($, gitop),
    ])
    const set = settings.glyphs === 'nerd' || (settings.glyphs === 'auto' && e.surface !== 'desktop') ? 'nerd' : 'plain'

    if (prev) {
      const isMd = prev.mode === 'file' && /\.(md|markdown)$/i.test(prev.path)
      const shown: TreeProps = {
        rows: [], active: '', query: '', footer: null,
        preview: { text: prev.text, path: prev.path, markdown: isMd, diff: prev.mode === 'diff' },
      }

      return (
        <Box flexDirection="column">
          <Box>
            <Button key="back" plain onPress={() => void closePreview($)}>← files </Button>
            <Button key="swap" plain onPress={() => void (prev.mode === 'diff' ? showFile($, prev.path) : showDiff($, prev.path))}>{prev.mode === 'diff' ? 'file' : 'diff'}</Button>
          </Box>
          <Text dimColor>{prev.note}</Text>
          <Client key="tree" module="./tree.tsx" props={shown} />
        </Box>
      )
    }

    const counts: Record<string, number> = {}
    for (const path of Object.keys(changed)) for (const dir of ancestors(path)) counts[dir] = (counts[dir] ?? 0) + 1
    const now = await $.clock.now()
    const expanded = new Set(await read($, open))
    const right = (n: Node) => {
      if (col === 'size') return n.isDir ? (size[n.id] !== undefined ? bytes(size[n.id]!) : '') : bytes(n.size)
      if (n.isDir) return counts[n.id] ? `${counts[n.id]}` : ''
      return n.mtimeMs ? (col === 'age' ? age(now, n.mtimeMs) : new Date(n.mtimeMs).toISOString().slice(5, 10)) : ''
    }
    const rows = all.map(n => {
      const change = changed[n.id]
      const glowing = lit[n.id]
      const mark = change && change.add + change.del > 0 ? ` +${change.add} -${change.del}` : ''
      const color = n.isDir ? COLORS.dir : change ? COLORS[change.code as keyof typeof COLORS] : undefined
      return {
        id: n.id,
        t: `${'  '.repeat(n.depth)}${icon(n.name, n.isDir, expanded.has(n.id), set)} ${n.name}${n.isDir ? '/' : ''}${mark}`,
        ...(color ? { c: color } : {}),
        ...(right(n) ? { r: right(n) } : {}),
        ...(glowing ? { sh: TONE[glowing.kind] } : {}),
      }
    })
    const props: TreeProps = {
      rows,
      active: here,
      query: q,
      footer: op ? { t: op.label, tone: op.tone, spin: op.state === 'running' } : null,
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>{head || 'not a git repo'}</Text>
          <Button key="refresh" plain onPress={() => void refresh($)}> ↻</Button>
          <Button key="column" plain onPress={() => void cycle($)}> {col === 'size' ? 'Σ' : col}</Button>
        </Box>
        <Client key="tree" module="./tree.tsx" props={props} />
        {picked && <Text dimColor>selected: {picked}</Text>}
      </Box>
    )
  })
}
