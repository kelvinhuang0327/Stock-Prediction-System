const fs = require('fs');
const data = JSON.parse(fs.readFileSync('eslint-p175-before.json', 'utf8'));

let safeFiles = [];
for (const file of data) {
  if (file.filePath.includes('RuleBasedStockAnalyzer.ts')) continue;
  if (file.errorCount === 0 && file.warningCount === 0) continue;
  
  const hasHookError = file.messages.some(m => m.ruleId && m.ruleId.includes('react-hooks'));
  if (!hasHookError) {
    safeFiles.push(file.filePath);
    if (safeFiles.length === 5) break;
  }
}

console.log(safeFiles.join('\n'));
