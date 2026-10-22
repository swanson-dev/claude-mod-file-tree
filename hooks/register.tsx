import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Change, TreeEntry } from '../types'

const PANE = 'file-tree'
const HIDDEN = new Set(['.git', 'node_modules', '.tmp'])
const GLOW_MS = 8_000
const MAX_RESULTS = 200
const COLOR = { M: '#e5c07b', A: '#98c379', '?': '#98c379', D: '#e06c75', R: '#61afef', read: '#c084fc', write: '#fb923c' }

const open = atom({ plugin: 'file-tree', key: 'open' } as const, [])
const tree = atom({ plugin: 'file-tree', key: 'tree' } as const, {})
const changes = atom({ plugin: 'file-tree', key: 'changes' } as const, {})
const branch = atom({ plugin: 'file-tree', key: 'branch' } as const, '')
const files = atom({ plugin: 'file-tree', key: 'files' } as const, [])
const query = atom({ plugin: 'file-tree', key: 'query' } as const, '')
const selected = atom({ plugin: 'file-tree', key: 'selected' } as const, '')
const touched = atom({ plugin: 'file-tree', key: 'touched' } as const, {})


const join = (dir: string, name: string) => (dir === '.' ? name : `${dir}/${name}`)
const ancestors = (path: string) => path.split('/').slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join('/'))

const load = async ($: any, dir: string) => {
  const found = await $.fs.list(dir).catch(() => [])
  const entries: TreeEntry[] = found
    .filter((one: { name: string }) => !HIDDEN.has(one.name))
    .map((one: { name: string; kind: string }) => ({ name: one.name, isDir: one.kind === 'dir' }))
    .sort((a: TreeEntry, b: TreeEntry) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
  await update($, tree, all => ({ ...all, [dir]: entries }))
}

const git = async ($: any, args: string[]) => {
  const run = await $.process.run(['git', ...args], { timeoutMs: 10_000 }).catch(() => undefined)
  return run && run.exitCode === 0 ? (run.stdout as string) : undefined
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
  await update($, files, () => listed.split('\n').filter(Boolean).slice(0, 20_000))
}

const refresh = async ($: any) => {
  const dirs = ['.', ...(await read($, open))]
  await Promise.all([...dirs.map(dir => load($, dir)), loadGit($)])
}

const toggle = async ($: any, dir: string) => {
  const isOpen = (await read($, open)).includes(dir)
  if (!isOpen) await load($, dir)
  await update($, open, list => (isOpen ? list.filter(p => p !== dir) : [...list, dir]))
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
  return file.startsWith(`${cwd}/`) ? file.slice(cwd.length + 1) : file
}

const start = async ($: any) => {
  await refresh($)
  return $.ui.open({ id: PANE, title: 'Files' })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'file-tree', description: 'Show the working directory as a file tree in a pane' })
    void start($)

    return next(e)
  })

  on('command.run', { command: 'file-tree' }, async $ => {
    await start($)

    return { text: 'File tree pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (result.deny) return result
    const path = 'file_path' in e && typeof e.file_path === 'string' ? e.file_path : ''
    const isWrite = e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'Bash'
    if (!path && !isWrite) return result
    void (async () => {
      if (path && (e.tool === 'Read' || e.tool === 'Edit' || e.tool === 'Write')) {
        const rel = await relative($, path)
        await reveal($, rel)
        await glow($, rel, e.tool === 'Read' ? 'read' : 'write')
      }
      if (isWrite) await refresh($)
    })()

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    const path = await read($, selected)
    if (!path || e.command) return next(e)

    return next({ ...e, text: `${e.text}\n\n[Selected in file tree: ${path}]` })
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    const Input = 'Input' in elements ? elements.Input : undefined
    const [expanded, all, changed, head, flat, q, picked, lit] = await Promise.all([
      read($, open), read($, tree), read($, changes), read($, branch), read($, files),
      read($, query), read($, selected), read($, touched),
    ])
    const isOpen = new Set(expanded)
    const counts: Record<string, number> = {}
    for (const path of Object.keys(changed)) for (const dir of ancestors(path)) counts[dir] = (counts[dir] ?? 0) + 1

    const file = (path: string, label: string, pad: string) => {
      const change = changed[path]
      const glowing = lit[path]
      const color = glowing ? COLOR[glowing.kind] : change ? COLOR[change.code as keyof typeof COLOR] : undefined
      return (
        <Button key={path} plain onPress={() => void update($, selected, cur => (cur === path ? '' : path))}>
          <Text bold={picked === path} color={color}>{pad}{picked === path ? '▸ ' : '  '}{label}</Text>
          {change && change.add + change.del > 0 && <Text dimColor> +{change.add} -{change.del}</Text>}
        </Button>
      )
    }

    const rows: any[] = []
    const walk = (dir: string, depth: number) => {
      for (const entry of all[dir] ?? []) {
        const path = join(dir, entry.name)
        const pad = '  '.repeat(depth)
        if (!entry.isDir) {
          rows.push(file(path, entry.name, pad))
          continue
        }
        const expandedHere = isOpen.has(path)
        rows.push(
          <Button key={path} plain onPress={() => void toggle($, path)}>
            <Text color={lit[path] ? COLOR[lit[path]!.kind] : '#61afef'}>{pad}{expandedHere ? '▾ ' : '▸ '}{entry.name}/</Text>
            {counts[path] && <Text dimColor> {counts[path]}</Text>}
          </Button>,
        )
        if (expandedHere) walk(path, depth + 1)
      }
    }

    const needle = q.trim().toLowerCase()
    if (needle) for (const path of flat.filter(p => p.toLowerCase().includes(needle)).slice(0, MAX_RESULTS)) rows.push(file(path, path, ''))
    else walk('.', 0)

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>{head || 'not a git repo'}</Text>
          <Button key="refresh" plain onPress={() => void refresh($)}> ↻</Button>
        </Box>
        {Input && <Input key="search" placeholder="Search files" value={q} onInput={(v: string) => void update($, query, () => v)} onSubmit={(v: string) => void update($, query, () => v)} />}
        {rows.length === 0 && <Text dimColor>{needle ? 'No matches.' : 'Empty.'}</Text>}
        {rows}
        {picked && <Text dimColor>Selected: {picked}</Text>}
      </Box>
    )
  })
}
