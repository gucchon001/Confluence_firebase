/**
 * パフォーマンス監視スクリプト
 * 同期処理と検索処理のパフォーマンスを測定
 */

import 'dotenv/config';
import { performance } from 'perf_hooks';
import { LanceDBClient } from '../lib/lancedb-client';
import { searchLanceDB } from '../lib/lancedb-search-client';

interface PerformanceMetrics {
  timestamp: string;
  category: string;
  operation: string;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  success: boolean;
  error?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private startTime: number = 0;

  /**
   * メトリクス測定開始
   */
  startMeasurement(operation: string): void {
    this.startTime = performance.now();
    console.log(`🔍 測定開始: ${operation}`);
  }

  /**
   * メトリクス測定終了
   */
  endMeasurement(category: string, operation: string, success: boolean = true, error?: string): PerformanceMetrics {
    const duration = performance.now() - this.startTime;
    const memoryUsage = process.memoryUsage();
    
    const metric: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      category,
      operation,
      duration,
      memoryUsage,
      success,
      error
    };

    this.metrics.push(metric);
    
    console.log(`✅ 測定完了: ${operation} - ${duration.toFixed(2)}ms`);
    console.log(`  メモリ使用量: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    return metric;
  }

  /**
   * データベース状況を測定
   */
  async measureDatabaseStatus(): Promise<void> {
    this.startMeasurement('データベース状況確認');
    
    try {
      const lancedbClient = LanceDBClient.getInstance();
      await lancedbClient.connect();
      const table = await lancedbClient.getTable();
      
      const totalChunks = await table.countRows();
      console.log(`📊 総チャンク数: ${totalChunks}件`);
      
      // メモリ使用量を測定
      const memoryUsage = process.memoryUsage();
      console.log(`💾 メモリ使用量:`);
      console.log(`  RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  External: ${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`);
      
      this.endMeasurement('database', 'status_check', true);
      
    } catch (error) {
      this.endMeasurement('database', 'status_check', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * 検索処理のパフォーマンスを測定
   */
  async measureSearchPerformance(): Promise<void> {
    const testQueries = [
      '要件定義',
      'ワークフロー',
      '機能要件',
      '権限',
      '帳票'
    ];

    console.log('\n🔍 検索処理パフォーマンス測定');
    console.log('=' .repeat(50));

    for (const query of testQueries) {
      this.startMeasurement(`検索: ${query}`);
      
      try {
        const startTime = performance.now();
        const results = await searchLanceDB({
          query: query,
          limit: 10,
          labelFilters: {
            excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive']
          }
        });
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        console.log(`  結果数: ${results.length}件`);
        console.log(`  処理時間: ${duration.toFixed(2)}ms`);
        
        this.endMeasurement('search', `query_${query}`, true);
        
      } catch (error) {
        this.endMeasurement('search', `query_${query}`, false, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * メトリクスサマリーを生成
   */
  generateSummary(): void {
    console.log('\n📊 パフォーマンス測定サマリー');
    console.log('=' .repeat(50));

    // カテゴリ別統計
    const categories = [...new Set(this.metrics.map(m => m.category))];
    
    for (const category of categories) {
      const categoryMetrics = this.metrics.filter(m => m.category === category);
      const successCount = categoryMetrics.filter(m => m.success).length;
      const totalCount = categoryMetrics.length;
      const avgDuration = categoryMetrics.reduce((sum, m) => sum + m.duration, 0) / totalCount;
      
      console.log(`\n📋 ${category.toUpperCase()}:`);
      console.log(`  成功率: ${successCount}/${totalCount} (${((successCount/totalCount)*100).toFixed(1)}%)`);
      console.log(`  平均処理時間: ${avgDuration.toFixed(2)}ms`);
      
      if (categoryMetrics.length > 0) {
        const maxDuration = Math.max(...categoryMetrics.map(m => m.duration));
        const minDuration = Math.min(...categoryMetrics.map(m => m.duration));
        console.log(`  最大処理時間: ${maxDuration.toFixed(2)}ms`);
        console.log(`  最小処理時間: ${minDuration.toFixed(2)}ms`);
      }
    }

    // メモリ使用量統計
    const memoryMetrics = this.metrics.map(m => m.memoryUsage);
    if (memoryMetrics.length > 0) {
      const avgHeapUsed = memoryMetrics.reduce((sum, m) => sum + m.heapUsed, 0) / memoryMetrics.length;
      const maxHeapUsed = Math.max(...memoryMetrics.map(m => m.heapUsed));
      const minHeapUsed = Math.min(...memoryMetrics.map(m => m.heapUsed));
      
      console.log('\n💾 メモリ使用量統計:');
      console.log(`  平均Heap Used: ${(avgHeapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  最大Heap Used: ${(maxHeapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  最小Heap Used: ${(minHeapUsed / 1024 / 1024).toFixed(2)}MB`);
    }

    // エラー統計
    const errorMetrics = this.metrics.filter(m => !m.success);
    if (errorMetrics.length > 0) {
      console.log('\n❌ エラー統計:');
      errorMetrics.forEach(metric => {
        console.log(`  ${metric.operation}: ${metric.error}`);
      });
    }
  }

  /**
   * メトリクスをCSVファイルに出力
   */
  async exportMetrics(filename: string = 'performance-metrics.csv'): Promise<void> {
    const fs = await import('fs');
    const csvHeader = 'timestamp,category,operation,duration,heapUsed,heapTotal,rss,external,success,error\n';
    const csvRows = this.metrics.map(m => 
      `${m.timestamp},${m.category},${m.operation},${m.duration},${m.memoryUsage.heapUsed},${m.memoryUsage.heapTotal},${m.memoryUsage.rss},${m.memoryUsage.external},${m.success},${m.error || ''}`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;
    fs.writeFileSync(filename, csvContent);
    console.log(`\n📁 メトリクスを ${filename} に出力しました`);
  }
}

// メイン実行
async function runPerformanceMonitoring() {
  console.log('🚀 パフォーマンス監視開始');
  console.log('=' .repeat(50));

  const monitor = new PerformanceMonitor();

  try {
    // データベース状況測定
    await monitor.measureDatabaseStatus();

    // 検索処理パフォーマンス測定
    await monitor.measureSearchPerformance();

    // サマリー生成
    monitor.generateSummary();

    // メトリクス出力
    await monitor.exportMetrics();

    console.log('\n✅ パフォーマンス監視完了');

  } catch (error) {
    console.error('❌ パフォーマンス監視エラー:', error);
  }
}

runPerformanceMonitoring().catch(console.error);
