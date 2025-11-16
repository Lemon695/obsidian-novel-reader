/**
 * 统计数据文件路径管理工具
 *
 * 目录结构：
 * .obsidian/plugins/novel-reader/stats/
 * ├── index.json                    # 全局索引
 * ├── global.json                   # 全局统计
 * ├── novels/
 * │   ├── {novelId}/
 * │   │   ├── stats.json           # 该书统计
 * │   │   ├── sessions-2024-01.json
 * │   │   └── daily-stats.json
 * ├── backups/
 * │   ├── daily/
 * │   └── manual/
 * └── migrations/
 */

import type {App} from "obsidian";
import type NovelReaderPlugin from "../main";

export class StatsPathsManager {
    private baseStatsPath: string;

    constructor(private app: App, private plugin: NovelReaderPlugin) {
        // 使用设置中的路径，默认为 '.obsidian/plugins/novel-reader/stats'
        this.baseStatsPath = this.plugin.settings.statsPath || '.obsidian/plugins/novel-reader/stats';
    }

    /**
     * 获取统计数据根目录
     */
    getStatsRoot(): string {
        return this.baseStatsPath;
    }

    /**
     * 获取全局索引文件路径
     */
    getIndexFilePath(): string {
        return `${this.baseStatsPath}/index.json`;
    }

    /**
     * 获取全局统计文件路径
     */
    getGlobalStatsPath(): string {
        return `${this.baseStatsPath}/global.json`;
    }

    /**
     * 获取小说统计目录
     */
    getNovelStatsDir(novelId: string): string {
        return `${this.baseStatsPath}/novels/${this.sanitizeId(novelId)}`;
    }

    /**
     * 获取小说统计文件路径
     */
    getNovelStatsPath(novelId: string): string {
        return `${this.getNovelStatsDir(novelId)}/stats.json`;
    }

    /**
     * 获取会话数据文件路径（按月分文件）
     */
    getSessionsPath(novelId: string, yearMonth?: string): string {
        const ym = yearMonth || this.getCurrentYearMonth();
        return `${this.getNovelStatsDir(novelId)}/sessions-${ym}.json`;
    }

    /**
     * 获取每日统计文件路径
     */
    getDailyStatsPath(novelId: string): string {
        return `${this.getNovelStatsDir(novelId)}/daily-stats.json`;
    }

    /**
     * 获取备份目录路径
     */
    getBackupDir(type: 'daily' | 'manual' = 'daily'): string {
        return `${this.baseStatsPath}/backups/${type}`;
    }

    /**
     * 获取备份文件路径
     */
    getBackupPath(novelId: string, timestamp: number, type: 'daily' | 'manual' = 'daily'): string {
        const date = new Date(timestamp).toISOString().split('T')[0];
        return `${this.getBackupDir(type)}/${this.sanitizeId(novelId)}-${date}-${timestamp}.json`;
    }

    /**
     * 获取迁移记录目录
     */
    getMigrationsDir(): string {
        return `${this.baseStatsPath}/migrations`;
    }

    /**
     * 获取迁移记录文件路径
     */
    getMigrationRecordPath(timestamp: number): string {
        return `${this.getMigrationsDir()}/migration-${timestamp}.json`;
    }

    /**
     * 获取损坏数据备份路径（Loki原有机制）
     */
    getCorruptedBackupPath(originalPath: string, timestamp: number): string {
        return `${originalPath}.corrupted.${timestamp}`;
    }

    /**
     * 清理文件ID（移除不安全字符）
     */
    private sanitizeId(id: string): string {
        // 移除或替换文件系统不安全字符
        return id.replace(/[<>:"/\\|?*]/g, '_').substring(0, 255);
    }

    /**
     * 获取当前年月（YYYY-MM格式）
     */
    private getCurrentYearMonth(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * 获取年月列表（用于遍历历史会话文件）
     */
    getYearMonthRange(startDate: Date, endDate: Date = new Date()): string[] {
        const result: string[] = [];
        const current = new Date(startDate);

        while (current <= endDate) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            result.push(`${year}-${month}`);

            // 移动到下个月
            current.setMonth(current.getMonth() + 1);
        }

        return result;
    }

    /**
     * 确保目录存在
     */
    async ensureDir(path: string): Promise<void> {
        const exists = await this.app.vault.adapter.exists(path);
        if (!exists) {
            await this.app.vault.adapter.mkdir(path);
            console.log(`Created directory: ${path}`);
        }
    }

    /**
     * 确保所有必需的目录存在
     */
    async ensureAllDirs(): Promise<void> {
        await this.ensureDir(this.getStatsRoot());
        await this.ensureDir(`${this.baseStatsPath}/novels`);
        await this.ensureDir(`${this.baseStatsPath}/backups`);
        await this.ensureDir(this.getBackupDir('daily'));
        await this.ensureDir(this.getBackupDir('manual'));
        await this.ensureDir(this.getMigrationsDir());
    }

    /**
     * 列出小说目录下的所有会话文件
     */
    async listSessionFiles(novelId: string): Promise<string[]> {
        const dir = this.getNovelStatsDir(novelId);
        const exists = await this.app.vault.adapter.exists(dir);

        if (!exists) {
            return [];
        }

        try {
            const files = await this.app.vault.adapter.list(dir);
            return files.files
                .filter(f => f.includes('sessions-') && f.endsWith('.json'))
                .map(f => f.split('/').pop()!);
        } catch (error) {
            console.error('Error listing session files:', error);
            return [];
        }
    }

    /**
     * 清理旧的备份文件（保留最近N天）
     */
    async cleanOldBackups(keepDays: number = 30): Promise<number> {
        const backupDir = this.getBackupDir('daily');
        const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        try {
            const files = await this.app.vault.adapter.list(backupDir);

            for (const file of files.files) {
                // 从文件名提取时间戳
                const match = file.match(/-(\d+)\.json$/);
                if (match) {
                    const timestamp = parseInt(match[1]);
                    if (timestamp < cutoffTime) {
                        await this.app.vault.adapter.remove(file);
                        deletedCount++;
                    }
                }
            }

            console.log(`Cleaned ${deletedCount} old backup files`);
            return deletedCount;
        } catch (error) {
            console.error('Error cleaning old backups:', error);
            return 0;
        }
    }
}
