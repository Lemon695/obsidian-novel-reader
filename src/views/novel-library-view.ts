import {ItemView, Notice, TFile, WorkspaceLeaf} from 'obsidian';
import type {Novel} from '../types';
import NovelReaderPlugin from '../main';
import {LibraryService} from '../services/library-service';
import {
	VIEW_TYPE_TXT_READER, VIEW_TYPE_EPUB_READER, VIEW_TYPE_LIBRARY,
	VIEW_TYPE_STATS, VIEW_TYPE_PDF_READER, VIEW_TYPE_TXT_CHAPTER_GRID
} from "../types/constants";
import {NovelNoteService} from "../services/note/novel-note-service";
import {ConfirmationDialog} from "../modals/confirmation-dialog";
import {NovelStatsView} from "./novel-stats-view";
import type {ComponentType} from "svelte";
import {ChapterGridView} from "./txt/chapter-grid-view";
import {PDFNovelReaderView} from "./pdf/pdf-novel-reader-view";
import {EpubNovelReaderView} from "./epub-novel-reader-view";
import NovelLibraryComponent from "../components/library/NovelLibraryComponent.svelte";
import {TxtNovelReaderView} from "./txt/txt-novel-reader-view";

//图书库
export class NovelLibraryView extends ItemView {
	private component: NovelLibraryComponent | null = null;
	private lastRefreshTime: number = 0;
	private readonly REFRESH_COOLDOWN = 5000; // 5秒冷却时间

	private libraryService!: LibraryService;
	private noteService!: NovelNoteService;

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
		this.libraryService = this.plugin.libraryService;
		this.noteService = this.plugin.noteService;
	}

	getViewType(): string {
		return VIEW_TYPE_LIBRARY;
	}

	getDisplayText(): string {
		return '图书库';
	}

	private handleFocus = async () => {
		const now = Date.now();
		// 检查是否超过冷却时间
		if (now - this.lastRefreshTime >= this.REFRESH_COOLDOWN) {
			await this.refresh();
			this.lastRefreshTime = now;
		}
	};

	async onOpen() {
		try {
			const container = this.containerEl.children[1];
			if (!container) {
				console.error('Container not found');
				return;
			}
			container.empty();

			// 先加载已有图书
			let novels = await this.libraryService.getAllNovels() || [];

			// 加载书架和标签
			const shelves = await this.plugin.shelfService.getShelves();
			const tags = await this.plugin.shelfService.getTags();
			const categories = await this.plugin.shelfService.loadCategories();

			console.log('Loaded novels:', novels);

			this.component = new (NovelLibraryComponent as unknown as ComponentType)({
				target: container,
				props: {
					novels: novels,
					shelves: shelves,
					tags: tags,
					categories: categories,
					customShelves: await this.plugin.customShelfService.getAllCustomShelves(),
					plugin: this.plugin,
					onAddNovel: async () => {
						console.log('onAddNovel called');
						try {
							const result = await this.libraryService.pickNovelFile();
							if (!result) return;

							// 判断是单个文件还是多个文件
							if (Array.isArray(result)) {
								// 批量添加
								new Notice(`正在批量添加 ${result.length} 本图书...`);
								const addedNovels = await this.libraryService.batchAddNovels(result);

								// 刷新列表
								await this.refresh();

								new Notice(`批量添加完成：成功 ${addedNovels.length} 本，失败 ${result.length - addedNovels.length} 本`);
							} else {
								// 单个添加
								let newNovel = await this.libraryService.addNovel(result);
								// 加载封面信息
								newNovel = await this.plugin.bookCoverManagerService.loadNovelWithCover(newNovel);

								const novels = await this.libraryService.getAllNovels() || [];
								const updatedNovels = await Promise.all(
									novels.map(novel => this.plugin.bookCoverManagerService.loadNovelWithCover(novel))
								);

								// 更新组件的 novels 属性
								if (this.component) {
									this.component.$set({novels: updatedNovels});
								}
								new Notice(`添加成功: ${result.basename}`);
							}
						} catch (error) {
							console.error('Error:', error);
							new Notice('添加失败');
						}
					},
					onRemoveNovel: async (novel: Novel) => {
						try {
							// 调用 LibraryService 的删除方法
							await this.libraryService.deleteNovel(novel);
							// 更新图书列表
							const novels = await this.libraryService.getAllNovels() || [];
							const updatedNovels = await Promise.all(
								novels.map(novel => this.plugin.bookCoverManagerService.loadNovelWithCover(novel))
							);

							if (this.component) {
								this.component.$set({novels: updatedNovels});
							}
							new Notice(`已移除: ${novel.title}`);
						} catch (error) {
							console.error('Error removing novel:', error);
							new Notice('移除失败');
						}
					},
					onOpenNovel: async (novel: Novel) => {
						try {
							console.log("Opening novel:", novel);

							if (novel.format === 'pdf') {
								// 检查是否已存在阅读视图
								const existingView = PDFNovelReaderView.findExistingView(this.app, novel.id);

								if (existingView) {
									await this.app.workspace.revealLeaf(existingView.leaf);
								} else {
									const leaf = this.app.workspace.getLeaf('tab');
									await leaf.setViewState({
										type: VIEW_TYPE_PDF_READER,
										state: {
											novel: novel,
										},
										active: true
									});

									const view = leaf.view as PDFNovelReaderView;
									if (view) {
										await view.setNovelData(novel);
										this.app.workspace.revealLeaf(leaf);
									}
								}
							} else if (novel.format === 'epub') {
								// 检查是否已存在阅读视图
								const existingView = EpubNovelReaderView.findExistingView(this.app, novel.id);

								if (existingView) {
									await this.app.workspace.revealLeaf(existingView.leaf);
								} else {
									const leaf = this.app.workspace.getLeaf('tab');
									await leaf.setViewState({
										type: VIEW_TYPE_EPUB_READER,
										state: {
											novel: novel,
										},
										active: true
									});

									const view = leaf.view as EpubNovelReaderView;
									if (view) {
										await view.setNovelData(novel);
										this.app.workspace.revealLeaf(leaf);
									}
								}
							} else {
								// 检查是否已存在阅读视图
								const existingView = TxtNovelReaderView.findExistingView(this.app, novel.id);

								if (existingView) {
									// 如果存在，直接激活该视图
									await this.app.workspace.revealLeaf(existingView.leaf);
								} else {
									const file = this.app.vault.getAbstractFileByPath(novel.path);
									if (!(file instanceof TFile)) {
										throw new Error('File not found: ' + novel.path);
									}

									// 读取文件内容
									const content = await this.plugin.contentLoaderService.loadContent(file) as string;
									console.log("Content loaded, length:", content.length);

									// 创建新的阅读视图
									const leaf = this.app.workspace.getLeaf('tab');
									await leaf.setViewState({
										type: VIEW_TYPE_TXT_READER,
										active: true
									});

									// 获取视图实例
									const view = leaf.view as TxtNovelReaderView;

									// 确保视图已经初始化
									await view.setNovelData(novel, content);

									this.app.workspace.revealLeaf(leaf);
								}
							}

						} catch (error) {
							console.error('Error opening novel:', error);
							new Notice(`打开失败：${novel.title} - ${(error as Error).message}`);
						}
					},
					onOpenNovelChapter: async (novel: Novel) => {
						try {
							console.log("Opening novelChapter:", novel);
							const file = this.app.vault.getAbstractFileByPath(novel.path);
							if (!(file instanceof TFile)) {
								throw new Error('File not found: ' + novel.path);
							}

							// 创建新的阅读视图
							const leaf = this.app.workspace.getLeaf('tab');
							await leaf.setViewState({
								type: VIEW_TYPE_TXT_CHAPTER_GRID,
								active: true
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
							console.log("Opening note for novel:", novel);

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
					onOpenStats: async (novel: Novel) => {
						//阅读统计
						await this.openNovelStats(novel);
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
					}
				}
			}) as NovelLibraryComponent;

			console.log('Component created successfully');

			// 添加刷新事件监听
			this.component.$on('refresh', async () => {
				await this.refresh();
				new Notice('图书库已刷新');
			});

			// 添加焦点事件监听
			this.registerDomEvent(window, 'focus', this.handleFocus);
			// 添加视图激活事件监听
			this.registerEvent(
				this.app.workspace.on('active-leaf-change', (leaf) => {
					if (leaf?.view === this) {
						this.handleFocus();
					}
				})
			);

		} catch (error) {
			console.error('Error in onOpen:', error);
			new Notice('Failed to open library view');
		}
	}

	async refresh() {
		if (!this.component) {
			return; // 如果当前视图不是活跃的，不执行刷新
		}

		try {
			const novels = await this.libraryService.getAllNovels() || [];
			const updatedNovels = await Promise.all(
				novels.map(async (novel) => {
					// 先获取最新进度
					const progress = await this.libraryService.getProgress(novel.id);

					// 复制小说对象以避免引用问题
					const updatedNovel = {...novel};

					// 更新进度
					if (progress && progress.totalChapters) {
						updatedNovel.progress = Math.floor((progress.chapterIndex / progress.totalChapters) * 100);
						updatedNovel.currentChapter = progress.position?.chapterId;
						updatedNovel.lastRead = progress.timestamp;
						console.log(`Updated progress for ${updatedNovel.title} to ${updatedNovel.progress}%`);
					}

					// 加载封面
					return await this.plugin.bookCoverManagerService.loadNovelWithCover(updatedNovel);
				})
			);

			// 强制创建新的数组以触发更新
			console.log('Setting component with updated novels:', updatedNovels);
			this.component.$set({
				novels: [...updatedNovels],
				shelves: await this.plugin.shelfService.getShelves(),
				tags: await this.plugin.shelfService.getTags(),
				categories: await this.plugin.shelfService.loadCategories()
			});

			console.log('刷新图书库成功', updatedNovels)
		} catch (error) {
			console.error('Error refreshing library:', error);
			new Notice('刷新图书库时出错');
		}
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}
	}

	//阅读统计
	async openNovelStats(novel: Novel) {
		try {
			// 查找已存在的统计视图
			let existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_STATS)[0];

			// 如果没有找到，创建新的视图
			if (!existingLeaf) {
				const newLeaf = this.app.workspace.getRightLeaf(false);
				if (!newLeaf) {
					throw new Error('Failed to create new leaf');
				}

				await newLeaf.setViewState({
					type: VIEW_TYPE_STATS,
					active: true
				});

				existingLeaf = newLeaf;
			}

			// 获取视图实例并设置小说数据
			const view = existingLeaf.view as NovelStatsView;
			if (view) {
				await view.setNovel(novel);
				await this.app.workspace.revealLeaf(existingLeaf);
			}
		} catch (error) {
			console.error('Error opening stats:', error);
			new Notice(`打开统计失败：${novel.title}`);
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
