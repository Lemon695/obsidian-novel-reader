import {App, TFile} from 'obsidian';
import type NovelReaderPlugin from '../main';
import {PathsService} from "./utils/paths-service";

interface CacheMetadata {
	path: string;
	mtime: number;
	size: number;
	timestamp: number;
	quickHash?: string;  // 文件前256字节的hash，用于快速检测内容变化
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
		if (metadata && await this.isCacheValid(metadata, file)) {
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
			// 确保缓存目录存在
			const cacheDir = this.pathsService.getCacheDirPath();
			await this.pathsService.ensureDirectoryExists(cacheDir);

			const cachePath = this.pathsService.getCachePath(file);

			// 保存内容到缓存文件
			if (content instanceof ArrayBuffer) {
				await this.app.vault.adapter.writeBinary(cachePath, content);
			} else {
				await this.app.vault.adapter.write(cachePath, content);
			}

			// 计算快速hash（文件前256字节）
			const quickHash = this.calculateQuickHash(content);

			// 更新索引
			this.cacheIndex[file.path] = {
				path: file.path,
				mtime: file.stat.mtime,
				size: file.stat.size,
				timestamp: Date.now(),
				quickHash: quickHash
			};

			await this.saveIndex();
		} catch (error) {
			console.error('Error setting cache:', error);
		}
	}

	async getChaptersCache(file: TFile): Promise<any[] | null> {
		const chaptersPath = this.pathsService.getChaptersCachePath(file);
		const metadata = this.cacheIndex[file.path];

		if (metadata && await this.isCacheValid(metadata, file)) {
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
			// 确保缓存目录存在
			const cacheDir = this.pathsService.getCacheDirPath();
			await this.pathsService.ensureDirectoryExists(cacheDir);

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

	private async isCacheValid(metadata: CacheMetadata, file: TFile): Promise<boolean> {
		const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
		const age = Date.now() - metadata.timestamp;

		// 基本检查：mtime、size、age
		if (file.stat.mtime !== metadata.mtime ||
			file.stat.size !== metadata.size ||
			age >= MAX_AGE) {
			return false;
		}

		// 如果有quickHash，进行额外的内容校验
		// 这可以检测到文件内容改变但mtime和size未变的情况
		if (metadata.quickHash) {
			try {
				let content: string | ArrayBuffer;
				if (file.extension === 'txt') {
					content = await this.app.vault.read(file);
				} else {
					content = await this.app.vault.readBinary(file);
				}

				const currentHash = this.calculateQuickHash(content);
				if (currentHash !== metadata.quickHash) {
					console.log(`Cache hash mismatch for ${file.path}, invalidating cache`);
					return false;
				}
			} catch (error) {
				console.error('Error validating cache hash:', error);
				return false;
			}
		}

		return true;
	}

	// 计算快速hash（只取文件前256字节）
	private calculateQuickHash(content: string | ArrayBuffer): string {
		let sample: string;

		if (content instanceof ArrayBuffer) {
			// 对于二进制文件，取前256字节
			const bytes = new Uint8Array(content, 0, Math.min(256, content.byteLength));
			sample = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
		} else {
			// 对于文本文件，取前256个字符
			sample = content.substring(0, 256);
		}

		// 简单的字符串hash算法
		let hash = 0;
		for (let i = 0; i < sample.length; i++) {
			const char = sample.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}

		return hash.toString(36);
	}

	private async saveIndex(): Promise<void> {
		try {
			// 确保缓存目录存在
			const cacheDir = this.pathsService.getCacheDirPath();
			await this.pathsService.ensureDirectoryExists(cacheDir);

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
