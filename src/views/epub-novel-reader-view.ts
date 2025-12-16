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
	private toc: EpubNavigationItem[] = [];
	private chapters: EpubChapter[] = [];
	private eventUnsubscribers: Array<() => void> = [];

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
		this.libraryService = plugin.libraryService;
		this.noteService = plugin.noteService;
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
		console.log('[EpubView] setNovelData, saved progress:', progress);

		await this.leaf.setViewState({
			type: VIEW_TYPE_EPUB_READER,
			state: {
				title: novel.title,
				initialCfi: progress?.position?.cfi
			}
		});

		if (this.contentEl) {
			// 传递章节ID和CFI
			await this.initializeComponent(
				progress?.position?.chapterId || null,
				progress?.position?.cfi || null
			);
		}
	}

	async onClose(): Promise<void> {
		if (this.currentSessionId) {
			await this.plugin.statsService?.endReadingSession(this.currentSessionId);
			this.currentSessionId = undefined;
		}

		// 先取消事件订阅（在组件销毁前）
		if (this.component) {
			this.eventUnsubscribers.forEach(unsub => {
				try {
					unsub();
				} catch (error) {
					console.error('Error unsubscribing event:', error);
				}
			});
			this.eventUnsubscribers = [];
		}

		// 再销毁组件
		if (this.component) {
			this.component.$destroy();
			this.component = null;
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

	private async initializeComponent(initialChapterId: number | null = null, initialCfi: string | null = null) {
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
		console.log("[EpubView] Initialization params - chapterId:", initialChapterId, "cfi:", initialCfi);
		const container = this.contentEl;
		container.empty();

		// 获取上次阅读进度（如果没有传入参数，则从存储中获取）
		const progress = await this.libraryService.getProgress(this.novel.id);
		console.log("EpubView,Retrieved reading progress:", progress);

		// 优先使用传入的章节ID，如果没有则使用进度中的章节ID
		let selectChapterId = initialChapterId || progress?.position?.chapterId || 1;
		let selectCfi = initialCfi || progress?.position?.cfi || null;
		try {
			// 优先使用传入的章节ID
			this.currentSessionId = await this.plugin.statsService?.startReadingSession(
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
				initialCfi: selectCfi,  // 使用selectCfi而不是initialCfi参数
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

	private registerReadingEventListeners(): void {
		if (!this.component) return;

		const startReadingHandler = async (event: CustomEvent) => {
			if (!this.novel) return;

			console.log('Reading session started:', event.detail);
			this.currentSessionId = await this.plugin.statsService?.startReadingSession(
				this.novel.id,
				event.detail.chapterId,
				event.detail.chapterTitle
			);
		};

		const endReadingHandler = async () => {
			if (this.currentSessionId) {
				await this.plugin.statsService?.endReadingSession(this.currentSessionId);
				this.currentSessionId = undefined;
			}
		};

		const saveProgressHandler = async (event: CustomEvent) => {
			if (!this.novel) return;

			try {
				await this.libraryService.updateProgress(this.novel.id, event.detail.progress);
			} catch (error) {
				console.error('Failed to save progress:', error);
			}
		};

		const chapterChangedHandler = async (event: CustomEvent) => {
			if (!this.novel) return;

			console.log('Chapter changed:', event.detail);

			if (this.currentSessionId) {
				await this.plugin.statsService?.endReadingSession(this.currentSessionId);
			}

			this.currentSessionId = await this.plugin.statsService?.startReadingSession(
				this.novel.id,
				event.detail.chapterId,
				event.detail.chapterTitle
			);

			try {
				await this.plugin.chapterHistoryService.addHistory(
					this.novel.id,
					event.detail.chapterId,
					event.detail.chapterTitle
				);

				const newHistory = await this.plugin.chapterHistoryService.getHistory(this.novel.id);
				if (this.component) {
					this.component.$set({ chapterHistory: newHistory });
				}
			} catch (error) {
				console.error('Failed to record chapter history:', error);
			}

			this.app.workspace.trigger('novel-chapter-selected', event.detail.chapterId);
		};

		// 使用 $on 的返回值来取消订阅（更安全）
		const unsubStartReading = this.component.$on('startReading', startReadingHandler);
		const unsubEndReading = this.component.$on('endReading', endReadingHandler);
		const unsubSaveProgress = this.component.$on('saveProgress', saveProgressHandler);
		const unsubChapterChanged = this.component.$on('chapterChanged', chapterChangedHandler);

		this.eventUnsubscribers.push(
			unsubStartReading,
			unsubEndReading,
			unsubSaveProgress,
			unsubChapterChanged
		);
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
