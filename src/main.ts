import {Plugin, WorkspaceLeaf, TFile, Notice} from 'obsidian';
import {NovelLibraryView} from './views/novel-library-view';
import {DEFAULT_SETTINGS, type NovelSettings} from "./types/settings";
import {TxtNovelReaderView} from "./views/txt/txt-novel-reader-view";
import {NovelReaderSettingTab} from "./setting/settings-tab";
import {TxtNovelOutlineView} from "./views/txt/txt-novel-outline-view";
import {NovelStatsView} from "./views/novel-stats-view";
import {DatabaseService} from "./services/database-service";
import {ShelfService} from "./services/shelf-service";
import {LibraryService} from "./services/library-service";
import {NovelCompletedView} from "./views/novel-completed-view";
import {NovelCollectionView} from "./views/novel-collection-view";
import {CustomShelfService} from "./services/custom-shelf-service";
import {ChapterHistoryService} from "./services/chapter-history-service";
import {ChapterGridView} from "./views/txt/chapter-grid-view";
import {GlobalReadingStatsView} from "./views/global-reading-statistics-view";
import {GlobalNotesView} from "./views/note/global-notes-view";
import {PDFNovelReaderView} from "./views/pdf/pdf-novel-reader-view";
import {EpubNovelReaderView} from "./views/epub-novel-reader-view";
import {ContentLoaderService} from "./services/content-loader-service";
import {ObsidianCacheService} from "./services/obsidian-cache-service";
import {BookCoverManagerService} from "./services/book-cover-service";
import {
	VIEW_TYPE_LIBRARY, VIEW_TYPE_TXT_READER, VIEW_TYPE_EPUB_READER, VIEW_TYPE_PDF_READER
	, VIEW_TYPE_GLOBAL_NOTES, VIEW_TYPE_GLOBAL_STATS, VIEW_TYPE_TXT_CHAPTER_GRID, VIEW_TYPE_COLLECTION
	, VIEW_TYPE_COMPLETED, VIEW_TYPE_STATS, VIEW_TYPE_OUTLINE
} from "./types/constants";
import {FileService} from "./services/utils/file-service";
import {PathsService} from "./services/utils/paths-service";
import {CoverManagerService} from "./services/cover-manager-service";
import {NovelNoteService} from "./services/note/novel-note-service";
import {EpubCoverManager} from "./services/epub/epub-cover-manager-serivce";
import {PDFCoverManagerService} from "./services/pdf/pdf-cover-manager-service";
import {StatsStorageAdapter} from "./services/stats-adapter";
import {StatsMigrationService} from "./services/stats-migration";

export default class NovelReaderPlugin extends Plugin {
	settings!: NovelSettings;
	private libraryView!: NovelLibraryView;
	private outlineView: TxtNovelOutlineView | null = null;
	public dbService: DatabaseService | null = null;
	public libraryService!: LibraryService;
	public shelfService!: ShelfService;
	public customShelfService!: CustomShelfService;
	public chapterHistoryService!: ChapterHistoryService;
	public obsidianCacheService!: ObsidianCacheService;
	public contentLoaderService!: ContentLoaderService;
	public bookCoverManagerService!: BookCoverManagerService;
	public fileService!: FileService;
	public pathsService!: PathsService;
	public coverManagerService!: CoverManagerService
	public noteService!: NovelNoteService;
	public epubCoverManager!: EpubCoverManager;
	public pdfCoverManagerService!: PDFCoverManagerService;
	public statsAdapter!: StatsStorageAdapter;
	public migrationService!: StatsMigrationService;

	async onload() {
		try {
			await this.loadSettings();

			this.pathsService = new PathsService(this.app, this);
			this.fileService = new FileService(this.app, this);
			this.libraryService = new LibraryService(this.app, this);
			this.shelfService = new ShelfService(this.app, this);
			this.customShelfService = new CustomShelfService(this.app, this);
			this.chapterHistoryService = new ChapterHistoryService(this.app, this);
			this.obsidianCacheService = new ObsidianCacheService(this.app, this);
			this.contentLoaderService = new ContentLoaderService(this);
			this.coverManagerService = new CoverManagerService(this.app, this);
			this.noteService = new NovelNoteService(this.app, this);
			this.epubCoverManager = new EpubCoverManager(this.app, this);
			this.pdfCoverManagerService = new PDFCoverManagerService(this.app, this);
			this.bookCoverManagerService = new BookCoverManagerService(this.app, this);

			// 1. 确保必要的目录存在
			await this.ensureDirectories();

			// 2. 初始化数据库服务
			this.dbService = new DatabaseService(this.app, this);
			await this.dbService.waitForInitialization();

			// 3. 执行数据迁移
			await this.dbService.migrateExistingStats();

			console.log('Database service and migration initialized');

			// 4. 初始化增强统计系统
			this.statsAdapter = new StatsStorageAdapter(this.app, this);
			this.migrationService = new StatsMigrationService(this.app, this);

			// 根据设置启用新统计系统
			if (this.settings.useEnhancedStats) {
				await this.statsAdapter.initialize();

				// 启用新存储
				this.statsAdapter.enableNewStorage(true);

				// 根据设置启用双写模式
				if (this.settings.dualWriteStats) {
					this.statsAdapter.enableDualWrite(true);
					console.log('📊 增强统计系统已启用（双写模式）');
				} else {
					console.log('📊 增强统计系统已启用（仅新系统）');
				}

				// 检查是否需要数据迁移
				const needsMigration = await this.migrationService.needsMigration();
				if (needsMigration && this.settings.autoMigrateStats) {
					console.log('🔄 检测到需要数据迁移，开始自动迁移...');
					try {
						const result = await this.migrationService.migrate({
							createBackup: this.settings.backupBeforeMigration,
							validateSource: true,
							validateTarget: true,
							continueOnError: true,
							onProgress: (progress) => {
								console.log(`迁移进度: ${progress.percentage.toFixed(0)}% - ${progress.message}`);
							}
						});

						if (result.success) {
							new Notice(`✅ 数据迁移成功！共迁移 ${result.successCount} 本书`);
							console.log('✅ 数据迁移完成:', result);
						} else {
							new Notice(`⚠️ 数据迁移完成，但有 ${result.failedCount} 本书迁移失败`);
							console.warn('⚠️ 数据迁移部分失败:', result);
						}
					} catch (error) {
						console.error('❌ 数据迁移失败:', error);
						new Notice('数据迁移失败，将继续使用旧统计系统');
						// 迁移失败时禁用新系统，继续使用旧系统
						this.statsAdapter.enableNewStorage(false);
					}
				} else if (needsMigration) {
					console.log('ℹ️ 检测到旧数据，但自动迁移已禁用');
					new Notice('检测到旧统计数据，请在设置中手动启动迁移');
				}
			} else {
				console.log('📊 使用旧统计系统（Loki）');
			}

			// 5. 注册插件功能
			this.addSettingTab(new NovelReaderSettingTab(this.app, this));

			// 注册图书馆视图
			this.registerView(
				VIEW_TYPE_LIBRARY,
				(leaf: WorkspaceLeaf) => {
					this.libraryView = new NovelLibraryView(leaf, this);
					return this.libraryView;
				}
			);

			// 注册阅读视图
			this.registerView(
				VIEW_TYPE_TXT_READER,
				(leaf: WorkspaceLeaf) => new TxtNovelReaderView(leaf, this)
			);

			// 注册大纲视图
			this.registerView(
				VIEW_TYPE_OUTLINE,
				(leaf: WorkspaceLeaf) => {
					this.outlineView = new TxtNovelOutlineView(leaf, this);
					return this.outlineView;
				}
			);

			// 注册统计视图
			this.registerView(
				VIEW_TYPE_STATS,
				(leaf: WorkspaceLeaf) => new NovelStatsView(leaf, this)
			);

			// 注册已读完视图
			this.registerView(
				VIEW_TYPE_COMPLETED,
				(leaf: WorkspaceLeaf) => new NovelCompletedView(leaf, this)
			);

			// 注册藏书管理视图
			this.registerView(
				VIEW_TYPE_COLLECTION,
				(leaf: WorkspaceLeaf) => new NovelCollectionView(leaf, this)
			);

			this.registerView(
				VIEW_TYPE_TXT_CHAPTER_GRID,
				(leaf: WorkspaceLeaf) => {
					return new ChapterGridView(leaf, this);
				}
			);

			this.registerView(
				VIEW_TYPE_GLOBAL_STATS,
				(leaf: WorkspaceLeaf) => new GlobalReadingStatsView(leaf, this)
			);

			this.registerView(
				VIEW_TYPE_GLOBAL_NOTES,
				(leaf: WorkspaceLeaf) => new GlobalNotesView(leaf, this)
			);

			// PDF阅读视图
			this.registerView(
				VIEW_TYPE_PDF_READER,
				(leaf: WorkspaceLeaf) => new PDFNovelReaderView(leaf, this)
			);

			this.registerView(
				VIEW_TYPE_EPUB_READER,
				(leaf: WorkspaceLeaf) => new EpubNovelReaderView(leaf, this)
			);

			// 注册命令
			this.addCommands();

			// 添加图标
			this.addIcons();

			// 监听事件
			this.registerEvents();

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : '未知错误';
			console.error('Failed to load novel reader plugin:', error);
			new Notice(`初始化Novel Reader插件失败: ${errorMsg}`);
		}
	}

	private async ensureDirectories() {
		// 1、确保插件目录存在
		if (!(await this.app.vault.adapter.exists(this.settings.libraryPath))) {
			await this.app.vault.adapter.mkdir(this.settings.libraryPath);
		}

		// 2、确保封面目录存在
		if (!(await this.app.vault.adapter.exists(this.settings.coverPath))) {
			await this.app.vault.adapter.mkdir(this.settings.coverPath);
		}

		// 3、确保MD笔记目录存在
		if (!(await this.app.vault.adapter.exists(this.settings.notePath))) {
			await this.app.vault.adapter.mkdir(this.settings.notePath);
		}

		// 4、确保JSON笔记目录存在
		const notesDir = `${this.settings.libraryPath}/notes`;
		if (!(await this.app.vault.adapter.exists(notesDir))) {
			await this.app.vault.adapter.mkdir(notesDir);
		}

		// 5、确保统计目录存在
		if (!(await this.app.vault.adapter.exists(this.settings.statsPath))) {
			await this.app.vault.adapter.mkdir(this.settings.statsPath);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private addCommands() {
		this.addCommand({
			id: 'open-novel-library',
			name: '打开图书库',
			callback: () => this.activateLibraryView()
		});

		this.addCommand({
			id: 'toggle-novel-outline',
			name: '切换章节大纲',
			callback: () => this.toggleOutlineView()
		});

		this.addCommand({
			id: 'open-completed-view',
			name: '打开已读完视图',
			callback: () => this.activateCompletedView()
		});

		this.addCommand({
			id: 'open-collection-view',
			name: '打开藏书管理',
			callback: () => this.activateCollectionView()
		});

		this.addCommand({
			id: 'open-global-reading-stats',
			name: '打开全局阅读统计',
			callback: () => this.activateGlobalStatsView()
		});

		this.addCommand({
			id: 'open-global-notes',
			name: '打开笔记管理',
			callback: () => this.activateGlobalNotesView()
		});

		// 统计数据迁移命令
		this.addCommand({
			id: 'migrate-stats-data',
			name: '迁移统计数据到增强系统',
			callback: async () => {
				await this.migrateStatsData();
			}
		});
	}

	private addIcons() {
		// 添加图书库按钮到工具栏
		this.addRibbonIcon('book', '图书库', () =>
			this.activateLibraryView());

		this.addRibbonIcon('list-ordered', '章节大纲', () => {
			this.toggleOutlineView();
		});
	}

	// 监听章节选择事件
	private registerEvents() {
		this.registerEvent(
			this.app.workspace.on('novel-chapter-selected', (chapterId: number) => {
				this.handleChapterSelected(chapterId);
			})
		);

		// 监听文件变化
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				// 检查是否是支持的文件类型
				if (file instanceof TFile &&
					['txt', 'epub', 'pdf'].includes(file.extension.toLowerCase())) {
					this.handleFileModification(file);
				}
			})
		);

		// 删除文件事件
		this.registerEvent(
			this.app.metadataCache.on('deleted', (file) => {
				if (['txt', 'epub', 'pdf'].includes(file.extension.toLowerCase())) {
					this.handleFileDeletion(file);
				}
			})
		);
	}

	/**
	 * 通用视图激活方法（避免代码重复）
	 */
	private async activateView(viewType: string): Promise<void> {
		const {workspace} = this.app;
		let leaf = workspace.getLeavesOfType(viewType)[0];

		if (!leaf) {
			leaf = workspace.getLeaf('tab');
			await leaf.setViewState({
				type: viewType,
				active: true,
			});
		}

		await workspace.revealLeaf(leaf);
	}

	async activateLibraryView() {
		return this.activateView(VIEW_TYPE_LIBRARY);
	}

	async onunload() {
		console.log('Unloading Novel Reader plugin');

		// 关闭数据库连接
		if (this.dbService) {
			this.dbService.close();
		}

		// 清理所有视图
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_LIBRARY);
	}

	/**
	 * 切换章节大纲视图（优化版）
	 * - 添加状态提示
	 * - 改进用户反馈
	 * - 支持快捷键操作
	 */
	async toggleOutlineView() {
		try {
			const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_OUTLINE);

			if (existing.length) {
				// 如果已经打开，就关闭
				await Promise.all(existing.map(leaf => leaf.detach()));
				new Notice('已关闭章节大纲');
			} else {
				// 如果没有打开，就在右侧边栏打开
				const leaf = await this.app.workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_OUTLINE,
						active: true,
					});

					// 如果当前有打开的阅读器视图，重新触发其章节更新
					const readerLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TXT_READER);
					for (const readerLeaf of readerLeaves) {
						const readerView = readerLeaf.view as TxtNovelReaderView;
						if (readerView && readerView.component && readerView.novel && readerView.content) {
							// 强制重新渲染已打开的阅读器视图
							await readerView.setNovelData(readerView.novel, readerView.content);
						}
					}

					new Notice('已打开章节大纲');
				} else {
					new Notice('无法打开章节大纲：右侧边栏不可用');
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : '未知错误';
			console.error('Error toggling outline view:', error);
			new Notice(`切换章节大纲失败: ${errorMsg}`);
		}
	}

	private async handleChapterSelected(chapterId: number) {
		console.log(`handleChapterSelected--->${chapterId}`)
		// 在这里处理章节选择，通知阅读视图
		const readerLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TXT_READER);
		for (const leaf of readerLeaves) {
			const view = leaf.view as TxtNovelReaderView;
			if (view) {
				await view.setCurrentChapter(chapterId);
			}
		}

		// 在大纲视图中处理章节选择
		const outlineLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_OUTLINE);
		for (const leaf of outlineLeaves) {
			const view = leaf.view as TxtNovelOutlineView;
			if (view) {
				await view.updateChapter(chapterId);
			}
		}
	}

	// 激活已读完视图
	async activateCompletedView() {
		return this.activateView(VIEW_TYPE_COMPLETED);
	}

	// 激活藏书管理视图
	async activateCollectionView() {
		return this.activateView(VIEW_TYPE_COLLECTION);
	}

	// 添加激活统计视图的方法
	async activateGlobalStatsView() {
		return this.activateView(VIEW_TYPE_GLOBAL_STATS);
	}

	// 添加激活笔记视图的方法
	async activateGlobalNotesView() {
		return this.activateView(VIEW_TYPE_GLOBAL_NOTES);
	}

	private async handleFileModification(file: TFile) {
		try {
			await this.obsidianCacheService.clearFileCache(file.path);

			// 如果文件正在打开，重新加载内容
			const currentView = this.getCurrentView(file);
			if (currentView) {
				await this.reloadFileContent(file, currentView);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : '未知错误';
			console.error('Error handling file modification:', error);
			new Notice(`文件修改处理失败: ${errorMsg}`);
		}
	}

	private getCurrentView(file: TFile) {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TXT_READER);
		for (const leaf of leaves) {
			const view = leaf.view;
			if ((view instanceof TxtNovelReaderView ||
					view instanceof PDFNovelReaderView ||
					view instanceof EpubNovelReaderView) &&
				view.novel?.path === file.path) {
				return view;
			}
		}
		return null;
	}

	private async reloadFileContent(file: TFile, view: any) {
		if (!view.novel) return;

		try {
			const content = file.extension === 'txt'
				? await this.app.vault.read(file)
				: await this.app.vault.readBinary(file);

			await this.obsidianCacheService.setFileContent(file, content);

			if (view instanceof TxtNovelReaderView) {
				await view.setNovelData(view.novel, content as string);
			} else if (view instanceof EpubNovelReaderView ||
				view instanceof PDFNovelReaderView) {
				await view.setNovelData(view.novel);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : '未知错误';
			console.error('Error reloading file content:', error);
			new Notice(`文件内容重新加载失败: ${errorMsg}`);
		}
	}

	private async handleFileDeletion(file: TFile) {
		try {
			// 清除文件缓存
			await this.obsidianCacheService.clearFileCache(file.path);

			// 关闭相关视图
			const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TXT_READER);
			for (const leaf of leaves) {
				const view = leaf.view;
				if ((view instanceof TxtNovelReaderView ||
						view instanceof PDFNovelReaderView ||
						view instanceof EpubNovelReaderView) &&
					view.novel?.path === file.path) {
					leaf.detach();
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : '未知错误';
			console.error('Error handling file deletion:', error);
			new Notice(`文件删除处理失败: ${errorMsg}`);
		}
	}

	/**
	 * 手动迁移统计数据
	 */
	private async migrateStatsData() {
		try {
			// 检查是否已启用增强统计系统
			if (!this.settings.useEnhancedStats) {
				new Notice('请先在设置中启用增强统计系统');
				return;
			}

			// 检查是否需要迁移
			const needsMigration = await this.migrationService.needsMigration();
			if (!needsMigration) {
				new Notice('未检测到需要迁移的旧数据');
				return;
			}

			// 估算迁移时间
			const estimate = await this.migrationService.estimateMigrationTime();
			const estimatedMinutes = Math.ceil(estimate.estimatedTime / 60000);
			const dataSizeMB = (estimate.dataSize / 1024 / 1024).toFixed(2);

			// 显示确认对话框
			const confirmed = confirm(
				`即将迁移 ${estimate.novelCount} 本书的统计数据\n` +
				`数据大小: ${dataSizeMB} MB\n` +
				`预计耗时: ${estimatedMinutes} 分钟\n\n` +
				`迁移前会自动备份原数据。\n` +
				`是否继续？`
			);

			if (!confirmed) {
				new Notice('已取消迁移');
				return;
			}

			// 显示进度通知
			new Notice('开始迁移数据，请勿关闭Obsidian...');

			// 执行迁移
			const result = await this.migrationService.migrate({
				createBackup: true,
				validateSource: true,
				validateTarget: true,
				continueOnError: true,
				deleteOldData: false, // 手动迁移不自动删除旧数据
				onProgress: (progress) => {
					console.log(`迁移进度: ${progress.percentage.toFixed(0)}% - ${progress.message}`);
					if (progress.novelTitle) {
						console.log(`  当前处理: ${progress.novelTitle}`);
					}
				}
			});

			// 显示结果
			if (result.success) {
				const message = `✅ 数据迁移成功！\n` +
					`成功: ${result.successCount} 本\n` +
					`耗时: ${(result.duration / 1000).toFixed(1)} 秒\n` +
					`备份路径: ${result.backupPath}`;

				new Notice(message, 10000);
				console.log('✅ 迁移完成:', result);

				// 询问是否删除旧数据
				const deleteOld = confirm(
					'迁移成功！是否删除旧数据文件？\n\n' +
					'（建议先验证新数据无误后再删除）'
				);

				if (deleteOld) {
					try {
						const oldDbPath = '.obsidian/plugins/novel-reader/reading-stats.json';
						await this.app.vault.adapter.remove(oldDbPath);
						new Notice('✅ 旧数据已删除');
					} catch (error) {
						console.error('删除旧数据失败:', error);
						new Notice('删除旧数据失败，请手动删除');
					}
				}
			} else {
				const message = `⚠️ 数据迁移部分失败\n` +
					`成功: ${result.successCount} 本\n` +
					`失败: ${result.failedCount} 本\n` +
					`跳过: ${result.skippedCount} 本\n\n` +
					`详情请查看控制台日志`;

				new Notice(message, 15000);
				console.warn('⚠️ 迁移部分失败:', result);

				// 显示失败的书籍
				if (result.failedNovels.length > 0) {
					console.error('失败的书籍:');
					result.failedNovels.forEach(novel => {
						console.error(`  - ${novel.title}: ${novel.error}`);
					});
				}
			}

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : '未知错误';
			console.error('❌ 迁移失败:', error);
			new Notice(`迁移失败: ${errorMsg}`, 10000);
		}
	}


}
