"""
Test Survivorship Bias Filter
測試生存者偏差過濾器
"""

import sys
sys.path.append('.')

from src.validators.SurvivorshipFilter import SurvivorshipFilter

def test_basic_filtering():
    """測試基本過濾功能"""
    print("\n測試 1: 基本股票過濾")
    print("-" * 60)
    
    filter = SurvivorshipFilter()
    
    # 測試股票列表
    test_stocks = ['2330', '2317', '2454', '2603', '2881', '6443']
    
    # 過濾 2025年的股票
    filtered = filter.filter_stocks('2025-11-01', test_stocks)
    
    print(f"原始股票數: {len(test_stocks)}")
    print(f"過濾後股票數: {len(filtered)}")
    print(f"過濾結果: {filtered}")
    
    assert len(filtered) > 0, "應該至少有一些股票通過過濾"
    
    print("✅ PASS\n")
    filter.close()

def test_period_validation():
    """測試回測期間驗證"""
    print("測試 2: 回測期間驗證")
    print("-" * 60)
    
    filter = SurvivorshipFilter()
    
    test_stocks = ['2330', '2317', '2454', '0050']
    
    # 驗證一個較長的回測期間
    report = filter.validate_backtest_period('2023-01-01', '2025-12-31', test_stocks)
    
    print(f"總股票數: {report['total_stocks']}")
    print(f"發現問題: {report['issues_count']}")
    print(f"存在偏差: {report['has_bias']}")
    
    if report['issues']:
        print("\n問題詳情:")
        for issue in report['issues'][:5]:  # 只顯示前5個
            print(f"  [{issue['severity']}] {issue['stock_id']}: {issue['issue']}")
    
    print("\n✅ PASS\n")
    filter.close()

def test_date_format_handling():
    """測試不同日期格式"""
    print("測試 3: 日期格式處理")
    print("-" * 60)
    
    filter = SurvivorshipFilter()
    
    test_stocks = ['2330', '2454']
    
    # 測試不同格式
    formats = [
        '2025-11-01',   # YYYY-MM-DD
        '20251101',      # YYYYMMDD
    ]
    
    for date_format in formats:
        filtered = filter.filter_stocks(date_format, test_stocks)
        print(f"日期格式 {date_format}: {len(filtered)} 支股票通過")
        assert len(filtered) > 0, f"格式 {date_format} 應該有結果"
    
    print("\n✅ PASS\n")
    filter.close()

if __name__ == "__main__":
    try:
        test_basic_filtering()
        test_period_validation()
        test_date_format_handling()
        
        print("="*60)
        print("✅ All Survivorship Filter tests passed!")
        print("="*60 + "\n")
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
