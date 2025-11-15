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

export class TxtNovelReaderView extends ItemView {
	public component: TxtReaderViewComponent | null = null;
	public novel: Novel | null = null;
	public content: string | null = null;
	private dataReady = false;
	private plugin: NovelReaderPlugin;
	private chaptersUpdateHandler: (event: CustomEvent) => void;
	private libraryService: LibraryService;
	private currentSessionId: string | undefined;
	private chapterHistoryService: ChapterHistoryService;
	private readingProgressService: ReadingProgressService;

	constructor(leaf: WorkspaceLeaf, plugin: NovelReaderPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.libraryService = plugin.libraryService; // 使用plugin中已有的实例
		this.chapterHistoryService = new ChapterHistoryService(this.app, plugin);
		this.readingProgressService = new ReadingProgressService(this.app, plugin);

		// 章节更新Handler
		this.chaptersUpdateHandler = async (event: CustomEvent) => {
			const outlineView = this.app.workspace.getLeavesOfType(VIEW_TYPE_OUTLINE)[0]?.view as TxtNovelOutlineView;
			if (outlineView) {
				await outlineView.setNovelData(this.novel, event.detail.chapters);
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
				initialChapterId: options?.initialChapterId // 初始章节ID
			}
		});

		if (this.contentEl) {
			console.log("Initializing reader component");
			await this.initializeComponent(options?.initialChapterId, options?.chapters);
		}
	}

	private async initializeComponent(initialChapterId: number | null = null,
									  chapters?: ChapterProgress[]) {
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

	async onOpen() {
		console.log("[onOpen]TxtNovelReaderView onOpen");
		if (this.novel) {
			// 确保打开时也设置正确的标题
			await this.leaf.setViewState({type: VIEW_TYPE_TXT_READER, state: {title: this.novel.title}});
		}

		if (this.dataReady) {
			await this.initializeComponent();
		}
		// 添加章节更新事件监听
		window.addEventListener('chaptersUpdated', this.chaptersUpdateHandler as EventListener);
	}

	async onClose() {
		if (this.currentSessionId) {
			// 结束阅读会话
			await this.plugin.dbService?.endReadingSession(this.currentSessionId);
			this.currentSessionId = undefined;
		}

		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}

		// 移除事件监听
		window.removeEventListener('chaptersUpdated',
			this.chaptersUpdateHandler as EventListener);
	}

	async setCurrentChapter(chapterId: number) {
		if (this.component) {
			this.component.$set({
				currentChapterId: chapterId
			});

			// 触发大纲视图的更新
			const outlineView = this.app.workspace.getLeavesOfType(VIEW_TYPE_OUTLINE)[0]?.view as TxtNovelOutlineView;
			if (outlineView) {
				await outlineView.updateChapter(chapterId);
			}
		}
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

				// ❌ 删除全局事件触发，避免影响其他打开的书籍
				// 键盘切换章节时不需要通知其他视图，只有outline点击时才需要
				// this.app.workspace.trigger('novel-chapter-selected', event.detail.chapterId);
			}
		});

		// 监听进度保存事件（使用组件事件而不是全局window事件）
		this.component.$on('saveProgress', async (event) => {
			if (this.novel) {
				console.log('TxtView,监听"saveProgress"---', JSON.stringify(event.detail?.progress));
				try {
					await this.libraryService.updateProgress(this.novel.id, event.detail.progress);
				} catch (error) {
					console.error('Failed to save progress:', error);
				}
			}
		});
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
