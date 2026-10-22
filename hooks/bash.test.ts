import { expect, test } from 'claude-code/testing'

import { gitActions, readCandidates } from './bash'

test('gitActions finds git and gh verbs in a compound command', () => {
  expect(gitActions('git add -A && git commit -m "x" && git push').map(a => a.verb)).toEqual(['add', 'commit', 'push'])
  expect(gitActions('git -C sub status; gh pr create --fill').map(a => a.verb)).toEqual(['pr create'])
  expect(gitActions('echo git commit').length).toBe(0)
  expect(gitActions('git status').length).toBe(0)
})

test('readCandidates takes file arguments of read-only commands', () => {
  expect(readCandidates('cat a.md b/c.ts')).toEqual(['a.md', 'b/c.ts'])
  expect(readCandidates('rg -n "foo bar" src docs')).toEqual(['src', 'docs'])
  expect(readCandidates('sed -n 1,5p file.txt')).toEqual(['file.txt'])
  expect(readCandidates('head -20 "my file.md" | wc -l')).toEqual(['my file.md'])
  expect(readCandidates('npm test')).toEqual([])
})
