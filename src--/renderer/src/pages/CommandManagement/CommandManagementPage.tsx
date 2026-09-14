import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, Play, Terminal, Loader2, Info } from 'lucide-react'

const commandsApi = window.electronAPI.commands

export function CommandManagement() {
  const { t } = useTranslation()
  const [commands, setCommands] = useState<CommandRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCmd, setEditingCmd] = useState<CommandRecord | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [results, setResults] = useState<Record<string, CommandExecuteResult>>({})

  const loadCommands = useCallback(async () => {
    setLoading(true)
    try {
      const res = await commandsApi.getAll()
      setCommands(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error('[CommandManagement] Failed to load commands:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCommands() }, [loadCommands])

  const openCreate = () => {
    setEditingCmd(null)
    setName('')
    setDescription('')
    setCommand('')
    setArgs('')
    setDialogOpen(true)
  }

  const openEdit = (cmd: CommandRecord) => {
    setEditingCmd(cmd)
    setName(cmd.name)
    setDescription(cmd.description)
    setCommand(cmd.command)
    setArgs((cmd.args || []).join(' '))
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const argsArr = args.split(' ').filter(Boolean)
    if (editingCmd) {
      await commandsApi.update(editingCmd.id, { name, description, command, args: argsArr.length > 0 ? argsArr : undefined })
    } else {
      await commandsApi.add({ name, description, command, args: argsArr.length > 0 ? argsArr : undefined, type: 'custom', enabled: true })
    }
    setDialogOpen(false)
    loadCommands()
  }

  const handleDelete = async (id: string) => {
    await commandsApi.delete(id)
    loadCommands()
  }

  const handleExecute = async (cmd: CommandRecord) => {
    const res = await commandsApi.execute(cmd.name)
    if (res.success) {
      setResults(prev => ({ ...prev, [cmd.id]: res }))
    }
  }

  const builtin = commands.filter(c => c.type === 'builtin')
  const custom = commands.filter(c => c.type === 'custom')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--accent-primary)]">{t('commands.title', '命令管理')}</h2>
          <p className="text-muted-foreground">{t('commands.description', '管理和执行命令')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t('commands.create', '新建命令')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCmd ? t('commands.edit', '编辑命令') : t('commands.create', '新建命令')}</DialogTitle>
              <DialogDescription>
                {editingCmd ? t('commands.editDesc', '编辑命令配置') : t('commands.createDesc', '创建一个新的自定义命令')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('commands.nameLabel', '名称')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>{t('commands.descriptionLabel', '描述')}</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>{t('commands.commandLabel', '命令')}</Label>
                <Input value={command} onChange={e => setCommand(e.target.value)} placeholder={t('commands.commandPlaceholder', '例如: npm, node, python')} />
              </div>
              <div>
                <Label>{t('commands.argsLabel', '参数（空格分隔）')}</Label>
                <Input value={args} onChange={e => setArgs(e.target.value)} />
              </div>
              <Button onClick={handleSave} className="w-full">{t('common.save', '保存')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)]">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-[var(--text-dim)] leading-relaxed flex items-start gap-2">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
            {t('commands.pageHelp', '内置命令由系统预设，不可修改。自定义命令可新建、编辑、删除和执行。点击播放按钮直接运行命令查看输出。')}
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Tabs defaultValue="custom">
          <TabsList>
            <TabsTrigger value="custom">{t('commands.custom', '自定义')} ({custom.length})</TabsTrigger>
            <TabsTrigger value="builtin">{t('commands.builtin', '内置')} ({builtin.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="custom" className="space-y-4 mt-4">
            {custom.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{t('commands.empty', '暂无命令')}</CardContent></Card>
            ) : (
              custom.map(cmd => (
                <Card key={cmd.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4" />
                          <span className="font-medium">{cmd.name}</span>
                          <Badge variant={cmd.enabled ? 'default' : 'secondary'}>{cmd.enabled ? t('commands.enabled', '启用') : t('commands.disabled', '禁用')}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{cmd.description}</p>
                        <p className="text-xs font-mono text-muted-foreground">{cmd.command} {(cmd.args || []).join(' ')}</p>
                        {results[cmd.id] && (
                          <div className={`mt-2 p-2 rounded text-sm ${results[cmd.id].success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                            <strong>{results[cmd.id].success ? 'Output:' : 'Error:'}</strong>
                            <pre className="mt-1 text-xs whitespace-pre-wrap">{results[cmd.id].output || results[cmd.id].error}</pre>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleExecute(cmd)}><Play className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(cmd)}>{t('common.edit', '编辑')}</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(cmd.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
          <TabsContent value="builtin" className="space-y-4 mt-4">
            {builtin.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{t('commands.noBuiltin', '无内置命令')}</CardContent></Card>
            ) : (
              builtin.map(cmd => (
                <Card key={cmd.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4" />
                          <span className="font-medium">{cmd.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{cmd.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export default CommandManagement
