"""
Look-Ahead Bias Detector
偵測策略是否使用未來數據

在回測中，常見的 Look-ahead Bias：
1. 使用當日收盤價做當日買入決策
2. 使用當日最高/最低價做當日止損判斷
3. 使用未來營收數據做當前決策

This validator ensures strategies only use data that would have been available at decision time.
"""

from dataclasses import dataclass
from typing import List, Dict
from datetime import datetime

@dataclass
class DataAccess:
    """數據訪問記錄"""
    timestamp: datetime  # 訪問時間（決策時間點）
    stock_id: str
    date: str  # 被訪問的數據日期
    field: str  # 訪問的欄位 (close, open, high, low)
    value: float

class LookAheadBiasDetector:
    """Look-ahead Bias 偵測器"""
    
    def __init__(self):
        self.access_log: List[DataAccess] = []
        self.violations: List[Dict] = []
    
    def log_access(self, decision_date: str, stock_id: str, data_date: str, field: str, value: float):
        """
        記錄數據訪問
        
        Args:
            decision_date: 決策日期（策略執行日期）
            stock_id: 股票代號
            data_date: 被訪問的數據日期
            field: 欄位名稱
            value: 數值
        """
        self.access_log.append(DataAccess(
            timestamp=datetime.strptime(decision_date, '%Y-%m-%d'),
            stock_id=stock_id,
            date=data_date,
            field=field,
            value=value
        ))
    
    def validate(self) -> bool:
        """
        驗證是否有 look-ahead bias
        
        規則：
        1. ✅ 允許：使用昨日及之前的所有數據
        2. ✅ 允許：使用當日開盤價（因為開盤後才能決策）
        3. ❌ 禁止：使用當日收盤價做當日買入（收盤前無法知道）
        4. ❌ 禁止：使用當日最高/最低價做當日決策
        
        Returns:
            True if no violations found
        """
        for access in self.access_log:
            decision_date = access.timestamp.strftime('%Y-%m-%d')
            data_date = access.date
            
            # 檢查是否使用未來數據
            if data_date > decision_date:
                self.violations.append({
                    'type': 'FUTURE_DATA',
                    'decision_date': decision_date,
                    'data_date': data_date,
                    'stock_id': access.stock_id,
                    'field': access.field,
                    'severity': 'CRITICAL',
                    'message': f'策略在 {decision_date} 使用了未來日期 {data_date} 的數據'
                })
            
            # 檢查是否使用當日收盤價做當日決策
            elif data_date == decision_date and access.field == 'close':
                self.violations.append({
                    'type': 'SAME_DAY_CLOSE',
                    'decision_date': decision_date,
                    'stock_id': access.stock_id,
                    'field': 'close',
                    'severity': 'HIGH',
                    'message': f'策略在 {decision_date} 使用了當日收盤價做買入決策（Look-ahead Bias）'
                })
            
            # 檢查是否使用當日最高/最低價
            elif data_date == decision_date and access.field in ['high', 'low']:
                self.violations.append({
                    'type': 'SAME_DAY_EXTREME',
                    'decision_date': decision_date,
                    'stock_id': access.stock_id,
                    'field': access.field,
                    'severity': 'MEDIUM',
                    'message': f'策略在 {decision_date} 使用了當日{access.field}價（可能的 Look-ahead Bias）'
                })
        
        return len(self.violations) == 0
    
    def generate_report(self) -> Dict:
        """生成驗證報告"""
        is_clean = self.validate()
        
        return {
            'is_clean': is_clean,
            'total_accesses': len(self.access_log),
            'violations_count': len(self.violations),
            'violations': self.violations,
            'severity_summary': {
                'CRITICAL': len([v for v in self.violations if v['severity'] == 'CRITICAL']),
                'HIGH': len([v for v in self.violations if v['severity'] == 'HIGH']),
                'MEDIUM': len([v for v in self.violations if v['severity'] == 'MEDIUM'])
            }
        }
    
    def print_report(self):
        """印出報告"""
        report = self.generate_report()
        
        print("\n" + "="*80)
        print("Look-Ahead Bias Detection Report")
        print("="*80 + "\n")
        
        if report['is_clean']:
            print("✅ No look-ahead bias detected!")
            print(f"   Total data accesses validated: {report['total_accesses']}")
        else:
            print(f"❌ Found {report['violations_count']} potential violations!\n")
            
            severity_summary = report['severity_summary']
            if severity_summary['CRITICAL'] > 0:
                print(f"   🚨 CRITICAL: {severity_summary['CRITICAL']} violations")
            if severity_summary['HIGH'] > 0:
                print(f"   ⚠️  HIGH:     {severity_summary['HIGH']} violations")
            if severity_summary['MEDIUM'] > 0:
                print(f"   ⚡ MEDIUM:   {severity_summary['MEDIUM']} violations")
            
            print("\nViolation Details:\n")
            for i, violation in enumerate(report['violations'][:10], 1):
                print(f"{i}. [{violation['severity']}] {violation['message']}")
                print(f"   Stock: {violation['stock_id']}, Field: {violation['field']}\n")
            
            if len(report['violations']) > 10:
                print(f"... and {len(report['violations']) - 10} more violations\n")
        
        print("="*80 + "\n")

if __name__ == "__main__":
    # 測試範例
    detector = LookAheadBiasDetector()
    
    # 模擬正常訪問（昨日數據）
    detector.log_access('2025-12-20', '2330', '2025-12-19', 'close', 1000)
    
    # 模擬 Look-ahead violation（當日收盤）
    detector.log_access('2025-12-20', '2330', '2025-12-20', 'close', 1010)
    
    # 模擬允許的訪問（當日開盤）
    detector.log_access('2025-12-20', '2330', '2025-12-20', 'open', 995)
    
    detector.print_report()
