import {type App, ItemView, Notice, WorkspaceLeaf} from 'obsidian';
import type {Novel, ReadingProgress} from '../../types';
import TxtReaderViewComponent from "../../components/txt/TxtReaderViewComponent.svelte";
import type NovelReaderPlugin from "../../main";
import {TxtNovelOutlineView} from "./txt-novel-outline-view";
import {VIEW_TYPE_OUTLINE, VIEW_TYPE_TXT_READER} from "../../types/constants";
import {LibraryService} from '../../services/library-service';
import type {ComponentType} from "svelte";
import {ChapterHistoryService} from "../../services/chapter-history-service";
import type {ChapterProgress} from "../../types/txt/txt-reader";
import {parseChapters} from "../../lib/txt.reader/chapter-logic";
import type {CustomProgressEvent} from "../../types/read-progress";
import {ReadingProgressService} from "../../services/progress/reading-progress-service";

interface ChaptersUpdatedEvent extends CustomEvent {
	detail: {
		chapters: ChapterProgress[];
	};
}

export class TxtNovelReaderView extends ItemView {
	public component: TxtReaderViewComponent | null = null;
	public novel: Novel | null = null;
	public content: string | null = null;
	private dataReady = false;
	private plugin: NovelReaderPlugin;
	private chaptersUpdateHandler: (event: Event) => void;
	private libraryService: LibraryService;
	private currentSessionId: string | undefined;
	private chapterHistoryService: ChapterHistoryService;
	private readingProgressService: ReadingProgressService;
	private eventUnsubscribers: Array<() => void> = [];

	constructor(leaf: WorkspaceLeaf, plugin: NovelReaderPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.libraryService = plugin.libraryService;
		this.chapterHistoryService = plugin.chapterHistoryService;
		this.readingProgressService = new ReadingProgressService(this.app, plugin);

		this.chaptersUpdateHandler = async (event: Event) => {
			const customEvent = event as ChaptersUpdatedEvent;
			const outlineView = this.app.workspace.getLeavesOfType(VIEW_TYPE_OUTLINE)[0]?.view as TxtNovelOutlineView;
			if (outlineView && this.novel) {
				await outlineView.setNovelData(this.novel, customEvent.detail.chapters);
			}
		};
	}

	getViewType(): string {
		return VIEW_TYPE_TXT_READER;
	}

	getDisplayText(): string {
		return this.novel?.title || "TXT阅读";
	}

	async setNovelData(novel: Novel, content: string, options?: {
		initialChapterId?: number,
		initialNoteId?: string,
		chapters?: ChapterProgress[]
	}) {
		this.novel = novel;
		this.content = content;
		this.dataReady = true;

		console.log("Setting novel data:", novel.title, "initial chapter:", options?.initialChapterId);

		//更新标题
		await this.leaf.setViewState({
			type: VIEW_TYPE_TXT_READER,
			state: {
				title: novel.title,
				initialChapterId: options?.initialChapterId, // 初始章节ID
				initialNoteId: options?.initialNoteId
			}
		});

		if (this.contentEl) {
			console.log("Initializing reader component");
			await this.initializeComponent(options?.initialChapterId, options?.chapters, options?.initialNoteId);
		}
	}

	private async initializeComponent(initialChapterId: number | null = null,
									  chapters?: ChapterProgress[],
									  initialNoteId?: string) {
		if (!this.dataReady || !this.novel || !this.content) {
			console.log("Data not ready yet");
			return;
		}

		const container = this.contentEl;
		container.empty();

		console.log("Initializing component with novel:", this.novel.title, initialChapterId);

		// 获取上次阅读进度
		const progress = await this.libraryService.getProgress(this.novel.id);
		console.log("TxtView,Retrieved reading progress:", progress);

		//TXT章节-阅读进度
		let txtChapterProgress = parseChapters(this.content, this.novel);

		//获取阅读章节
		let selectChapterId = await this.readingProgressService.getReadingChapterId(this.novel,txtChapterProgress, initialChapterId, this.currentSessionId);

		this.component = new (TxtReaderViewComponent as ComponentType)({
			target: container,
			props: {
				novel: this.novel,
				content: this.content,
				displayMode: this.plugin.settings.chapterDisplayMode,
				initialChapterId: selectChapterId, // 优先使用指定的章节ID，如果未指定则使用历史阅读进度
				initialNoteId,
				savedProgress: initialChapterId != null ? initialChapterId : progress,
				chapterHistoryService: this.chapterHistoryService,
				chapters: txtChapterProgress,
				plugin: this.plugin,
			}
		});

		// 注册阅读事件监听
		this.registerReadingEventListeners();

		// 如果设置为侧边栏模式——>自动打开大纲视图
		if (this.plugin.settings.chapterDisplayMode === 'sidebar') {
			const outlineLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_OUTLINE)[0];
			if (!outlineLeaf) {
				await this.app.workspace.getRightLeaf(false)?.setViewState({
					type: VIEW_TYPE_OUTLINE,
					active: true,
				});
			}
		}
	}

	async onOpen(): Promise<void> {
		console.log("[onOpen]TxtNovelReaderView onOpen");
		
		if (this.novel) {
			await this.leaf.setViewState({
				type: VIEW_TYPE_TXT_READER, 
				state: { title: this.novel.title }
			});
		}

		if (this.dataReady) {
			await this.initializeComponent();
		}

		window.addEventListener('chaptersUpdated', this.chaptersUpdateHandler);
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

		window.removeEventListener('chaptersUpdated', this.chaptersUpdateHandler);

		// 再销毁组件
		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}
	}

	async setCurrentChapter(chapterId: number): Promise<void> {
		if (!this.component) return;

		this.component.$set({ currentChapterId: chapterId });

		const outlineView = this.app.workspace.getLeavesOfType(VIEW_TYPE_OUTLINE)[0]?.view as TxtNovelOutlineView;
		if (outlineView) {
			await outlineView.updateChapter(chapterId);
		}
	}

	private registerReadingEventListeners(): void {
		if (!this.component) return;

		const startReadingHandler = async (event: CustomEvent) => {
			if (this.novel) {
				console.log('Reading session started:', event.detail);
				this.currentSessionId = await this.plugin.statsService?.startReadingSession(
					this.novel.id,
					event.detail.chapterId,
					event.detail.chapterTitle
				);
			}
		};

		const endReadingHandler = async () => {
			if (this.currentSessionId) {
				await this.plugin.statsService?.endReadingSession(this.currentSessionId);
				this.currentSessionId = undefined;
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
		};

		const saveProgressHandler = async (event: CustomEvent) => {
			if (!this.novel) return;

			console.log('TxtView,监听"saveProgress"---', JSON.stringify(event.detail?.progress));
			try {
				await this.libraryService.updateProgress(this.novel.id, event.detail.progress);
			} catch (error) {
				console.error('Failed to save progress:', error);
			}
		};

		// 使用 $on 的返回值来取消订阅（更安全）
		const unsubStartReading = this.component.$on('startReading', startReadingHandler);
		const unsubEndReading = this.component.$on('endReading', endReadingHandler);
		const unsubChapterChanged = this.component.$on('chapterChanged', chapterChangedHandler);
		const unsubSaveProgress = this.component.$on('saveProgress', saveProgressHandler);

		this.eventUnsubscribers.push(
			unsubStartReading,
			unsubEndReading,
			unsubChapterChanged,
			unsubSaveProgress
		);
	}

	// 查找已存在的阅读视图
	static findExistingView(app: App, novelId: string): TxtNovelReaderView | null {
		const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_TXT_READER);
		for (const leaf of leaves) {
			const view = leaf.view as TxtNovelReaderView;
			if (view?.novel?.id === novelId) {
				return view;
			}
		}
		return null;
	}

}
