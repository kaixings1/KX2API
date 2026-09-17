import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search, RefreshCw, Download, Upload, Trash2, CheckSquare, Square,
  MoreHorizontal, X, ChevronDown,
} from 'lucide-react'

export interface ToolbarFilters {
  search: string
  status?: string
  tag?: string
  group?: string
}

interface ManagementToolbarProps {
  title: string
  subtitle?: string
  onCreate?: () => void
  createLabel?: React.ReactNode
  filters: ToolbarFilters
  onFiltersChange: (filters: ToolbarFilters) => void
  filterOptions?: { key: string; label: string; options: { value: string; label: string }[] }[]
  selectedIds?: string[]
  onBatchDelete?: (ids: string[]) => void
  onBatchToggle?: (ids: string[], enabled: boolean) => void
  onRefresh: () => void
  onExport?: () => void
  onImport?: () => void
  onBackup?: () => void
  onRestore?: () => void
  totalCount: number
  filteredCount: number
  isLoading?: boolean
  extraActions?: React.ReactNode
}

export function ManagementToolbar({
  title,
  subtitle,
  onCreate,
  createLabel = '新建',
  filters,
  onFiltersChange,
  filterOptions = [],
  selectedIds,
  onBatchDelete,
  onBatchToggle,
  onRefresh,
  onExport,
  onImport,
  onBackup,
  onRestore,
  totalCount,
  filteredCount,
  isLoading = false,
  extraActions,
}: ManagementToolbarProps) {
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const updateFilter = useCallback((key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value || undefined })
  }, [filters, onFiltersChange])

  const clearFilters = useCallback(() => {
    onFiltersChange({ search: '' })
  }, [onFiltersChange])

  const hasFilters = filters.search || filters.status || filters.tag || filters.group
  const hasSelection = (selectedIds?.length || 0) > 0

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--accent-primary)]">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">
            共 {totalCount} 条{filters.search ? `，筛选结果 ${filteredCount} 条` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          {onBackup && (
            <Button variant="ghost" size="sm" onClick={onBackup} title="备份">
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onRestore && (
            <Button variant="ghost" size="sm" onClick={onRestore} title="恢复">
              <Upload className="h-4 w-4" />
            </Button>
          )}
          {onExport && (
            <Button variant="ghost" size="sm" onClick={onExport} title="导出">
              <Download className="h-4 w-4 mr-1" />导出
            </Button>
          )}
          {onImport && (
            <Button variant="ghost" size="sm" onClick={onImport} title="导入">
              <Upload className="h-4 w-4 mr-1" />导入
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {onCreate && (
            <Button onClick={onCreate} size="sm">
              {createLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
            placeholder="搜索..."
            className="pl-8 h-9"
          />
        </div>

        {filterOptions.map(opt => (
          <SelectFilter
            key={opt.key}
            value={filters[opt.key as keyof ToolbarFilters] as string || ''}
            options={opt.options}
            placeholder={opt.label}
            onChange={v => updateFilter(opt.key, v)}
          />
        ))}

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="h-3.5 w-3.5 mr-1" />清除
          </Button>
        )}

        {/* Batch actions */}
        {hasSelection && (
          <div className="flex items-center gap-1 ml-auto">
            <Badge variant="secondary" className="text-xs">
              已选 {(selectedIds ?? []).length}
            </Badge>
            {onBatchToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onBatchToggle(selectedIds ?? [], true); setShowBatchMenu(false) }}
                className="h-8"
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1" />启用
              </Button>
            )}
            {onBatchDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { if (confirm(`确定删除选中的 ${(selectedIds ?? []).length} 项?`)) onBatchDelete(selectedIds ?? []); setShowBatchMenu(false) }}
                className="h-8 text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />删除
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SelectFilter({
  value, options, placeholder, onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder: string
  onChange: (v: string) => void
}) {
  if (options.length === 0) return null

  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-9 text-xs text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-2 pr-7 appearance-none cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
    </div>
  )
}
