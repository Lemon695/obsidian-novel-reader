/**
 * 统计数据校验工具
 *
 * 功能：
 * 1. 数据完整性校验（checksum）
 * 2. 数据结构验证
 * 3. 数据修复建议
 */

import type {
  EnhancedNovelStats,
  EnhancedGlobalStats,
  StatsIndexFile,
  IntegrityCheckResult,
  STATS_VERSION,
} from '../types/enhanced-stats';

export class StatsValidator {
  /**
   * 计算字符串的简单哈希值（替代MD5，避免引入额外依赖）
   */
  static computeChecksum(data: string): string {
    let hash = 0;
    if (data.length === 0) return hash.toString(16);

    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // 转换为16进制字符串并添加时间戳后缀（增加唯一性）
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * 生成数据的校验和
   */
  static generateChecksum(data: unknown): string {
    const dataString = JSON.stringify(data, null, 0);
    return this.computeChecksum(dataString);
  }

  /**
   * 验证数据的校验和
   */
  static verifyChecksum(data: unknown, expectedChecksum: string): boolean {
    // 临时移除checksum字段进行验证
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    
    const dataObj = data as Record<string, unknown>;
    const { basicStats, ...restData } = dataObj;
    const basicStatsObj = (basicStats && typeof basicStats === 'object') ? basicStats as Record<string, unknown> : {};
    const { dataChecksum, ...restBasicStats } = basicStatsObj;

    const dataToCheck = {
      ...restData,
      basicStats: restBasicStats,
    };

    const actualChecksum = this.generateChecksum(dataToCheck);
    return actualChecksum === expectedChecksum;
  }

  /**
   * 校验小说统计数据的完整性
   */
  static validateNovelStats(stats: EnhancedNovelStats): IntegrityCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 检查必需字段
    if (!stats.version) {
      errors.push('Missing version field');
    }

    if (!stats.novelId) {
      errors.push('Missing novelId field');
    }

    if (!stats.basicStats) {
      errors.push('Missing basicStats field');
    } else {
      // 检查基础统计字段
      if (typeof stats.basicStats.totalReadingTime !== 'number') {
        errors.push('Invalid totalReadingTime');
      }

      if (stats.basicStats.totalReadingTime < 0) {
        errors.push('Negative totalReadingTime');
      }

      if (typeof stats.basicStats.sessionsCount !== 'number') {
        errors.push('Invalid sessionsCount');
      }

      if (stats.basicStats.firstReadTime > stats.basicStats.lastReadTime) {
        errors.push('firstReadTime is later than lastReadTime');
      }
    }

    // 2. 检查时间分析数据
    if (stats.timeAnalysis) {
      if (stats.timeAnalysis.hourlyDistribution) {
        if (stats.timeAnalysis.hourlyDistribution.length !== 24) {
          errors.push('hourlyDistribution should have 24 elements');
        }

        const total = stats.timeAnalysis.hourlyDistribution.reduce((a, b) => a + b, 0);
        if (total !== stats.basicStats.totalReadingTime) {
          warnings.push('hourlyDistribution total does not match totalReadingTime');
        }
      }

      if (stats.timeAnalysis.weekdayDistribution) {
        if (stats.timeAnalysis.weekdayDistribution.length !== 7) {
          errors.push('weekdayDistribution should have 7 elements');
        }
      }
    }

    // 3. 检查进度追踪
    if (stats.progressTracking) {
      if (
        stats.progressTracking.currentProgress < 0 ||
        stats.progressTracking.currentProgress > 100
      ) {
        errors.push('currentProgress out of range (0-100)');
      }

      // 检查进度历史是否单调递增（允许小幅波动）
      if (
        stats.progressTracking.progressHistory &&
        stats.progressTracking.progressHistory.length > 1
      ) {
        for (let i = 1; i < stats.progressTracking.progressHistory.length; i++) {
          const prev = stats.progressTracking.progressHistory[i - 1];
          const curr = stats.progressTracking.progressHistory[i];

          if (curr.progress < prev.progress - 5) {
            // 允许5%的倒退
            warnings.push(
              `Progress regression detected at ${new Date(curr.timestamp).toISOString()}`
            );
          }
        }
      }
    }

    // 4. 检查章节统计
    if (stats.chapterStats) {
      Object.entries(stats.chapterStats).forEach(([chapterId, chapterStat]) => {
        if (chapterStat.readCount <= 0) {
          warnings.push(`Chapter ${chapterId} has invalid readCount: ${chapterStat.readCount}`);
        }

        if (chapterStat.timeSpent < 0) {
          errors.push(`Chapter ${chapterId} has negative timeSpent`);
        }

        if (chapterStat.firstRead > chapterStat.lastRead) {
          errors.push(`Chapter ${chapterId} firstRead is later than lastRead`);
        }
      });
    }

    // 5. 校验和检查
    let checksumMatches = false;
    if (stats.basicStats && stats.basicStats.dataChecksum) {
      checksumMatches = this.verifyChecksum(stats, stats.basicStats.dataChecksum);
      if (!checksumMatches) {
        warnings.push('Data checksum mismatch - data may have been corrupted or modified');
      }
    } else {
      warnings.push('No checksum found - cannot verify data integrity');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      checkedAt: Date.now(),
      checksumMatches,
    };
  }

  /**
   * 校验全局统计数据
   */
  static validateGlobalStats(stats: EnhancedGlobalStats): IntegrityCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必需字段
    if (!stats.version) {
      errors.push('Missing version field');
    }

    if (!stats.library) {
      errors.push('Missing library field');
    } else {
      // 检查书籍统计一致性
      const totalByStatus = Object.values(stats.library.booksByStatus || {}).reduce(
        (a, b) => a + b,
        0
      );
      if (totalByStatus !== stats.library.totalBooks) {
        warnings.push('booksByStatus total does not match totalBooks');
      }

      const totalByType = Object.values(stats.library.booksByType || {}).reduce((a, b) => a + b, 0);
      if (totalByType !== stats.library.totalBooks) {
        warnings.push('booksByType total does not match totalBooks');
      }
    }

    // 检查时间统计
    if (stats.timeStats) {
      if (stats.timeStats.today > stats.timeStats.thisWeek) {
        warnings.push('today reading time exceeds weekly total');
      }

      if (stats.timeStats.thisWeek > stats.timeStats.thisMonth) {
        warnings.push('weekly reading time exceeds monthly total');
      }

      if (stats.timeStats.thisMonth > stats.timeStats.thisYear) {
        warnings.push('monthly reading time exceeds yearly total');
      }

      if (stats.timeStats.thisYear > stats.timeStats.totalReadingTime) {
        warnings.push('yearly reading time exceeds total reading time');
      }
    }

    // 检查连续阅读数据
    if (stats.streaks) {
      if (stats.streaks.currentStreak > stats.streaks.longestStreak) {
        warnings.push('currentStreak is longer than longestStreak');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      checkedAt: Date.now(),
      checksumMatches: true, // 全局统计暂不使用checksum
    };
  }

  /**
   * 校验索引文件
   */
  static validateIndexFile(index: StatsIndexFile): IntegrityCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!index.version) {
      errors.push('Missing version field');
    }

    if (typeof index.totalNovels !== 'number') {
      errors.push('Invalid totalNovels field');
    }

    if (!index.novelIndex) {
      errors.push('Missing novelIndex field');
    } else {
      const actualCount = Object.keys(index.novelIndex).length;
      if (actualCount !== index.totalNovels) {
        warnings.push(
          `novelIndex count (${actualCount}) does not match totalNovels (${index.totalNovels})`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      checkedAt: Date.now(),
      checksumMatches: true,
    };
  }

  /**
   * 尝试修复损坏的数据
   */
  static repairNovelStats(stats: Partial<EnhancedNovelStats>): EnhancedNovelStats | null {
    try {
      // 尝试填充缺失的必需字段
      const repaired: Partial<EnhancedNovelStats> = {
        version: stats.version || '2.0.0',
        novelId: stats.novelId || '',
        novel: stats.novel || {
          title: 'Unknown',
          type: 'txt',
        },
        basicStats: stats.basicStats || {
          totalReadingTime: 0,
          sessionsCount: 0,
          firstReadTime: Date.now(),
          lastReadTime: Date.now(),
          lastUpdateTime: Date.now(),
          dataChecksum: '',
        },
        behaviorStats: stats.behaviorStats || {
          averageReadingSpeed: 0,
          speedHistory: [],
          jumpEvents: [],
          rereadStats: {},
          pauseResumeCount: 0,
          continuousReadingTime: 0,
        },
        progressTracking: stats.progressTracking || {
          currentProgress: 0,
          progressHistory: [],
          completedChapters: [],
          bookmarkedChapters: [],
          lastChapterId: 0,
        },
        timeAnalysis: stats.timeAnalysis || {
          hourlyDistribution: new Array(24).fill(0),
          weekdayDistribution: new Array(7).fill(0),
          preferredTimeSlot: 'evening' as const,
          dailyStats: {},
          monthlyStats: {},
        },
        chapterStats: stats.chapterStats || {},
        notesCorrelation: stats.notesCorrelation || {
          totalNotes: 0,
          notesPerChapter: {},
          heatmapChapters: [],
          averageNotesPerChapter: 0,
        },
        achievements: stats.achievements || {
          milestonesReached: [],
          streakRecords: {
            current: 0,
            longest: 0,
            longestStartDate: '',
            longestEndDate: '',
            history: [],
          },
          speedRecords: {
            fastest: 0,
            slowest: 0,
            average: 0,
            median: 0,
          },
          timeRecords: {
            singleSession: 0,
            singleDay: 0,
            singleWeek: 0,
          },
        },
      };

      // 重新生成checksum
      if (repaired.basicStats) {
        repaired.basicStats.dataChecksum = this.generateChecksum(repaired);
      }

      // 验证修复后的数据
      const validation = this.validateNovelStats(repaired as EnhancedNovelStats);
      if (validation.isValid) {
        return repaired as EnhancedNovelStats;
      }

      return null;
    } catch (error) {
      console.error('Failed to repair stats:', error);
      return null;
    }
  }

  /**
   * 生成数据诊断报告
   */
  static generateDiagnosticReport(stats: EnhancedNovelStats): string {
    const validation = this.validateNovelStats(stats);

    let report = `# 数据诊断报告\n\n`;
    report += `生成时间: ${new Date().toLocaleString()}\n`;
    report += `数据版本: ${stats.version}\n`;
    report += `小说ID: ${stats.novelId}\n`;
    report += `小说标题: ${stats.novel.title}\n\n`;

    report += `## 完整性检查\n`;
    report += `状态: ${validation.isValid ? '✅ 通过' : '❌ 失败'}\n`;
    report += `校验和匹配: ${validation.checksumMatches ? '✅ 是' : '⚠️ 否'}\n\n`;

    if (validation.errors.length > 0) {
      report += `## 错误 (${validation.errors.length})\n`;
      validation.errors.forEach((err, i) => {
        report += `${i + 1}. ${err}\n`;
      });
      report += `\n`;
    }

    if (validation.warnings.length > 0) {
      report += `## 警告 (${validation.warnings.length})\n`;
      validation.warnings.forEach((warn, i) => {
        report += `${i + 1}. ${warn}\n`;
      });
      report += `\n`;
    }

    report += `## 统计摘要\n`;
    report += `总阅读时间: ${Math.floor(stats.basicStats.totalReadingTime / 60000)} 分钟\n`;
    report += `会话次数: ${stats.basicStats.sessionsCount}\n`;
    report += `阅读章节: ${Object.keys(stats.chapterStats || {}).length}\n`;
    report += `笔记数量: ${stats.notesCorrelation?.totalNotes || 0}\n`;

    return report;
  }
}
