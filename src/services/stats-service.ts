/**
 * 统计服务 - 统一的阅读统计接口
 * 
 * 使用多文件存储系统，提供简单的API用于记录和查询阅读统计
 */

import type { App } from 'obsidian';
import type NovelReaderPlugin from '../main';
import { MultiFileStatsStorage } from './multi-file-stats-storage';
import type { EnhancedReadingSession, EnhancedNovelStats } from '../types/enhanced-stats';

export class StatsService {
  private storage: MultiFileStatsStorage;
  private activeSessions: Map<string, EnhancedReadingSession> = new Map();

  constructor(private app: App, private plugin: NovelReaderPlugin) {
    this.storage = new MultiFileStatsStorage(app, plugin);
  }

  /**
   * 初始化统计服务
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
    console.log('✅ StatsService initialized');
  }

  /**
   * 开始阅读会话
   */
  async startReadingSession(
    novelId: string,
    chapterId: number,
    chapterTitle: string
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    
    const session: EnhancedReadingSession = {
      sessionId,
      novelId,
      chapterId,
      chapterTitle,
      startTime: Date.now(),
      endTime: null,
      totalDuration: 0,
      pauseCount: 0,
      platform: 'obsidian',
      device: 'desktop'
    };

    // 保存到内存
    this.activeSessions.set(sessionId, session);
    
    // 保存到存储
    await this.storage.saveSession(session);
    
    console.log(`Started reading session: ${sessionId}`);
    return sessionId;
  }

  /**
   * 结束阅读会话
   */
  async endReadingSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      console.warn(`No active session found for ID: ${sessionId}`);
      return;
    }

    // 更新会话结束时间
    const endTime = Date.now();
    const duration = endTime - session.startTime;
    
    session.endTime = endTime;
    session.totalDuration = duration;

    // 保存会话
    await this.storage.saveSession(session);

    // 更新小说统计
    await this.updateNovelStats(session);

    // 从内存中移除
    this.activeSessions.delete(sessionId);
    
    console.log(`Ended reading session: ${sessionId}, duration: ${duration}ms`);
  }

  /**
   * 更新小说统计数据
   */
  private async updateNovelStats(session: EnhancedReadingSession): Promise<void> {
    const { novelId, chapterId, totalDuration, startTime } = session;
    
    // 获取现有统计
    let stats = await this.storage.getNovelStats(novelId);
    
    if (!stats) {
      // 创建新的统计记录
      stats = this.createNewStats(novelId);
    }

    // 更新基础统计
    stats.basicStats.totalReadingTime += totalDuration;
    stats.basicStats.sessionsCount += 1;
    stats.basicStats.lastReadTime = session.endTime || Date.now();
    stats.basicStats.lastUpdateTime = Date.now();
    
    if (!stats.basicStats.firstReadTime) {
      stats.basicStats.firstReadTime = startTime;
    }

    // 更新每日统计
    const dateKey = new Date(startTime).toISOString().split('T')[0];
    if (!stats.timeAnalysis.dailyStats[dateKey]) {
      stats.timeAnalysis.dailyStats[dateKey] = {
        totalDuration: 0,
        sessionsCount: 0,
        chaptersRead: [],
        averageSpeed: 0,
        peakSpeed: 0,
        pauseCount: 0,
        notes: 0
      };
    }
    
    const dailyStat = stats.timeAnalysis.dailyStats[dateKey];
    dailyStat.totalDuration += totalDuration;
    dailyStat.sessionsCount += 1;
    
    if (!dailyStat.chaptersRead.includes(chapterId)) {
      dailyStat.chaptersRead.push(chapterId);
    }

    // 更新章节统计
    if (!stats.chapterStats[chapterId]) {
      stats.chapterStats[chapterId] = {
        timeSpent: 0,
        readCount: 0,
        lastRead: 0,
        firstRead: startTime,
        averageSpeed: 0,
        peakSpeed: 0,
        notesCount: 0,
        bookmarked: false,
        difficulty: 'medium',
        completionRate: 0
      };
    }
    
    const chapterStat = stats.chapterStats[chapterId];
    chapterStat.timeSpent += totalDuration;
    chapterStat.readCount += 1;
    chapterStat.lastRead = session.endTime || Date.now();

    // 更新时段分布
    const hour = new Date(startTime).getHours();
    if (!stats.timeAnalysis.hourlyDistribution) {
      stats.timeAnalysis.hourlyDistribution = new Array(24).fill(0);
    }
    stats.timeAnalysis.hourlyDistribution[hour] += totalDuration;

    // 更新星期分布
    const weekday = new Date(startTime).getDay();
    if (!stats.timeAnalysis.weekdayDistribution) {
      stats.timeAnalysis.weekdayDistribution = new Array(7).fill(0);
    }
    stats.timeAnalysis.weekdayDistribution[weekday] += totalDuration;

    // 计算校验和
    stats.basicStats.dataChecksum = this.calculateChecksum(stats);
    
    // 保存更新后的统计
    await this.storage.saveNovelStats(novelId, stats);
    
    // 更新全局统计
    await this.storage.recalculateGlobalStats();
  }

  /**
   * 创建新的统计记录
   */
  private createNewStats(novelId: string): EnhancedNovelStats {
    return {
      version: '2.0.0',
      novelId,
      novel: {
        title: '',
        type: 'txt'
      },
      basicStats: {
        totalReadingTime: 0,
        sessionsCount: 0,
        firstReadTime: 0,
        lastReadTime: 0,
        lastUpdateTime: Date.now(),
        dataChecksum: ''
      },
      timeAnalysis: {
        dailyStats: {},
        weekdayDistribution: new Array(7).fill(0),
        hourlyDistribution: new Array(24).fill(0),
        preferredTimeSlot: 'evening',
        monthlyStats: {}
      },
      chapterStats: {},
      behaviorStats: {
        averageReadingSpeed: 0,
        speedHistory: [],
        jumpEvents: [],
        rereadStats: {},
        pauseResumeCount: 0,
        continuousReadingTime: 0
      },
      progressTracking: {
        currentProgress: 0,
        progressHistory: [],
        completedChapters: [],
        bookmarkedChapters: [],
        lastChapterId: 0
      },
      notesCorrelation: {
        totalNotes: 0,
        notesPerChapter: {},
        heatmapChapters: [],
        averageNotesPerChapter: 0
      },
      achievements: {
        milestonesReached: [],
        streakRecords: {
          current: 0,
          longest: 0,
          longestStartDate: '',
          longestEndDate: '',
          history: []
        },
        speedRecords: {
          fastest: 0,
          slowest: 0,
          average: 0,
          median: 0
        },
        timeRecords: {
          singleSession: 0,
          singleDay: 0,
          singleWeek: 0
        }
      }
    };
  }

  /**
   * 计算数据校验和
   */
  private calculateChecksum(stats: EnhancedNovelStats): string {
    // 简单的校验和计算（实际应该使用 MD5 或其他哈希算法）
    const data = JSON.stringify({
      totalReadingTime: stats.basicStats.totalReadingTime,
      sessionsCount: stats.basicStats.sessionsCount,
      lastUpdateTime: stats.basicStats.lastUpdateTime
    });
    return btoa(data).substring(0, 16);
  }

  /**
   * 获取小说统计
   */
  async getNovelStats(novelId: string): Promise<EnhancedNovelStats | null> {
    return await this.storage.getNovelStats(novelId);
  }

  /**
   * 获取全局统计
   */
  async getGlobalStats() {
    return await this.storage.getGlobalStats();
  }

  /**
   * 获取多文件存储实例（用于高级功能）
   */
  get multiFileStorage(): MultiFileStatsStorage {
    return this.storage;
  }

  /**
   * 关闭服务
   */
  close(): void {
    // 结束所有活动会话
    for (const [sessionId] of this.activeSessions) {
      this.endReadingSession(sessionId).catch(err => {
        console.error(`Failed to end session ${sessionId}:`, err);
      });
    }
    this.activeSessions.clear();
  }
}
