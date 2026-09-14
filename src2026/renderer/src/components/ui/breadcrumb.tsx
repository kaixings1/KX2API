import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-[var(--accent-primary)] transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>

      {items.map((item) => {
        const isLast = item === items[items.length - 1]

        return (
          <span key={`${item.label}-${item.href || ''}`} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            {isLast || !item.href ? (
              <span className={isLast ? 'text-foreground font-medium' : ''}>
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="hover:text-[var(--accent-primary)] transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
