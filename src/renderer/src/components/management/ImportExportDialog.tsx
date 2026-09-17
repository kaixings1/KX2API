import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Download, Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react'

interface ImportExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'import' | 'export' | 'backup' | 'restore'
  title: string
  description: string
  data?: any
  onExport: () => string | Promise<string>
  onImport: (json: string) => { success: boolean; error?: string } | Promise<{ success: boolean; error?: string }>
  onBackup?: () => { success: boolean; file?: File; error?: string } | Promise<{ success: boolean; file?: File; error?: string }>
  onRestore?: (file: File) => { success: boolean; error?: string } | Promise<{ success: boolean; error?: string }>
}

export function ImportExportDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  data,
  onExport,
  onImport,
  onBackup,
  onRestore,
}: ImportExportDialogProps) {
  const [importText, setImportText] = useState('')
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    try {
      const json = await onExport()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setResult({ success: true, message: '导出成功' })
    } catch (e) {
      setResult({ success: false, message: '导出失败: ' + (e instanceof Error ? e.message : String(e)) })
    }
  }

  const handleImport = async () => {
    if (!importText.trim()) return
    const res = await onImport(importText)
    if (res.success) {
      setResult({ success: true, message: '导入成功' })
      setTimeout(() => { onOpenChange(false); setImportText(''); setResult(null) }, 1000)
    } else {
      setResult({ success: false, message: res.error || '导入失败' })
    }
  }

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setImportText(text)
      setResult(null)
    } catch {
      setResult({ success: false, message: '读取文件失败' })
    }
  }

  const handleBackup = async () => {
    if (onBackup) {
      const res = await onBackup()
      setResult({ success: res.success, message: res.success ? '备份成功' : (res.error || '备份失败') })
      if (res.success && res.file) {
        const url = URL.createObjectURL(res.file)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title.replace(/\s+/g, '_')}_backup_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    }
  }

  const handleRestore = async () => {
    if (onRestore && fileRef.current?.files?.[0]) {
      const res = await onRestore(fileRef.current.files[0])
      setResult({ success: res.success, message: res.success ? '恢复成功' : (res.error || '恢复失败') })
      if (res.success) {
        setTimeout(() => { onOpenChange(false); setResult(null) }, 1000)
      }
    }
  }

  const isBackupRestore = mode === 'backup' || mode === 'restore'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={mode} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">导出</TabsTrigger>
            <TabsTrigger value="import">导入</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">将数据导出为 JSON 文件，可备份或迁移到其他设备。</p>
            {data && (
              <Textarea readOnly value={JSON.stringify(data, null, 2)} className="h-40 text-xs font-mono" />
            )}
            <Button onClick={handleExport} className="w-full">
              <Download className="h-4 w-4 mr-1" />导出 JSON
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">粘贴 JSON 数据或选择文件导入。导入会合并数据，不会覆盖已有项。</p>
            <Textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder='[{"id": "...", "name": "..."}]'
              className="h-40 text-xs font-mono"
            />
            <div className="flex items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="text-xs"
              />
              <span className="text-xs text-muted-foreground">或选择文件</span>
            </div>
            <Button onClick={handleImport} className="w-full">
              <Upload className="h-4 w-4 mr-1" />导入
            </Button>
          </TabsContent>
        </Tabs>

        {isBackupRestore && (
          <div className="space-y-3 mt-2 pt-3 border-t border-[var(--border)]">
            <div className="flex gap-2">
              {onBackup && (
                <Button variant="outline" size="sm" onClick={handleBackup} className="flex-1">
                  <FileJson className="h-4 w-4 mr-1" />完整备份
                </Button>
              )}
              {onRestore && (
                <div className="flex-1">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestore}
                    className="hidden"
                    id="restore-file-input"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('restore-file-input')?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-1" />从备份恢复
                  </Button>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              备份包含所有数据。恢复将合并数据，已有 ID 的项会被跳过。
            </p>
          </div>
        )}

        {result && (
          <div className={`flex items-center gap-2 p-2.5 rounded-md text-sm ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
            {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {result.message}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); setImportText(''); setResult(null) }}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
