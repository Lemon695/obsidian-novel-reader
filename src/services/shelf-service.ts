import {App, Notice} from 'obsidian';
import type NovelReaderPlugin from '../main';
import type {Shelf, Category, Tag} from '../types/shelf';
import {DEFAULT_SHELVES} from '../types/shelf';
import {v4 as uuidv4} from 'uuid';
import type {Novel} from "../types";

export class ShelfService {
	private shelves: Shelf[] = [];
	private categories: Category[] = [];
	private tags: Tag[] = [];

	constructor(private app: App, private plugin: NovelReaderPlugin) {
		this.initialize();
	}

	private async initialize(): Promise<void> {
		// 并行加载所有数据
		await Promise.all([
			this.loadShelves(),
			this.loadCategories(),
			this.loadTags()
		]);
	}

	async loadShelves(): Promise<Shelf[]> {
		try {
			const path = this.plugin.pathsService.getShelfFilePath();
			if (await this.app.vault.adapter.exists(path)) {
				const data = await this.app.vault.adapter.read(path);
				this.shelves = JSON.parse(data);
			} else {
				// 初始化默认书架
				this.shelves = DEFAULT_SHELVES;
				await this.saveShelves();
			}
			return this.shelves;
		} catch (error) {
			console.error('Error loading shelves:', error);
			return DEFAULT_SHELVES;
		}
	}

	// 获取所有书架及其图书数量
	async getShelves(): Promise<Shelf[]> {
		try {
			const novels = await this.plugin.libraryService.getAllNovels();

			// 一次遍历完成所有计数（性能优化：O(n) 而不是 O(n*m)）
			const shelfCounts = new Map<string, number>();
			
			for (const novel of novels) {
				const shelfId = novel.shelfId || 'toread';
				shelfCounts.set(shelfId, (shelfCounts.get(shelfId) || 0) + 1);
			}

			// 构建默认书架
			const defaultShelves = [
				{id: 'all', name: '全部', sort: 0, count: novels.length},
				{id: 'reading', name: '在读', sort: 1, count: shelfCounts.get('reading') || 0},
				{id: 'toread', name: '待读', sort: 2, count: shelfCounts.get('toread') || 0},
				{id: 'finished', name: '已读', sort: 3, count: shelfCounts.get('finished') || 0},
			];

			// 添加自定义书架的计数
			const customShelves = this.shelves
				.filter(shelf => !defaultShelves.some(ds => ds.id === shelf.id))
				.map(shelf => ({
					...shelf,
					count: shelfCounts.get(shelf.id) || 0
				}));

			return [...defaultShelves, ...customShelves].sort((a, b) => a.sort - b.sort);
		} catch (error) {
			console.error('Error getting shelves:', error);
			return [];
		}
	}

	// 获取所有标签及其使用次数
	async getTags(): Promise<Tag[]> {
		try {
			const novels = await this.plugin.libraryService.getAllNovels();

			// 一次遍历完成所有计数（性能优化：O(n) 而不是 O(n*m)）
			const tagCounts = new Map<string, number>();
			
			for (const novel of novels) {
				if (novel.tags) {
					for (const tagId of novel.tags) {
						tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
					}
				}
			}

			// 添加计数到标签
			return this.tags.map(tag => ({
				...tag,
				count: tagCounts.get(tag.id) || 0
			}));
		} catch (error) {
			console.error('Error getting tags:', error);
			return [];
		}
	}

	async createShelf(name: string): Promise<Shelf> {
		const shelf: Shelf = {
			id: uuidv4(),
			name,
			sort: this.shelves.length,
		};
		this.shelves.push(shelf);
		await this.saveShelves();
		return shelf;
	}

	async createTag(name: string, color?: string): Promise<Tag> {
		const tag: Tag = {
			id: uuidv4(),
			name,
			color
		};
		this.tags.push(tag);
		await this.saveTags();
		return tag;
	}

	async updateNovelShelf(novelId: string, shelfId: string) {
		// 更新小说的书架信息
		const libraryService = this.plugin.libraryService;
		const novel = await libraryService.getNovel(novelId);
		if (novel) {
			novel.shelfId = shelfId;
			await libraryService.updateNovel(novel);
		}
	}

	async updateNovelTags(novelId: string, tagIds: string[]) {
		const novel = await this.plugin.libraryService.getNovel(novelId);
		if (novel) {
			novel.tags = tagIds;
			await this.plugin.libraryService.updateNovel(novel);
		}
	}

	private async saveShelves() {
		try {
			// 确保目录存在
			await this.plugin.pathsService.initLibraryPath();
			const path = this.plugin.pathsService.getShelfFilePath();
			await this.app.vault.adapter.write(path, JSON.stringify(this.shelves, null, 2));
		} catch (error) {
			console.error('Error saving shelves:', error);
			throw error;
		}
	}

	async getNovelsByShelf(shelfId: string) {
		const novels = await this.plugin.libraryService.getAllNovels();
		if (shelfId === 'all') {
			return novels;
		}
		return novels.filter(novel => novel.shelfId === shelfId);
	}

	async getNovelsByTag(tagId: string) {
		const novels = await this.plugin.libraryService.getAllNovels();
		return novels.filter(novel => novel.tags?.includes(tagId));
	}

	async loadCategories(): Promise<Category[]> {
		try {
			const path = this.plugin.pathsService.getCategoryFilePath();
			if (await this.app.vault.adapter.exists(path)) {
				const data = await this.app.vault.adapter.read(path);
				this.categories = JSON.parse(data);
			} else {
				// 初始化默认分类
				this.categories = [
					{
						id: 'fiction',
						name: '小说',
						sort: 0
					},
					{
						id: 'literature',
						name: '文学',
						parentId: undefined,
						sort: 1
					},
					{
						id: 'history',
						name: '历史',
						parentId: undefined,
						sort: 2
					}
				];
				await this.saveCategories();
			}
			return this.categories;
		} catch (error) {
			console.error('Error loading categories:', error);
			return [];
		}
	}

	async loadTags(): Promise<Tag[]> {
		try {
			const path = this.plugin.pathsService.getTagFilePath();
			if (await this.app.vault.adapter.exists(path)) {
				const data = await this.app.vault.adapter.read(path);
				this.tags = JSON.parse(data);
			} else {
				// 初始化一些默认标签
				this.tags = [
					{id: 'favorite', name: '收藏', color: '#FFD700'},
					{id: 'ongoing', name: '连载中', color: '#98FB98'},
					{id: 'completed', name: '已完结', color: '#87CEEB'}
				];
				await this.saveTags();
			}
			return this.tags;
		} catch (error) {
			console.error('Error loading tags:', error);
			return [];
		}
	}

	// 添加或更新分类
	async addCategory(name: string, parentId?: string): Promise<Category> {
		const newCategory: Category = {
			id: uuidv4(),
			name,
			parentId,
			sort: this.categories.length
		};
		this.categories.push(newCategory);
		await this.saveCategories();
		return newCategory;
	}

	// 更新分类
	async updateCategory(categoryId: string, updates: Partial<Category>): Promise<void> {
		const index = this.categories.findIndex(c => c.id === categoryId);
		if (index !== -1) {
			this.categories[index] = {...this.categories[index], ...updates};
			await this.saveCategories();
		}
	}

	// 删除分类
	async deleteCategory(categoryId: string): Promise<void> {
		this.categories = this.categories.filter(c => c.id !== categoryId);
		// 可能需要处理子分类和相关书籍
		await this.saveCategories();
	}

	// 添加或更新标签
	async addTag(name: string, color?: string): Promise<Tag> {
		const newTag: Tag = {
			id: uuidv4(),
			name,
			color
		};
		this.tags.push(newTag);
		await this.saveTags();
		return newTag;
	}

	// 更新标签
	async updateTag(tagId: string, updates: Partial<Tag>): Promise<void> {
		const index = this.tags.findIndex(t => t.id === tagId);
		if (index !== -1) {
			this.tags[index] = {...this.tags[index], ...updates};
			await this.saveTags();
		}
	}

	// 删除标签
	async deleteTag(tagId: string): Promise<void> {
		this.tags = this.tags.filter(t => t.id !== tagId);
		// 可能需要从所有相关书籍中移除此标签
		const novels = await this.plugin.libraryService.getAllNovels();
		for (const novel of novels) {
			if (novel.tags?.includes(tagId)) {
				if (novel.tags) {
					novel.tags = novel.tags.filter(t => t !== tagId);
				}
				await this.plugin.libraryService.updateNovel(novel);
			}
		}
		await this.saveTags();
	}

	// 获取分类下的书籍
	async getNovelsByCategory(categoryId: string): Promise<Novel[]> {
		const novels = await this.plugin.libraryService.getAllNovels();
		if (categoryId === 'all') {
			return novels;
		}
		return novels.filter(novel => novel.categoryId === categoryId);
	}

	// 保存分类到文件
	private async saveCategories() {
		try {
			// 确保目录存在
			await this.plugin.pathsService.initLibraryPath();
			const path = this.plugin.pathsService.getCategoryFilePath();
			await this.app.vault.adapter.write(
				path,
				JSON.stringify(this.categories, null, 2)
			);
		} catch (error) {
			console.error('Error saving categories:', error);
			throw error;
		}
	}

	// 保存标签到文件
	private async saveTags(): Promise<void> {
		try {
			// 确保目录存在
			await this.plugin.pathsService.initLibraryPath();
			const path = this.plugin.pathsService.getTagFilePath();
			await this.app.vault.adapter.write(
				path,
				JSON.stringify(this.tags, null, 2)
			);
		} catch (error) {
			console.error('Error saving tags:', error);
			throw error;
		}
	}
}
