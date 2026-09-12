# 程序长时运行 + 完成感知 — 方案大全（30+ 种方法）

---

## 第一类：文件系统方案（程序自己写标记）

### 方法 1：完成标记文件
程序结束时写 `done.flag` 文件（空文件或有内容均可）。
外部用 `if exist done.flag` 判断完成。
最轻量，零依赖。

### 方法 2：时间戳对比
程序开始时写 `start.flag`（含时间戳），结束时写 `end.flag`。
`end.flag` 存在且时间 > `start.flag` = 成功完成。
可以区分"未开始"、"运行中"、"已完成"、"启动失败"四种状态。

### 方法 3：进度百分比文件
程序每处理一批数据，向 `progress.json` 写入：
```json
{"step":"processing","processed":1200,"total":50000,"pct":2.4}
```
外部轮询读取百分比，判断是否完成。

### 方法 4：递增计数器文件
每完成一批，向 `count.log` 追加一行数字。
外部 `find /c /v "" count.log` 看行数 = 处理批次数。

### 方法 5：锁文件（互斥文件）
程序启动时创建 `running.lock`，正常退出时删除。
外部检测：
- `running.lock` 不存在且 `result.json` 不存在 → 未启动
- `running.lock` 存在 → 运行中（或崩溃了）
- `running.lock` 不存在且 `result.json` 存在 → 已完成

崩溃检测：再加一个 `last_heartbeat` 时间戳文件，超时未更新 = 异常退出。

### 方法 6：结果目录重命名
程序在 `tmp_output/` 中写结果，完成时重命名为 `final_output/`。
外部检测 `final_output/` 是否存在判断完成。

### 方法 7：多阶段状态文件
程序分 N 个阶段，每阶段完成后写 `stage_1.done`、`stage_2.done`...
外部看最后一个 `.done` 文件就知道卡在哪一步。

### 方法 8：日志尾部标记
程序最后一行写入固定字符串 `__PROGRAM_FINISHED_SUCCESS__`。
外部 `findstr "PROGRAM_FINISHED" output.log` 一行就判断完成。

### 方法 9：退出码文件
程序把退出码也写入文件：
```json
{"exitCode":0,"finishedAt":"2026-08-16T19:00:00"}
```
exitCode=0 = 成功，非0 = 失败。比只看文件是否存在多了一个失败维度。

### 方法 10：原子写入（防半写）
完成时先写 `result.json.tmp`，然后 `rename` 到 `result.json`。
外部永远看到的是完整文件或不存在，不会读到写到一半的损坏数据。

---

## 第二类：日志方案（从输出中判断状态）

### 方法 11：固定格式心跳日志
程序每 30 秒写入一行心跳：
```
[19:00:00] HEARTBEIT processed=1200/50000 rate=40/s
```
外部监控心跳时间差，超过 2 分钟没心跳 = 卡死。

### 方法 12：错误日志分离
程序把所有错误写入 `error.log`。
外部：`error.log` 为空且 `result.json` 存在 = 干净完成。
`error.log` 非空 = 有异常（需要人工判断是否影响结果）。

### 方法 13：结构化日志（JSON Lines）
每行是 JSON，方便程序解析：
```jsonl
{"t":"19:00:00","e":"heartbeat","processed":1200}
{"t":"19:05:00","e":"heartbeat","processed":2400}
{"t":"19:10:00","e":"done","exitCode":0}
```
外部用任何 JSON 工具解析最后一条，看 `e` 字段。

### 方法 14：日志级别控制
- INFO: 一般进度
- WARN: 可恢复的问题
- ERROR: 致命错误导致提前退出
外部扫描 ERROR 级别日志数量，0 个 + 有 DONE 标记 = 完全成功。

### 方法 15：日志轮转 + 完成标记
日志超过 10MB 自动轮转（`output.log.1`、`output.log.2`）。
完成时写 `done.flag`。
如果只有 `output.log` 而没有 `done.flag` = 日志满了但没跑完 = 异常。

---

## 第三类：进程监控方案（从外部监控程序）

### 方法 16：进程存活检查
最简单的外部分析：
```cmd
tasklist /FI "IMAGENAME eq your_program.exe"
```
有输出 = 运行中，无输出 = 已退出。再配合结果文件判断是否完成。

### 方法 17：PID 文件
程序启动时写 `pid` 到 `app.pid`，退出时删除。
外部用 `tasklist /FI "PID eq 12345"` 检查特定 PID。
比方法 16 更精确（多个同名进程时能区分）。

### 方法 18：Windows 任务计划程序（一次性任务）
```cmd
schtasks /Create /TN "MyJob" /TR "D:\KX2API\run.bat" /SC ONCE /ST 19:00 /F
```
完成后自动从任务计划程序中删除任务条目。

### 方法 19：Windows 服务
把程序注册为 Windows 服务，用 `sc.exe` 管理。
`sc query MyService` 看状态（RUNNING/STOPPED）。
配合 SCM 的事件日志自动触发完成通知。

### 方法 20：WMI 事件订阅
用 WMI 监听进程退出事件：
```powershell
Register-WmiEvent -Class Win32_ProcessStopTrace -SourceIdentifier Stop
```
进程一退出就触发回调，读取结果文件。

---

## 第四类：进程树 + 超时方案

### 方法 21：启动器 + watchdog 子进程
写一个启动器程序 `launcher.exe`，它：
1. 启动真实工作进程
2. 定时（如每 60 秒）检查工作进程是否还在
3. 如果进程退出且 `done.flag` 不存在 → 记录异常退出
4. 如果进程退出且 `done.flag` 存在 → 触发完成通知

启动器自己是个短命进程，但保证了监控不中断。

### 方法 22：超时自动重启
启动器检测到：
- 进程存活但 `heartbeat` 超过 N 分钟没更新 → 杀掉重启
- 连续重启超过 M 次 → 放弃并报警

适合"程序容易卡死但跑完就能出结果"的场景。

### 方法 23：资源监控（CPU/内存）
启动器监控工作进程的资源占用：
- CPU 持续为 0 超过 N 分钟 = 卡死
- 内存持续不释放 = 内存泄漏
- 触发告警或自动重启

---

## 第五类：网络通信方案（跨机器/跨终端感知）

### 方法 24：HTTP 状态端点
程序启动一个轻量 HTTP 服务器（如 `http://localhost:18923/status`），响应：
```json
{"status":"running","progress":45,"eta":"19:30"}
```
外部 `curl http://localhost:18923/status` 即可查看。
完成时响应 `{"status":"done"}`。

### 方法 25：端口存活检测
程序启动时监听一个本地端口（如 18923），完成时关闭端口。
外部 `netstat -ano | findstr :18923` 判断端口是否在监听。

### 方法 26：Webhook 回调
程序完成后向指定 URL 发送 POST 请求：
```json
{"jobId":"123","status":"completed","resultUrl":"http://..."}
```
适合从一台机器提交任务，另一台（或手机）接收通知。

### 方法 27：MQTT / 消息队列
程序运行期间和完成时向 MQTT topic 发布消息。
外部任何订阅了该 topic 的设备（手机、另一台电脑）都能实时收到进度和完成通知。

### 方法 28：SSE / WebSocket 推送
程序提供一个 WebSocket 端点，外部连接后实时接收：
- 进度更新（push）
- 完成事件（push）
比 HTTP 轮询更实时，适合 Web 面板监控。

---

## 第六类：通知方案（完成时提醒你）

### 方法 29：Windows Toast 通知
程序完成时调用 Windows 原生通知：
```cmd
powershell -Command "[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null"
```
或用更简单的：
```cmd
msg * "任务已完成！结果在 D:\KX2API\output\result.json"
```

### 方法 30：播放提示音
程序完成时播放一个 WAV 文件：
```cmd
powershell -Command "(New-Object Media.SoundPlayer 'D:\KX2API\done.wav').PlaySync()"
```
不需要任何 GUI，最简单的声音提醒。

### 方法 31：邮件通知
程序完成时调用本地邮件客户端或 SMTP 发送邮件：
```cmd
powershell -Command "Send-MailMessage -To 'you@example.com' -Subject '任务完成' -SmtpServer 'smtp.example.com'"
```

### 方法 32：桌面快捷方式/Flag 文件 + 自动启动监控
写一个 `watch.ps1`，用 `FileSystemWatcher` 监控目录：
```powershell
$watcher = New-Object IO.FileSystemWatcher "D:\KX2API\output","result.json"
$watcher.EnableRaisingEvents = $true
Register-ObjectEvent $watcher Created -Action {
    [System.Windows.Forms.MessageBox]::Show("任务完成！","KX2API")
}
```
文件一出现就弹窗，不需要轮询。

---

## 第七类：批处理编排方案（不用改程序代码）

### 方法 33：包装批处理脚本（.bat）
```bat
@echo off
echo [%date% %time%] START > output.log
your_program.exe >> output.log 2>&1
if %errorlevel% equ 0 (
    echo [%date% %time%] DONE >> output.log
    msg * "任务成功完成"
) else (
    echo [%date% %time%] FAILED (exit=%errorlevel%) >> output.log
    msg * "任务失败，查看 output.log"
)
```
不用改任何程序代码，靠启动器脚本完成检测和通知。

### 方法 34：PowerShell 编排脚本
```powershell
$log = "output.log"
$started = Get-Date
"[$(Get-Date)] START" | Out-File $log
& "D:\KX2API\your_program.exe" *>> $log
$exitCode = $LASTEXITCODE
$duration = (Get-Date) - $started
"[$(Get-Date)] EXIT=$exitCode duration=$($duration.TotalSeconds)s" | Out-File $log -Append

if ($exitCode -eq 0) {
    # Toast 通知
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("KX2API").Show(
        (New-Object Windows.UI.Notifications.ToastNotification(
            (New-Object Windows.UI.Notifications.ToastTemplateType).Text02
        ))
    )
}
```

### 方法 35：Windows 任务计划程序 + 事件触发
用 `schtasks` 创建任务，完成后触发一个事件。
再创建第二个任务，监听该事件并执行通知。

---

## 第八类：架构级方案（从设计上保证可观测性）

### 方法 36：状态机模式
把程序改为显式状态机：
```
IDLE → RUNNING → (SUCCESS | FAILED | CANCELLED)
```
每个状态转换都写 `state.json`。
外部读 `state.json` 就知道程序在哪个状态。
这是最健壮的方案，任何意外退出都能通过"上次状态"推断出发生了什么。

### 方法 37：检查点 + 恢复
程序每处理一批数据后写一个检查点（checkpoint）：
```json
{"lastBatch":120,"itemsProcessed":24000,"totalItems":50000,"timestamp":"..."}
```
崩溃后重启时，跳过前 120 批继续。
进度文件天然就是检查点，不需要额外实现。

### 方法 38：管道 + 外部进度条
把程序输出重定向到外部工具：
```cmd
your_program.exe | progressbar.exe
```
外部工具解析 stdout 中的进度信息并显示进度条。
程序本身不需要知道进度条的 UI 逻辑。

### 方法 39：双进程协调（Master-Worker）
把程序拆成 master（协调）和 worker（计算）两个进程：
- master 启动多个 worker，收集它们的进度
- master 写全局 `progress.json`
- master 在所有 worker 完成后写 `done.flag`
- 任何 worker 异常退出，master 都能感知并记录

### 方法 40：分布式锁 + 共享存储
如果多台机器协作：
- 用文件锁或数据库行锁标记"任务已认领"
- 完成任务后写共享存储（数据库/文件服务器/NAS）
- 外部任何机器都能查看共享存储中的完成状态

---

## 推荐组合方案

根据你的项目特点（KX2API，本地工具，单机运行），推荐以下组合：

### 轻量方案（改程序 20 行）
> 方法 1（done.flag）+ 方法 8（日志标记）+ 方法 11（心跳）

程序每 30 秒写一行心跳日志，结束时写 `done.flag`。
外部：`timeout /t 3600 && if exist done.flag (msg * "完成")` 

### 零改代码方案
> 方法 33（.bat 包装器）+ 方法 29（Toast 通知）

写一个启动 bat，调用你的程序，检测退出码，完成后弹通知。
不需要改任何现有代码。

### 完整方案
> 方法 5（锁文件）+ 方法 1（done.flag）+ 方法 36（状态机）+ 方法 33（bat 包装器）

程序内部维护状态机 + 锁文件 + 完成标记。
外部用 bat 脚本启动 + 监控 + 通知。
崩溃/异常/正常完成三种状态都能准确区分。

---

## 快速选择指南

| 你的场景 | 推荐方法 |
|---------|---------|
| 不想改代码 | 方法 33 (.bat包装器) |
| 需要知道进度百分比 | 方法 3 (progress.json) + 方法 11 (心跳) |
| 程序容易崩溃 | 方法 5 (锁文件) + 方法 37 (检查点) |
| 跨机器感知 | 方法 26 (Webhook) 或 方法 27 (MQTT) |
| 有 GUI 弹窗提醒 | 方法 29 (Toast) 或 方法 32 (FileSystemWatcher) |
| 多个任务并行 | 方法 36 (状态机) + 方法 39 (Master-Worker) |
| 最简单能跑就行 | 方法 1 (done.flag) 一行就够 |
