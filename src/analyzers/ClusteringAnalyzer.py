"""
Clustering Analyzer
翻倍股特徵聚類分析器

使用 K-means 演算法將歷史翻倍股分群
識別不同的翻倍路徑（例如：法人鎖碼型、主力拉抬型、營收爆發型）
"""

import sqlite3
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from typing import List, Dict, Optional
import json

class ClusteringAnalyzer:
    """翻倍股特徵聚類分析器"""
    
    def __init__(self, db_path: str = 'prisma/dev.db'):
        self.db_path = db_path
        self.conn = None
        self.model = None
        self.scaler = StandardScaler()
    
    def connect(self):
        """連接資料庫"""
        self.conn = sqlite3.connect(self.db_path)
    
    def load_features(self) -> pd.DataFrame:
        """從資料庫載入翻倍股特徵"""
        if not self.conn:
            self.connect()
        
        query = """
        SELECT 
            stockId, stockName, maxGain, doublingDays,
            preRevenueYoY, preChipConcentration, 
            preForeignHolding, preTrustHolding,
            preVolatility, preMomentum
        FROM DoublingFeatures
        WHERE preRevenueYoY IS NOT NULL 
          AND preChipConcentration IS NOT NULL
        """
        
        df = pd.read_sql_query(query, self.conn)
        
        print(f"📊 載入 {len(df)} 筆完整特徵數據")
        return df
    
    def analyze_clusters(self, n_clusters: int = 3) -> Dict:
        """
        執行聚類分析
        
        Args:
            n_clusters: 分群數量
            
        Returns:
            聚類結果報告
        """
        df = self.load_features()
        
        if len(df) < n_clusters:
            print(f"⚠️ 數據不足 ({len(df)} 筆)，無法進行聚類")
            return {'error': '數據不足'}
        
        # 選取特徵欄位進行聚類
        feature_cols = [
            'preRevenueYoY', 'preChipConcentration', 
            'preForeignHolding', 'preTrustHolding',
            'preVolatility', 'preMomentum'
        ]
        
        X = df[feature_cols].copy()
        
        # 標準化
        X_scaled = self.scaler.fit_transform(X)
        
        # K-means 聚類
        self.model = KMeans(n_clusters=n_clusters, random_state=42)
        clusters = self.model.fit_predict(X_scaled)
        
        # 將結果合併回 DataFrame
        df['cluster'] = clusters
        
        # 分析各群特徵
        cluster_summary = []
        
        for i in range(n_clusters):
            cluster_data = df[df['cluster'] == i]
            
            summary = {
                'cluster_id': i,
                'count': len(cluster_data),
                'percent': len(cluster_data) / len(df) * 100,
                'avg_gain': cluster_data['maxGain'].mean(),
                'avg_days': cluster_data['doublingDays'].mean(),
                'features': {}
            }
            
            # 計算特徵平均值
            for col in feature_cols:
                summary['features'][col] = cluster_data[col].mean()
            
            # 自動命名群組類型
            summary['type'] = self._name_cluster(summary['features'])
            
            cluster_summary.append(summary)
        
        return {
            'total_samples': len(df),
            'n_clusters': n_clusters,
            'clusters': cluster_summary,
            'details': df[['stockId', 'stockName', 'cluster', 'maxGain']].to_dict(orient='records')
        }
    
    def _name_cluster(self, features: Dict) -> str:
        """根據特徵自動命名群組"""
        name_parts = []
        
        # 判斷籌碼特徵
        if features['preChipConcentration'] > 3000:
            name_parts.append("高度集中")
        elif features['preTrustHolding'] > 5:
            name_parts.append("投信認養")
        elif features['preForeignHolding'] > 20:
            name_parts.append("外資重倉")
            
        # 判斷基本面
        if features['preRevenueYoY'] > 30:
            name_parts.append("營收爆發")
        
        # 判斷技術面
        if features['preVolatility'] > 3:
            name_parts.append("高波段")
        elif features['preMomentum'] > 70:
            name_parts.append("強勢動能")
            
        if not name_parts:
            return "綜合型"
            
        return " + ".join(name_parts)
    
    def close(self):
        if self.conn:
            self.conn.close()

if __name__ == "__main__":
    analyzer = ClusteringAnalyzer()
    
    try:
        report = analyzer.analyze_clusters(n_clusters=3)
        
        if 'error' not in report:
            print("\n" + "="*80)
            print("翻倍股特徵聚類分析報告")
            print("="*80 + "\n")
            
            for cluster in report['clusters']:
                print(f"群組 {cluster['cluster_id']}: [{cluster['type']}]")
                print(f"  數量: {cluster['count']} ({cluster['percent']:.1f}%)")
                print(f"  平均漲幅: {cluster['avg_gain']:.1f}%")
                print(f"  平均天數: {cluster['avg_days']:.1f} 天")
                print("  特徵:")
                for k, v in cluster['features'].items():
                    print(f"    - {k}: {v:.2f}")
                print()
            
            print("="*80 + "\n")
            
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        import traceback
        traceback.print_exc()
    finally:
        analyzer.close()
