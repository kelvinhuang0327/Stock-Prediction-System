# macOS 自動啟動（LaunchAgent / LaunchDaemon）

本專案已新增一套符合以下架構的 launchd 自動啟動機制：

- 主服務：登入後自動啟動，異常退出自動重啟
- planner tick：每 10 分鐘執行
- worker tick：每 10 分鐘執行
- worker daemon：常駐模式（RunAtLoad + KeepAlive）
- 固定 log 輸出
- 啟動後 health check + smoke check

支援兩種模式：

- LaunchAgent：登入後自動啟動
- LaunchDaemon：未登入也可自動啟動

## 1) 主要檔案

### 啟動/停止腳本

- `scripts/start_all.sh`
- `scripts/stop_all.sh`
- `scripts/run-orchestrator-planner-tick.sh`
- `scripts/run-orchestrator-worker-tick.sh`
- `scripts/run-orchestrator-worker-daemon.sh`

### LaunchAgent 模板

- `deploy/launchd-orchestrator/templates/com.stocksystem.main-service.plist.template`
- `deploy/launchd-orchestrator/templates/com.stocksystem.orchestrator.planner-tick.plist.template`
- `deploy/launchd-orchestrator/templates/com.stocksystem.orchestrator.worker-tick.plist.template`
- `deploy/launchd-orchestrator/templates/com.stocksystem.orchestrator.worker-daemon.plist.template`

### 安裝/重載/移除

- `deploy/launchd-orchestrator/install.sh`
- `deploy/launchd-orchestrator/reload.sh`
- `deploy/launchd-orchestrator/uninstall.sh`
- `deploy/launchd-orchestrator/status.sh`

### 設定檔

- `deploy/launchd-orchestrator/launchd.env.example`
- `deploy/launchd-orchestrator/launchd.env`（install 時會自動由 example 建立）

## 2) 每個 LaunchAgent 的用途

- `com.stocksystem.main-service`
  - 啟動 `scripts/start_all.sh --foreground`
  - `RunAtLoad=true`, `KeepAlive=true`
  - 由 launchd 監控主程序，異常退出時重啟

- `com.stocksystem.orchestrator.planner-tick`
  - 每 600 秒執行一次 planner tick
  - `StartInterval=600`

- `com.stocksystem.orchestrator.worker-tick`
  - 每 600 秒執行一次 worker tick
  - `StartInterval=600`

- `com.stocksystem.orchestrator.worker-daemon`
  - 常駐 worker daemon
  - `RunAtLoad=true`, `KeepAlive=true`

## 3) 安裝與重載

### 登入後自啟（LaunchAgent）

```bash
bash deploy/launchd-orchestrator/install.sh
```

### 未登入也要自啟（LaunchDaemon）

```bash
sudo bash deploy/launchd-orchestrator/install.sh --scope daemon
```

可指定執行身分：

```bash
sudo bash deploy/launchd-orchestrator/install.sh --scope daemon --user kelvin --group staff
```

重載：

```bash
bash deploy/launchd-orchestrator/reload.sh
```

LaunchDaemon 重載：

```bash
sudo bash deploy/launchd-orchestrator/reload.sh --scope daemon
```

移除：

```bash
bash deploy/launchd-orchestrator/uninstall.sh
```

LaunchDaemon 移除：

```bash
sudo bash deploy/launchd-orchestrator/uninstall.sh --scope daemon
```

### 手動方式（等價）

```bash
# 先把渲染後 plist 放到 ~/Library/LaunchAgents/
cp /ABS/PATH/TO/*.plist ~/Library/LaunchAgents/

# 載入
launchctl load -w ~/Library/LaunchAgents/com.stocksystem.main-service.plist
launchctl load -w ~/Library/LaunchAgents/com.stocksystem.orchestrator.planner-tick.plist
launchctl load -w ~/Library/LaunchAgents/com.stocksystem.orchestrator.worker-tick.plist
launchctl load -w ~/Library/LaunchAgents/com.stocksystem.orchestrator.worker-daemon.plist

# 卸載
launchctl unload -w ~/Library/LaunchAgents/com.stocksystem.main-service.plist
launchctl unload -w ~/Library/LaunchAgents/com.stocksystem.orchestrator.planner-tick.plist
launchctl unload -w ~/Library/LaunchAgents/com.stocksystem.orchestrator.worker-tick.plist
launchctl unload -w ~/Library/LaunchAgents/com.stocksystem.orchestrator.worker-daemon.plist
```

## 4) 驗證登入後自動啟動

1. LaunchAgent：安裝完成後先人工登出再登入（或重開機）
2. LaunchDaemon：安裝完成後直接重開機即可，不需登入
3. 驗證 launchd 是否在跑：

```bash
launchctl list | grep com.stocksystem
launchctl print system/com.stocksystem.main-service
```

4. 驗證 health：

```bash
curl -fsS http://127.0.0.1:3000/api/system/health
curl -fsS http://127.0.0.1:3000/api/orchestrator/summary
```

5. 驗證 planner/worker 是否持續有 tick log 更新（每 10 分鐘）

## 5) 查目前運行狀態與 log

快速查狀態：

```bash
bash deploy/launchd-orchestrator/status.sh
```

主要 log：

- `logs/launchd/main-service.stdout.log`
- `logs/launchd/main-service.stderr.log`
- `logs/launchd/planner-tick.stdout.log`
- `logs/launchd/planner-tick.stderr.log`
- `logs/launchd/worker-tick.stdout.log`
- `logs/launchd/worker-tick.stderr.log`
- `logs/launchd/worker-daemon.stdout.log`
- `logs/launchd/worker-daemon.stderr.log`
- `logs/launchd/smoke.log`

即時追蹤：

```bash
tail -f logs/launchd/main-service.stdout.log
tail -f logs/launchd/main-service.stderr.log
```

## 6) 專案現況說明（backend / frontend）

本專案目前採 Next.js 單體（API + UI 同進程）。  
因此 `start_all.sh` 預設為 `FRONTEND_MODE=shared`：

- backend 進程啟動後，同時提供 frontend
- 仍會分別做 backend / frontend health check

若未來拆分前後端，只要在 `deploy/launchd-orchestrator/launchd.env` 設定：

- `FRONTEND_MODE=separate`
- `FRONTEND_CMD`
- `FRONTEND_PORT`
