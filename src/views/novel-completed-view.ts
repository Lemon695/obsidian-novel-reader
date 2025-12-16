import {ItemView, WorkspaceLeaf} from 'obsidian';
import type NovelReaderPlugin from '../main';
import {PLUGIN_ID, VIEW_TYPE_COMPLETED} from '../types/constants';
import CompletedViewComponent from "../components/CompletedViewComponent.svelte";
import type {ComponentType, SvelteComponent} from 'svelte';

export class NovelCompletedView extends ItemView {
	private component: CompletedViewComponent | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_COMPLETED;
	}

	getDisplayText(): string {
		return '已读完';
	}

	getIcon(): string {
		return 'checkmark-circle';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		// 获取已完成阅读的图书数据
		const novels = await this.plugin.libraryService.getAllNovels();
		const completedNovels = novels.filter(novel => novel.progress === 100);

		// 创建组件
		this.component = new (CompletedViewComponent as unknown as ComponentType)({
			target: container,
			props: {
				novels: completedNovels,
				stats: {
					totalCompleted: completedNovels.length,
					// 按月统计完成数量
					monthlyStats: this.getMonthlyStats(completedNovels),
					// 计算年度目标达成率
					yearlyGoal: {
						current: completedNovels.filter(n =>
							new Date(n.lastRead ?? Date.now()).getFullYear() === new Date().getFullYear()
						).length,
						target: 12 // 默认年度目标12本
					}
				},
				onRefresh: async () => {
					await this.refresh();
				}
			}
		});
	}

	private getMonthlyStats(novels: import('../types').Novel[]): number[] {
		const monthlyData = new Array(12).fill(0);
		const currentYear = new Date().getFullYear();

		novels.forEach(novel => {
			if (novel.lastRead) {
				const date = new Date(novel.lastRead);
				if (date.getFullYear() === currentYear) {
					monthlyData[date.getMonth()]++;
				}
			}
		});

		return monthlyData;
	}

	async refresh() {
		if (this.component) {
			const novels = await this.plugin.libraryService.getAllNovels();
			const completedNovels = novels.filter(novel => novel.progress === 100);

			this.component.$set({
				novels: completedNovels,
				stats: {
					totalCompleted: completedNovels.length,
					monthlyStats: this.getMonthlyStats(completedNovels),
					yearlyGoal: {
						current: completedNovels.filter(n =>
							new Date(n.lastRead ?? Date.now()).getFullYear() === new Date().getFullYear()
						).length,
						target: 12
					}
				}
			});
		}
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}
}
