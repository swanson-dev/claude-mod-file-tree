export type GitAction = { verb: string; running: string; done: string; tone: string }

const GIT: Record<string, Omit<GitAction, 'verb'>> = {
  commit: { running: 'committing', done: 'committed', tone: 'green' },
  push: { running: 'pushing', done: 'pushed', tone: 'teal' },
  pull: { running: 'pulling', done: 'pulled', tone: 'blue' },
  fetch: { running: 'fetching', done: 'fetched', tone: 'blue' },
  checkout: { running: 'checking out', done: 'checked out', tone: 'blue' },
  switch: { running: 'switching', done: 'switched', tone: 'blue' },
  branch: { running: 'branching', done: 'branched', tone: 'blue' },
  merge: { running: 'merging', done: 'merged', tone: 'purple' },
  rebase: { running: 'rebasing', done: 'rebased', tone: 'purple' },
  'cherry-pick': { running: 'cherry-picking', done: 'cherry-picked', tone: 'purple' },
  stash: { running: 'stashing', done: 'stashed', tone: 'orange' },
  reset: { running: 'resetting', done: 'reset', tone: 'red' },
  restore: { running: 'restoring', done: 'restored', tone: 'red' },
  revert: { running: 'reverting', done: 'reverted', tone: 'red' },
  add: { running: 'staging', done: 'staged', tone: 'green' },
  rm: { running: 'removing', done: 'removed', tone: 'red' },
  mv: { running: 'moving', done: 'moved', tone: 'orange' },
  tag: { running: 'tagging', done: 'tagged', tone: 'purple' },
  init: { running: 'initialising', done: 'initialised', tone: 'green' },
  clone: { running: 'cloning', done: 'cloned', tone: 'blue' },
}

const GH: Record<string, Omit<GitAction, 'verb'>> = {
  'pr create': { running: 'opening PR', done: 'opened PR', tone: 'purple' },
  'pr merge': { running: 'merging PR', done: 'merged PR', tone: 'purple' },
  'pr checkout': { running: 'checking out PR', done: 'checked out PR', tone: 'blue' },
  'pr comment': { running: 'commenting on PR', done: 'commented on PR', tone: 'purple' },
  'pr review': { running: 'reviewing PR', done: 'reviewed PR', tone: 'purple' },
  'release create': { running: 'releasing', done: 'released', tone: 'purple' },
  'issue create': { running: 'opening issue', done: 'opened issue', tone: 'purple' },
}

const READERS = new Set(['cat', 'head', 'tail', 'less', 'more', 'bat', 'nl', 'wc', 'rg', 'grep', 'egrep', 'fgrep', 'sed', 'awk', 'jq', 'file', 'stat', 'find'])
const PATTERN_FIRST = new Set(['rg', 'grep', 'egrep', 'fgrep', 'sed', 'awk', 'jq'])
const SEPARATORS = new Set(['&&', '||', ';', '|', '\n'])

// Splits a shell line into commands of words: quotes keep a word whole, an unquoted `&&`, `||`, `;`, `|` or newline ends a command.
const commands = (line: string): string[][] => {
  const out: string[][] = [[]]
  let word = ''
  let quote = ''
  let has = false
  const flush = () => {
    if (has) out[out.length - 1]!.push(word)
    word = ''
    has = false
  }
  const cut = () => {
    flush()
    out.push([])
  }
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quote) {
      if (ch === quote) quote = ''
      else word += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      has = true
    } else if (SEPARATORS.has(ch) || SEPARATORS.has(line.slice(i, i + 2))) {
      cut()
      if (SEPARATORS.has(line.slice(i, i + 2))) i++
    } else if (/\s/.test(ch)) flush()
    else {
      word += ch
      has = true
    }
  }
  flush()

  return out.filter(c => c.length > 0)
}

export const gitActions = (line: string): (GitAction)[] => {
  const found: GitAction[] = []
  for (const words of commands(line)) {
    if (words[0] === 'git') {
      let i = 1
      while (i < words.length && words[i]!.startsWith('-')) i += words[i] === '-C' || words[i] === '-c' ? 2 : 1
      const verb = words[i] ?? ''
      const spec = GIT[verb]
      if (spec) found.push({ verb, ...spec })
    } else if (words[0] === 'gh') {
      const verb = `${words[1] ?? ''} ${words[2] ?? ''}`
      const spec = GH[verb]
      if (spec) found.push({ verb, ...spec })
    }
  }

  return found
}

export const readCandidates = (line: string): string[] => {
  const found: string[] = []
  for (const words of commands(line)) {
    const name = (words[0] ?? '').split('/').pop() ?? ''
    if (!READERS.has(name)) continue
    const plain = words.slice(1).filter(w => !w.startsWith('-'))
    const args = PATTERN_FIRST.has(name) ? plain.slice(1) : plain.filter(w => !/^\d+$/.test(w))
    found.push(...args)
  }

  return found
}
