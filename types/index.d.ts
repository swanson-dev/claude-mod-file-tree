export type TreeEntry = { name: string; isDir: boolean }
export type Change = { code: string; add: number; del: number }
export type Touch = { kind: 'read' | 'write'; until: number }

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
      touched: Record<string, Touch>
    }
  }
}
