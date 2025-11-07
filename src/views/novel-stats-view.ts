import {ItemView, Notice, WorkspaceLeaf} from 'obsidian';
import type {Novel} from '../types';
import NovelStatsComponent from '../components/NovelStatsComponent.svelte';
import {ReadingStatsService} from '../services/reading-stats-service';
import {VIEW_TYPE_STATS} from '../types/constants';
import type NovelReaderPlugin from "../main";
import type {ComponentType} from "svelte";

export class NovelStatsView extends ItemView {
	private component: NovelStatsComponent | null = null;
	private statsService: ReadingStatsService;

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
		this.statsService = new ReadingStatsService(this.app, plugin);
	}

	getViewType(): string {
		return VIEW_TYPE_STATS;
	}

	getDisplayText(): string {
		return '阅读统计';
	}

	async setNovel(novel: Novel) {
		try {
			// 获取统计数据
			const stats = await this.statsService.getNovelStats(novel.id);

			if (!stats) {
				new Notice('暂无阅读数据');

				//更新组件显示默认数据
				if (this.component) {
					this.component.$set({
						novel,
						stats: undefined
					});
				} else {
					const container = this.contentEl;
					container.empty();

					this.component = new (NovelStatsComponent as unknown as ComponentType)({
						target: container,
						props: {
							novel,
							stats: undefined
						}
					});
				}
				return;
			}

			// 如果有统计数据，正常显示
			if (this.component) {
				this.component.$set({
					novel,
					stats
				});
			} else {
				const container = this.contentEl;
				container.empty();

				this.component = new (NovelStatsComponent as unknown as ComponentType)({
					target: container,
					props: {
						novel,
						stats
					}
				});
			}

			// 激活视图
			await this.app.workspace.revealLeaf(this.leaf);
		} catch (error) {
			console.error('Error loading stats:', error);
			new Notice('加载统计数据失败');
		}
	}


	async onClose() {
		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}
	}

	private formatStats(stats: any) {
		// 格式化统计数据以适应组件显示
		return {
			dailyReadTime: stats.dailyStats.map((day: any) => ({
				date: day.date,
				duration: day.read_time
			})),
			chapterStats: stats.chapterStats.map((chapter: any) => ({
				id: chapter.chapter_id,
				timeSpent: chapter.total_time,
				readCount: chapter.read_count
			})),
			totalStats: {
				totalTime: stats.totalStats.total_time,
				sessionsCount: stats.totalStats.total_sessions
			}
		};
	}
}
