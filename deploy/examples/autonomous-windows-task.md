# Autonomous System Windows Task Scheduler example

Replace `C:\PATH\TO\Stock-Prediction-System` with your real workspace path.
Make sure `node`, `npm`, and environment variables are available to the scheduled task.

## Suggested tasks

### Daily
```bat
schtasks /Create /TN "StockSystem\Autonomous Daily" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 18:20 /TR "cmd /c cd /d C:\PATH\TO\Stock-Prediction-System && npm run autonomous:daily >> logs\autonomous\daily.log 2>&1"
```

### Monitor
```bat
schtasks /Create /TN "StockSystem\Autonomous Monitor" /SC MINUTE /MO 30 /TR "cmd /c cd /d C:\PATH\TO\Stock-Prediction-System && npm run autonomous:monitor >> logs\autonomous\monitor.log 2>&1"
```

### Review
```bat
schtasks /Create /TN "StockSystem\Autonomous Review" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 20:30 /TR "cmd /c cd /d C:\PATH\TO\Stock-Prediction-System && npm run autonomous:review >> logs\autonomous\review.log 2>&1"
```

### Learning
```bat
schtasks /Create /TN "StockSystem\Autonomous Learning" /SC WEEKLY /D MON,WED,FRI /ST 21:00 /TR "cmd /c cd /d C:\PATH\TO\Stock-Prediction-System && npm run autonomous:learning >> logs\autonomous\learning.log 2>&1"
```

## Notes

- Use `cmd /c` so the task can chain `cd` and npm execution.
- Keep logs separate per job.
- If the task starts failing, check `/api/autonomous/jobs/status` and `/autonomous/dashboard` before changing the schedule.
