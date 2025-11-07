import {ItemView, WorkspaceLeaf} from 'obsidian';
import type NovelReaderPlugin from '../../main';
import {VIEW_TYPE_GLOBAL_NOTES} from '../../types/constants';
import type {ComponentType} from 'svelte';
import GlobalNotesComponent from "../../components/note/GlobalNotesComponent.svelte";

export class GlobalNotesView extends ItemView {
	private component: GlobalNotesComponent | undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: NovelReaderPlugin
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_GLOBAL_NOTES;
	}

	getDisplayText(): string {
		return '我的笔记';
	}

	getIcon(): string {
		return 'note';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		this.component = new (GlobalNotesComponent as ComponentType)({
			target: container,
			props: {
				plugin: this.plugin
			}
		});
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
			this.component = undefined;
		}
	}
}
