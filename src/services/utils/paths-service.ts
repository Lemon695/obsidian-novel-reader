import type NovelReaderPlugin from "../../main";
import {type App, TFile} from "obsidian";
import {
	CATEGORY_FILE,
	CUSTOM_SHELVES_FILE, FAVORITES_FILE,
	HISTORY_FILE,
	LIBRARY_FILE,
	PROGRESS_FILE,
	SHELF_FILE,
	TAG_FILE
} from "../../types/constants";
import type {Novel} from "../../types";

export class PathsService {
	private app: App;
	private plugin: NovelReaderPlugin;

	private readonly CACHE_DIR = '.cache';
	private readonly INDEX_FILE = 'cache-index.json';

	constructor(app: App, plugin: NovelReaderPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	/**
	 * 确保目录存在
	 */
	async ensureDirectoryExists(path: string) {
		const exists = await this.app.vault.adapter.exists(path);
		if (!exists) {
			await this.app.vault.adapter.mkdir(path);
		}
	}

	async initLibraryPath() {
		const libraryPath = this.plugin.settings.libraryPath;
		if (!(await this.app.vault.adapter.exists(libraryPath))) {
			await this.app.vault.adapter.mkdir(libraryPath);
		}
	}

	getNotesDir(): string {
		return `${this.plugin.settings.libraryPath}/notes`;
	}

	getNotesPath(novelId: string): string {
		return `${this.getNotesDir()}/${novelId}.json`;
	}

	getLibraryPath(): string {
		return `${this.plugin.settings.libraryPath}/${LIBRARY_FILE}`;
	}

	getProgressFilePath(): string {
		return `${this.plugin.settings.libraryPath}/${PROGRESS_FILE}`;
	}

	getHistoryFilePath(): string {
		return `${this.plugin.settings.libraryPath}/${HISTORY_FILE}`;
	}

	getShelfFilePath(): string {
		return `${this.plugin.settings.libraryPath}/${SHELF_FILE}`;
	}

	getCategoryFilePath(): string {
		return `${this.plugin.settings.libraryPath}/${CATEGORY_FILE}`;
	}

	getTagFilePath(): string {
		return `${this.plugin.settings.libraryPath}/${TAG_FILE}`;
	}

	// 自定义书架
	getCustomShelvesFilePath(): string {
		return `${this.plugin.settings.libraryPath}/${CUSTOM_SHELVES_FILE}`;
	}

	// 收藏数据
	getFavoritesFilePath(): string {
		return `${this.plugin.settings.libraryPath}/${FAVORITES_FILE}`;
	}

	getChaptersCachePathByPath(path: string): string {
		return `${this.plugin.settings.libraryPath}/${this.CACHE_DIR}/${path.replace(/[\/\\]/g, '_')}.chapters.json`;
	}

	getCachePathByPath(path: string): string {
		return `${this.plugin.settings.libraryPath}/${this.CACHE_DIR}/${path.replace(/[\/\\]/g, '_')}.cache`;
	}

	getCachePath(file: TFile): string {
		return `${this.plugin.settings.libraryPath}/${this.CACHE_DIR}/${file.path.replace(/[\/\\]/g, '_')}.cache`;
	}

	getChaptersCachePath(file: TFile): string {
		return `${this.plugin.settings.libraryPath}/${this.CACHE_DIR}/${file.path.replace(/[\/\\]/g, '_')}.chapters.json`;
	}

	getCacheDirPath(): string {
		return `${this.plugin.settings.libraryPath}/${this.CACHE_DIR}`;
	}

	getCacheIndexFilePath(): string {
		// 确保缓存目录存在
		const cachePath = this.getCacheDirPath();
		if (!this.app.vault.adapter.exists(cachePath)) {
			this.app.vault.adapter.mkdir(cachePath);
		}

		return `${cachePath}/${this.INDEX_FILE}`;
	}

	//笔记路径
	getNotePath(novel: Novel): string {
		return this.getNotePathByNovelId(novel.id);
	}

	//笔记路径
	getNotePathByNovelId(novelId: string): string {
		return `${this.plugin.settings.libraryPath}/notes/${novelId}.json`;
	}
}
