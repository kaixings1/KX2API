import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function MainLayout() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
      <div className="bokeh-bg">
        <div className="bokeh-blob bokeh-blob-1" />
        <div className="bokeh-blob bokeh-blob-2" />
      </div>
      <Header />
      {/* min-h-0：flex 子项默认 min-height:auto，无法收缩到内容高度以下，
          缺了它 main 会被长内容撑破 h-screen，overflow-auto 失效（滚不动整页） */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
          <div className="mx-auto w-[92%] max-w-[1680px] page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
