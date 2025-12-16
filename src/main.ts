import { Plugin, WorkspaceLeaf, TFile, Notice, type ItemView, type EventRef } from 'obsidian';
import { NovelLibraryView } from './views/novel-library-view';
import { DEFAULT_SETTINGS, type NovelSettings } from './types/settings';
import { TxtNovelReaderView } from './views/txt/txt-novel-reader-view';
import { NovelReaderSettingTab } from './setting/settings-tab';
import { TxtNovelOutlineView } from './views/txt/txt-novel-outline-view';
import { NovelStatsView } from './views/novel-stats-view';
import { StatsService } from './services/stats-service';
import { ShelfService } from './services/shelf-service';
import { LibraryService } from './services/library-service';
import { NovelCompletedView } from './views/novel-completed-view';
import { NovelCollectionView } from './views/novel-collection-view';
import { CustomShelfService } from './services/custom-shelf-service';
import { ChapterHistoryService } from './services/chapter-history-service';
import { ChapterGridView } from './views/txt/chapter-grid-view';
import { GlobalReadingStatsView } from './views/global-reading-statistics-view';
import { GlobalNotesView } from './views/note/global-notes-view';
import { PDFNovelReaderView } from './views/pdf/pdf-novel-reader-view';
import { EpubNovelReaderView } from './views/epub-novel-reader-view';
import { ContentLoaderService } from './services/content-loader-service';
import { ObsidianCacheService } from './services/obsidian-cache-service';
import { BookCoverManagerService } from './services/book-cover-service';
import {
  VIEW_TYPE_LIBRARY,
  VIEW_TYPE_TXT_READER,
  VIEW_TYPE_EPUB_READER,
  VIEW_TYPE_PDF_READER,
  VIEW_TYPE_MOBI_READER,
  VIEW_TYPE_GLOBAL_NOTES,
  VIEW_TYPE_GLOBAL_STATS,
  VIEW_TYPE_TXT_CHAPTER_GRID,
  VIEW_TYPE_COLLECTION,
  VIEW_TYPE_COMPLETED,
  VIEW_TYPE_STATS,
  VIEW_TYPE_OUTLINE,
} from './types/constants';
import { FileService } from './services/utils/file-service';
import { PathsService } from './services/utils/paths-service';
import { CoverManagerService } from './services/cover-manager-service';
import { NovelNoteService } from './services/note/novel-note-service';
import { EpubCoverManager } from './services/epub/epub-cover-manager-serivce';
import { PDFCoverManagerService } from './services/pdf/pdf-cover-manager-service';
import { BookmarkService } from './services/bookmark-service';
import { MobiCoverManagerService } from './services/mobi/mobi-cover-manager-service';


import { MobiNovelReaderView } from './views/mobi/mobi-novel-reader-view';

type NovelReaderView = TxtNovelReaderView | EpubNovelReaderView | PDFNovelReaderView | MobiNovelReaderView;

interface ServiceInitResult {
  success: boolean;
  service: string;
  error?: Error;
}

export default class NovelReaderPlugin extends Plugin {
  settings!: NovelSettings;
  private libraryView!: NovelLibraryView;
  private outlineView: TxtNovelOutlineView | null = null;
  private eventRefs: EventRef[] = [];

  public statsService!: StatsService;
  public libraryService!: LibraryService;
  public shelfService!: ShelfService;
  public customShelfService!: CustomShelfService;
  public chapterHistoryService!: ChapterHistoryService;
  public obsidianCacheService!: ObsidianCacheService;
  public contentLoaderService!: ContentLoaderService;
  public bookCoverManagerService!: BookCoverManagerService;
  public fileService!: FileService;
  public pathsService!: PathsService;
  public coverManagerService!: CoverManagerService;
  public noteService!: NovelNoteService;
  public epubCoverManager!: EpubCoverManager;
  public pdfCoverManagerService!: PDFCoverManagerService;
  public mobiCoverManagerService!: MobiCoverManagerService;
  public bookmarkService!: BookmarkService;

  async onload(): Promise<void> {
    try {
      await this.loadSettings();
      await this.initializeServices();
      await this.ensureDirectories();
      await this.initializeStatsService();

      this.registerPluginFeatures();
      this.registerWorkspaceEvents();

      console.log('✅ Novel Reader Plugin loaded successfully');
    } catch (error) {
      this.handleLoadError(error);
    }
  }

  private async initializeServices(): Promise<void> {
    const services: Array<{ name: string; init: () => void }> = [
      { name: 'PathsService', init: () => { this.pathsService = new PathsService(this.app, this); } },
      { name: 'FileService', init: () => { this.fileService = new FileService(this.app, this); } },
      { name: 'LibraryService', init: () => { this.libraryService = new LibraryService(this.app, this); } },
      { name: 'ShelfService', init: () => { this.shelfService = new ShelfService(this.app, this); } },
      { name: 'CustomShelfService', init: () => { this.customShelfService = new CustomShelfService(this.app, this); } },
      { name: 'ChapterHistoryService', init: () => { this.chapterHistoryService = new ChapterHistoryService(this.app, this); } },
      { name: 'ObsidianCacheService', init: () => { this.obsidianCacheService = new ObsidianCacheService(this.app, this); } },
      { name: 'ContentLoaderService', init: () => { this.contentLoaderService = new ContentLoaderService(this); } },
      { name: 'CoverManagerService', init: () => { this.coverManagerService = new CoverManagerService(this.app, this); } },
      { name: 'NovelNoteService', init: () => { this.noteService = new NovelNoteService(this.app, this); } },
      { name: 'EpubCoverManager', init: () => { this.epubCoverManager = new EpubCoverManager(this.app, this); } },
      { name: 'PDFCoverManagerService', init: () => { this.pdfCoverManagerService = new PDFCoverManagerService(this.app, this); } },
      { name: 'MobiCoverManagerService', init: () => { this.mobiCoverManagerService = new MobiCoverManagerService(this.app, this); } },
      { name: 'BookCoverManagerService', init: () => { this.bookCoverManagerService = new BookCoverManagerService(this.app, this); } },
      { name: 'BookmarkService', init: () => { this.bookmarkService = new BookmarkService(this.app, this); } },
    ];

    const results: ServiceInitResult[] = [];

    for (const { name, init } of services) {
      try {
        init();
        results.push({ success: true, service: name });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        results.push({ success: false, service: name, error: err });
        console.error(`❌ Failed to initialize ${name}:`, err);
      }
    }

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      throw new Error(`Failed to initialize ${failed.length} service(s): ${failed.map(f => f.service).join(', ')}`);
    }
  }

  private async initializeStatsService(): Promise<void> {
    this.statsService = new StatsService(this.app, this);
    await this.statsService.initialize();
    console.log('✅ Stats service initialized');

    // 初始化书签服务
    await this.bookmarkService.initialize();
    console.log('✅ Bookmark service initialized');
  }

  private registerPluginFeatures(): void {
    this.addSettingTab(new NovelReaderSettingTab(this.app, this));
    this.registerAllViews();
    this.addCommands();
    this.addIcons();
  }

  private registerAllViews(): void {
    const viewFactories: Record<string, (leaf: WorkspaceLeaf) => ItemView> = {
      [VIEW_TYPE_LIBRARY]: (leaf) => {
        this.libraryView = new NovelLibraryView(leaf, this);
        return this.libraryView;
      },
      [VIEW_TYPE_TXT_READER]: (leaf) => new TxtNovelReaderView(leaf, this),
      [VIEW_TYPE_OUTLINE]: (leaf) => {
        this.outlineView = new TxtNovelOutlineView(leaf, this);
        return this.outlineView;
      },
      [VIEW_TYPE_STATS]: (leaf) => new NovelStatsView(leaf, this),
      [VIEW_TYPE_COMPLETED]: (leaf) => new NovelCompletedView(leaf, this),
      [VIEW_TYPE_COLLECTION]: (leaf) => new NovelCollectionView(leaf, this),
      [VIEW_TYPE_TXT_CHAPTER_GRID]: (leaf) => new ChapterGridView(leaf, this),
      [VIEW_TYPE_GLOBAL_STATS]: (leaf) => new GlobalReadingStatsView(leaf, this),
      [VIEW_TYPE_GLOBAL_NOTES]: (leaf) => new GlobalNotesView(leaf, this),
      [VIEW_TYPE_PDF_READER]: (leaf) => new PDFNovelReaderView(leaf, this),
      [VIEW_TYPE_EPUB_READER]: (leaf) => new EpubNovelReaderView(leaf, this),
      [VIEW_TYPE_MOBI_READER]: (leaf) => new MobiNovelReaderView(leaf, this),
    };

    Object.entries(viewFactories).forEach(([type, factory]) => {
      this.registerView(type, factory);
    });
  }

  private handleLoadError(error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to load Novel Reader plugin:', error);
    new Notice(`初始化Novel Reader插件失败: ${errorMsg}`);
  }

  private async ensureDirectories(): Promise<void> {
    const directories = [
      this.settings.libraryPath,
      this.settings.coverPath,
      this.settings.notePath,
      `${this.settings.libraryPath}/notes`,
      this.settings.statsPath,
    ];

    await Promise.all(
      directories.map(async (dir) => {
        if (!(await this.app.vault.adapter.exists(dir))) {
          await this.app.vault.adapter.mkdir(dir);
        }
      })
    );
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
      callback: () => this.activateLibraryView(),
    });

    this.addCommand({
      id: 'toggle-novel-outline',
      name: '切换章节大纲',
      callback: () => this.toggleOutlineView(),
    });

    this.addCommand({
      id: 'open-completed-view',
      name: '打开已读完视图',
      callback: () => this.activateCompletedView(),
    });

    this.addCommand({
      id: 'open-collection-view',
      name: '打开藏书管理',
      callback: () => this.activateCollectionView(),
    });

    this.addCommand({
      id: 'open-global-reading-stats',
      name: '打开全局阅读统计',
      callback: () => this.activateGlobalStatsView(),
    });

    this.addCommand({
      id: 'open-global-notes',
      name: '打开笔记管理',
      callback: () => this.activateGlobalNotesView(),
    });
  }

  private addIcons() {
    // 添加图书库按钮到工具栏
    this.addRibbonIcon('book', '图书库', () => this.activateLibraryView());

    this.addRibbonIcon('list-ordered', '章节大纲', () => {
      this.toggleOutlineView();
    });
  }

  private registerWorkspaceEvents(): void {
    const chapterSelectedRef = this.app.workspace.on('novel-chapter-selected', (chapterId: number) => {
      this.handleChapterSelected(chapterId);
    });
    this.eventRefs.push(chapterSelectedRef);
    this.registerEvent(chapterSelectedRef);

    const fileModifyRef = this.app.vault.on('modify', (file) => {
      if (file instanceof TFile && this.isSupportedFileType(file.extension)) {
        this.handleFileModification(file);
      }
    });
    this.eventRefs.push(fileModifyRef);
    this.registerEvent(fileModifyRef);

    const fileDeleteRef = this.app.metadataCache.on('deleted', (file) => {
      if (this.isSupportedFileType(file.extension)) {
        this.handleFileDeletion(file);
      }
    });
    this.eventRefs.push(fileDeleteRef);
    this.registerEvent(fileDeleteRef);
  }

  private isSupportedFileType(extension: string): boolean {
    return ['txt', 'epub', 'pdf'].includes(extension.toLowerCase());
  }

  /**
   * 通用视图激活方法（避免代码重复）
   */
  private async activateView(viewType: string): Promise<void> {
    const { workspace } = this.app;
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

  async onunload(): Promise<void> {
    console.log('🔄 Unloading Novel Reader plugin...');

    this.eventRefs.forEach(ref => this.app.workspace.offref(ref));
    this.eventRefs = [];

    if (this.statsService) {
      this.statsService.close();
    }

    const viewTypes = [
      VIEW_TYPE_LIBRARY,
      VIEW_TYPE_TXT_READER,
      VIEW_TYPE_EPUB_READER,
      VIEW_TYPE_PDF_READER,
      VIEW_TYPE_MOBI_READER,
      VIEW_TYPE_OUTLINE,
      VIEW_TYPE_STATS,
      VIEW_TYPE_COMPLETED,
      VIEW_TYPE_COLLECTION,
      VIEW_TYPE_TXT_CHAPTER_GRID,
      VIEW_TYPE_GLOBAL_STATS,
      VIEW_TYPE_GLOBAL_NOTES,
    ];

    viewTypes.forEach(type => {
      this.app.workspace.detachLeavesOfType(type);
    });

    console.log('✅ Novel Reader plugin unloaded');
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
        await Promise.all(existing.map((leaf) => leaf.detach()));
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
    console.log(`handleChapterSelected--->${chapterId}`);
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

  private async handleFileModification(file: TFile): Promise<void> {
    try {
      await this.obsidianCacheService.clearFileCache(file.path);
      const currentView = this.getCurrentView(file);
      if (currentView) {
        await this.reloadFileContent(file, currentView);
      }
    } catch (error) {
      console.error('Error handling file modification:', error);
      new Notice(`文件修改处理失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getCurrentView(file: TFile): NovelReaderView | null {
    const viewTypes = [VIEW_TYPE_TXT_READER, VIEW_TYPE_EPUB_READER, VIEW_TYPE_PDF_READER];

    for (const viewType of viewTypes) {
      const leaves = this.app.workspace.getLeavesOfType(viewType);
      for (const leaf of leaves) {
        const view = leaf.view;
        if (
          (view instanceof TxtNovelReaderView ||
            view instanceof PDFNovelReaderView ||
            view instanceof EpubNovelReaderView) &&
          view.novel?.path === file.path
        ) {
          return view;
        }
      }
    }
    return null;
  }

  private async reloadFileContent(file: TFile, view: NovelReaderView): Promise<void> {
    if (!view.novel) return;

    try {
      const content = file.extension === 'txt'
        ? await this.app.vault.read(file)
        : await this.app.vault.readBinary(file);

      await this.obsidianCacheService.setFileContent(file, content);

      if (view instanceof TxtNovelReaderView) {
        await view.setNovelData(view.novel, content as string);
      } else if (view instanceof EpubNovelReaderView || view instanceof PDFNovelReaderView) {
        await view.setNovelData(view.novel);
      }
    } catch (error) {
      console.error('Error reloading file content:', error);
      new Notice(`文件内容重新加载失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleFileDeletion(file: TFile): Promise<void> {
    try {
      await this.obsidianCacheService.clearFileCache(file.path);

      const viewTypes = [VIEW_TYPE_TXT_READER, VIEW_TYPE_EPUB_READER, VIEW_TYPE_PDF_READER];
      for (const viewType of viewTypes) {
        const leaves = this.app.workspace.getLeavesOfType(viewType);
        for (const leaf of leaves) {
          const view = leaf.view;
          if (
            (view instanceof TxtNovelReaderView ||
              view instanceof PDFNovelReaderView ||
              view instanceof EpubNovelReaderView) &&
            view.novel?.path === file.path
          ) {
            await leaf.detach();
          }
        }
      }
    } catch (error) {
      console.error('Error handling file deletion:', error);
      new Notice(`文件删除处理失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

}
