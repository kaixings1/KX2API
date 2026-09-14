/**
 * pages/Chat/FileTree.tsx — 简易文件树
 */

import { useState } from 'react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

interface Props {
  files: { name: string; path: string }[]
  onOpen?: (path: string) => void
}

export function FileTree({ files, onOpen }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['/']))

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const tree: FileNode[] = buildTree(files)

  return (
    <div className="file-tree-root">
      {tree.map(node => (
        <TreeNode key={node.path} node={node} depth={0} expanded={expanded} toggle={toggle} onOpen={onOpen} />
      ))}
    </div>
  )
}

function TreeNode({ node, depth, expanded, toggle, onOpen }: {
  node: FileNode
  depth: number
  expanded: Set<string>
  toggle: (p: string) => void
  onOpen?: (p: string) => void
}) {
  const isOpen = expanded.has(node.path)
  const padding = depth * 12 + 4

  if (node.type === 'folder') {
    return (
      <div className="file-tree-node">
        <div
          className="file-tree-item file-tree-folder"
          style={{ paddingLeft: padding + 4 }}
          onClick={() => toggle(node.path)}
        >
          <span className="file-tree-arrow">{isOpen ? '▾' : '▸'}</span>
          <span className="file-tree-icon">📁</span>
          <span className="file-tree-name">{node.name}</span>
        </div>
        {isOpen && node.children?.map(child => (
          <TreeNode key={child.path} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} onOpen={onOpen} />
        ))}
      </div>
    )
  }

  return (
    <div
      className="file-tree-item file-tree-file"
      style={{ paddingLeft: padding + 20 }}
      onClick={() => onOpen?.(node.path)}
    >
      <span className="file-tree-icon">📄</span>
      <span className="file-tree-name">{node.name}</span>
    </div>
  )
}

function buildTree(files: { name: string; path: string }[]): FileNode[] {
  const root: FileNode[] = []
  const map = new Map<string, FileNode>()

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean)
    let currentPath = ''
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      currentPath = currentPath ? `${currentPath}/${name}` : `/${name}`
      if (!map.has(currentPath)) {
        const isFile = i === parts.length - 1
        const node: FileNode = { name, path: currentPath, type: isFile ? 'file' : 'folder', children: [] }
        map.set(currentPath, node)
        if (i === 0) {
          root.push(node)
        } else {
          const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
          const parent = map.get(parentPath)
          if (parent?.children) parent.children.push(node)
        }
      }
    }
  }
  return root
}
