export type TreeEntry = { name: string; isDir: boolean; size: number; mtimeMs: number }
export type Change = { code: string; add: number; del: number }
export type Touch = { kind: 'read' | 'write'; until: number }
export type Preview = { path: string; mode: 'file' | 'diff'; text: string; note: string }
export type GitOp = { label: string; tone: string; state: 'running' | 'done' | 'failed' }
export type Column = 'date' | 'age' | 'size'

declare module 'claude-code' {
  interface PluginState {
    'file-tree': {
      open: string[]
      tree: Record<string, TreeEntry[]>
      changes: Record<string, Change>
      branch: string
      files: string[]
      query: string
      selected: string
      cursor: string
      touched: Record<string, Touch>
      sizes: Record<string, number>
      column: Column
      preview: Preview | null
      gitop: GitOp | null
      press: { id: string; at: number }
    }
  }
}
