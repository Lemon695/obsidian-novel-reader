/**
 * 多文件统计数据存储服务
 *
 * 设计原则：
 * 1. 分散存储 - 每本书独立文件
 * 2. 按需加载 - 不一次性加载所有数据
 * 3. 自动备份 - 定期备份重要数据
 * 4. 数据校验 - 每次写入验证完整性
 * 5. 错误恢复 - 损坏数据可回滚
 */

import type {App} from "obsidian";
import type NovelReaderPlugin from "../main";
import {StatsPathsManager} from "../utils/stats-paths";
import {StatsValidator} from "../utils/stats-validator";
import type {
    EnhancedNovelStats,
    EnhancedGlobalStats,
    StatsIndexFile,
    EnhancedReadingSession,
    NovelIndexEntry,
    STATS_VERSION
} from "../types/enhanced-stats";
import {Notice} from "obsidian";

export class MultiFileStatsStorage {
    private pathsManager: StatsPathsManager;
    private indexCache: StatsIndexFile | null = null;
    private lastBackupTime: number = 0;
    private readonly BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时

    constructor(private app: App, private plugin: NovelReaderPlugin) {
        this.pathsManager = new StatsPathsManager(app, plugin);
    }

    /**
     * 初始化存储系统
     */
    async initialize(): Promise<void> {
        console.log('Initializing MultiFileStatsStorage...');

        try {
            // 1. 确保所有必需目录存在
            await this.pathsManager.ensureAllDirs();

            // 2. 加载或创建索引文件
            await this.loadOrCreateIndex();

            // 3. 清理旧备份
            await this.pathsManager.cleanOldBackups(30);

            console.log('MultiFileStatsStorage initialized successfully');
        } catch (error) {
            console.error('Failed to initialize MultiFileStatsStorage:', error);
            throw error;
        }
    }

    // ============================================
    // 索引文件操作
    // ============================================

    /**
     * 加载或创建索引文件
     */
    private async loadOrCreateIndex(): Promise<StatsIndexFile> {
        const indexPath = this.pathsManager.getIndexFilePath();
        const exists = await this.app.vault.adapter.exists(indexPath);

        if (exists) {
            try {
                const content = await this.app.vault.adapter.read(indexPath);
                const index = JSON.parse(content) as StatsIndexFile;

                // 验证索引文件
                const validation = StatsValidator.validateIndexFile(index);
                if (!validation.isValid) {
                    console.warn('Index file validation failed:', validation.errors);
                    // 尝试修复或重建索引
                    return await this.rebuildIndex();
                }

                this.indexCache = index;
                return index;
            } catch (error) {
                console.error('Failed to load index file:', error);
                return await this.rebuildIndex();
            }
        } else {
            // 创建新索引
            return await this.createNewIndex();
        }
    }

    /**
     * 创建新的索引文件
     */
    private async createNewIndex(): Promise<StatsIndexFile> {
        const index: StatsIndexFile = {
            version: "2.0.0",
            lastUpdate: Date.now(),
            totalNovels: 0,
            globalStatsFile: this.pathsManager.getGlobalStatsPath(),
            globalStats: {
                totalReadingTime: 0,
                totalBooks: 0,
                booksCompleted: 0,
                currentStreak: 0,
                longestStreak: 0
            },
            novelIndex: {}
        };

        await this.saveIndex(index);
        this.indexCache = index;
        return index;
    }

    /**
     * 保存索引文件
     */
    private async saveIndex(index: StatsIndexFile): Promise<void> {
        const indexPath = this.pathsManager.getIndexFilePath();
        index.lastUpdate = Date.now();

        const content = JSON.stringify(index, null, 2);
        await this.app.vault.adapter.write(indexPath, content);

        this.indexCache = index;
    }

    /**
     * 重建索引文件（从现有数据，带备份和错误处理）
     */
    private async rebuildIndex(): Promise<StatsIndexFile> {
        console.log('Rebuilding index from existing data...');

        // 1. 备份原索引（如果存在）
        const indexPath = this.pathsManager.getIndexFilePath();
        const backupPath = `${indexPath}.backup.${Date.now()}`;
        
        try {
            if (await this.app.vault.adapter.exists(indexPath)) {
                const content = await this.app.vault.adapter.read(indexPath);
                await this.app.vault.adapter.write(backupPath, content);
                console.log('Original index backed up to:', backupPath);
            }
        } catch (error) {
            console.error('Failed to backup index:', error);
            // 继续执行，但记录警告
        }

        // 2. 创建新索引
        const index = await this.createNewIndex();
        const novelsDir = `${this.pathsManager.getStatsRoot()}/novels`;

        try {
            const exists = await this.app.vault.adapter.exists(novelsDir);
            if (!exists) {
                console.warn('Novels directory not found, returning empty index');
                return index;
            }

            const dirs = await this.app.vault.adapter.list(novelsDir);
            let successCount = 0;
            let failCount = 0;

            for (const dir of dirs.folders) {
                try {
                    const novelId = dir.split('/').pop()!;
                    const statsPath = this.pathsManager.getNovelStatsPath(novelId);

                    const statsExists = await this.app.vault.adapter.exists(statsPath);
                    if (statsExists) {
                        const content = await this.app.vault.adapter.read(statsPath);
                        const stats = JSON.parse(content) as EnhancedNovelStats;

                        index.novelIndex[novelId] = {
                            title: stats.novel.title,
                            author: stats.novel.author,
                            type: stats.novel.type,
                            lastAccess: stats.basicStats.lastReadTime,
                            statsFile: statsPath,
                            checksum: stats.basicStats.dataChecksum,
                            status: this.determineBookStatus(stats),
                            progress: stats.progressTracking.currentProgress
                        };

                        index.totalNovels++;
                        successCount++;
                    }
                } catch (error) {
                    console.error(`Failed to process novel ${dir}:`, error);
                    failCount++;
                }
            }

            console.log(`Index rebuilt: ${successCount} novels processed, ${failCount} failed`);
            
            if (failCount > 0) {
                new Notice(`索引重建完成，但有 ${failCount} 本书处理失败`);
            } else if (successCount > 0) {
                new Notice(`索引重建成功，处理了 ${successCount} 本书`);
            }

            await this.saveIndex(index);
            return index;
        } catch (error) {
            console.error('Failed to rebuild index:', error);
            new Notice('索引重建失败，请检查日志');
            throw error;
        }
    }

    /**
     * 判断书籍状态
     */
    private determineBookStatus(stats: EnhancedNovelStats): 'notStarted' | 'reading' | 'completed' | 'abandoned' {
        const progress = stats.progressTracking.currentProgress;

        if (progress === 0) return 'notStarted';
        if (progress >= 100) return 'completed';

        // 如果超过30天未读，判定为abandoned
        const daysSinceLastRead = (Date.now() - stats.basicStats.lastReadTime) / (1000 * 60 * 60 * 24);
        if (daysSinceLastRead > 30 && progress < 50) return 'abandoned';

        return 'reading';
    }

    /**
     * 更新索引中的小说条目
     */
    private async updateIndexEntry(novelId: string, stats: EnhancedNovelStats): Promise<void> {
        const index = this.indexCache || await this.loadOrCreateIndex();

        const entry: NovelIndexEntry = {
            title: stats.novel.title,
            author: stats.novel.author,
            type: stats.novel.type,
            lastAccess: stats.basicStats.lastReadTime,
            statsFile: this.pathsManager.getNovelStatsPath(novelId),
            checksum: stats.basicStats.dataChecksum,
            status: this.determineBookStatus(stats),
            progress: stats.progressTracking.currentProgress
        };

        const isNew = !index.novelIndex[novelId];
        index.novelIndex[novelId] = entry;

        if (isNew) {
            index.totalNovels++;
        }

        await this.saveIndex(index);
    }

    // ============================================
    // 小说统计数据操作
    // ============================================

    /**
     * 获取小说统计数据
     */
    async getNovelStats(novelId: string): Promise<EnhancedNovelStats | null> {
        const statsPath = this.pathsManager.getNovelStatsPath(novelId);
        const exists = await this.app.vault.adapter.exists(statsPath);

        if (!exists) {
            return null;
        }

        try {
            const content = await this.app.vault.adapter.read(statsPath);
            const stats = JSON.parse(content) as EnhancedNovelStats;

            // 验证数据完整性
            const validation = StatsValidator.validateNovelStats(stats);
            if (!validation.isValid) {
                console.warn('Stats validation failed:', validation.errors);

                if (!validation.checksumMatches) {
                    new Notice('检测到数据异常，已自动备份');
                    await this.createManualBackup(novelId, stats);
                }

                // 尝试修复
                const repaired = StatsValidator.repairNovelStats(stats);
                if (repaired) {
                    console.log('Stats repaired successfully');
                    await this.saveNovelStats(novelId, repaired);
                    return repaired;
                }
            }

            return stats;
        } catch (error) {
            console.error('Failed to load novel stats:', error);

            // 尝试从备份恢复
            const backup = await this.restoreFromLatestBackup(novelId);
            if (backup) {
                new Notice('已从备份恢复数据');
                return backup;
            }

            return null;
        }
    }

    /**
     * 保存小说统计数据
     */
    async saveNovelStats(novelId: string, stats: EnhancedNovelStats): Promise<void> {
        // 更新时间戳和checksum
        stats.basicStats.lastUpdateTime = Date.now();
        stats.basicStats.dataChecksum = StatsValidator.generateChecksum(stats);

        // 验证数据
        const validation = StatsValidator.validateNovelStats(stats);
        if (!validation.isValid) {
            console.error('Cannot save invalid stats:', validation.errors);
            throw new Error(`Invalid stats data: ${validation.errors.join(', ')}`);
        }

        // 确保目录存在
        const dir = this.pathsManager.getNovelStatsDir(novelId);
        await this.pathsManager.ensureDir(dir);

        // 保存到文件
        const statsPath = this.pathsManager.getNovelStatsPath(novelId);
        const content = JSON.stringify(stats, null, 2);
        await this.app.vault.adapter.write(statsPath, content);

        // 更新索引
        await this.updateIndexEntry(novelId, stats);

        // 定期备份
        await this.maybeCreateBackup(novelId, stats);
    }

    /**
     * 创建新的小说统计数据
     */
    async createNovelStats(
        novelId: string,
        title: string,
        type: 'txt' | 'epub' | 'pdf',
        author?: string
    ): Promise<EnhancedNovelStats> {
        const now = Date.now();

        const stats: EnhancedNovelStats = {
            version: "2.0.0",
            novelId,
            novel: {
                title,
                author,
                type
            },
            basicStats: {
                totalReadingTime: 0,
                sessionsCount: 0,
                firstReadTime: now,
                lastReadTime: now,
                lastUpdateTime: now,
                dataChecksum: ''
            },
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
            timeAnalysis: {
                hourlyDistribution: new Array(24).fill(0),
                weekdayDistribution: new Array(7).fill(0),
                preferredTimeSlot: 'evening',
                dailyStats: {},
                monthlyStats: {}
            },
            chapterStats: {},
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

        // 生成checksum
        stats.basicStats.dataChecksum = StatsValidator.generateChecksum(stats);

        await this.saveNovelStats(novelId, stats);
        return stats;
    }

    // ============================================
    // 会话数据操作
    // ============================================

    /**
     * 保存会话数据（按月分文件）
     */
    async saveSession(session: EnhancedReadingSession): Promise<void> {
        const yearMonth = new Date(session.startTime).toISOString().substring(0, 7); // "YYYY-MM"
        const sessionPath = this.pathsManager.getSessionsPath(session.novelId, yearMonth);

        // 确保目录存在
        const dir = this.pathsManager.getNovelStatsDir(session.novelId);
        await this.pathsManager.ensureDir(dir);

        // 读取现有会话
        let sessions: EnhancedReadingSession[] = [];
        const exists = await this.app.vault.adapter.exists(sessionPath);
        if (exists) {
            const content = await this.app.vault.adapter.read(sessionPath);
            sessions = JSON.parse(content);
        }

        // 添加或更新会话
        const index = sessions.findIndex(s => s.sessionId === session.sessionId);
        if (index >= 0) {
            sessions[index] = session;
        } else {
            sessions.push(session);
        }

        // 保存
        const content = JSON.stringify(sessions, null, 2);
        await this.app.vault.adapter.write(sessionPath, content);
    }

    /**
     * 获取小说的所有会话（可选时间范围）
     */
    async getSessionsByDate(
        novelId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<EnhancedReadingSession[]> {
        const allSessions: EnhancedReadingSession[] = [];

        // 获取需要查询的年月列表
        const yearMonths = startDate
            ? this.pathsManager.getYearMonthRange(startDate, endDate)
            : await this.pathsManager.listSessionFiles(novelId);

        for (const ym of yearMonths) {
            const sessionPath = this.pathsManager.getSessionsPath(novelId, ym);
            const exists = await this.app.vault.adapter.exists(sessionPath);

            if (exists) {
                const content = await this.app.vault.adapter.read(sessionPath);
                const sessions = JSON.parse(content) as EnhancedReadingSession[];

                // 过滤日期范围
                const filtered = sessions.filter(s => {
                    if (startDate && s.startTime < startDate.getTime()) return false;
                    if (endDate && s.startTime > endDate.getTime()) return false;
                    return true;
                });

                allSessions.push(...filtered);
            }
        }

        return allSessions.sort((a, b) => a.startTime - b.startTime);
    }

    // ============================================
    // 备份与恢复
    // ============================================

    /**
     * 可能创建备份（24小时一次）
     */
    private async maybeCreateBackup(novelId: string, stats: EnhancedNovelStats): Promise<void> {
        const now = Date.now();
        if (now - this.lastBackupTime < this.BACKUP_INTERVAL) {
            return; // 备份间隔未到
        }

        await this.createDailyBackup(novelId, stats);
        this.lastBackupTime = now;
    }

    /**
     * 创建每日备份
     */
    private async createDailyBackup(novelId: string, stats: EnhancedNovelStats): Promise<void> {
        const backupPath = this.pathsManager.getBackupPath(novelId, Date.now(), 'daily');

        // 确保备份目录存在
        await this.pathsManager.ensureDir(this.pathsManager.getBackupDir('daily'));

        const content = JSON.stringify(stats, null, 2);
        await this.app.vault.adapter.write(backupPath, content);

        console.log(`Daily backup created: ${backupPath}`);
    }

    /**
     * 创建手动备份
     */
    async createManualBackup(novelId: string, stats: EnhancedNovelStats): Promise<string> {
        const backupPath = this.pathsManager.getBackupPath(novelId, Date.now(), 'manual');

        // 确保备份目录存在
        await this.pathsManager.ensureDir(this.pathsManager.getBackupDir('manual'));

        const content = JSON.stringify(stats, null, 2);
        await this.app.vault.adapter.write(backupPath, content);

        console.log(`Manual backup created: ${backupPath}`);
        return backupPath;
    }

    /**
     * 从最新备份恢复
     */
    private async restoreFromLatestBackup(novelId: string): Promise<EnhancedNovelStats | null> {
        try {
            const backupDir = this.pathsManager.getBackupDir('daily');
            const files = await this.app.vault.adapter.list(backupDir);

            // 筛选该小说的备份文件
            const novelBackups = files.files
                .filter(f => f.includes(novelId) && f.endsWith('.json'))
                .sort()
                .reverse();

            if (novelBackups.length === 0) {
                return null;
            }

            // 尝试最新的备份
            const latestBackup = novelBackups[0];
            const content = await this.app.vault.adapter.read(latestBackup);
            const stats = JSON.parse(content) as EnhancedNovelStats;

            console.log(`Restored from backup: ${latestBackup}`);
            return stats;
        } catch (error) {
            console.error('Failed to restore from backup:', error);
            return null;
        }
    }

    // ============================================
    // 全局统计操作
    // ============================================

    /**
     * 获取全局统计数据
     */
    async getGlobalStats(): Promise<EnhancedGlobalStats | null> {
        const statsPath = this.pathsManager.getGlobalStatsPath();
        const exists = await this.app.vault.adapter.exists(statsPath);

        if (!exists) {
            return await this.createGlobalStats();
        }

        try {
            const content = await this.app.vault.adapter.read(statsPath);
            return JSON.parse(content) as EnhancedGlobalStats;
        } catch (error) {
            console.error('Failed to load global stats:', error);
            return await this.createGlobalStats();
        }
    }

    /**
     * 创建新的全局统计
     */
    private async createGlobalStats(): Promise<EnhancedGlobalStats> {
        const stats: EnhancedGlobalStats = {
            version: "2.0.0",
            lastUpdate: Date.now(),
            library: {
                totalBooks: 0,
                booksCompleted: 0,
                booksInProgress: 0,
                booksNotStarted: 0,
                booksAbandoned: 0,
                booksByType: { txt: 0, epub: 0, pdf: 0 },
                booksByStatus: {
                    notStarted: 0,
                    reading: 0,
                    completed: 0,
                    abandoned: 0
                }
            },
            timeStats: {
                totalReadingTime: 0,
                thisYear: 0,
                thisMonth: 0,
                thisWeek: 0,
                today: 0,
                averageDaily: 0,
                averagePerBook: 0,
                longestSession: { duration: 0, novelId: '', date: '' }
            },
            readingHabits: {
                preferredTimeSlot: 'evening',
                mostProductiveDay: '',
                averageSessionLength: 0,
                readingPeakHours: []
            },
            streaks: {
                currentStreak: 0,
                longestStreak: 0,
                streakStartDate: '',
                streakHistory: []
            },
            rankings: {
                mostReadBooks: [],
                fastestBooks: [],
                recentBooks: [],
                favoriteBooks: []
            },
            yearlyGoals: {},
            globalAchievements: {
                unlocked: [],
                total: 0,
                categories: {},
                recentUnlocked: []
            }
        };

        await this.saveGlobalStats(stats);
        return stats;
    }

    /**
     * 保存全局统计数据
     */
    async saveGlobalStats(stats: EnhancedGlobalStats): Promise<void> {
        stats.lastUpdate = Date.now();

        const statsPath = this.pathsManager.getGlobalStatsPath();
        const content = JSON.stringify(stats, null, 2);
        await this.app.vault.adapter.write(statsPath, content);
    }

    /**
     * 重新计算全局统计（从所有小说聚合）
     */
    async recalculateGlobalStats(): Promise<EnhancedGlobalStats> {
        console.log('Recalculating global stats...');

        // 并行加载索引和创建全局统计对象
        const [index, global] = await Promise.all([
            this.indexCache || this.loadOrCreateIndex(),
            this.createGlobalStats()
        ]);

        // 遍历所有小说统计
        for (const [novelId, entry] of Object.entries(index.novelIndex)) {
            const stats = await this.getNovelStats(novelId);
            if (!stats) continue;

            // 聚合数据
            global.library.totalBooks++;
            global.library.booksByType[entry.type]++;
            global.library.booksByStatus[entry.status]++;

            global.timeStats.totalReadingTime += stats.basicStats.totalReadingTime;

            // 更新排行榜等...
            // (详细逻辑可后续补充)
        }

        // 计算平均值
        if (global.library.totalBooks > 0) {
            global.timeStats.averagePerBook = global.timeStats.totalReadingTime / global.library.totalBooks;
        }

        await this.saveGlobalStats(global);
        console.log('Global stats recalculated');

        return global;
    }
}
