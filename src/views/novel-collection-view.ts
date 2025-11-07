import { ItemView, WorkspaceLeaf } from 'obsidian';
import type NovelReaderPlugin from '../main';
import CollectionViewComponent from '../components/CollectionViewComponent.svelte';
import {PLUGIN_ID, VIEW_TYPE_COLLECTION} from '../types/constants';
import type {ComponentType} from "svelte";

export class NovelCollectionView extends ItemView {
	private component: CollectionViewComponent | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_COLLECTION;
	}

	getDisplayText(): string {
		return '藏书管理';
	}

	getIcon(): string {
		return 'library';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		// 获取所有藏书数据
		const novels = await this.plugin.libraryService.getAllNovels();
		const shelves = await this.plugin.shelfService.getShelves();
		const categories = await this.plugin.shelfService.loadCategories();

		this.component = new (CollectionViewComponent as unknown as ComponentType)({
			target: container,
			props: {
				novels,
				shelves,
				categories,
				onCreateShelf: async (name: string) => {
					await this.plugin.shelfService.createShelf(name);
					await this.refresh();
				},
				onUpdateShelf: async (shelfId: string, updates: any) => {
					//await this.plugin.shelfService.updateShelf(shelfId, updates);
					await this.refresh();
				},
				onDeleteShelf: async (shelfId: string) => {
					//await this.plugin.shelfService.deleteShelf(shelfId);
					await this.refresh();
				},
				onMoveBook: async (novelId: string, shelfId: string) => {
					const novel = novels.find(n => n.id === novelId);
					if (novel) {
						novel.shelfId = shelfId;
						await this.plugin.libraryService.updateNovel(novel);
						await this.refresh();
					}
				},
				onRefresh: async () => {
					await this.refresh();
				}
			}
		});
	}

	async refresh() {
		if (this.component) {
			const novels = await this.plugin.libraryService.getAllNovels();
			const shelves = await this.plugin.shelfService.getShelves();
			const categories = await this.plugin.shelfService.loadCategories();

			this.component.$set({
				novels,
				shelves,
				categories
			});
		}
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}
}
