import { type App, ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type { Novel } from '../types';
import NovelReaderPlugin from '../main';
import { LibraryService } from '../services/library-service';
import {
  VIEW_TYPE_TXT_READER,
  VIEW_TYPE_EPUB_READER,
  VIEW_TYPE_LIBRARY,
  VIEW_TYPE_STATS,
  VIEW_TYPE_PDF_READER,
  VIEW_TYPE_TXT_CHAPTER_GRID,
} from '../types/constants';
import { NovelNoteService } from '../services/note/novel-note-service';
import { ConfirmationDialog } from '../modals/confirmation-dialog';
import { NovelStatsView } from './novel-stats-view';
import type { ComponentType } from 'svelte';
import { ChapterGridView } from './txt/chapter-grid-view';
import { PDFNovelReaderView } from './pdf/pdf-novel-reader-view';
import { EpubNovelReaderView } from './epub-novel-reader-view';
import NovelLibraryComponent from '../components/library/NovelLibraryComponent.svelte';
import { TxtNovelReaderView } from './txt/txt-novel-reader-view';

export class NovelLibraryView extends ItemView {
  private component: NovelLibraryComponent | null = null;
  private lastRefreshTime: number = 0;
  private readonly REFRESH_COOLDOWN = 5000;
  private isAddingNovel = false;
  private libraryService: LibraryService;
  private noteService: NovelNoteService;
  private eventUnsubscribers: Array<() => void> = [];
  private isInitialized = false; // 添加初始化标志

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: NovelReaderPlugin
  ) {
    super(leaf);
    this.libraryService = this.plugin.libraryService;
    this.noteService = this.plugin.noteService;
  }

  private async loadNovelsWithCovers(): Promise<Novel[]> {
    const novels = await this.libraryService.getAllNovels();
    if (!novels || novels.length === 0) return [];

    return Promise.all(
      novels.map(novel => this.plugin.bookCoverManagerService.loadNovelWithCover(novel))
    );
  }

  private async loadNovelsWithProgress(): Promise<Novel[]> {
    const novels = await this.libraryService.getAllNovels();
    if (!novels || novels.length === 0) return [];

    return Promise.all(
      novels.map(async (novel) => {
        const progress = await this.libraryService.getProgress(novel.id);
        const updatedNovel = { ...novel };

        if (progress?.totalChapters) {
          updatedNovel.progress = Math.floor(
            (progress.chapterIndex / progress.totalChapters) * 100
          );
          updatedNovel.currentChapter = progress.position?.chapterId;
          updatedNovel.lastRead = progress.timestamp;
        }

        return this.plugin.bookCoverManagerService.loadNovelWithCover(updatedNovel);
      })
    );
  }

  private async openReaderView<T extends ItemView>(
    novel: Novel,
    viewType: string,
    findExisting: (app: App, novelId: string) => T | null,
    setupView: (view: T) => Promise<void>
  ): Promise<void> {
    const existingView = findExisting(this.app, novel.id);

    if (existingView) {
      await this.app.workspace.revealLeaf(existingView.leaf);
      return;
    }

    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.setViewState({
      type: viewType,
      state: { novel },
      active: true
    });

    const view = leaf.view as T;
    if (view) {
      await setupView(view);
      await this.app.workspace.revealLeaf(leaf);
    }
  }

  getViewType(): string {
    return VIEW_TYPE_LIBRARY;
  }

  getDisplayText(): string {
    return '图书库';
  }

  private handleFocus = async () => {
    // 检查组件是否存在和是否已初始化
    if (!this.component || !this.isInitialized) {
      console.warn('Cannot handle focus: component is null or not initialized');
      return;
    }

    const now = Date.now();
    // 检查是否超过冷却时间
    if (now - this.lastRefreshTime >= this.REFRESH_COOLDOWN) {
      await this.refresh();
      this.lastRefreshTime = now;
    }
  };

  async onOpen(): Promise<void> {
    try {
      const container = this.containerEl.children[1];
      if (!container) {
        console.error('Container not found');
        return;
      }
      container.empty();

      // 并行加载所有初始数据
      const [novels, shelves, tags, categories, customShelves] = await Promise.all([
        this.libraryService.getAllNovels(),
        this.plugin.shelfService.getShelves(),
        this.plugin.shelfService.getTags(),
        this.plugin.shelfService.loadCategories(),
        this.plugin.customShelfService.getAllCustomShelves()
      ]);

      console.log('Loaded novels:', novels);

      this.component = new (NovelLibraryComponent as unknown as ComponentType)({
        target: container,
        props: {
          novels: novels || [],
          shelves,
          tags,
          categories,
          customShelves,
          plugin: this.plugin,
          onAddNovel: async () => {
            console.log('onAddNovel called');
            try {
              // 防止重复触发
              if (this.isAddingNovel) {
                console.log('Already adding novels, skipping...');
                new Notice('正在添加图书，请稍候...');
                return;
              }
              this.isAddingNovel = true;

              const result = await this.libraryService.pickNovelFile();
              if (!result) {
                return;
              }

              // 判断是单个文件还是多个文件
              if (Array.isArray(result)) {
                // 批量添加
                new Notice(`正在批量添加 ${result.length} 本图书...`);
                const addedNovels = await this.libraryService.batchAddNovels(
                  result,
                  async (novel, index, total) => {
                    try {
                      // 只为新添加的图书加载封面，避免每次重新加载所有图书
                      const novelWithCover =
                        await this.plugin.bookCoverManagerService.loadNovelWithCover(novel);

                      // 获取当前图书列表并更新
                      const novels = (await this.libraryService.getAllNovels()) || [];

                      // 更新组件的 novels 属性
                      if (this.component) {
                        this.component.$set({ novels: novels });
                      }

                      // 显示进度
                      new Notice(`已添加 ${index}/${total}: ${novel.title}`, 2000);
                    } catch (error) {
                      console.error(`Failed to update UI for ${novel.title}:`, error);
                      // 即使UI更新失败，也继续处理下一本书
                    }
                  }
                );

                // 批量添加完成后，刷新一次以确保所有封面都已加载
                await this.refresh();

                new Notice(
                  `批量添加完成：成功 ${addedNovels.length} 本，失败 ${result.length - addedNovels.length} 本`
                );
              } else {
                // 单个添加
                await this.libraryService.addNovel(result);
                const updatedNovels = await this.loadNovelsWithCovers();

                if (this.component) {
                  this.component.$set({ novels: updatedNovels });
                }
                new Notice(`添加成功: ${result.basename}`);
              }
            } catch (error) {
              console.error('Error adding novel:', error);
              const errorMsg = error instanceof Error ? error.message : '未知错误';
              new Notice(`添加失败: ${errorMsg}`);
            } finally {
              // 确保标志位被重置，即使发生错误
              this.isAddingNovel = false;
            }
          },
          onRemoveNovel: async (novel: Novel) => {
            try {
              await this.libraryService.deleteNovel(novel);
              const updatedNovels = await this.loadNovelsWithCovers();

              if (this.component) {
                this.component.$set({ novels: updatedNovels });
              }
              new Notice(`已移除: ${novel.title}`);
            } catch (error) {
              console.error('Error removing novel:', error);
              new Notice('移除失败');
            }
          },
          onOpenNovel: async (novel: Novel) => {
            try {
              console.log('Opening novel:', novel);

              switch (novel.format) {
                case 'pdf':
                  await this.openReaderView(
                    novel,
                    VIEW_TYPE_PDF_READER,
                    PDFNovelReaderView.findExistingView,
                    async (view) => await view.setNovelData(novel)
                  );
                  break;

                case 'epub':
                  await this.openReaderView(
                    novel,
                    VIEW_TYPE_EPUB_READER,
                    EpubNovelReaderView.findExistingView,
                    async (view) => await view.setNovelData(novel)
                  );
                  break;

                case 'mobi':
                  // MOBI 支持 (需要导入 MobiNovelReaderView)
                  const { MobiNovelReaderView } = await import('../views/mobi/mobi-novel-reader-view');
                  const { VIEW_TYPE_MOBI_READER } = await import('../types/constants');
                  await this.openReaderView(
                    novel,
                    VIEW_TYPE_MOBI_READER,
                    MobiNovelReaderView.findExistingView,
                    async (view) => await view.setNovelData(novel)
                  );
                  break;

                default: {
                  // TXT 格式
                  const existingView = TxtNovelReaderView.findExistingView(this.app, novel.id);
                  if (existingView) {
                    await this.app.workspace.revealLeaf(existingView.leaf);
                    return;
                  }

                  const file = this.app.vault.getAbstractFileByPath(novel.path);
                  if (!(file instanceof TFile)) {
                    throw new Error('File not found: ' + novel.path);
                  }

                  const content = await this.plugin.contentLoaderService.loadContent(file) as string;
                  const leaf = this.app.workspace.getLeaf('tab');

                  await leaf.setViewState({
                    type: VIEW_TYPE_TXT_READER,
                    active: true
                  });

                  const view = leaf.view as TxtNovelReaderView;
                  await view.setNovelData(novel, content);
                  await this.app.workspace.revealLeaf(leaf);
                }
              }
            } catch (error) {
              console.error('Error opening novel:', error);
              new Notice(`打开失败：${novel.title} - ${(error as Error).message}`);
            }
          },
          onOpenNovelChapter: async (novel: Novel) => {
            try {
              console.log('Opening novelChapter:', novel);
              const file = this.app.vault.getAbstractFileByPath(novel.path);
              if (!(file instanceof TFile)) {
                throw new Error('File not found: ' + novel.path);
              }

              // 创建新的阅读视图
              const leaf = this.app.workspace.getLeaf('tab');
              await leaf.setViewState({
                type: VIEW_TYPE_TXT_CHAPTER_GRID,
                active: true,
              });

              // 获取视图实例
              const view = leaf.view as ChapterGridView;

              // 确保视图已经初始化
              await view.setNovel(novel);

              this.app.workspace.revealLeaf(leaf);
            } catch (error) {
              console.error('Error opening novel:', error);
              new Notice(`打开失败：${novel.title} - ${(error as Error).message}`);
            }
          },
          onOpenNote: async (novel: Novel) => {
            try {
              console.log('Opening note for novel:', novel);

              // 检查笔记文件是否已存在
              const notePath = await this.noteService.getNotePath(novel);
              const noteFile = this.app.vault.getAbstractFileByPath(notePath);

              if (!noteFile) {
                // 创建并显示确认对话框
                const confirmDialog = new ConfirmationDialog(
                  this.app,
                  '创建笔记',
                  `是否为《${novel.title}》创建笔记？`,
                  '创建',
                  '取消'
                );

                const shouldCreate = await confirmDialog.openAndWait();
                if (!shouldCreate) {
                  return;
                }
              }

              await this.libraryService.openNovelNote(novel);
            } catch (error) {
              console.error('Error opening note:', error);
              new Notice(`打开笔记失败：${novel.title}`);
            }
          },
          // 新增更新小说信息的处理函数
          onUpdateNovel: async (novel: Novel) => {
            try {
              await this.libraryService.updateNovel(novel);
              await this.refresh();
              new Notice(`已更新：${novel.title}`);
            } catch (error) {
              console.error('Error updating novel:', error);
              new Notice('更新失败');
            }
          },
          // 新增标签相关处理函数
          onCreateTag: async (name: string, color: string) => {
            try {
              await this.plugin.shelfService.createTag(name, color);
              await this.refresh();
              new Notice(`已创建标签：${name}`);
            } catch (error) {
              console.error('Error creating tag:', error);
              new Notice('创建标签失败');
            }
          },
          onDeleteTag: async (tagId: string) => {
            try {
              await this.plugin.shelfService.deleteTag(tagId);
              await this.refresh();
              new Notice('已删除标签');
            } catch (error) {
              console.error('Error deleting tag:', error);
              new Notice('删除标签失败');
            }
          },
          // 新增分类相关处理函数
          onCreateCategory: async (name: string) => {
            try {
              await this.plugin.shelfService.addCategory(name);
              await this.refresh();
              new Notice(`已创建分类：${name}`);
            } catch (error) {
              console.error('Error creating category:', error);
              new Notice('创建分类失败');
            }
          },
          onDeleteCategory: async (categoryId: string) => {
            try {
              await this.plugin.shelfService.deleteCategory(categoryId);
              await this.refresh();
              new Notice('已删除分类');
            } catch (error) {
              console.error('Error deleting category:', error);
              new Notice('删除分类失败');
            }
          },
          // 新增自定义书架处理函数
          onCreateCustomShelf: async (event: { name: string }) => {
            try {
              await this.plugin.customShelfService.createCustomShelf(event.name);
              await this.refresh();
              new Notice(`已创建书架：${event.name}`);
            } catch (error) {
              console.error('Error creating custom shelf:', error);
              new Notice('创建书架失败');
            }
          },
        },
      }) as NovelLibraryComponent;

      console.log('Component created successfully');

      const refreshHandler = async () => {
        await this.refresh();
        new Notice('图书库已刷新');
      };

      // 使用 $on 的返回值来取消订阅（更安全）
      const unsubRefresh = this.component.$on('refresh', refreshHandler);
      this.eventUnsubscribers.push(unsubRefresh);

      this.registerDomEvent(window, 'focus', this.handleFocus);
      this.registerEvent(
        this.app.workspace.on('active-leaf-change', (leaf) => {
          if (leaf?.view === this) {
            this.handleFocus();
          }
        })
      );

      // 标记为已初始化
      this.isInitialized = true;
      console.log('NovelLibraryView initialized successfully');
    } catch (error) {
      console.error('Error in onOpen:', error);
      new Notice('Failed to open library view');
    }
  }

  async refresh(): Promise<void> {
    if (!this.component) {
      console.warn('Cannot refresh: component is null');
      return;
    }

    try {
      const [updatedNovels, shelves, tags, categories, customShelves] = await Promise.all([
        this.loadNovelsWithProgress(),
        this.plugin.shelfService.getShelves(),
        this.plugin.shelfService.getTags(),
        this.plugin.shelfService.loadCategories(),
        this.plugin.customShelfService.getAllCustomShelves()
      ]);

      this.component.$set({
        novels: [...updatedNovels],
        shelves,
        tags,
        categories,
        customShelves
      });

      console.log('刷新图书库成功', updatedNovels.length, '本');
    } catch (error) {
      console.error('Error refreshing library:', error);
      new Notice('刷新图书库时出错');
    }
  }

  async onClose(): Promise<void> {
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



  // 获取最近阅读的小说
  getRecentNovel(): Novel | null {
    if (!this.component) return null;

    // 从组件中获取小说列表
    const novels = this.component.$$.ctx[this.component.$$.props['novels']];
    if (!novels || novels.length === 0) return null;

    // 根据最后阅读时间排序，返回最近阅读的小说
    return novels.sort((a: Novel, b: Novel) => {
      const timeA = a.lastRead || 0;
      const timeB = b.lastRead || 0;
      return timeB - timeA;
    })[0];
  }
}
