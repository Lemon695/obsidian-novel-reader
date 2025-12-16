import {App} from 'obsidian';
import type NovelReaderPlugin from '../main';
import type {ChapterHistory, NovelChapterHistory} from '../types/reading-stats';
import {PathsService} from "./utils/paths-service";

export class ChapterHistoryService {
	private history: NovelChapterHistory = {};
	private readonly MAX_HISTORY_PER_NOVEL = 50;

	private pathsService!: PathsService;

	constructor(private app: App, private plugin: NovelReaderPlugin) {
		this.pathsService = this.plugin.pathsService;
		this.loadHistory();
	}

	private async loadHistory() {
		try {
			const path = this.pathsService.getHistoryFilePath();
			if (await this.app.vault.adapter.exists(path)) {
				const data = await this.app.vault.adapter.read(path);
				this.history = JSON.parse(data);
			}
		} catch (error) {
			console.error('Error loading chapter history:', error);
			this.history = {};
		}
	}

	private async saveHistory() {
		try {
			const path = this.pathsService.getHistoryFilePath();
			await this.app.vault.adapter.write(
				path,
				JSON.stringify(this.history, null, 2)
			);
		} catch (error) {
			console.error('Error saving chapter history:', error);
		}
	}

	async addHistory(novelId: string, chapterId: number, chapterTitle: string) {
		if (!this.history[novelId]) {
			this.history[novelId] = [];
		}

		console.log('addHistory--->', novelId, chapterId, chapterTitle)

		// 添加新记录
		const record: ChapterHistory = {
			novelId,
			chapterId,
			chapterTitle,
			timestamp: Date.now()
		};

		// 添加到数组开头
		this.history[novelId].unshift(record);

		// 限制历史记录数量
		if (this.history[novelId].length > this.MAX_HISTORY_PER_NOVEL) {
			this.history[novelId] = this.history[novelId]
				.slice(0, this.MAX_HISTORY_PER_NOVEL);
		}

		await this.saveHistory();
	}

	async getHistory(novelId: string): Promise<ChapterHistory[]> {
		await this.loadHistory(); // 重新加载确保数据最新
		return this.history[novelId] || [];
	}

	async clearHistory(novelId: string) {
		delete this.history[novelId];
		await this.saveHistory();
	}

	async deleteRecord(novelId: string, timestamp: number) {
		if (this.history[novelId]) {
			this.history[novelId] = this.history[novelId]
				.filter(record => record.timestamp !== timestamp);
			await this.saveHistory();
		}
	}

	async toggleImportant(novelId: string, timestamp: number) {
		if (this.history[novelId]) {
			const record = this.history[novelId]
				.find(r => r.timestamp === timestamp);
			if (record) {
				record.isImportant = !record.isImportant;
				await this.saveHistory();
			}
		}
	}

	/**
	 * 清理旧历史记录（保留重要记录）
	 * @param daysToKeep 保留最近多少天的记录，默认 30 天
	 */
	async cleanOldHistory(daysToKeep: number = 30): Promise<void> {
		const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
		let totalRemoved = 0;

		for (const novelId in this.history) {
			const originalLength = this.history[novelId].length;
			
			// 保留重要记录和最近的记录
			this.history[novelId] = this.history[novelId].filter(record => 
				record.isImportant || record.timestamp > cutoffTime
			);
			
			totalRemoved += originalLength - this.history[novelId].length;
		}

		if (totalRemoved > 0) {
			await this.saveHistory();
			console.log(`Cleaned ${totalRemoved} old history records`);
		}
	}

	/**
	 * 获取历史记录统计信息
	 */
	getHistoryStats(): { totalNovels: number; totalRecords: number; oldestRecord: number | null } {
		const totalNovels = Object.keys(this.history).length;
		let totalRecords = 0;
		let oldestRecord: number | null = null;

		for (const novelId in this.history) {
			totalRecords += this.history[novelId].length;
			
			for (const record of this.history[novelId]) {
				if (oldestRecord === null || record.timestamp < oldestRecord) {
					oldestRecord = record.timestamp;
				}
			}
		}

		return { totalNovels, totalRecords, oldestRecord };
	}
}
