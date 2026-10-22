import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'file-tree',
  component: 'Pane',
  requestId: 'file-tree',
  props: { title: 'Files', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const entry = (name: string, kind: 'file' | 'dir') => ({ name, kind, size: 2048, mtimeMs: 1_700_000_000_000, isLink: false })

const setup = ($: any, on: any) => {
  on('command.register', () => ({ value: { command: 'file-tree' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: 1_700_000_100_000 }))
  on('fs.list', () => ({ value: [entry('b.md', 'file'), entry('docs', 'dir'), entry('.git', 'dir'), entry('node_modules', 'dir')] }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: '## main\n M b.md\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
}

const run = ($: any) =>
  $.command.run({ command: 'file-tree', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 80 } })

test('the pane hands the tree module folders first, git status and no hidden names', async ($, on) => {
  setup($, on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await run($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /main/ })).toBeTruthy()
  const tree = await ui.find({ type: 'Client' })
  const rows = ((tree?.props as { props: unknown }).props as { rows: { id: string; t: string; c?: string }[] }).rows
  expect(rows.map(r => r.id)).toEqual(['docs', 'b.md'])
  expect(rows[1]?.c).toBe('#e5c07b')
  await ui.unmount()
})

test('keys from the tree module move the cursor, o previews a file, h closes it', async ($, on) => {
  setup($, on)
  on('fs.read', () => ({ value: 'preview body' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await run($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.post({ key: 'j' })
  const active = async () => ((await ui.find({ type: 'Client' }))?.props as { props: { active: string } }).props.active
  expect(await active()).toBe('b.md')
  await ui.post({ key: 'o' })
  const shown = async () => ((await ui.find({ type: 'Client' }))?.props as { props: { preview?: { text: string } } }).props.preview
  expect(await shown()).toEqual({ text: 'preview body', path: 'b.md', markdown: true, diff: false })
  await ui.post({ key: 'h' })
  expect(await shown()).toBeUndefined()
  await ui.unmount()
})

test('a drawing the mod leaves goes to the engine', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({ ...PANE, requestId: 'other', surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeTruthy()
  await ui.unmount()
})
