import {App, TFile, Notice, FuzzySuggestModal, type FuzzyMatch} from 'obsidian';
import type {Novel, ReadingProgress} from '../types';
import NovelReaderPlugin from '../main';
import {v4 as uuidv4} from 'uuid';
import {NovelNoteService} from "./note/novel-note-service";
import {PDFCoverManagerService} from "./pdf/pdf-cover-manager-service";
import {BookCoverManagerService} from "./book-cover-service";
import {EpubCoverManager} from "./epub/epub-cover-manager-serivce";
import {PathsService} from "./utils/paths-service";
import * as pdfjs from 'pdfjs-dist';

export class LibraryService {
	private novels: Novel[] = [];
	private progress: ReadingProgress[] = [];
	private initialized = false;
	private noteService: NovelNoteService;
	private initPromise: Promise<void> | null = null;
	private epubCoverManager: EpubCoverManager;
	private pdfCoverManagerService: PDFCoverManagerService;
	private pathsService!: PathsService;
	private lockPromise: Promise<void> = Promise.resolve();

	// 封面缓存
	private coverCache: Map<string, string> = new Map();
	private coverCacheTime = 0;
	private readonly COVER_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

	// 保存防抖
	private saveDebounceTimer: NodeJS.Timeout | null = null;
	private readonly SAVE_DEBOUNCE_DURATION = 1000; // 1秒防抖

	constructor(private app: App, private plugin: NovelReaderPlugin) {
		this.pathsService = this.plugin.pathsService;

		this.initPromise = this.initialize();

		this.noteService = this.plugin.noteService;
		this.epubCoverManager = this.plugin.epubCoverManager;
		this.pdfCoverManagerService = this.plugin.pdfCoverManagerService;
	}

	private async initialize() {
		try {
			await this.loadLibrary();
			this.initialized = true;
		} catch (error) {
			console.error('Error initializing library:', error);
			// 即使发生错误也要将 initialized 设置为 true
			this.initialized = true;
			throw error;
		}
	}

	private async ensureInitialized() {
		if (this.initPromise) {
			await this.initPromise;
		}
		if (!this.initialized) {
			this.initPromise = this.initialize();
			await this.initPromise;
		}
	}

	//数据锁、同步（使用Promise链避免忙等待和竞态条件）
	private async withDataLock<T>(operation: () => Promise<T>): Promise<T> {
		// 创建一个新的Promise链
		const currentLock = this.lockPromise;
		let releaseLock: () => void;

		// 创建新的锁Promise
		this.lockPromise = new Promise<void>(resolve => {
			releaseLock = resolve;
		});

		try {
			// 等待前一个操作完成
			await currentLock;
			// 执行当前操作
			return await operation();
		} finally {
			// 释放锁，允许下一个操作继续
			releaseLock!();
		}
	}

	/**
	 * 获取所有小说（带封面缓存优化）
	 */
	async getAllNovels(): Promise<Novel[]> {
		await this.loadLibrary();
		await this.ensureInitialized();

		const now = Date.now();
		const isCacheValid = now - this.coverCacheTime < this.COVER_CACHE_DURATION;

		// 如果缓存有效且已加载封面，直接返回
		if (isCacheValid && this.coverCache.size > 0) {
			// 使用缓存的封面数据
			const novelsWithCachedCovers = this.novels.map(novel => {
				const cachedCover = this.coverCache.get(novel.id);
				if (cachedCover) {
					return { ...novel, cover: cachedCover };
				}
				return novel;
			});
			return [...novelsWithCachedCovers];
		}

		// 缓存失效或首次加载，重新加载封面
		this.novels = await Promise.all(
			this.novels.map(async novel => {
				const novelWithCover = await this.plugin.bookCoverManagerService.loadNovelWithCover(novel);
				// 更新缓存
				if (novelWithCover.cover) {
					this.coverCache.set(novel.id, novelWithCover.cover);
				}
				return novelWithCover;
			})
		);

		this.coverCacheTime = now;
		return [...this.novels]; // 返回副本以防止外部修改
	}

	/**
	 * 清除封面缓存（在添加/删除小说时调用）
	 */
	clearCoverCache(): void {
		this.coverCache.clear();
		this.coverCacheTime = 0;
	}

	/**
	 * 加载图书库数据
	 */
	private async loadLibrary(retryCount = 3) {
		for (let i = 0; i < retryCount; i++) {
			try {
				await this.pathsService.initLibraryPath();
				const libraryPath = this.pathsService.getLibraryPath();
				const progressPath = this.pathsService.getProgressFilePath();

				let needsSave = false;

				// 加载图书库数据
				if (await this.app.vault.adapter.exists(libraryPath)) {
					const data = await this.app.vault.adapter.read(libraryPath);
					try {
						this.novels = JSON.parse(data);
					} catch (e) {
						console.error('Error parsing library data:', e);
						this.novels = [];
						needsSave = true;
					}
				} else {
					this.novels = [];
					needsSave = true;
				}

				// 加载进度数据
				if (await this.app.vault.adapter.exists(progressPath)) {
					const progressData = await this.app.vault.adapter.read(progressPath);
					try {
						this.progress = JSON.parse(progressData);
					} catch (e) {
						console.error('Error parsing progress data:', e);
						this.progress = [];
						needsSave = true;
					}
				} else {
					this.progress = [];
					needsSave = true;
				}

				// 验证所有小说的文件是否存在
				this.novels = this.novels.filter(novel => {
					const file = this.app.vault.getAbstractFileByPath(novel.path);
					return file instanceof TFile;
				});

				// 如果有任何更改，保存更新后的数据（初始化时立即保存）
				if (needsSave) {
					await this.saveLibraryImmediate("loadLibrary");
				}
			} catch (error) {
				console.error('Error loading library:', error);
				if (i === retryCount - 1) throw error;
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}
	}

	/**
	 * 保存图书库数据（带防抖）
	 */
	private async saveLibrary(logType: string) {
		// 清除之前的计时器
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer);
		}

		// 设置新的防抖计时器
		return new Promise<void>((resolve) => {
			this.saveDebounceTimer = setTimeout(async () => {
				try {
					await this.saveLibraryImmediate(logType);
					resolve();
				} catch (error) {
					console.error('Error in debounced save:', error);
					throw error;
				}
			}, this.SAVE_DEBOUNCE_DURATION);
		});
	}

	/**
	 * 立即保存图书库数据（内部实现）
	 */
	private async saveLibraryImmediate(logType: string) {
		console.log('saveLibrary--->', logType)
		try {
			// 添加调试日志

			/**
			console.log(logType, 'Before saving library, novels data:',
				JSON.stringify(this.novels.map(n => ({
					id: n.id,
					title: n.title,
					customSettings: n.customSettings
				})), null, 2)
			);*/

			// 确保数据存在
			if (!Array.isArray(this.novels)) {
				console.error('novels is not an array, resetting to empty array');
				this.novels = [];
			}

			// 确保目录存在
			this.pathsService.initLibraryPath();

			const libraryPath = this.pathsService.getLibraryPath();
			const progressPath = this.pathsService.getProgressFilePath();

			// 先读取现有文件内容进行对比
			let existingContent = '';
			if (await this.plugin.app.vault.adapter.exists(libraryPath)) {
				existingContent = await this.plugin.app.vault.adapter.read(libraryPath);
				// console.log('Existing library content:', existingContent);
			}

			// 准备新的内容
			const newContent = JSON.stringify(this.novels, null, 2);
			// console.log('New library content to save:', newContent);

			// 确保内容有变化才写入
			if (existingContent !== newContent) {
				// 写入文件
				await this.plugin.app.vault.adapter.write(
					libraryPath,
					newContent
				);

				await this.plugin.app.vault.adapter.write(
					progressPath,
					JSON.stringify(this.progress, null, 2)
				);

				console.log('Library file updated successfully');
			} else {
				console.log('No changes detected in library content');
			}
		} catch (error) {
			console.error('Error in saveLibrary:', error);
			throw error;
		}
	}

	/**
	 * 添加新小说
	 */
	async addNovel(file: TFile): Promise<Novel> {
		// 检查文件是否已存在
		const existing = this.novels.find(n => n.path === file.path);
		if (existing) {
			throw new Error('Novel already exists in library');
		}

		const format = this.getFileFormat(file);
		let pdfMetadata = {};
		let coverFileName = null;

		try {
			if (format === 'pdf') {
				const arrayBuffer = await this.app.vault.readBinary(file);
				const pdfDoc = await pdfjs.getDocument(arrayBuffer).promise;
				pdfMetadata = {
					numPages: pdfDoc.numPages,
					outlines: await pdfDoc.getOutline()
				};

				coverFileName = await this.pdfCoverManagerService.getPDFCover(file, format);
			} else if (format === 'epub') {
				coverFileName = await this.epubCoverManager.getEpubCover(file, format);
			}
		} catch (error) {
			console.error(`Error reading ${format} metadata:`, error);
		}

		// 创建新小说记录
		const novel: Novel = {
			id: uuidv4(),
			title: file.basename,
			author: 'Unknown',
			path: file.path,
			format: this.getFileFormat(file),
			addTime: Date.now(),
			lastRead: undefined,
			progress: 0,
			isHidden: false,
			tags: [],
			shelfId: 'toread', // 默认放入"待读"书架
			categoryId: undefined, // 默认无分类
			customMetadata: {},
			customSettings: {},
			pdfMetadata: format === 'pdf' ? pdfMetadata : undefined,
			coverFileName: coverFileName || undefined,
		};

		// 准备笔记文件路径（但不创建笔记）
		try {
			// 获取笔记文件路径并保存
			novel.notePath = await this.noteService.getNotePath(novel);
		} catch (error) {
			console.error('Error creating note file:', error);
		}

		// 添加到集合
		this.novels.push(novel);
		await this.saveLibrary("addNovel");

		// 清除封面缓存，确保下次加载时重新获取
		this.clearCoverCache();

		new Notice(`已添加《${novel.title}》到图书库\n点击图书信息可添加笔记`);
		return novel;
	}

	/**
	 * 删除小说
	 */
	async deleteNovel(novel: Novel): Promise<boolean> {
		const index = this.novels.findIndex(n => n.id === novel.id);
		if (index === -1) {
			return false;
		}

		// 删除相关进度记录
		this.progress = this.progress.filter(p => p.novelId !== novel.id);

		// 删除小说记录（立即保存以防数据丢失）
		this.novels.splice(index, 1);
		await this.saveLibraryImmediate("deleteNovel");

		// 清除封面缓存
		this.clearCoverCache();

		return true;
	}

	/**
	 * 更新小说信息
	 */
	async updateNovel(novel: Novel): Promise<boolean> {
		return this.withDataLock(async () => {
			// 重新加载最新数据
			await this.loadLibrary();

			const index = this.novels.findIndex(n => n.id === novel.id);
			if (index === -1) {
				return false;
			}

			// 确保所有必要的字段都存在
			novel = await this.ensureNovelDefaults(novel);

			this.novels[index] = {
				...this.novels[index],
				...novel,
				customSettings: {
					...this.novels[index].customSettings,
					...novel.customSettings
				}
			};

			// 调试日志
			console.log('Saving novel with pattern:', this.novels[index].customSettings?.chapterPattern);

			// 如果有笔记文件，同步更新笔记
			if (novel.notePath) {
				try {
					await this.noteService.updateNovelMetadata(novel);
				} catch (error) {
					console.error('Error updating note metadata:', error);
				}
			}

			try {
				await this.saveLibrary("updateNovel");
				return true;
			} catch (error) {
				console.error('Error updating novel:', error);
				return false;
			}
		})
	}

	/**
	 * 打开小说笔记
	 */
	async openNovelNote(novel: Novel): Promise<void> {
		try {
			await this.noteService.createOrOpenNote(novel);
		} catch (error) {
			console.error('Error opening note:', error);
			new Notice('Failed to open note');
		}
	}

	/**
	 * 更新阅读进度
	 */
	async updateProgress(novelId: string, progress: ReadingProgress): Promise<void> {
		await this.withDataLock(async () => {
			//console.log('更新阅读进度.updateProgress---1---', novelId, JSON.stringify(progress))

			// 确保在执行保存前已初始化
			if (!this.initialized) {
				await this.initialize();
			}

			await this.loadLibrary();
			await this.ensureInitialized();

			//console.log('更新阅读进度.updateProgress---2---', novelId, JSON.stringify(progress))

			try {
				// 更新进度记录
				const index = this.progress.findIndex(p => p.novelId === novelId);
				if (index === -1) {
					this.progress.push(progress);
				} else {
					this.progress[index] = progress;
				}

				//console.log('更新阅读进度.updateProgress---3---', novelId, JSON.stringify(this.novels))

				// 更新小说的最后阅读时间和进度
				const novel = this.novels.find(n => n.id === novelId);
				if (!novel) {
					console.error('Novel not found:', novelId);
					return;
				}

				novel.lastRead = Date.now();
				novel.currentChapter = progress.position?.chapterId;

				// 如果没有总章节数，从进度对象中获取
				if (!novel.totalChapters && progress.totalChapters) {
					novel.totalChapters = progress.totalChapters;
				}

				// 计算进度百分比
				if (novel.totalChapters) {
					novel.progress = Math.floor((progress.chapterIndex / novel.totalChapters) * 100);
					console.log('Updating novel progress:', {
						novelId,
						progress: novel.progress,
						lastRead: novel.lastRead,
						currentChapter: novel.currentChapter,
						totalChapters: novel.totalChapters,
						chapterIndex: progress.chapterIndex
					});
				}

				// 保存更新后的数据
				await this.saveLibrary("updateProgress");
				console.log('Progress updated and saved successfully');
			} catch (error) {
				console.error('Failed to update progress:', error);
				throw error;
			}
		});
	}

	/**
	 * 获取阅读进度
	 */
	async getProgress(novelId: string): Promise<ReadingProgress | null> {
		// 确保数据已加载
		await this.ensureInitialized();

		// 重新读取progress文件以获取最新数据
		try {
			const progressPath = this.pathsService.getProgressFilePath();
			if (await this.app.vault.adapter.exists(progressPath)) {
				const progressData = await this.app.vault.adapter.read(progressPath);
				this.progress = JSON.parse(progressData);
				//console.log('Reloaded progress data from file');
			}
		} catch (error) {
			console.error('Error reloading progress file:', error);
		}

		// 查找进度记录
		const progress = this.progress.find(p => p.novelId === novelId);
		return progress || null;
	}

	/**
	 * 导入小说
	 */
	async importNovel(filePath: string): Promise<Novel> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			throw new Error('File not found');
		}

		// 检查文件类型
		if (!this.isSupportedFormat(file)) {
			throw new Error('Unsupported file format');
		}

		return this.addNovel(file);
	}

	/**
	 * 获取文件格式
	 */
	private getFileFormat(file: TFile): Novel['format'] {
		switch (file.extension.toLowerCase()) {
			case 'txt':
				return 'txt';
			case 'epub':
				return 'epub';
			case 'pdf':
				return 'pdf';
			default:
				throw new Error('Unsupported file format');
		}
	}

	/**
	 * 检查是否支持的格式
	 */
	private isSupportedFormat(file: TFile): boolean {
		return ['txt', 'epub', 'pdf'].includes(file.extension.toLowerCase());
	}

	/**
	 * 选择小说文件
	 */
	async pickNovelFile(): Promise<TFile | null> {
		console.log('pickNovelFile called');
		const existingNovels = await this.getAllNovels();

		return new Promise<TFile | null>((resolve) => {
			const modal = new NovelFileSuggestModal(
				this.app,
				existingNovels,
				this.plugin,
				(file: TFile | null) => {
					console.log('File selected in modal:', file);
					resolve(file);
				}
			);
			modal.open();
		});
	}

	// 获取单本小说
	async getNovel(novelId: string): Promise<Novel | null> {
		await this.ensureInitialized();
		const novel = this.novels.find(n => n.id === novelId);
		return novel || null;
	}

	// 更新小说信息时的辅助方法
	private async ensureNovelDefaults(novel: Novel): Promise<Novel> {
		if (!novel.tags) {
			novel.tags = [];
		}
		if (!novel.customMetadata) {
			novel.customMetadata = {};
		}
		if (!novel.customSettings) {
			novel.customSettings = {};
		}
		return novel;
	}

}

// 文件选择模态框
class NovelFileSuggestModal extends FuzzySuggestModal<TFile> {
	private isComposing = false;

	constructor(
		app: App,
		private existingNovels: Novel[],
		private plugin: NovelReaderPlugin,
		private onChoose: (file: TFile) => void
	) {
		super(app);
		this.setPlaceholder('选择 TXT 文件');
		this.setupInputHandlers();
	}

	private setupInputHandlers() {
		const originalInputEl = this.inputEl;

		originalInputEl.addEventListener('compositionstart', () => {
			this.isComposing = true;
		});

		originalInputEl.addEventListener('compositionend', () => {
			this.isComposing = false;
			// 手动触发搜索
			const event = new Event('input', {
				bubbles: true,
				cancelable: true,
			});
			originalInputEl.dispatchEvent(event);
		});
	}

	getItems(): TFile[] {
		// 如果正在输入拼音，返回空数组避免搜索
		if (this.isComposing) {
			return [];
		}

		return this.app.vault.getFiles().filter(file => {
			// 检查文件类型
			if (file.extension.toLowerCase() !== 'txt' &&
				file.extension.toLowerCase() !== 'pdf' &&
				file.extension.toLowerCase() !== 'epub'
			) {
				return false;
			}

			// 检查是否已经添加过
			const isExisting = this.existingNovels.some(novel =>
				novel.path === file.path
			);
			if (isExisting) {
				return false;
			}

			const {blockConfig} = this.plugin.settings;

			// 检查具体路径屏蔽
			if (blockConfig.specificPaths.includes(file.path)) {
				return false;
			}

			// 检查正则表达式屏蔽
			const isBlocked = blockConfig.patterns.some(pattern => {
				try {
					const regex = new RegExp(pattern);
					return regex.test(file.path);
				} catch (e) {
					console.error('Invalid regex pattern:', pattern, e);
					return false;
				}
			});

			return !isBlocked;
		}).sort((a, b) => b.stat.ctime - a.stat.ctime);
	}

	getItemText(file: TFile): string {
		return file.basename;
	}

	renderSuggestion(fileItem: {
		item: TFile,
		match: { score: number, matches: Array<[number, number]> }
	}, el: HTMLElement) {
		const container = el.createDiv({
			cls: 'suggestion-content'
		});

		// 创建标题容器
		const titleEl = document.createElement('div');
		titleEl.className = 'suggestion-title';
		titleEl.textContent = fileItem.item.basename;
		container.appendChild(titleEl);

		// 创建路径信息容器
		const pathEl = document.createElement('div');
		pathEl.className = 'suggestion-note';
		pathEl.textContent = fileItem.item.path;
		container.appendChild(pathEl);

		// 添加样式
		el.addClasses(['suggestion-item']);
		el.setAttribute('title', fileItem.item.path);
	}

	onChooseItem(file: TFile): void {
		this.onChoose(file);
	}

	onNoSuggestion(): void {
		// 只在非输入法编辑状态且有输入内容时显示提示
		if (!this.isComposing && this.inputEl.value) {
			new Notice('没有找到可添加的新图书');
		}
	}
}
