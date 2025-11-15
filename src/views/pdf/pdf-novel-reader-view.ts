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
	private progressHandler: ((event: Event) => Promise<void>) | null = null;
	private libraryService: LibraryService;

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
		this.libraryService = plugin.libraryService; // 使用plugin中已有的实例

		// 添加进度保存事件处理器
		this.progressHandler = async (event: Event) => {
			const progressEvent = event as CustomProgressEvent;
			if (this.novel && progressEvent.detail?.progress) {
				await this.libraryService.updateProgress(this.novel.id, progressEvent.detail.progress);
			}
		};
		window.addEventListener('saveProgress', this.progressHandler as EventListener);
	}

	getViewType(): string {
		return VIEW_TYPE_PDF_READER;
	}

	getDisplayText(): string {
		return this.novel?.title || "PDF Reader";
	}

	async setNovelData(novel: Novel, options?: { initialPage?: number }) {
		this.novel = novel;
		this.dataReady = true;

		await this.leaf.setViewState({
			type: VIEW_TYPE_PDF_READER,
			state: {
				title: novel.title,
				initialPage: options?.initialPage
			}
		});

		if (this.contentEl) {
			await this.initializeComponent(options?.initialPage);
		}
	}

	private async initializeComponent(initialPage: number | null = null) {
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
			this.currentSessionId = await this.plugin.dbService?.startReadingSession(
				this.novel.id,
				selectPage,
				`Page ${selectPage}`
			);
			console.log("Started new reading session:", this.currentSessionId);
		} catch (error) {
			console.error("Failed to start reading session:", error);
		}

		this.component = new (PDFReaderViewComponent as ComponentType)({
			target: container,
			props: {
				novel: this.novel,
				displayMode: this.plugin.settings.chapterDisplayMode,
				initialPage: selectPage,
				plugin: this.plugin
			}
		});

		// 注册阅读事件监听
		this.registerReadingEventListeners();
	}

	private registerReadingEventListeners() {
		if (!this.component) return;

		this.component.$on('startReading', async (event) => {
			if (this.novel) {
				console.log('Reading session started:', event.detail);
				this.currentSessionId = await this.plugin.dbService?.startReadingSession(
					this.novel.id,
					event.detail.pageNum,
					`Page ${event.detail.pageNum}`
				);
			}
		});

		this.component.$on('endReading', async () => {
			if (this.currentSessionId) {
				await this.plugin.dbService?.endReadingSession(this.currentSessionId);
				this.currentSessionId = undefined;
			}
		});

		this.component.$on('pageChanged', async (event) => {
			if (this.novel) {
				console.log('Page changed:', event.detail);

				// 记录页码历史（优先执行，不依赖session）
				try {
					await this.plugin.chapterHistoryService.addHistory(
						this.novel.id,
						event.detail.pageNum,
						`第 ${event.detail.pageNum} 页`
					);

					// 刷新历史显示
					const newHistory = await this.plugin.chapterHistoryService.getHistory(this.novel.id);
					if (this.component) {
						this.component.$set({ chapterHistory: newHistory });
					}
				} catch (error) {
					console.error('Failed to record page history:', error);
				}

				// 结束当前会话（放在try-catch中，避免阻塞）
				try {
					if (this.currentSessionId) {
						await this.plugin.dbService?.endReadingSession(this.currentSessionId);
					}
					// 开始新会话
					this.currentSessionId = await this.plugin.dbService?.startReadingSession(
						this.novel.id,
						event.detail.pageNum,
						`Page ${event.detail.pageNum}`
					);
				} catch (error) {
					console.error('Failed to manage reading session:', error);
				}
			}
		});
	}

	async onClose() {
		if (this.currentSessionId) {
			await this.plugin.dbService?.endReadingSession(this.currentSessionId);
			this.currentSessionId = undefined;
		}

		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}

		if (this.progressHandler) {
			window.removeEventListener('saveProgress', this.progressHandler as EventListener);
			this.progressHandler = null;
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
