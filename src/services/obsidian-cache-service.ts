import {App, TFile} from 'obsidian';
import type NovelReaderPlugin from '../main';
import {PathsService} from "./utils/paths-service";

interface CacheMetadata {
	path: string;
	mtime: number;
	size: number;
	timestamp: number;
}

interface CacheIndex {
	[path: string]: CacheMetadata;
}

export class ObsidianCacheService {
	private cacheIndex: CacheIndex = {};

	private pathsService!: PathsService;

	constructor(private app: App, private plugin: NovelReaderPlugin) {
		this.pathsService = this.plugin.pathsService;
		this.initializeCache();
	}

	private async initializeCache() {
		try {
			// 加载缓存索引
			const indexPath = this.pathsService.getCacheIndexFilePath();
			if (await this.app.vault.adapter.exists(indexPath)) {
				const indexContent = await this.app.vault.adapter.read(indexPath);
				this.cacheIndex = JSON.parse(indexContent);
			}

			// 清理过期缓存
			await this.cleanCache();
		} catch (error) {
			console.error('Error initializing cache:', error);
			this.cacheIndex = {};
		}
	}

	async getFileContent(file: TFile): Promise<string | ArrayBuffer | null> {
		const cachePath = this.pathsService.getCachePath(file);
		const metadata = this.cacheIndex[file.path];

		// 检查缓存是否有效
		if (metadata && this.isCacheValid(metadata, file)) {
			try {
				if (file.extension === 'txt') {
					return await this.app.vault.adapter.read(cachePath);
				} else {
					return await this.app.vault.adapter.readBinary(cachePath);
				}
			} catch (error) {
				console.error('Error reading cache:', error);
				return null;
			}
		}

		return null;
	}

	async setFileContent(file: TFile, content: string | ArrayBuffer): Promise<void> {
		try {
			const cachePath = this.pathsService.getCachePath(file);

			// 保存内容到缓存文件
			if (content instanceof ArrayBuffer) {
				await this.app.vault.adapter.writeBinary(cachePath, content);
			} else {
				await this.app.vault.adapter.write(cachePath, content);
			}

			// 更新索引
			this.cacheIndex[file.path] = {
				path: file.path,
				mtime: file.stat.mtime,
				size: file.stat.size,
				timestamp: Date.now()
			};

			await this.saveIndex();
		} catch (error) {
			console.error('Error setting cache:', error);
		}
	}

	async getChaptersCache(file: TFile): Promise<any[] | null> {
		const chaptersPath = this.pathsService.getChaptersCachePath(file);
		const metadata = this.cacheIndex[file.path];

		if (metadata && this.isCacheValid(metadata, file)) {
			try {
				const content = await this.app.vault.adapter.read(chaptersPath);
				return JSON.parse(content);
			} catch (error) {
				console.error('Error reading chapters cache:', error);
				return null;
			}
		}

		return null;
	}

	async setChaptersCache(file: TFile, chapters: any[]): Promise<void> {
		try {
			const chaptersPath = this.pathsService.getChaptersCachePath(file);
			await this.app.vault.adapter.write(chaptersPath, JSON.stringify(chapters));

			// 更新索引
			if (!this.cacheIndex[file.path]) {
				this.cacheIndex[file.path] = {
					path: file.path,
					mtime: file.stat.mtime,
					size: file.stat.size,
					timestamp: Date.now()
				};
				await this.saveIndex();
			}
		} catch (error) {
			console.error('Error setting chapters cache:', error);
		}
	}

	async clearFileCache(path: string): Promise<void> {
		try {
			const cachePath = this.pathsService.getCachePathByPath(path);
			const chaptersPath = this.pathsService.getChaptersCachePathByPath(path);

			// 删除缓存文件
			if (await this.app.vault.adapter.exists(cachePath)) {
				await this.app.vault.adapter.remove(cachePath);
			}
			if (await this.app.vault.adapter.exists(chaptersPath)) {
				await this.app.vault.adapter.remove(chaptersPath);
			}

			// 更新索引
			delete this.cacheIndex[path];
			await this.saveIndex();
		} catch (error) {
			console.error('Error clearing cache:', error);
		}
	}

	private isCacheValid(metadata: CacheMetadata, file: TFile): boolean {
		const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
		const age = Date.now() - metadata.timestamp;

		return (
			file.stat.mtime === metadata.mtime &&
			file.stat.size === metadata.size &&
			age < MAX_AGE
		);
	}

	private async saveIndex(): Promise<void> {
		try {
			const indexPath = this.pathsService.getCacheIndexFilePath();
			await this.app.vault.adapter.write(indexPath, JSON.stringify(this.cacheIndex, null, 2));
		} catch (error) {
			console.error('Error saving cache index:', error);
		}
	}

	private async cleanCache(): Promise<void> {
		const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7天
		const now = Date.now();

		// 清理过期的缓存索引
		for (const [path, metadata] of Object.entries(this.cacheIndex)) {
			if (now - metadata.timestamp > MAX_AGE) {
				await this.clearFileCache(path);
			}
		}
	}
}
