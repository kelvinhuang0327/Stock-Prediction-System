"""
Survivorship Bias Filter
生存者偏差過濾器

防止回測使用「後來才上市」或「已下市」的股票數據
這是回測中最常見的偏差來源之一

Example:
    某支股票在 2024-06-01 才上市，但回測時使用了 2023 年的數據
    這會導致虛假的高績效（因為只有成功上市的公司才會被納入）
"""

import sqlite3
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class StockInfo:
    """股票基本資訊"""
    stock_id: str
    name: str
    listing_date: Optional[str]  # 上市日期
    delisting_date: Optional[str]  # 下市日期（None = 仍在市場）

class SurvivorshipFilter:
    """生存者偏差過濾器"""
    
    def __init__(self, db_path: str = 'prisma/dev.db'):
        self.db_path = db_path
        self.conn = None
        self.stocks_cache: Dict[str, StockInfo] = {}
        self._load_stock_info()
    
    def _load_stock_info(self):
        """載入所有股票的上市/下市資訊"""
        self.conn = sqlite3.connect(self.db_path)
        cursor = self.conn.cursor()
        
        # 查詢股票基本資訊
        query = """
        SELECT id, name, listingDate
        FROM Stock
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        for stock_id, name, listing_date in rows:
            self.stocks_cache[stock_id] = StockInfo(
                stock_id=stock_id,
                name=name,
                listing_date=listing_date,
                delisting_date=None  # 目前資料庫沒有下市日期欄位
            )
        
        print(f"✅ 載入 {len(self.stocks_cache)} 支股票資訊")
    
    def filter_stocks(self, date: str, stock_ids: List[str]) -> List[str]:
        """
        過濾在指定日期可交易的股票
        
        Args:
            date: 回測日期 (YYYY-MM-DD or YYYYMMDD)
            stock_ids: 候選股票列表
        
        Returns:
            在該日期可交易的股票列表
        """
        # 正規化日期格式
        try:
            if '-' in date:
                check_date = datetime.strptime(date, '%Y-%m-%d')
            else:
                check_date = datetime.strptime(date, '%Y%m%d')
        except:
            print(f"⚠️ 無效日期格式: {date}")
            return stock_ids
        
        filtered = []
        excluded_count = 0
        
        for stock_id in stock_ids:
            stock_info = self.stocks_cache.get(stock_id)
            
            if not stock_info:
                # 股票不在資料庫中，略過
                excluded_count += 1
                continue
            
            # 檢查上市日期
            if stock_info.listing_date:
                try:
                    # 嘗試多種日期格式
                    if len(stock_info.listing_date) == 8:  # YYYYMMDD
                        listing_dt = datetime.strptime(stock_info.listing_date, '%Y%m%d')
                    elif '-' in stock_info.listing_date:  # YYYY-MM-DD
                        listing_dt = datetime.strptime(stock_info.listing_date, '%Y-%m-%d')
                    else:
                        # 無法解析，保守起見排除
                        excluded_count += 1
                        continue
                    
                    # 如果回測日期早於上市日期，排除
                    if check_date < listing_dt:
                        excluded_count += 1
                        continue
                        
                except Exception as e:
                    # 日期解析錯誤，保守起見排除
                    excluded_count += 1
                    continue
            
            # 檢查下市日期
            if stock_info.delisting_date:
                try:
                    if len(stock_info.delisting_date) == 8:
                        delisting_dt = datetime.strptime(stock_info.delisting_date, '%Y%m%d')
                    else:
                        delisting_dt = datetime.strptime(stock_info.delisting_date, '%Y-%m-%d')
                    
                    # 如果回測日期晚於下市日期，排除
                    if check_date > delisting_dt:
                        excluded_count += 1
                        continue
                        
                except Exception:
                    pass  # 下市日期解析失敗，假設仍在市場
            
            # 通過所有檢查
            filtered.append(stock_id)
        
        if excluded_count > 0:
            print(f"📊 {date}: 排除 {excluded_count} 支不可交易股票, 保留 {len(filtered)} 支")
        
        return filtered
    
    def get_stock_info(self, stock_id: str) -> Optional[StockInfo]:
        """取得股票資訊"""
        return self.stocks_cache.get(stock_id)
    
    def validate_backtest_period(self, start_date: str, end_date: str, stock_ids: List[str]) -> Dict:
        """
        驗證回測期間是否有生存者偏差
        
        Returns:
            驗證報告
        """
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        except:
            return {'error': '無效日期格式'}
        
        issues = []
        
        for stock_id in stock_ids:
            stock_info = self.stocks_cache.get(stock_id)
            if not stock_info or not stock_info.listing_date:
                continue
            
            try:
                if len(stock_info.listing_date) == 8:
                    listing_dt = datetime.strptime(stock_info.listing_date, '%Y%m%d')
                else:
                    listing_dt = datetime.strptime(stock_info.listing_date, '%Y-%m-%d')
                
                # 檢查回測期間是否包含上市前的時間
                if start_dt < listing_dt < end_dt:
                    issues.append({
                        'stock_id': stock_id,
                        'stock_name': stock_info.name,
                        'listing_date': stock_info.listing_date,
                        'issue': f'股票在回測期間內上市 ({stock_info.listing_date})',
                        'severity': 'WARNING'
                    })
                elif start_dt < listing_dt:
                    issues.append({
                        'stock_id': stock_id,
                        'stock_name': stock_info.name,
                        'listing_date': stock_info.listing_date,
                        'issue': f'回測起始日 ({start_date}) 早於上市日 ({stock_info.listing_date})',
                        'severity': 'CRITICAL'
                    })
            except:
                continue
        
        return {
            'total_stocks': len(stock_ids),
            'issues_count': len(issues),
            'issues': issues,
            'has_bias': len(issues) > 0
        }
    
    def close(self):
        """關閉資料庫連接"""
        if self.conn:
            self.conn.close()

if __name__ == "__main__":
    # 測試範例
    filter = SurvivorshipFilter()
    
    # 測試過濾
    test_stocks = ['2330', '2317', '2454', '0050', '6443']
    
    print("\n測試 1: 過濾 2025-11-01 可交易股票")
    filtered = filter.filter_stocks('2025-11-01', test_stocks)
    print(f"結果: {filtered}\n")
    
    # 測試驗證
    print("測試 2: 驗證回測期間")
    report = filter.validate_backtest_period('2024-01-01', '2025-12-31', test_stocks)
    print(f"生存者偏差: {'是' if report['has_bias'] else '否'}")
    print(f"問題數: {report['issues_count']}")
    
    if report['issues']:
        print("\n問題詳情:")
        for issue in report['issues']:
            print(f"  - {issue['stock_id']} {issue['stock_name']}: {issue['issue']}")
    
    filter.close()
