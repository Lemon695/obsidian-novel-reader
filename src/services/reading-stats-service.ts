import {App} from 'obsidian';
import type NovelReaderPlugin from '../main';
import type {ReadingStats} from "../types/reading-stats";

export class ReadingStatsService {
	constructor(private app: App, private plugin: NovelReaderPlugin) {
	}

	// 获取小说的阅读统计
	async getNovelStats(novelId: string): Promise<ReadingStats> {
		// 从数据库服务获取原始数据
		const rawStats = await this.plugin.dbService?.getNovelStats(novelId);

		// 处理今日阅读时间
		const todayKey = new Date().toISOString().split('T')[0];
		const todayTime = rawStats?.stats.dailyStats[todayKey]?.totalDuration || 0;

		// 计算总阅读时间
		const totalTime = rawStats?.stats.totalReadingTime || 0;

		// 计算平均速度
		const averageSpeed = rawStats?.stats.averageSessionTime || 0;

		// 获取阅读天数
		const readingDays = Object.keys(rawStats?.stats.dailyStats || {}).length;

		// 处理每日统计数据
		const dailyStats = this.processDailyStats(rawStats?.stats.dailyStats || {});

		// 处理速度统计数据
		const speedStats = this.processSpeedStats(rawStats?.stats.chapterStats || {});

		// 计算完成率
		const completionRate = await this.calculateCompletionRate(novelId);

		// 获取最后阅读章节
		const lastChapter = await this.getLastChapter(novelId);

		// 计算连续阅读天数
		const readingStreak = this.calculateReadingStreak(rawStats?.stats.dailyStats || {});

		// 获取首次阅读时间
		const firstReadTime = rawStats?.stats.firstReadTime
			? this.formatFirstReadTime(rawStats.stats.firstReadTime)
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

	private processDailyStats(dailyStats: any) {
		return Object.entries(dailyStats)
			.map(([date, stats]: [string, any]) => ({
				date,
				minutes: Math.floor(stats.totalDuration / 60000), // 转换为分钟
				speed: stats.averageSpeed
			}))
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	private processSpeedStats(chapterStats: any) {
		return Object.entries(chapterStats)
			.map(([time, stats]: [string, any]) => ({
				time,
				speed: stats.averageSpeed
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

	private calculateReadingStreak(dailyStats: any): number {
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
		const stats = await this.getNovelStats(novelId);
		const novel = await this.plugin.libraryService.getNovel(novelId);

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
