import {App} from 'obsidian';
import type NovelReaderPlugin from '../main';
import type {ReadingStats} from "../types/reading-stats";

interface RawDailyStats {
	totalDuration: number;
	averageSpeed?: number;
}

interface RawChapterStats {
	averageSpeed?: number;
}

export class ReadingStatsService {
	constructor(private app: App, private plugin: NovelReaderPlugin) {
	}

	// 获取小说的阅读统计
	async getNovelStats(novelId: string): Promise<ReadingStats> {
		// 从统计服务获取数据
		if (!this.plugin.statsService) {
			console.warn('Stats service is not available');
			return this.getEmptyStats();
		}

		const rawStats = await this.plugin.statsService.getNovelStats(novelId);

		// 如果没有统计数据，返回空统计
		if (!rawStats) {
			console.warn(`No stats found for novel: ${novelId}`);
			return this.getEmptyStats();
		}

		// 处理今日阅读时间
		const todayKey = new Date().toISOString().split('T')[0];
		const todayTime = rawStats.timeAnalysis.dailyStats?.[todayKey]?.totalDuration || 0;

		// 计算总阅读时间
		const totalTime = rawStats.basicStats.totalReadingTime || 0;

		// 计算平均速度
		let averageSpeed = rawStats.behaviorStats.averageReadingSpeed || 0;

		// 获取阅读天数
		const readingDays = Object.keys(rawStats.timeAnalysis.dailyStats || {}).length;

		// 处理每日统计数据
		const dailyStats = this.processDailyStats(rawStats.timeAnalysis.dailyStats || {});

		// 处理速度统计数据
		const speedStats = this.processSpeedStats(rawStats.chapterStats || {});

		// 计算完成率
		const completionRate = await this.calculateCompletionRate(novelId);

		// 获取最后阅读章节
		const lastChapter = await this.getLastChapter(novelId);

		// 计算连续阅读天数
		const readingStreak = this.calculateReadingStreak(rawStats.timeAnalysis.dailyStats || {});

		// 获取首次阅读时间
		const firstReadTime = rawStats.basicStats.firstReadTime
			? this.formatFirstReadTime(rawStats.basicStats.firstReadTime)
			: '未开始阅读';

		return {
			todayTime,
			totalTime,
			averageSpeed,
			readingDays,
			dailyStats,
			speedStats,
			completionRate,
			lastChapter,
			readingStreak,
			firstReadTime      // 添加首次阅读时间到返回对象
		};
	}

	// 返回空的统计数据
	private getEmptyStats(): ReadingStats {
		return {
			todayTime: 0,
			totalTime: 0,
			averageSpeed: 0,
			readingDays: 0,
			dailyStats: [],
			speedStats: [],
			completionRate: 0,
			lastChapter: '',
			readingStreak: 0,
			firstReadTime: '未开始阅读'
		};
	}

	private processDailyStats(dailyStats: Record<string, RawDailyStats>) {
		return Object.entries(dailyStats)
			.map(([date, stats]) => ({
				date,
				minutes: Math.floor(stats.totalDuration / 60000),
				speed: stats.averageSpeed || 0
			}))
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	private processSpeedStats(chapterStats: Record<string, RawChapterStats>) {
		return Object.entries(chapterStats)
			.map(([time, stats]) => ({
				time,
				speed: stats.averageSpeed || 0
			}))
			.sort((a, b) => a.time.localeCompare(b.time));
	}

	private async calculateCompletionRate(novelId: string): Promise<number> {
		const novel = await this.plugin.libraryService.getNovel(novelId);
		if (!novel?.totalChapters) return 0;
		return Math.floor((novel.progress || 0) * 100);
	}

	private async getLastChapter(novelId: string): Promise<string> {
		const progress = await this.plugin.libraryService.getProgress(novelId);
		return progress?.position?.chapterTitle || '';
	}

	private calculateReadingStreak(dailyStats: Record<string, RawDailyStats>): number {
		let streak = 0;
		const today = new Date();
		let currentDate = new Date(today);

		while (true) {
			const dateKey = currentDate.toISOString().split('T')[0];
			if (!dailyStats[dateKey]) break;

			streak++;
			currentDate.setDate(currentDate.getDate() - 1);
		}

		return streak;
	}

	private formatFirstReadTime(timestamp: number): string {
		if (!timestamp) return '未开始阅读';

		const first = new Date(timestamp);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return '今天';
		if (diffDays === 1) return '昨天';
		if (diffDays < 7) return `${diffDays}天前`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;

		// 返回具体日期
		return first.toLocaleDateString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
	}

	// 导出统计报告
	async exportReport(novelId: string): Promise<string> {
		// 并行获取统计数据和小说信息
		const [stats, novel] = await Promise.all([
			this.getNovelStats(novelId),
			this.plugin.libraryService.getNovel(novelId)
		]);

		// 生成报告内容
		const report = `# 阅读统计报告 - ${novel?.title}
    
## 基础统计
- 今日阅读时间: ${Math.floor(stats.todayTime / 60)}小时${stats.todayTime % 60}分钟
- 累计阅读时间: ${Math.floor(stats.totalTime / 60)}小时${stats.totalTime % 60}分钟
- 平均阅读速度: ${stats.averageSpeed}字/分钟
- 已阅读天数: ${stats.readingDays}天
- 连续阅读天数: ${stats.readingStreak}天
- 阅读进度: ${stats.completionRate}%

## 阅读建议
1. ${stats.averageSpeed < 200 ? '建议提高阅读速度' : '当前阅读速度良好'}
2. ${stats.readingStreak < 7 ? '建议保持每日阅读习惯' : '连续阅读状态不错'}
3. ${stats.todayTime < 30 ? '建议增加每日阅读时间' : '今日阅读时间达标'}

报告生成时间: ${new Date().toLocaleString()}
`;

		return report;
	}
}
