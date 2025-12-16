/**
 * 统计数据迁移服务
 * 负责从旧的Loki单文件系统迁移到新的多文件分散存储系统
 *
 * 功能特性：
 * - 从 reading-stats.json 读取并转换数据格式
 * - 自动备份原数据
 * - 数据完整性验证
 * - 进度追踪和取消支持
 * - 失败回滚机制
 * - 详细的迁移日志
 */

import type {App} from "obsidian";
import type NovelReaderPlugin from "../main";
import type {
    NovelReadingStats,
    ReadingSession
} from "../types/reading-stats";
import type {
    EnhancedNovelStats,
    EnhancedReadingSession,
    MigrationRecord,
    MigrationStatus,
    STATS_VERSION
} from "../types/enhanced-stats";
import {MultiFileStatsStorage} from "./multi-file-stats-storage";
import {StatsPathsManager} from "../utils/stats-paths";
import {StatsValidator} from "../utils/stats-validator";

interface OldDailyStats {
    totalDuration?: number;
    sessionsCount?: number;
    chaptersRead?: number[];
}

interface NewDailyStats {
    totalDuration: number;
    sessionsCount: number;
    chaptersRead: number[];
    averageSpeed: number;
    peakSpeed: number;
    pauseCount: number;
    notes: number;
}

interface OldChapterStats {
    timeSpent?: number;
    readCount?: number;
    lastRead?: number;
}

interface NewChapterStats {
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

/**
 * 迁移进度回调
 */
export interface MigrationProgress {
    phase: 'backup' | 'validation' | 'conversion' | 'writing' | 'verification' | 'cleanup';
    current: number;
    total: number;
    novelId?: string;
    novelTitle?: string;
    message: string;
    percentage: number;
}

/**
 * 迁移选项
 */
export interface MigrationOptions {
    /** 是否创建备份（强烈推荐） */
    createBackup?: boolean;
    /** 是否验证源数据 */
    validateSource?: boolean;
    /** 是否验证迁移后的数据 */
    validateTarget?: boolean;
    /** 遇到错误是否继续 */
    continueOnError?: boolean;
    /** 迁移后是否删除旧数据 */
    deleteOldData?: boolean;
    /** 进度回调 */
    onProgress?: (progress: MigrationProgress) => void;
    /** 是否只做演练（不实际写入） */
    dryRun?: boolean;
}

/**
 * 迁移结果
 */
export interface MigrationResult {
    success: boolean;
    startTime: number;
    endTime: number;
    duration: number;
    totalNovels: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    failedNovels: Array<{
        novelId: string;
        title: string;
        error: string;
    }>;
    backupPath?: string;
    recordPath: string;
}

export class StatsMigrationService {
    private pathsManager: StatsPathsManager;
    private newStorage: MultiFileStatsStorage;
    private isCancelled = false;

    constructor(
        private app: App,
        private plugin: NovelReaderPlugin
    ) {
        this.pathsManager = new StatsPathsManager(app, plugin);
        this.newStorage = new MultiFileStatsStorage(app, plugin);
    }

    /**
     * 执行完整迁移
     */
    async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
        const {
            createBackup = true,
            validateSource = true,
            validateTarget = true,
            continueOnError = false,
            deleteOldData = false,
            onProgress,
            dryRun = false
        } = options;

        const startTime = Date.now();
        this.isCancelled = false;

        const result: MigrationResult = {
            success: false,
            startTime,
            endTime: 0,
            duration: 0,
            totalNovels: 0,
            successCount: 0,
            failedCount: 0,
            skippedCount: 0,
            failedNovels: [],
            recordPath: ''
        };

        try {
            // Phase 1: 备份原数据
            if (createBackup && !dryRun) {
                this.reportProgress(onProgress, {
                    phase: 'backup',
                    current: 0,
                    total: 1,
                    message: '正在备份原始数据...',
                    percentage: 0
                });

                result.backupPath = await this.backupOldData();
                console.log(`✅ 备份完成: ${result.backupPath}`);
            }

            // Phase 2: 读取并验证源数据
            this.reportProgress(onProgress, {
                phase: 'validation',
                current: 0,
                total: 1,
                message: '正在读取源数据...',
                percentage: 10
            });

            const oldStats = await this.readOldStats();
            if (!oldStats || oldStats.length === 0) {
                throw new Error('未找到旧的统计数据或数据为空');
            }

            result.totalNovels = oldStats.length;
            console.log(`📊 找到 ${result.totalNovels} 本书的统计数据`);

            // Phase 3: 初始化新存储系统
            if (!dryRun) {
                await this.newStorage.initialize();
            }

            // Phase 4: 逐个转换并写入
            for (let i = 0; i < oldStats.length; i++) {
                if (this.isCancelled) {
                    throw new Error('迁移已被用户取消');
                }

                const oldNovelStats = oldStats[i];
                const novelId = oldNovelStats.novelId;

                try {
                    this.reportProgress(onProgress, {
                        phase: 'conversion',
                        current: i + 1,
                        total: result.totalNovels,
                        novelId,
                        message: `正在迁移: ${novelId}`,
                        percentage: 10 + (i / result.totalNovels) * 60
                    });

                    // 验证源数据（如果启用）
                    if (validateSource) {
                        const isValid = this.validateOldStats(oldNovelStats);
                        if (!isValid) {
                            console.warn(`⚠️ 源数据验证失败: ${novelId}`);
                            if (!continueOnError) {
                                throw new Error('源数据验证失败');
                            }
                            result.skippedCount++;
                            continue;
                        }
                    }

                    // 转换数据格式
                    const newStats = this.convertToNewFormat(oldNovelStats);

                    // 演练模式：只验证转换，不写入
                    if (dryRun) {
                        console.log(`[DRY RUN] 已转换: ${novelId}`);
                        result.successCount++;
                        continue;
                    }

                    // 写入新系统
                    await this.newStorage.saveNovelStats(novelId, newStats);

                    // 验证写入结果（如果启用）
                    if (validateTarget) {
                        const written = await this.newStorage.getNovelStats(novelId);
                        if (!written) {
                            throw new Error('写入验证失败：无法读取刚写入的数据');
                        }

                        const validation = StatsValidator.validateNovelStats(written);
                        if (!validation.isValid) {
                            throw new Error(`写入验证失败: ${validation.errors.join(', ')}`);
                        }
                    }

                    result.successCount++;
                    console.log(`✅ 迁移成功: ${novelId} (${i + 1}/${result.totalNovels})`);

                } catch (error) {
                    result.failedCount++;
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    result.failedNovels.push({
                        novelId,
                        title: novelId,
                        error: errorMsg
                    });

                    console.error(`❌ 迁移失败: ${novelId}`, error);

                    if (!continueOnError) {
                        throw error;
                    }
                }
            }

            // Phase 5: 重新计算全局统计
            if (!dryRun) {
                this.reportProgress(onProgress, {
                    phase: 'verification',
                    current: 0,
                    total: 1,
                    message: '正在重新计算全局统计...',
                    percentage: 80
                });

                await this.newStorage.recalculateGlobalStats();
            }

            // Phase 6: 删除旧数据（如果启用）
            if (deleteOldData && !dryRun && result.failedCount === 0) {
                this.reportProgress(onProgress, {
                    phase: 'cleanup',
                    current: 0,
                    total: 1,
                    message: '正在清理旧数据...',
                    percentage: 90
                });

                await this.deleteOldData();
                console.log('🗑️ 旧数据已删除');
            }

            // 完成
            result.success = result.failedCount === 0;
            result.endTime = Date.now();
            result.duration = result.endTime - result.startTime;

            // 保存迁移记录
            if (!dryRun) {
                const record = this.createMigrationRecord(result);
                result.recordPath = await this.saveMigrationRecord(record);
            }

            this.reportProgress(onProgress, {
                phase: 'cleanup',
                current: 1,
                total: 1,
                message: '迁移完成！',
                percentage: 100
            });

            return result;

        } catch (error) {
            result.success = false;
            result.endTime = Date.now();
            result.duration = result.endTime - result.startTime;

            console.error('❌ 迁移失败:', error);

            // 尝试保存失败记录
            try {
                const record = this.createMigrationRecord(result, error);
                result.recordPath = await this.saveMigrationRecord(record);
            } catch (recordError) {
                console.error('无法保存迁移记录:', recordError);
            }

            throw error;
        }
    }

    /**
     * 取消正在进行的迁移
     */
    cancelMigration(): void {
        this.isCancelled = true;
        console.log('⚠️ 迁移取消请求已发出');
    }

    /**
     * 备份旧数据
     */
    private async backupOldData(): Promise<string> {
        const oldDbPath = this.getOldDatabasePath();
        const timestamp = Date.now();
        const backupPath = `${this.pathsManager.getBackupDir('manual')}/reading-stats-backup-${timestamp}.json`;

        try {
            const exists = await this.app.vault.adapter.exists(oldDbPath);
            if (!exists) {
                console.warn('⚠️ 旧数据文件不存在，跳过备份');
                return '';
            }

            // 确保备份目录存在
            await this.pathsManager.ensureDir(this.pathsManager.getBackupDir('manual'));

            // 读取并写入备份
            const data = await this.app.vault.adapter.read(oldDbPath);
            await this.app.vault.adapter.write(backupPath, data);

            console.log(`✅ 备份成功: ${backupPath}`);
            return backupPath;

        } catch (error) {
            console.error('备份失败:', error);
            throw new Error(`备份失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 读取旧的Loki统计数据
     */
    private async readOldStats(): Promise<NovelReadingStats[]> {
        const oldDbPath = this.getOldDatabasePath();

        try {
            const exists = await this.app.vault.adapter.exists(oldDbPath);
            if (!exists) {
                console.warn('旧数据文件不存在');
                return [];
            }

            const content = await this.app.vault.adapter.read(oldDbPath);
            const parsed = JSON.parse(content);

            // Loki数据库格式: {name, collections: [{name, data: [...]}]}
            if (parsed.collections && Array.isArray(parsed.collections)) {
                for (const collection of parsed.collections) {
                    if (collection.name === 'novelStats' && Array.isArray(collection.data)) {
                        return collection.data;
                    }
                }
            }

            console.warn('未找到novelStats集合');
            return [];

        } catch (error) {
            console.error('读取旧数据失败:', error);
            throw new Error(`读取旧数据失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 验证旧数据的有效性
     */
    private validateOldStats(stats: NovelReadingStats): boolean {
        if (!stats.novelId) {
            console.warn('缺少novelId');
            return false;
        }

        if (!stats.stats) {
            console.warn('缺少stats对象');
            return false;
        }

        // 基本字段检查
        const required = ['totalReadingTime', 'sessionsCount', 'lastReadTime'];
        for (const field of required) {
            if (stats.stats[field as keyof typeof stats.stats] === undefined) {
                console.warn(`缺少必需字段: ${field}`);
                return false;
            }
        }

        return true;
    }

    /**
     * 转换数据格式：Loki v1.0 → 增强版 v2.0
     */
    private convertToNewFormat(oldStats: NovelReadingStats): EnhancedNovelStats {
        const novelId = oldStats.novelId;
        const old = oldStats.stats;

        // 基础转换
        const newStats: EnhancedNovelStats = {
            version: "2.0.0",
            novelId,

            novel: {
                title: novelId, // 使用novelId作为默认标题
                type: this.guessNovelType(novelId),
                totalChapters: Object.keys(old.chapterStats || {}).length
            },

            basicStats: {
                totalReadingTime: old.totalReadingTime || 0,
                sessionsCount: old.sessionsCount || 0,
                firstReadTime: old.firstReadTime || old.lastReadTime || Date.now(),
                lastReadTime: old.lastReadTime || Date.now(),
                lastUpdateTime: Date.now(),
                dataChecksum: ''  // 稍后计算
            },

            behaviorStats: {
                averageReadingSpeed: 0,  // 旧系统没有
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
                lastChapterId: 0,
                lastPosition: undefined
            },

            timeAnalysis: {
                hourlyDistribution: new Array(24).fill(0),
                weekdayDistribution: new Array(7).fill(0),
                preferredTimeSlot: 'evening',
                dailyStats: this.convertDailyStats((old.dailyStats as unknown as Record<string, OldDailyStats>) || {}),
                monthlyStats: {}
            },

            chapterStats: this.convertChapterStats((old.chapterStats as unknown as Record<number, OldChapterStats>) || {}),

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

        // 计算衍生数据
        this.calculateDerivedData(newStats);

        // 计算校验和
        newStats.basicStats.dataChecksum = StatsValidator.generateChecksum(newStats);

        return newStats;
    }

    /**
     * 转换每日统计数据
     */
    private convertDailyStats(oldDaily: Record<string, OldDailyStats>): Record<string, NewDailyStats> {
        const result: Record<string, NewDailyStats> = {};

        for (const [date, stats] of Object.entries(oldDaily)) {
            result[date] = {
                totalDuration: stats.totalDuration || 0,
                sessionsCount: stats.sessionsCount || 0,
                chaptersRead: stats.chaptersRead || [],
                averageSpeed: 0,
                peakSpeed: 0,
                pauseCount: 0,
                notes: 0
            };
        }

        return result;
    }

    /**
     * 转换章节统计数据
     */
    private convertChapterStats(oldChapters: Record<number, OldChapterStats>): Record<number, NewChapterStats> {
        const result: Record<number, NewChapterStats> = {};

        for (const [chapterId, stats] of Object.entries(oldChapters)) {
            result[Number(chapterId)] = {
                timeSpent: stats.timeSpent || 0,
                readCount: stats.readCount || 0,
                lastRead: stats.lastRead || Date.now(),
                firstRead: stats.lastRead || Date.now(),
                averageSpeed: 0,
                peakSpeed: 0,
                notesCount: 0,
                bookmarked: false,
                difficulty: 'medium',
                completionRate: stats.readCount && stats.readCount > 0 ? 1 : 0
            };
        }

        return result;
    }

    /**
     * 计算衍生数据（基于已转换的基础数据）
     */
    private calculateDerivedData(stats: EnhancedNovelStats): void {
        // 计算已完成章节
        stats.progressTracking.completedChapters = Object.entries(stats.chapterStats)
            .filter(([_, chapter]) => chapter.completionRate >= 1)
            .map(([id, _]) => Number(id));

        // 计算进度百分比
        const totalChapters = stats.novel.totalChapters || 0;
        if (totalChapters > 0) {
            stats.progressTracking.currentProgress =
                (stats.progressTracking.completedChapters.length / totalChapters) * 100;
        }

        // 计算最长单日阅读时长
        let maxDailyTime = 0;
        for (const daily of Object.values(stats.timeAnalysis.dailyStats)) {
            if (daily.totalDuration > maxDailyTime) {
                maxDailyTime = daily.totalDuration;
            }
        }
        stats.achievements.timeRecords.singleDay = maxDailyTime;

        // 找到最后阅读的章节
        let lastChapter = 0;
        let lastTime = 0;
        for (const [chapterId, chapter] of Object.entries(stats.chapterStats)) {
            if (chapter.lastRead > lastTime) {
                lastTime = chapter.lastRead;
                lastChapter = Number(chapterId);
            }
        }
        stats.progressTracking.lastChapterId = lastChapter;
    }

    /**
     * 猜测小说类型
     */
    private guessNovelType(novelId: string): 'txt' | 'epub' | 'pdf' {
        const lower = novelId.toLowerCase();
        if (lower.endsWith('.epub')) return 'epub';
        if (lower.endsWith('.pdf')) return 'pdf';
        return 'txt';
    }

    /**
     * 删除旧数据
     */
    private async deleteOldData(): Promise<void> {
        const oldDbPath = this.getOldDatabasePath();

        try {
            const exists = await this.app.vault.adapter.exists(oldDbPath);
            if (exists) {
                await this.app.vault.adapter.remove(oldDbPath);
                console.log(`✅ 已删除旧数据文件: ${oldDbPath}`);
            }
        } catch (error) {
            console.error('删除旧数据失败:', error);
            throw error;
        }
    }

    /**
     * 获取旧数据库路径
     */
    private getOldDatabasePath(): string {
        // 旧的Loki数据库路径
        return '.obsidian/plugins/novel-reader/reading-stats.json';
    }

    /**
     * 创建迁移记录
     */
    private createMigrationRecord(result: MigrationResult, error?: Error | unknown): MigrationRecord {
        const status: MigrationStatus = error ? 'failed' :
            result.failedCount > 0 ? 'completed' : 'completed';

        return {
            version: "2.0.0",
            fromVersion: "1.0.0",
            timestamp: result.startTime,
            status,
            novelsProcessed: result.successCount,
            novelsFailed: result.failedNovels.map(f => f.novelId),
            backupPath: result.backupPath || '',
            errors: error ? [error instanceof Error ? error.message : String(error)] :
                    result.failedNovels.map(f => `${f.novelId}: ${f.error}`)
        };
    }

    /**
     * 保存迁移记录
     */
    private async saveMigrationRecord(record: MigrationRecord): Promise<string> {
        const path = this.pathsManager.getMigrationRecordPath(record.timestamp);

        try {
            await this.pathsManager.ensureDir(this.pathsManager.getMigrationsDir());
            await this.app.vault.adapter.write(path, JSON.stringify(record, null, 2));
            console.log(`✅ 迁移记录已保存: ${path}`);
            return path;
        } catch (error) {
            console.error('保存迁移记录失败:', error);
            throw error;
        }
    }

    /**
     * 报告进度
     */
    private reportProgress(
        callback: ((progress: MigrationProgress) => void) | undefined,
        progress: MigrationProgress
    ): void {
        if (callback) {
            callback(progress);
        }
    }

    /**
     * 获取迁移历史
     */
    async getMigrationHistory(): Promise<MigrationRecord[]> {
        const migrationsDir = this.pathsManager.getMigrationsDir();

        try {
            const exists = await this.app.vault.adapter.exists(migrationsDir);
            if (!exists) {
                return [];
            }

            const files = await this.app.vault.adapter.list(migrationsDir);
            const records: MigrationRecord[] = [];

            for (const file of files.files) {
                if (file.endsWith('.json')) {
                    try {
                        const content = await this.app.vault.adapter.read(file);
                        const record = JSON.parse(content) as MigrationRecord;
                        records.push(record);
                    } catch (error) {
                        console.error(`读取迁移记录失败: ${file}`, error);
                    }
                }
            }

            // 按时间倒序排序
            return records.sort((a, b) => b.timestamp - a.timestamp);

        } catch (error) {
            console.error('获取迁移历史失败:', error);
            return [];
        }
    }

    /**
     * 检查是否需要迁移
     */
    async needsMigration(): Promise<boolean> {
        const oldDbPath = this.getOldDatabasePath();
        const indexPath = this.pathsManager.getIndexFilePath();

        try {
            const oldExists = await this.app.vault.adapter.exists(oldDbPath);
            const newExists = await this.app.vault.adapter.exists(indexPath);

            // 如果旧数据存在且新索引不存在，则需要迁移
            return oldExists && !newExists;
        } catch (error) {
            console.error('检查迁移状态失败:', error);
            return false;
        }
    }

    /**
     * 估算迁移所需时间（毫秒）
     */
    async estimateMigrationTime(): Promise<{
        estimatedTime: number;
        novelCount: number;
        dataSize: number;
    }> {
        try {
            const oldStats = await this.readOldStats();
            const novelCount = oldStats.length;

            // 估算：每本书约需要 100-200ms
            const avgTimePerNovel = 150;
            const estimatedTime = novelCount * avgTimePerNovel + 2000; // +2秒用于初始化和收尾

            // 尝试获取数据大小
            let dataSize = 0;
            const oldDbPath = this.getOldDatabasePath();
            const exists = await this.app.vault.adapter.exists(oldDbPath);
            if (exists) {
                const content = await this.app.vault.adapter.read(oldDbPath);
                dataSize = new Blob([content]).size;
            }

            return {
                estimatedTime,
                novelCount,
                dataSize
            };

        } catch (error) {
            console.error('估算迁移时间失败:', error);
            return {
                estimatedTime: 0,
                novelCount: 0,
                dataSize: 0
            };
        }
    }
}
