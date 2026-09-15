/**
 * SectionCard — 通用区块外框
 * 用于包裹按钮组、输入区、表单等需要视觉边界的非文本内容
 *
 * 用法：
 *   <SectionCard title="操作" icon={<Zap />}>
 *     <Button>...</Button>
 *   </SectionCard>
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface SectionCardProps {
  title?: string
  icon?: LucideIcon
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  icon,
  children,
  className,
  headerClassName,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card className={cn('border-[var(--glass-border)] bg-[var(--glass-bg)]', className)}>
      {(title || icon) && (
        <CardHeader className={cn('pb-3', headerClassName)}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {icon && (
              <div className="h-7 w-7 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                <icon className="h-4 w-4 text-[var(--accent-primary)]" />
              </div>
            )}
            {title && <span>{title}</span>}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn('pt-3', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
