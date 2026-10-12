"""
Test Look-Ahead Bias Detector
測試 Look-ahead Bias 偵測器
"""

import sys
sys.path.append('src')

from validators.LookAheadBiasDetector import LookAheadBiasDetector

def test_clean_strategy():
    """測試乾淨的策略（無 bias）"""
    print("\n測試 1: 乾淨的策略")
    print("-" * 40)
    
    detector = LookAheadBiasDetector()
    
    # 使用昨日收盤價 ✅
    detector.log_access('2025-12-20', '2330', '2025-12-19', 'close', 1000)
    
    # 使用當日開盤價 ✅
    detector.log_access('2025-12-20', '2330', '2025-12-20', 'open', 995)
    
    # 使用前日數據 ✅
    detector.log_access('2025-12-20', '2454', '2025-12-18', 'close', 500)
    
    report = detector.generate_report()
    assert report['is_clean'] == True
    assert report['violations_count'] == 0
    
    print("✅ PASS: No violations detected")

def test_lookahead_violations():
    """測試有 look-ahead bias 的策略"""
    print("\n測試 2: Look-ahead Bias 違規")
    print("-" * 40)
    
    detector = LookAheadBiasDetector()
    
    # ❌ 使用當日收盤價做當日買入
    detector.log_access('2025-12-20', '2330', '2025-12-20', 'close', 1010)
    
    # ❌ 使用未來數據
    detector.log_access('2025-12-20', '2454', '2025-12-21', 'close', 520)
    
    # ⚠️ 使用當日最高價
    detector.log_access('2025-12-20', '2603', '2025-12-20', 'high', 200)
    
    report = detector.generate_report()
    assert report['is_clean'] == False
    assert report['violations_count'] == 3
    assert report['severity_summary']['CRITICAL'] == 1  # Future data
    assert report['severity_summary']['HIGH'] == 1      # Same day close
    assert report['severity_summary']['MEDIUM'] == 1    # Same day high
    
    detector.print_report()
    
    print("✅ PASS: All violations detected correctly")

if __name__ == "__main__":
    try:
        test_clean_strategy()
        test_lookahead_violations()
        
        print("\n" + "="*60)
        print("✅ All tests passed!")
        print("="*60 + "\n")
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}\n")
        sys.exit(1)
