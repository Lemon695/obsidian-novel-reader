import { App, Notice } from 'obsidian';
import type NovelReaderPlugin from '../main';
import type { CustomShelf } from '../types/shelf';
import { v4 as uuidv4 } from 'uuid';
import {PathsService} from "./utils/paths-service";

export class CustomShelfService {
	private customShelves: CustomShelf[] = [];
	private favorites: Set<string> = new Set(); // 存储喜爱的图书ID

	private pathsService!: PathsService;

	constructor(private app: App, private plugin: NovelReaderPlugin) {
		this.pathsService = this.plugin.pathsService;

		this.initialize();
	}

	private async initialize(): Promise<void> {
		// 并行加载
		await Promise.all([
			this.loadCustomShelves(),
			this.loadFavorites()
		]);
	}

	// 加载自定义书架
	private async loadCustomShelves() {
		try {
			const path = this.pathsService.getCustomShelvesFilePath();
			if (await this.app.vault.adapter.exists(path)) {
				const data = await this.app.vault.adapter.read(path);
				this.customShelves = JSON.parse(data);
			}
		} catch (error) {
			console.error('Error loading custom shelves:', error);
			this.customShelves = [];
		}
	}

	// 加载收藏数据
	private async loadFavorites() {
		try {
			const path = this.pathsService.getFavoritesFilePath();
			if (await this.app.vault.adapter.exists(path)) {
				const data = await this.app.vault.adapter.read(path);
				this.favorites = new Set(JSON.parse(data));
			}
		} catch (error) {
			console.error('Error loading favorites:', error);
			this.favorites = new Set();
		}
	}

	// 保存自定义书架
	private async saveCustomShelves() {
		try {
			const path = this.pathsService.getCustomShelvesFilePath();
			await this.app.vault.adapter.write(
				path,
				JSON.stringify(this.customShelves, null, 2)
			);
		} catch (error) {
			console.error('Error saving custom shelves:', error);
			new Notice('保存书架数据失败，请检查文件权限');
			throw error;
		}
	}

	// 保存收藏数据
	private async saveFavorites() {
		try {
			const path = this.pathsService.getFavoritesFilePath();
			await this.app.vault.adapter.write(
				path,
				JSON.stringify(Array.from(this.favorites), null, 2)
			);
		} catch (error) {
			console.error('Error saving favorites:', error);
			new Notice('保存收藏数据失败，请检查文件权限');
			throw error;
		}
	}

	// 创建自定义书架
	async createCustomShelf(name: string): Promise<CustomShelf> {
		const newShelf: CustomShelf = {
			id: uuidv4(),
			name,
			novels: [],
			created: Date.now()
		};

		this.customShelves.push(newShelf);
		await this.saveCustomShelves();
		return newShelf;
	}

	// 删除自定义书架（带图书检查）
	async deleteCustomShelf(shelfId: string): Promise<boolean> {
		const shelf = this.customShelves.find(s => s.id === shelfId);
		if (!shelf) {
			console.warn(`Shelf not found: ${shelfId}`);
			return false;
		}

		// 检查是否有图书
		if (shelf.novels && shelf.novels.length > 0) {
			new Notice(`书架"${shelf.name}"中还有 ${shelf.novels.length} 本书，请先移除图书`);
			return false;
		}

		this.customShelves = this.customShelves.filter(s => s.id !== shelfId);
		await this.saveCustomShelves();
		
		new Notice(`已删除书架"${shelf.name}"`);
		return true;
	}

	// 添加图书到自定义书架
	async addToCustomShelf(novelId: string, shelfId: string) {
		const shelf = this.customShelves.find(s => s.id === shelfId);
		if (shelf && !shelf.novels.includes(novelId)) {
			shelf.novels.push(novelId);
			await this.saveCustomShelves();
		}
	}

	// 从自定义书架移除图书
	async removeFromCustomShelf(novelId: string, shelfId: string) {
		const shelf = this.customShelves.find(s => s.id === shelfId);
		if (shelf) {
			shelf.novels = shelf.novels.filter(id => id !== novelId);
			await this.saveCustomShelves();
		}
	}

	// 添加到收藏
	async addToFavorites(novelId: string) {
		this.favorites.add(novelId);
		await this.saveFavorites();
	}

	// 从收藏中移除
	async removeFromFavorites(novelId: string) {
		this.favorites.delete(novelId);
		await this.saveFavorites();
	}

	// 获取所有自定义书架
	async getAllCustomShelves(): Promise<CustomShelf[]> {
		return this.customShelves;
	}

	// 获取指定书架的图书
	async getCustomShelfNovels(shelfId: string): Promise<string[]> {
		const shelf = this.customShelves.find(s => s.id === shelfId);
		return shelf?.novels || [];
	}

	// 获取所有收藏的图书ID
	async getFavoriteNovels(): Promise<string[]> {
		return Array.from(this.favorites);
	}

	// 检查图书是否已收藏
	isFavorite(novelId: string): boolean {
		return this.favorites.has(novelId);
	}

	// 获取图书所在的自定义书架
	async getNovelCustomShelves(novelId: string): Promise<CustomShelf[]> {
		return this.customShelves.filter(shelf =>
			shelf.novels.includes(novelId)
		);
	}
}
