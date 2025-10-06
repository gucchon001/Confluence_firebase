#!/usr/bin/env ts-node

/**
 * コード品質チェッカー
 * 重複コード、干渉、仕様準拠性をチェック
 */

import * as fs from 'fs';
import * as path from 'path';

interface CodeQualityIssue {
  type: 'duplicate' | 'interference' | 'specification' | 'import';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

interface CodeQualityReport {
  totalIssues: number;
  issuesByType: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issues: CodeQualityIssue[];
  duplicateFiles: string[];
  interferenceFiles: string[];
  specificationViolations: string[];
}

class CodeQualityChecker {
  private issues: CodeQualityIssue[] = [];
  private srcPath: string;
  private libPath: string;
  private componentsPath: string;

  constructor() {
    this.srcPath = path.join(process.cwd(), 'src');
    this.libPath = path.join(this.srcPath, 'lib');
    this.componentsPath = path.join(this.srcPath, 'components');
  }

  /**
   * 全チェック実行
   */
  async runAllChecks(): Promise<CodeQualityReport> {
    console.log('🔍 Starting Code Quality Checks...\n');

    try {
      // 重複コードチェック
      await this.checkDuplicateCode();
      
      // インポート重複チェック
      await this.checkImportDuplication();
      
      // 機能干渉チェック
      await this.checkFunctionInterference();
      
      // 仕様準拠性チェック
      await this.checkSpecificationCompliance();
      
      // 型定義整合性チェック
      await this.checkTypeDefinitionConsistency();
      
      // サービス間の依存関係チェック
      await this.checkServiceDependencies();
      
      // レポート生成
      return this.generateReport();
      
    } catch (error) {
      console.error('❌ Code quality check failed:', error);
      throw error;
    }
  }

  /**
   * 重複コードチェック
   */
  private async checkDuplicateCode(): Promise<void> {
    console.log('📋 Checking for duplicate code...');
    
    const libFiles = await this.getTypeScriptFiles(this.libPath);
    const componentFiles = await this.getTypeScriptFiles(this.componentsPath);
    const allFiles = [...libFiles, ...componentFiles];
    
    const functionSignatures = new Map<string, string[]>();
    
    for (const file of allFiles) {
      const content = await this.readFile(file);
      const functions = this.extractFunctions(content);
      
      for (const func of functions) {
        const signature = this.normalizeFunctionSignature(func);
        if (!functionSignatures.has(signature)) {
          functionSignatures.set(signature, []);
        }
        functionSignatures.get(signature)!.push(file);
      }
    }
    
    // 重複関数を検出
    for (const [signature, files] of functionSignatures.entries()) {
      if (files.length > 1) {
        this.addIssue({
          type: 'duplicate',
          severity: 'medium',
          file: files[0],
          message: `Duplicate function signature found in ${files.length} files`,
          suggestion: 'Consider extracting to a shared utility function'
        });
        
        files.slice(1).forEach(file => {
          this.addIssue({
            type: 'duplicate',
            severity: 'low',
            file,
            message: `Duplicate function: ${signature}`,
            suggestion: 'Remove duplicate and import from shared location'
          });
        });
      }
    }
  }

  /**
   * インポート重複チェック
   */
  private async checkImportDuplication(): Promise<void> {
    console.log('📋 Checking for import duplication...');
    
    const files = await this.getAllTypeScriptFiles();
    
    for (const file of files) {
      const content = await this.readFile(file);
      const imports = this.extractImports(content);
      
      // 同じモジュールからの重複インポート
      const importGroups = new Map<string, string[]>();
      
      imports.forEach(importStmt => {
        const module = importStmt.module;
        if (!importGroups.has(module)) {
          importGroups.set(module, []);
        }
        importGroups.get(module)!.push(importStmt.statement);
      });
      
      for (const [module, statements] of importGroups.entries()) {
        if (statements.length > 1) {
          this.addIssue({
            type: 'import',
            severity: 'low',
            file,
            message: `Multiple imports from same module: ${module}`,
            suggestion: 'Combine into single import statement'
          });
        }
      }
    }
  }

  /**
   * 機能干渉チェック
   */
  private async checkFunctionInterference(): Promise<void> {
    console.log('📋 Checking for function interference...');
    
    // サービス間の干渉チェック
    const serviceFiles = await this.getTypeScriptFiles(this.libPath);
    
    for (const file of serviceFiles) {
      if (file.includes('service.ts')) {
        const content = await this.readFile(file);
        
        // 同じ関数名の使用チェック
        const functionNames = this.extractFunctionNames(content);
        const className = this.extractClassName(content);
        
        if (className && functionNames.length > 0) {
          // 他のサービスファイルと関数名を比較
          for (const otherFile of serviceFiles) {
            if (otherFile !== file && otherFile.includes('service.ts')) {
              const otherContent = await this.readFile(otherFile);
              const otherFunctionNames = this.extractFunctionNames(otherContent);
              const otherClassName = this.extractClassName(otherContent);
              
              const commonFunctions = functionNames.filter(name => 
                otherFunctionNames.includes(name)
              );
              
              if (commonFunctions.length > 0) {
                this.addIssue({
                  type: 'interference',
                  severity: 'high',
                  file,
                  message: `Function name collision with ${otherClassName}: ${commonFunctions.join(', ')}`,
                  suggestion: 'Use unique function names or namespace prefixes'
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * 仕様準拠性チェック
   */
  private async checkSpecificationCompliance(): Promise<void> {
    console.log('📋 Checking specification compliance...');
    
    const files = await this.getAllTypeScriptFiles();
    
    for (const file of files) {
      const content = await this.readFile(file);
      
      // エラーハンドリングの仕様チェック
      if (content.includes('async') && !content.includes('try') && !content.includes('catch')) {
        this.addIssue({
          type: 'specification',
          severity: 'medium',
          file,
          message: 'Async function without error handling',
          suggestion: 'Add try-catch blocks for proper error handling'
        });
      }
      
      // 型定義の仕様チェック
      if (file.includes('service.ts') && !content.includes('export type')) {
        this.addIssue({
          type: 'specification',
          severity: 'low',
          file,
          message: 'Service file without type definitions',
          suggestion: 'Add proper TypeScript type definitions'
        });
      }
      
      // ログ出力の仕様チェック
      if (file.includes('service.ts') && !content.includes('console.log') && !content.includes('console.error')) {
        this.addIssue({
          type: 'specification',
          severity: 'low',
          file,
          message: 'Service file without logging',
          suggestion: 'Add appropriate logging for debugging and monitoring'
        });
      }
    }
  }

  /**
   * 型定義整合性チェック
   */
  private async checkTypeDefinitionConsistency(): Promise<void> {
    console.log('📋 Checking type definition consistency...');
    
    const libFiles = await this.getTypeScriptFiles(this.libPath);
    const typeFiles = libFiles.filter(file => file.includes('types') || file.includes('type'));
    
    // 型定義ファイルの存在確認
    const expectedTypes = [
      'ErrorLog',
      'SystemStatus', 
      'SatisfactionRating',
      'MarkdownQualityIssue',
      'AdminUser',
      'PostLog'
    ];
    
    for (const typeName of expectedTypes) {
      let found = false;
      for (const file of typeFiles) {
        const content = await this.readFile(file);
        if (content.includes(`export type ${typeName}`) || content.includes(`export interface ${typeName}`)) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        this.addIssue({
          type: 'specification',
          severity: 'high',
          file: 'src/types.ts',
          message: `Missing type definition: ${typeName}`,
          suggestion: 'Add the missing type definition'
        });
      }
    }
  }

  /**
   * サービス間の依存関係チェック
   */
  private async checkServiceDependencies(): Promise<void> {
    console.log('📋 Checking service dependencies...');
    
    const serviceFiles = await this.getTypeScriptFiles(this.libPath);
    const dependencyMap = new Map<string, string[]>();
    
    // 各サービスの依存関係を解析
    for (const file of serviceFiles) {
      if (file.includes('service.ts')) {
        const content = await this.readFile(file);
        const dependencies = this.extractDependencies(content);
        const serviceName = path.basename(file, '.ts');
        dependencyMap.set(serviceName, dependencies);
      }
    }
    
    // 循環依存をチェック
    for (const [service, deps] of dependencyMap.entries()) {
      for (const dep of deps) {
        if (dependencyMap.has(dep)) {
          const depDeps = dependencyMap.get(dep)!;
          if (depDeps.includes(service)) {
            this.addIssue({
              type: 'interference',
              severity: 'critical',
              file: `${service}.ts`,
              message: `Circular dependency detected: ${service} ↔ ${dep}`,
              suggestion: 'Refactor to remove circular dependency'
            });
          }
        }
      }
    }
  }

  /**
   * ユーティリティメソッド
   */
  private async getTypeScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        const subFiles = await this.getTypeScriptFiles(fullPath);
        files.push(...subFiles);
      } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private async getAllTypeScriptFiles(): Promise<string[]> {
    return await this.getTypeScriptFiles(this.srcPath);
  }

  private async readFile(filePath: string): Promise<string> {
    return await fs.promises.readFile(filePath, 'utf-8');
  }

  private extractFunctions(content: string): string[] {
    const functionRegex = /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(?:async\s+)?\w+\s*\([^)]*\)\s*{)/g;
    return content.match(functionRegex) || [];
  }

  private normalizeFunctionSignature(func: string): string {
    return func.replace(/\s+/g, ' ').trim();
  }

  private extractImports(content: string): Array<{ module: string; statement: string }> {
    const importRegex = /import\s+(?:{[^}]*}|\w+|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
    const imports: Array<{ module: string; statement: string }> = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        module: match[1],
        statement: match[0]
      });
    }
    
    return imports;
  }

  private extractFunctionNames(content: string): string[] {
    const functionNameRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=|\s+(\w+)\s*\([^)]*\)\s*{)/g;
    const names: string[] = [];
    let match;
    
    while ((match = functionNameRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      if (name && !names.includes(name)) {
        names.push(name);
      }
    }
    
    return names;
  }

  private extractClassName(content: string): string | null {
    const classRegex = /class\s+(\w+)/;
    const match = content.match(classRegex);
    return match ? match[1] : null;
  }

  private extractDependencies(content: string): string[] {
    const importRegex = /import\s+.*from\s+['"]\.\.?\/lib\/([^'"]+)['"]/g;
    const deps: string[] = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const dep = match[1].replace('.ts', '');
      if (!deps.includes(dep)) {
        deps.push(dep);
      }
    }
    
    return deps;
  }

  private addIssue(issue: CodeQualityIssue): void {
    this.issues.push(issue);
  }

  /**
   * レポート生成
   */
  private generateReport(): CodeQualityReport {
    const issuesByType: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = {};
    
    this.issues.forEach(issue => {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
      issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
    });
    
    const duplicateFiles = [...new Set(
      this.issues.filter(i => i.type === 'duplicate').map(i => i.file)
    )];
    
    const interferenceFiles = [...new Set(
      this.issues.filter(i => i.type === 'interference').map(i => i.file)
    )];
    
    const specificationViolations = [...new Set(
      this.issues.filter(i => i.type === 'specification').map(i => i.file)
    )];
    
    const report: CodeQualityReport = {
      totalIssues: this.issues.length,
      issuesByType,
      issuesBySeverity,
      issues: this.issues,
      duplicateFiles,
      interferenceFiles,
      specificationViolations
    };
    
    this.printReport(report);
    return report;
  }

  /**
   * レポート表示
   */
  private printReport(report: CodeQualityReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 CODE QUALITY REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📊 Overall Statistics:`);
    console.log(`   Total Issues: ${report.totalIssues}`);
    console.log(`   Duplicate Files: ${report.duplicateFiles.length}`);
    console.log(`   Interference Files: ${report.interferenceFiles.length}`);
    console.log(`   Specification Violations: ${report.specificationViolations.length}`);
    
    console.log(`\n📋 Issues by Type:`);
    Object.entries(report.issuesByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    console.log(`\n⚠️  Issues by Severity:`);
    Object.entries(report.issuesBySeverity).forEach(([severity, count]) => {
      const emoji = severity === 'critical' ? '🔴' : 
                   severity === 'high' ? '🟠' : 
                   severity === 'medium' ? '🟡' : '🔵';
      console.log(`   ${emoji} ${severity}: ${count}`);
    });
    
    if (report.totalIssues > 0) {
      console.log(`\n📝 Detailed Issues:`);
      report.issues.forEach((issue, index) => {
        const emoji = issue.severity === 'critical' ? '🔴' : 
                     issue.severity === 'high' ? '🟠' : 
                     issue.severity === 'medium' ? '🟡' : '🔵';
        console.log(`\n   ${emoji} ${index + 1}. ${issue.message}`);
        console.log(`      File: ${issue.file}`);
        if (issue.suggestion) {
          console.log(`      Suggestion: ${issue.suggestion}`);
        }
      });
    }
    
    if (report.totalIssues === 0) {
      console.log('\n🎉 NO CODE QUALITY ISSUES FOUND!');
      console.log('✅ No duplicate code detected');
      console.log('✅ No function interference detected');
      console.log('✅ Specification compliance verified');
      console.log('✅ All type definitions are consistent');
    } else {
      console.log('\n⚠️  Code quality issues found. Please review and fix.');
    }
    
    console.log('='.repeat(80));
  }
}

// テスト実行
if (require.main === module) {
  const checker = new CodeQualityChecker();
  checker.runAllChecks().catch(console.error);
}

export default CodeQualityChecker;
