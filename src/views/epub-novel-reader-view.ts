import {App, ItemView, Notice, TFile, WorkspaceLeaf} from 'obsidian';
import type NovelReaderPlugin from '../main';
import {PLUGIN_ID, VIEW_TYPE_EPUB_READER} from '../types/constants';
import type {ComponentType} from 'svelte';
import type {Novel} from "../types";
import EpubReaderViewComponent from "../components/epub/EpubReaderViewComponent.svelte";
import {LibraryService} from "../services/library-service";
import {NovelNoteService} from "../services/note/novel-note-service";
import type {CustomProgressEvent} from "../types/read-progress";
import type {EpubBook, EpubChapter, EpubNavigationItem} from "../types/epub/epub-rendition";
import ePub from "epubjs";

export class EpubNovelReaderView extends ItemView {
	public component: EpubReaderViewComponent | null = null;
	public novel: Novel | null = null;
	private currentSessionId: string | undefined;
	private libraryService: LibraryService;
	private noteService: NovelNoteService;
	private dataReady = false;
	private book: EpubBook | null = null;
	private toc: any[] = [];
	private chapters: EpubChapter[] = [];

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
		this.libraryService = plugin.libraryService; // 使用plugin中已有的实例
		this.noteService = new NovelNoteService(this.app, plugin);
	}

	getViewType(): string {
		return VIEW_TYPE_EPUB_READER;
	}

	getDisplayText(): string {
		return this.novel?.title || 'EPUB Reader';
	}

	async setNovelData(novel: Novel) {
		this.novel = novel;
		this.dataReady = true;

		// 获取保存的进度
		const progress = await this.plugin.libraryService.getProgress(novel.id);

		await this.leaf.setViewState({
			type: VIEW_TYPE_EPUB_READER,
			state: {
				title: novel.title,
				initialCfi: progress?.position?.cfi
			}
		});

		if (this.contentEl) {
			await this.initializeComponent(progress?.position?.chapterId);
		}
	}

	async onClose() {
		if (this.currentSessionId) {
			await this.plugin.dbService?.endReadingSession(this.currentSessionId);
		}

		if (this.component) {
			this.component.$destroy();
		}
	}

	static findExistingView(app: App, novelId: string): EpubNovelReaderView | null {
		const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EPUB_READER);
		for (const leaf of leaves) {
			const view = leaf.view as EpubNovelReaderView;
			if (view?.novel?.id === novelId) {
				return view;
			}
		}
		return null;
	}

	private async initializeComponent(initialCfi: number | null = null) {
		if (!this.dataReady || !this.novel) {
			console.log("Data not ready yet");
			return;
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(this.novel.path);
		if (!(file instanceof TFile)) {
			throw new Error('File not found');
		}

		// 使用 ContentLoaderService 加载文件
		const arrayBuffer = await this.plugin.contentLoaderService.loadEpubContent(file);
		this.book = ePub() as unknown as EpubBook;
		await this.book.open(arrayBuffer);

		// 加载目录和其他数据
		await this.book.loaded.navigation;
		this.toc = this.book.navigation.toc;
		this.chapters = this.processNavItems(this.toc);

		console.log("Initializing EPUB component with novel:", this.novel.title);
		const container = this.contentEl;
		container.empty();

		// 获取上次阅读进度
		const progress = await this.libraryService.getProgress(this.novel.id);
		console.log("EpubView,Retrieved reading progress:", progress);

		let selectChapterId = progress?.position?.chapterId || 1;
		try {
			// 优先使用传入的章节ID
			this.currentSessionId = await this.plugin.dbService?.startReadingSession(
				this.novel.id, selectChapterId,
				this.chapters?.find(c => c.id === (progress?.position?.chapterId))?.title || 'Chapter 1'
			);
			console.log("Started new reading session:", selectChapterId, this.currentSessionId);
		} catch (error) {
			console.error("Failed to start reading session:", error);
		}

		// 加载历史记录
		const initialHistory = await this.plugin.chapterHistoryService.getHistory(this.novel.id);

		this.component = new (EpubReaderViewComponent as unknown as ComponentType)({
			target: container,
			props: {
				novel: this.novel,
				displayMode: this.plugin.settings.chapterDisplayMode,
				// 优先使用指定的章节ID，如果未指定则使用历史阅读进度
				initialChapterId: selectChapterId,
				savedProgress: progress,
				initialCfi: initialCfi,
				plugin: this.plugin,
				book: this.book,
				toc: this.toc,
				chapters: this.chapters,
				chapterHistory: initialHistory
			}
		});

		// 注册事件监听
		this.registerReadingEventListeners();
	}

	private registerReadingEventListeners() {
		if (!this.component) return;

		this.component.$on('startReading', async (event) => {
			if (this.novel) {
				console.log('Reading session started:', event.detail);
				this.currentSessionId = await this.plugin.dbService?.startReadingSession(
					this.novel.id,
					event.detail.chapterId,
					event.detail.chapterTitle
				);
			}
		});

		this.component.$on('endReading', async () => {
			if (this.currentSessionId) {
				//console.log('Reading session ended:', this.currentSessionId);
				await this.plugin.dbService?.endReadingSession(this.currentSessionId);
				this.currentSessionId = undefined;
			}
		});

		this.component.$on('saveProgress', async (event) => {
			if (this.novel) {
				try {
					await this.libraryService.updateProgress(this.novel.id, event.detail.progress);
				} catch (error) {
					console.error('Failed to save progress:', error);
				}
			}
		});

		this.component.$on('chapterChanged', async (event) => {
			if (this.novel) {
				console.log('Chapter changed:', event.detail);

				// 结束当前会话
				if (this.currentSessionId) {
					await this.plugin.dbService?.endReadingSession(this.currentSessionId);
				}
				// 开始新会话
				this.currentSessionId = await this.plugin.dbService?.startReadingSession(
					this.novel.id,
					event.detail.chapterId,
					event.detail.chapterTitle
				);

				// 记录章节历史
				try {
					await this.plugin.chapterHistoryService.addHistory(
						this.novel.id,
						event.detail.chapterId,
						event.detail.chapterTitle
					);

					// 刷新历史显示
					const newHistory = await this.plugin.chapterHistoryService.getHistory(this.novel.id);
					if (this.component) {
						this.component.$set({ chapterHistory: newHistory });
					}
				} catch (error) {
					console.error('Failed to record chapter history:', error);
				}

				this.app.workspace.trigger('novel-chapter-selected', event.detail.chapterId);
			}
		});
	}

	// 转换为章节，处理嵌套结构
	private processNavItems(items: EpubNavigationItem[], parentTitle: string = '', level: number = 0): EpubChapter[] {
		let chapters: EpubChapter[] = [];
		let index = 0;

		const processItem = (item: EpubNavigationItem, currentLevel: number, parentTitle: string) => {
			const title = item.label.trim();
			if (item.href) {
				index++;

				const chapter: EpubChapter = {
					id: index,
					title: currentLevel === 0 ? title : `${parentTitle} - ${title}`,
					content: '',
					index: index,
					isRead: false,
					href: item.href,
					spinePos: chapters.length,
					level: currentLevel,
					parent: currentLevel > 0 ? parentTitle : undefined,
					children: []
				};
				chapters.push(chapter);

				// 处理子项
				if (item.subitems && item.subitems.length > 0) {
					item.subitems.forEach(subitem => {
						processItem(subitem, currentLevel + 1, title);
					});
				}
			}
		};

		items.forEach(item => processItem(item, level, parentTitle));

		console.log('A2---' + JSON.stringify(chapters))
		return chapters;
	}
}
