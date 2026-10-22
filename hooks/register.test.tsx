import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'file-tree',
  component: 'Pane',
  requestId: 'file-tree',
  props: { title: 'Files', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('the pane lists the working directory with folders first and git status', async ($, on) => {
  on('command.register', () => ({ value: { command: 'file-tree' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.list', () => ({
    value: [
      { name: 'b.md', kind: 'file', size: 1, mtimeMs: 1, isLink: false },
      { name: 'docs', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
      { name: '.git', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
    ],
  }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: '## main\n M b.md\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'file-tree' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /main/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /docs\// })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /\.git/ })).toBeFalsy()
  await ui.unmount()
})
