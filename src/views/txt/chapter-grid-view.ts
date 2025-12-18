import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type NovelReaderPlugin from '../../main';
import ChapterGridComponent from '../../components/ChapterGridViewComponent.svelte';
import { VIEW_TYPE_TXT_READER, VIEW_TYPE_TXT_CHAPTER_GRID } from '../../types/constants';
import type { Novel } from '../../types';
import { TxtNovelReaderView } from './txt-novel-reader-view';
import { parseChapters } from "../../lib/txt.reader/chapter-logic";
import type { ComponentType } from "svelte";
import type { ChapterProgress } from "../../types/txt/txt-reader";

//TXT章节目录
export class ChapterGridView extends ItemView {
	private component: ChapterGridComponent | null = null;
	private novel: Novel | null = null;
	private dataReady = false;
	private chapters: ChapterProgress[] = [];

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_TXT_CHAPTER_GRID;
	}

	getDisplayText(): string {
		return this.novel ? `${this.novel.title} - 目录` : '目录';
	}

	async setNovel(novel: Novel) {
		console.log("[GridView] setNovel called with:", novel.title);
		this.novel = novel;
		this.dataReady = true;

		await this.leaf.setViewState({
			type: VIEW_TYPE_TXT_CHAPTER_GRID,
			state: { title: novel.title }
		});

		const file = this.app.vault.getAbstractFileByPath(novel.path);
		if (!(file instanceof TFile)) {
			throw new Error('File not found');
		}

		const content = await this.app.vault.read(file);
		this.chapters = parseChapters(content, novel);
		console.log("[GridView] Parsed chapters:", this.chapters.length);

		if (this.component) {
			console.log("[GridView] Updating component");
			this.component.$set({
				novel: this.novel,
				chapters: this.chapters
			});
		}
	}

	async onOpen() {
		console.log("[GridView] onOpen called");
		const container = this.containerEl.children[1];
		if (!container) {
			console.error('[GridView] Container not found');
			return;
		}
		container.empty();

		console.log("[GridView] Initializing with novel:", this.novel?.title);
		console.log("[GridView] Chapters count:", this.chapters.length);

		this.component = new (ChapterGridComponent as unknown as ComponentType)({
			target: container,
			props: {
				novel: this.novel,
				chapters: this.chapters,
				plugin: this.plugin,
				onOpenNovel: async (novel: Novel, chapterId: number) => {
					try {
						console.log("[GridView] onOpenNovel called with:", {
							novelTitle: novel.title,
							chapterId: chapterId
						});

						let existingView = null;
						if (this.novel) {
							// 先检查是否已存在该小说的阅读视图
							existingView = TxtNovelReaderView.findExistingView(this.app, this.novel.id);
						}

						if (existingView) {
							// 如果存在，更新现有视图
							await existingView.setCurrentChapter(chapterId);
							// 激活包含该视图的标签页
							await this.app.workspace.revealLeaf(existingView.leaf);
						} else {
							const file = this.app.vault.getAbstractFileByPath(novel.path);
							if (!(file instanceof TFile)) {
								throw new Error('File not found: ' + novel.path);
							}

							console.log("[GridView] Found file:", file.path);
							const content = await this.app.vault.read(file);
							console.log("[GridView] Content loaded, length:", content.length);

							console.log("[GridView] Creating new leaf");
							const leaf = this.app.workspace.getLeaf('tab');

							console.log("[GridView] Setting view state");
							await leaf.setViewState({
								type: VIEW_TYPE_TXT_READER,
								state: {
									novel: novel,
									initialChapterId: chapterId
								},
								active: true  // 确保新标签页被激活
							});

							console.log("[GridView] Getting view instance");
							const view = leaf.view;
							if (view instanceof TxtNovelReaderView) {
								console.log("[GridView] Initializing reader view");
								await view.setNovelData(novel, content, {
									initialChapterId: chapterId
								});

								console.log("[GridView] Revealing leaf");
								await this.app.workspace.revealLeaf(leaf);
								console.log("[GridView] Reader view should be open now");
							} else {
								console.error("[GridView] View is not TxtNovelReaderView:", view?.constructor.name);
							}
						}
					} catch (error) {
						console.error('[GridView] Error in onOpenNovel:', error);
						new Notice(`打开失败：${novel.title} - ${(error as Error).message}`);
					}
				}
			}
		});

		if (this.novel) {
			console.log("[GridView] Updating with existing novel");
			await this.setNovel(this.novel);
		}
	}
	async onClose() {
		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}
	}

	/**
	 * 查找已打开的 TXT 章节目录视图
	 */
	static findExistingView(app: any, novelId: string): ChapterGridView | null {
		const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_TXT_CHAPTER_GRID);
		for (const leaf of leaves) {
			const view = leaf.view as ChapterGridView;
			if (view?.novel?.id === novelId) {
				return view;
			}
		}
		return null;
	}
}
