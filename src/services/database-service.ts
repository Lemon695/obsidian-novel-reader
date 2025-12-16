import Loki, { Collection } from 'lokijs';
import { App, FileSystemAdapter, Notice } from 'obsidian';
import type NovelReaderPlugin from '../main';
import type { NovelReadingStats, ReadingSession } from '../types/reading-stats';
import { DATABASE_CONFIG } from '../constants/app-config';
import { handleError, ErrorType, ErrorSeverity } from '../utils/error-handler';

export class DatabaseService {
  private db: Loki | null = null;
  private initialized = false;
  private sessions: Collection<ReadingSession> | null = null;
  private stats: Collection<NovelReadingStats> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private app: App,
    private plugin: NovelReaderPlugin
  ) {
    // 不在构造函数中启动异步操作
    // 让调用者显式调用 waitForInitialization()
  }

  /**
   * 等待初始化完成（公共方法）
   * 如果未初始化，会自动启动初始化
   */
  async waitForInitialization(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = this._initialize();
    }

    try {
      await this.initPromise;
    } catch (error) {
      // 初始化失败，清除 Promise 以允许重试
      this.initPromise = null;
      throw error;
    }

    if (!this.initialized) {
      throw new Error('Database failed to initialize properly');
    }
  }

  /**
   * 内部初始化方法
   */
  private async _initialize(): Promise<void> {
    try {
      let vaultPath = null;
      if (this.app.vault.adapter instanceof FileSystemAdapter) {
        vaultPath = this.app.vault.adapter.basePath;
        console.log('Current Vault Path:', vaultPath);
      } else {
        return;
      }

      const dbPath = `${vaultPath}/${this.plugin.settings.statsPath}/reading-stats.json`;

      // 创建 Loki 数据库
      this.db = new Loki(dbPath);

      // 加载数据库
      await new Promise<void>((resolve, reject) => {
        this.db!.loadDatabase({}, async (err) => {
          if (err) {
            // 检查是否是JSON解析错误
            if (err.message && err.message.includes('JSON')) {
              console.warn('Database file corrupted, attempting recovery...');
              try {
                // 备份损坏的文件
                const backupPath = `${dbPath}.corrupted.${Date.now()}`;
                const exists = await this.app.vault.adapter.exists(dbPath);
                if (exists) {
                  const content = await this.app.vault.adapter.read(dbPath);
                  await this.app.vault.adapter.write(backupPath, content);
                  console.log(`Corrupted database backed up to: ${backupPath}`);

                  // 删除损坏的文件
                  await this.app.vault.adapter.remove(dbPath);
                }

                // 初始化空数据库
                this.initializeCollections();
                new Notice('数据库文件损坏已修复，旧数据已备份');
                resolve();
              } catch (recoveryError) {
                console.error('Failed to recover from corrupted database:', recoveryError);
                reject(recoveryError);
              }
            } else {
              reject(err);
            }
            return;
          }
          this.initializeCollections();
          resolve();
        });
      });

      // 设置自动保存
      this.db.autosaveEnable();
      this.db.autosave = true;
      this.db.autosaveInterval = DATABASE_CONFIG.AUTOSAVE_INTERVAL;

      this.initialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      this.initialized = false;
      this.initPromise = null; // 允许重试
      
      handleError(error, {
        type: ErrorType.DATA_LOAD_ERROR,
        severity: ErrorSeverity.CRITICAL,
        context: { service: 'DatabaseService', method: '_initialize' },
        userMessage: '数据库初始化失败',
        recoverySuggestion: '请检查数据库文件是否损坏，可以尝试删除并重新创建',
      });
      
      throw error;
    }
  }

  private async ensureDirectoryExists(path: string): Promise<void> {
    try {
      const exists = await this.plugin.app.vault.adapter.exists(path);
      if (!exists) {
        await this.plugin.app.vault.adapter.mkdir(path);
        console.log(`Created directory: ${path}`);
      }
    } catch (error) {
      console.error(`Error creating directory ${path}:`, error);
      throw error;
    }
  }

  private initializeCollections() {
    if (!this.db) return;

    this.sessions = this.db.getCollection('reading_sessions');
    if (!this.sessions) {
      this.sessions = this.db.addCollection('reading_sessions', {
        indices: ['novelId', 'sessionId'],
      });
    }

    this.stats = this.db.getCollection('novel_stats');
    if (!this.stats) {
      this.stats = this.db.addCollection('novel_stats', {
        indices: ['novelId'],
      });
    }

    // 强制保存以确保集合创建
    this.db.saveDatabase((err) => {
      if (err) {
        console.error('Failed to save initial database state:', err);
      }
    });
  }

  private async ensureInitialized() {
    if (!this.initPromise) {
      throw new Error('Database initialization was never started');
    }

    await this.initPromise;

    if (!this.db || !this.sessions || !this.stats) {
      throw new Error('Database not fully initialized');
    }
  }

  private async saveDatabase(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('No database instance'));
        return;
      }

      this.db.saveDatabase((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async startReadingSession(
    novelId: string,
    chapterId: number,
    chapterTitle: string
  ): Promise<string> {
    if (!this.initialized || !this.sessions) {
      throw new Error('Database not initialized');
    }

    const sessionId = crypto.randomUUID();
    //console.log(`startReadingSession ${novelId}-${sessionId}`);

    try {
      // 确保返回插入的文档
      const session = this.sessions.insert({
        sessionId,
        novelId,
        chapterId,
        chapterTitle,
        startTime: Date.now(),
        endTime: null,
        totalDuration: 0,
      });

      // 立即保存确保同步状态
      await this.saveDatabase();
      return sessionId;
    } catch (error) {
      handleError(error, {
        type: ErrorType.DATA_SAVE_ERROR,
        severity: ErrorSeverity.ERROR,
        context: {
          service: 'DatabaseService',
          method: 'startReadingSession',
          novelId,
          chapterId,
          chapterTitle,
        },
        userMessage: '开始阅读会话失败',
        showNotice: false, // 不显示通知，避免打扰用户
      });
      throw error;
    }
  }

  async endReadingSession(sessionId: string): Promise<void> {
    try {
      console.log(`endReadingSession ${sessionId}`);
      await this.ensureInitialized();

      // 获取现有会话
      let session = this.sessions!.findOne({ sessionId });

      if (session) {
        // 直接修改现有会话的属性
        const endTime = Date.now();
        const duration = endTime - session.startTime;

        // 更新会话属性
        session.endTime = endTime;
        session.totalDuration = duration;

        // 更新会话记录
        this.sessions!.update(session);

        // 更新统计信息
        this.updateStats(session.novelId, duration, session.chapterId);

        // 保存所有更改
        await this.saveDatabase();
      } else {
        console.warn(`No session found for ID: ${sessionId}`);
      }
    } catch (error) {
      handleError(error, {
        type: ErrorType.DATA_SAVE_ERROR,
        severity: ErrorSeverity.ERROR,
        context: {
          service: 'DatabaseService',
          method: 'endReadingSession',
          sessionId,
        },
        userMessage: '结束阅读会话失败',
        showNotice: false, // 不显示通知，避免打扰用户
      });
      throw error;
    }
  }

  private updateStats(novelId: string, duration: number, chapterId: number) {
    if (!this.stats) return;

    const today = new Date().toISOString().split('T')[0];

    // 获取现有统计或创建新统计
    let stats = this.stats.findOne({ novelId }) as (NovelReadingStats & LokiObj) | null;

    if (!stats) {
      // 新建统计记录时设置首次阅读时间
      const initialStats: Omit<NovelReadingStats, keyof LokiObj> = {
        novelId,
        stats: {
          totalReadingTime: duration,
          sessionsCount: 1,
          firstReadTime: Date.now(), // 设置首次阅读时间
          lastReadTime: Date.now(),
          averageSessionTime: duration,
          dailyStats: {
            [today]: {
              totalDuration: duration,
              sessionsCount: 1,
              chaptersRead: 1,
            },
          },
          chapterStats: {
            [chapterId]: {
              timeSpent: duration,
              readCount: 1,
              lastRead: Date.now(),
            },
          },
        },
      };

      // 插入新记录
      stats = this.stats.insert(<NovelReadingStats>initialStats) as NovelReadingStats & LokiObj;
    } else {
      // 如果是已有记录但没有firstReadTime字段
      if (!stats.stats.firstReadTime) {
        stats.stats.firstReadTime = stats.stats.lastReadTime; // 使用最早的lastReadTime作为firstReadTime
      }

      // 更新其他统计数据
      stats.stats.totalReadingTime += duration;
      stats.stats.sessionsCount += 1;
      stats.stats.lastReadTime = Date.now();
      stats.stats.averageSessionTime = stats.stats.totalReadingTime / stats.stats.sessionsCount;

      // 更新每日统计
      if (!stats.stats.dailyStats[today]) {
        stats.stats.dailyStats[today] = {
          totalDuration: 0,
          sessionsCount: 0,
          chaptersRead: 0,
        };
      }
      stats.stats.dailyStats[today].totalDuration += duration;
      stats.stats.dailyStats[today].sessionsCount += 1;

      // 更新章节统计
      if (!stats.stats.chapterStats[chapterId]) {
        stats.stats.chapterStats[chapterId] = {
          timeSpent: 0,
          readCount: 0,
          lastRead: 0,
        };
      }
      stats.stats.chapterStats[chapterId].timeSpent += duration;
      stats.stats.chapterStats[chapterId].readCount += 1;
      stats.stats.chapterStats[chapterId].lastRead = Date.now();

      // 更新文档
      this.stats.update(stats);
    }
  }

  async getNovelStats(novelId: string | null) {
    if (!novelId) {
      console.warn('getNovelStats: Invalid novelId parameter');
      return null;
    }

    await this.ensureInitialized();
    return this.stats!.findOne({ novelId });
  }

  // 添加迁移方法用于处理已有数据
  async migrateExistingStats() {
    if (!this.stats) return;

    const allStats = this.stats.find({});
    for (const stat of allStats) {
      if (!stat.stats.firstReadTime) {
        // 方法1: 使用最早的lastReadTime
        let firstReadTime = stat.stats.lastReadTime;

        // 方法2: 查找最早的dailyStats记录
        const dailyDates = Object.keys(stat.stats.dailyStats).sort();
        if (dailyDates.length > 0) {
          const earliestDate = new Date(dailyDates[0]).getTime();
          firstReadTime = Math.min(firstReadTime, earliestDate);
        }

        // 方法3: 查找最早的chapterStats记录
        const chapterStats = Object.values(stat.stats.chapterStats);
        if (chapterStats.length > 0) {
          const earliestChapterRead = Math.min(...chapterStats.map((cs) => cs.lastRead));
          firstReadTime = Math.min(firstReadTime, earliestChapterRead);
        }

        // 更新firstReadTime
        stat.stats.firstReadTime = firstReadTime;
        this.stats.update(stat);
      }
    }

    // 保存更改
    await this.saveDatabase();
  }

  public async checkHealth(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }

  async exportReport(novelId: string): Promise<string> {
    const stats = await this.getNovelStats(novelId);
    if (!stats) return '';

    const formatTime = (ms: number) => {
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      return `${hours}小时${minutes % 60}分钟`;
    };

    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toLocaleDateString();
    };

    // 生成Markdown格式的报告
    const report = `# 阅读统计报告

## 基础统计
- 开始阅读时间: ${formatDate(stats.stats.firstReadTime)}
- 最后阅读时间: ${formatDate(stats.stats.lastReadTime)}
- 累计阅读时间: ${formatTime(stats.stats.totalReadingTime)}
- 阅读次数: ${stats.stats.sessionsCount}次
- 平均每次时长: ${formatTime(stats.stats.averageSessionTime)}

## 阅读趋势
${Object.entries(stats.stats.dailyStats)
  .map(([date, data]) => `- ${date}: ${formatTime(data.totalDuration)}`)
  .join('\n')}

## 章节统计
${Object.entries(stats.stats.chapterStats)
  .map(([id, data]) => `- 第${id}章: 阅读${data.readCount}次, 总时长${formatTime(data.timeSpent)}`)
  .join('\n')}

## 阅读建议
${this.generateReadingRecommendations(stats)}

报告生成时间: ${new Date().toLocaleString()}
`;

    return report;
  }

  // 生成阅读建议
  private generateReadingRecommendations(stats: NovelReadingStats): string {
    const recommendations = [];

    // 基于总阅读时间的建议
    const totalHours = stats.stats.totalReadingTime / (1000 * 60 * 60);
    if (totalHours < 1) {
      recommendations.push('- 建议增加阅读时间，培养阅读习惯');
    }

    // 基于阅读频率的建议
    if (stats.stats.sessionsCount < 7) {
      recommendations.push('- 建议保持每日阅读习惯，提高阅读连续性');
    }

    // 基于平均会话时长的建议
    const avgSessionMinutes = stats.stats.averageSessionTime / (1000 * 60);
    if (avgSessionMinutes < 30) {
      recommendations.push('- 建议适当延长单次阅读时间，有助于深入理解内容');
    }

    return recommendations.join('\n');
  }
}
