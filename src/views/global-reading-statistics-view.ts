import {ItemView, WorkspaceLeaf} from 'obsidian';
import type NovelReaderPlugin from '../main';
import {PLUGIN_ID, VIEW_TYPE_GLOBAL_STATS} from '../types/constants';
import type {ComponentType, SvelteComponent} from 'svelte';
import ReadingStatsDashboard from "../components/ReadingStatsDashboard.svelte";

export class GlobalReadingStatsView extends ItemView {
	private component: SvelteComponent | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: NovelReaderPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_GLOBAL_STATS;
	}

	getDisplayText(): string {
		return '阅读统计';
	}

	getIcon(): string {
		return 'bar-chart';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		this.component = new (ReadingStatsDashboard as unknown as ComponentType)({
			target: container,
			props: {
				plugin: this.plugin
			}
		});
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}
	}
}
