/**
 * 簡易版: バックアップと現在のベクトル比較
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const testPageId = '704643076'; // 046_【FIX】会員退会機能

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 バックアップとの比較調査');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Step 1: バックアップLanceDBのレコード数を確認\n');
  
  try {
    // バックアップのディレクトリサイズを確認
    const { stdout: backupInfo } = await execAsync('Get-ChildItem -Path .lancedb.backup.1760508595814 -Recurse | Measure-Object -Property Length -Sum | Select-Object @{Name="SizeMB";Expression={[math]::Round($_.Sum/1MB,2)}}, Count');
    console.log('バックアップ情報:');
    console.log(backupInfo);
    
    const { stdout: currentInfo } = await execAsync('Get-ChildItem -Path .lancedb -Recurse | Measure-Object -Property Length -Sum | Select-Object @{Name="SizeMB";Expression={[math]::Round($_.Sum/1MB,2)}}, Count');
    console.log('現在のLanceDB情報:');
    console.log(currentInfo);
    
  } catch (error: any) {
    console.error('エラー:', error.message);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 結論');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('調査結果:');
  console.log('  バックアップと現在のLanceDBのファイルサイズを比較しました');
  console.log('  ');
  console.log('エンベディング失敗の可能性:');
  console.log('  1. ベクトルがすべて0になっている → ファイルサイズが小さいはず');
  console.log('  2. ベクトルが正常に生成されている → ファイルサイズは大きいはず');
  console.log('  3. チャンク削減により → ファイルサイズは小さくなる（これは正常）\n');
  
  console.log('推奨される次の調査:');
  console.log('  → Phase 0A-2のデータ（もっと古いバックアップ）を探す');
  console.log('  → または、rebuild-lancedb-smart-chunking.tsのログを確認');
  console.log('  → ベクトル生成時のエラーがなかったか確認\n');
}

main().catch(console.error);

