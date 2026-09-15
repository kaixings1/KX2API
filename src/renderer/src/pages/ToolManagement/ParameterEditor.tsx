/**
 * ParameterEditor — 工具参数（JSON Schema 风格）结构化编辑器
 *
 * 编辑 ToolParameter[]（name / type / required / description / defaultValue）。
 * 提供增删改行能力，供「添加/编辑工具」表单与详情页复用。
 */

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus } from 'lucide-react'

/** 与后端 src/main/tools/types.ts 的 ToolParameter 保持一致 */
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  required: boolean
  description: string
  defaultValue?: string
}

const PARAM_TYPES: ToolParameter['type'][] = ['string', 'number', 'boolean', 'array']

export function ParameterEditor({
  value,
  onChange,
}: {
  value: ToolParameter[]
  onChange: (next: ToolParameter[]) => void
}) {
  const { t } = useTranslation()

  const update = (index: number, patch: Partial<ToolParameter>) => {
    onChange(value.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  const add = () => {
    onChange([...value, { name: '', type: 'string', required: false, description: '', defaultValue: undefined }])
  }

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{t('tools.noParams', '暂无参数，需要时点击下方添加')}</p>
      ) : (
        value.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-[var(--border)] p-2">
            <Input
              className="h-7 w-36 text-xs"
              placeholder={t('tools.paramName', '参数名')}
              value={p.name}
              onChange={e => update(i, { name: e.target.value })}
            />
            <select
              className="h-7 rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-1 text-xs"
              value={p.type}
              onChange={e => update(i, { type: e.target.value as ToolParameter['type'] })}
            >
              {PARAM_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <input
                type="checkbox"
                className="accent-[var(--accent-primary)]"
                checked={p.required}
                onChange={e => update(i, { required: e.target.checked })}
              />
              {t('tools.paramRequired', '必填')}
            </label>
            <Input
              className="h-7 flex-1 min-w-[120px]"
              placeholder={t('tools.paramDesc', '描述…')}
              value={p.description}
              onChange={e => update(i, { description: e.target.value })}
            />
            <Input
              className="h-7 w-28"
              placeholder={t('tools.paramDefault', '默认值（可选）')}
              value={p.defaultValue ?? ''}
              onChange={e => update(i, { defaultValue: e.target.value })}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => remove(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))
      )}
      <Button type="button" size="sm" variant="outline" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t('tools.addParam', '添加参数')}
      </Button>
    </div>
  )
}