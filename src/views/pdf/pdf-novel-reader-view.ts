import {ItemView, WorkspaceLeaf, App} from 'obsidian';
import type {Novel, ReadingProgress} from '../../types';
import type NovelReaderPlugin from '../../main';
import {VIEW_TYPE_PDF_READER} from '../../types/constants';
import type {ComponentType} from 'svelte';
import {LibraryService} from '../../services/library-service';
import PDFReaderViewComponent from "../../components/pdf/PDFReaderViewComponent.svelte";

interface ProgressEventDetail {
	progress: ReadingProgress;
}

interface CustomProgressEvent extends CustomEvent<ProgressEventDetail> {
	detail: ProgressEventDetail;
}

export class PDFNovelReaderView extends ItemView {
	public component: PDFReaderViewComponent | null = null;
	public novel: Novel | null = null;
	private dataReady = false;
	private currentSessionId: string | undefined;
	private libraryService: LibraryService;
	private eventUnsubscribers: Array<() => void> = [];

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
		this.libraryService = plugin.libraryService;
	}

	getViewType(): string {
		return VIEW_TYPE_PDF_READER;
	}

	getDisplayText(): string {
		return this.novel?.title || "PDF Reader";
	}

	async setNovelData(novel: Novel, options?: { initialPage?: number; initialNoteId?: string }) {
		this.novel = novel;
		this.dataReady = true;

		await this.leaf.setViewState({
			type: VIEW_TYPE_PDF_READER,
			state: {
				title: novel.title,
				initialPage: options?.initialPage,
				initialNoteId: options?.initialNoteId
			}
		});

		if (this.contentEl) {
			await this.initializeComponent(options?.initialPage, options?.initialNoteId);
		}
	}

	private async initializeComponent(initialPage: number | null = null, initialNoteId?: string) {
		if (!this.dataReady || !this.novel) {
			console.log("Data not ready yet");
			return;
		}

		console.log("Initializing PDF component with novel:", this.novel.title);
		const container = this.contentEl;
		container.empty();

		// 获取上次阅读进度
		const progress = await this.libraryService.getProgress(this.novel.id);
		console.log("Retrieved reading progress:", progress);

		let selectPage = initialPage || progress?.position?.page || 1;
		console.log("Selected page:", selectPage);

		try {
			// 开始新的阅读会话
			this.currentSessionId = await this.plugin.statsService?.startReadingSession(
				this.novel.id,
				selectPage,
				`Page ${selectPage}`
			);
			console.log("Started new reading session:", this.currentSessionId);
		} catch (error) {
			console.error("Failed to start reading session:", error);
		}

		// 加载历史记录
		const initialHistory = await this.plugin.chapterHistoryService.getHistory(this.novel.id);

		this.component = new (PDFReaderViewComponent as ComponentType)({
			target: container,
			props: {
				novel: this.novel,
				displayMode: this.plugin.settings.chapterDisplayMode,
				initialPage: selectPage,
				initialNoteId,
				plugin: this.plugin,
				chapterHistory: initialHistory
			}
		});

		// 注册阅读事件监听
		this.registerReadingEventListeners();
	}

	private registerReadingEventListeners(): void {
		if (!this.component) return;

		const startReadingHandler = async (event: CustomEvent) => {
			if (!this.novel) return;

			console.log('Reading session started:', event.detail);
			this.currentSessionId = await this.plugin.statsService?.startReadingSession(
				this.novel.id,
				event.detail.pageNum,
				`Page ${event.detail.pageNum}`
			);
		};

		const endReadingHandler = async () => {
			if (this.currentSessionId) {
				await this.plugin.statsService?.endReadingSession(this.currentSessionId);
				this.currentSessionId = undefined;
			}
		};

		const pageChangedHandler = async (event: CustomEvent) => {
			if (!this.novel) return;

			console.log('Page changed:', event.detail);

			try {
				await this.plugin.chapterHistoryService.addHistory(
					this.novel.id,
					event.detail.pageNum,
					`第 ${event.detail.pageNum} 页`
				);

				const newHistory = await this.plugin.chapterHistoryService.getHistory(this.novel.id);
				if (this.component) {
					this.component.$set({ chapterHistory: newHistory });
				}
			} catch (error) {
				console.error('Failed to record page history:', error);
			}

			try {
				if (this.currentSessionId) {
					await this.plugin.statsService?.endReadingSession(this.currentSessionId);
				}

				this.currentSessionId = await this.plugin.statsService?.startReadingSession(
					this.novel.id,
					event.detail.pageNum,
					`Page ${event.detail.pageNum}`
				);
			} catch (error) {
				console.error('Failed to manage reading session:', error);
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

		// 使用 $on 的返回值来取消订阅（更安全）
		const unsubStartReading = this.component.$on('startReading', startReadingHandler);
		const unsubEndReading = this.component.$on('endReading', endReadingHandler);
		const unsubPageChanged = this.component.$on('pageChanged', pageChangedHandler);
		const unsubSaveProgress = this.component.$on('saveProgress', saveProgressHandler);

		this.eventUnsubscribers.push(
			unsubStartReading,
			unsubEndReading,
			unsubPageChanged,
			unsubSaveProgress
		);
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

	// 查找已存在的PDF阅读视图
	static findExistingView(app: App, novelId: string): PDFNovelReaderView | null {
		const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_PDF_READER);
		for (const leaf of leaves) {
			const view = leaf.view as PDFNovelReaderView;
			if (view?.novel?.id === novelId) {
				return view;
			}
		}
		return null;
	}
}
