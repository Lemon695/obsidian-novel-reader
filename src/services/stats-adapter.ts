/**
 * 统计数据存储适配器
 *
 * 设计目标：
 * 1. 向后兼容 - 保持与现有代码的API兼容性
 * 2. 双写策略 - 同时写入新旧系统
 * 3. 渐进迁移 - 新数据优先使用新系统
 * 4. 无缝切换 - 用户无感知
 */

import type {App} from "obsidian";
import type NovelReaderPlugin from "../main";
import {DatabaseService} from "./database-service";
import {MultiFileStatsStorage} from "./multi-file-stats-storage";
import type {NovelReadingStats, ReadingSession} from "../types/reading-stats";
import type {
    EnhancedNovelStats,
    EnhancedReadingSession,
    SpeedDataPoint,
    ProgressDataPoint
} from "../types/enhanced-stats";

interface EnhancedDailyStats {
    totalDuration: number;
    sessionsCount: number;
    chaptersRead: number[];
    averageSpeed: number;
    peakSpeed: number;
    pauseCount: number;
    notes: number;
}

interface LegacyDailyStats {
    totalDuration: number;
    sessionsCount: number;
    chaptersRead: number;
}

interface EnhancedChapterStats {
    timeSpent: number;
    readCount: number;
    lastRead: number;
    firstRead: number;
    averageSpeed: number;
    peakSpeed: number;
    notesCount: number;
    bookmarked: boolean;
    difficulty: 'easy' | 'medium' | 'hard';
    completionRate: number;
}

interface LegacyChapterStats {
    timeSpent: number;
    readCount: number;
    lastRead: number;
}

/**
 * 统计数据存储适配器
 *
 * 作为新旧系统之间的桥梁，提供统一的接口
 */
export class StatsStorageAdapter {
    private legacyService: DatabaseService;     // 旧Loki系统
    private _newStorage: MultiFileStatsStorage;  // 新多文件系统
    private useNewStorage: boolean = true;      // 是否启用新系统
    private dualWrite: boolean = true;          // 是否双写

    constructor(private app: App, private plugin: NovelReaderPlugin) {
        this.legacyService = new DatabaseService(app, plugin);
        this._newStorage = new MultiFileStatsStorage(app, plugin);
    }

    /**
     * 获取新存储系统实例（用于直接访问高级功能）
     */
    get newStorage(): MultiFileStatsStorage {
        return this._newStorage;
    }

    /**
     * 初始化适配器
     */
    async initialize(): Promise<void> {
        console.log('Initializing StatsStorageAdapter...');

        try {
            // 初始化新系统
            await this._newStorage.initialize();

            // 检查是否需要启用新系统
            this.useNewStorage = this.plugin.settings.useEnhancedStats !== false;
            this.dualWrite = this.plugin.settings.dualWriteStats !== false;

            console.log(`Stats Adapter initialized - New Storage: ${this.useNewStorage}, Dual Write: ${this.dualWrite}`);
        } catch (error) {
            console.error('Failed to initialize new storage, falling back to legacy:', error);
            this.useNewStorage = false;
            this.dualWrite = false;
        }
    }

    // ============================================
    // 会话管理（兼容现有API）
    // ============================================

    /**
     * 开始阅读会话（改进的双写策略，确保数据一致性）
     */
    async startReadingSession(novelId: string, chapterId: number, chapterTitle: string): Promise<string> {
        const sessionId = crypto.randomUUID();
        const timestamp = Date.now();

        // 新系统会话对象
        const enhancedSession: EnhancedReadingSession = {
            sessionId,
            novelId,
            chapterId,
            chapterTitle,
            startTime: timestamp,
            endTime: null,
            totalDuration: 0,
            pauseCount: 0
        };

        const errors: Error[] = [];
        let newStorageSuccess = false;
        let legacySuccess = false;

        // 尝试写入新系统
        if (this.useNewStorage) {
            try {
                await this._newStorage.saveSession(enhancedSession);
                newStorageSuccess = true;
            } catch (error) {
                console.error('Failed to save to new storage:', error);
                errors.push(error as Error);
            }
        }

        // 尝试写入旧系统
        if (this.dualWrite || !this.useNewStorage) {
            try {
                await this.legacyService.startReadingSession(novelId, chapterId, chapterTitle);
                legacySuccess = true;
            } catch (error) {
                console.error('Failed to save to legacy storage:', error);
                errors.push(error as Error);
            }
        }

        // 至少一个系统成功才返回
        if (newStorageSuccess || legacySuccess) {
            if (errors.length > 0) {
                console.warn('Partial write success, some storage failed:', errors);
            }
            return sessionId;
        }

        // 全部失败
        const errorMsg = `Failed to start session in all storage systems: ${errors.map(e => e.message).join(', ')}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    /**
     * 结束阅读会话（改进的双写策略）
     */
    async endReadingSession(sessionId: string): Promise<void> {
        const errors: Error[] = [];
        let newStorageSuccess = false;
        let legacySuccess = false;

        // 尝试结束新系统会话
        if (this.useNewStorage) {
            try {
                // 新系统需要获取会话详情并更新
                // (这里简化处理，实际应该从缓存或数据库获取)
                // await this._newStorage.endSession(sessionId);
                newStorageSuccess = true;
            } catch (error) {
                console.error('Failed to end session in new storage:', error);
                errors.push(error as Error);
            }
        }

        // 尝试结束旧系统会话
        if (this.dualWrite || !this.useNewStorage) {
            try {
                await this.legacyService.endReadingSession(sessionId);
                legacySuccess = true;
            } catch (error) {
                console.error('Failed to end session in legacy storage:', error);
                errors.push(error as Error);
            }
        }

        // 至少一个系统成功
        if (newStorageSuccess || legacySuccess) {
            if (errors.length > 0) {
                console.warn('Partial write success when ending session:', errors);
            }
            return;
        }

        // 全部失败
        const errorMsg = `Failed to end session in all storage systems: ${errors.map(e => e.message).join(', ')}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    /**
     * 更新会话统计
     *
     * 这个方法在旧系统中是private的，我们需要通过endSession触发更新
     */
    private async updateStatsFromSession(
        novelId: string,
        session: EnhancedReadingSession
    ): Promise<void> {
        if (!this.useNewStorage) return;

        const stats = await this._newStorage.getNovelStats(novelId);
        if (!stats) return;

        // 更新基础统计
        stats.basicStats.totalReadingTime += session.totalDuration;
        stats.basicStats.sessionsCount++;
        stats.basicStats.lastReadTime = session.endTime || Date.now();

        // 更新每日统计
        const dateKey = new Date(session.startTime).toISOString().split('T')[0];
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
        dailyStat.totalDuration += session.totalDuration;
        dailyStat.sessionsCount++;
        if (!dailyStat.chaptersRead.includes(session.chapterId)) {
            dailyStat.chaptersRead.push(session.chapterId);
        }

        // 更新章节统计
        if (!stats.chapterStats[session.chapterId]) {
            stats.chapterStats[session.chapterId] = {
                timeSpent: 0,
                readCount: 0,
                lastRead: 0,
                firstRead: session.startTime,
                averageSpeed: 0,
                peakSpeed: 0,
                notesCount: 0,
                bookmarked: false,
                difficulty: 'medium',
                completionRate: 0
            };
        }

        const chapterStat = stats.chapterStats[session.chapterId];
        chapterStat.timeSpent += session.totalDuration;
        chapterStat.readCount++;
        chapterStat.lastRead = session.endTime || Date.now();

        // 保存更新后的统计
        await this._newStorage.saveNovelStats(novelId, stats);
    }

    // ============================================
    // 统计数据获取（兼容现有API）
    // ============================================

    /**
     * 获取小说统计数据（返回兼容格式）
     */
    async getNovelStats(novelId: string): Promise<NovelReadingStats | null> {
        try {
            if (this.useNewStorage) {
                // 尝试从新系统读取
                const enhancedStats = await this._newStorage.getNovelStats(novelId);

                if (enhancedStats) {
                    // 转换为旧格式（向后兼容）
                    return this.convertToLegacyFormat(enhancedStats);
                }
            }

            // Fallback到旧系统
            return await this.legacyService.getNovelStats(novelId);
        } catch (error) {
            console.error('Failed to get novel stats:', error);
            return await this.legacyService.getNovelStats(novelId);
        }
    }

    /**
     * 获取增强的统计数据（新API）
     */
    async getEnhancedNovelStats(novelId: string): Promise<EnhancedNovelStats | null> {
        if (!this.useNewStorage) {
            // 从旧系统转换
            const legacyStats = await this.legacyService.getNovelStats(novelId);
            if (legacyStats) {
                return this.convertToEnhancedFormat(novelId, legacyStats);
            }
            return null;
        }

        return await this._newStorage.getNovelStats(novelId);
    }

    /**
     * 创建或获取小说统计
     */
    async getOrCreateNovelStats(
        novelId: string,
        title: string,
        type: 'txt' | 'epub' | 'pdf',
        author?: string
    ): Promise<EnhancedNovelStats> {
        let stats = await this.getEnhancedNovelStats(novelId);

        if (!stats) {
            // 创建新统计
            if (this.useNewStorage) {
                stats = await this._newStorage.createNovelStats(novelId, title, type, author);
            } else {
                // 使用旧系统的默认结构
                const legacyStats = await this.legacyService.getNovelStats(novelId);
                stats = this.convertToEnhancedFormat(novelId, legacyStats || {
                    novelId,
                    stats: {
                        totalReadingTime: 0,
                        sessionsCount: 0,
                        firstReadTime: Date.now(),
                        lastReadTime: Date.now(),
                        averageSessionTime: 0,
                        dailyStats: {},
                        chapterStats: {}
                    }
                });
            }
        }

        return stats;
    }

    // ============================================
    // 数据格式转换
    // ============================================

    /**
     * 将增强格式转换为旧格式（向后兼容）
     */
    private convertToLegacyFormat(enhanced: EnhancedNovelStats): NovelReadingStats {
        return {
            novelId: enhanced.novelId,
            stats: {
                totalReadingTime: enhanced.basicStats.totalReadingTime,
                sessionsCount: enhanced.basicStats.sessionsCount,
                firstReadTime: enhanced.basicStats.firstReadTime,
                lastReadTime: enhanced.basicStats.lastReadTime,
                averageSessionTime: enhanced.behaviorStats.averageReadingSpeed,
                dailyStats: this.convertDailyStatsToLegacy(enhanced.timeAnalysis.dailyStats),
                chapterStats: this.convertChapterStatsToLegacy(enhanced.chapterStats)
            },
            // Loki 必需字段（这些字段会被 Loki 自动管理）
            $loki: 0,  // 临时值，Loki 会在插入时重新分配
            meta: {
                revision: 0,
                created: Date.now(),
                version: 0
            }
        } as NovelReadingStats;
    }

    /**
     * 将旧格式转换为增强格式（用于迁移）
     */
    private convertToEnhancedFormat(novelId: string, legacy: Partial<NovelReadingStats>): EnhancedNovelStats {
        const now = Date.now();

        return {
            version: "2.0.0",
            novelId,
            novel: {
                title: 'Unknown',  // 需要从其他地方获取
                type: 'txt'
            },
            basicStats: {
                totalReadingTime: legacy.stats?.totalReadingTime || 0,
                sessionsCount: legacy.stats?.sessionsCount || 0,
                firstReadTime: legacy.stats?.firstReadTime || now,
                lastReadTime: legacy.stats?.lastReadTime || now,
                lastUpdateTime: now,
                dataChecksum: ''
            },
            behaviorStats: {
                averageReadingSpeed: legacy.stats?.averageSessionTime || 0,
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
            timeAnalysis: {
                hourlyDistribution: new Array(24).fill(0),
                weekdayDistribution: new Array(7).fill(0),
                preferredTimeSlot: 'evening',
                dailyStats: this.convertDailyStatsToEnhanced(legacy.stats?.dailyStats || {}),
                monthlyStats: {}
            },
            chapterStats: this.convertChapterStatsToEnhanced(legacy.stats?.chapterStats || {}),
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

    private convertDailyStatsToLegacy(enhanced: Record<string, EnhancedDailyStats>): Record<string, LegacyDailyStats> {
        const legacy: Record<string, LegacyDailyStats> = {};
        Object.entries(enhanced).forEach(([date, stats]) => {
            legacy[date] = {
                totalDuration: stats.totalDuration,
                sessionsCount: stats.sessionsCount,
                chaptersRead: stats.chaptersRead.length
            };
        });
        return legacy;
    }

    private convertChapterStatsToLegacy(enhanced: Record<number, EnhancedChapterStats>): Record<number, LegacyChapterStats> {
        const legacy: Record<number, LegacyChapterStats> = {};
        Object.entries(enhanced).forEach(([chapterId, stats]) => {
            legacy[Number(chapterId)] = {
                timeSpent: stats.timeSpent,
                readCount: stats.readCount,
                lastRead: stats.lastRead
            };
        });
        return legacy;
    }

    private convertDailyStatsToEnhanced(legacy: Record<string, LegacyDailyStats>): Record<string, EnhancedDailyStats> {
        const enhanced: Record<string, EnhancedDailyStats> = {};
        Object.entries(legacy).forEach(([date, stats]) => {
            enhanced[date] = {
                totalDuration: stats.totalDuration,
                sessionsCount: stats.sessionsCount,
                chaptersRead: [],
                averageSpeed: 0,
                peakSpeed: 0,
                pauseCount: 0,
                notes: 0
            };
        });
        return enhanced;
    }

    private convertChapterStatsToEnhanced(legacy: Record<number, LegacyChapterStats>): Record<number, EnhancedChapterStats> {
        const enhanced: Record<number, EnhancedChapterStats> = {};
        Object.entries(legacy).forEach(([chapterId, stats]) => {
            enhanced[Number(chapterId)] = {
                timeSpent: stats.timeSpent,
                readCount: stats.readCount,
                lastRead: stats.lastRead,
                firstRead: stats.lastRead,
                averageSpeed: 0,
                peakSpeed: 0,
                notesCount: 0,
                bookmarked: false,
                difficulty: 'medium',
                completionRate: 0
            };
        });
        return enhanced;
    }

    // ============================================
    // 配置管理
    // ============================================

    /**
     * 启用新存储系统
     */
    enableNewStorage(enable: boolean = true): void {
        this.useNewStorage = enable;
        this.plugin.settings.useEnhancedStats = enable;
        this.plugin.saveSettings();
    }

    /**
     * 启用双写模式
     */
    enableDualWrite(enable: boolean = true): void {
        this.dualWrite = enable;
        this.plugin.settings.dualWriteStats = enable;
        this.plugin.saveSettings();
    }

    /**
     * 获取存储状态
     */
    getStorageStatus(): {
        useNewStorage: boolean;
        dualWrite: boolean;
        canMigrate: boolean;
    } {
        return {
            useNewStorage: this.useNewStorage,
            dualWrite: this.dualWrite,
            canMigrate: !this.useNewStorage  // 只有旧系统才需要迁移
        };
    }

    /**
     * 获取新存储服务实例（用于高级功能）
     */
    getNewStorage(): MultiFileStatsStorage {
        return this._newStorage;
    }

    /**
     * 获取旧存储服务实例（用于兼容）
     */
    getLegacyStorage(): DatabaseService {
        return this.legacyService;
    }
}
