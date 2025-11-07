import type {App, TFile} from 'obsidian';
import type NovelReaderPlugin from '../main';

interface CacheMetadata {
	path: string;
	mtime: number;
	size: number;
}

interface CacheEntry {
	metadata: CacheMetadata;
	content: string | ArrayBuffer;
	chapters?: any[];
	timestamp: number;
}

export class FileCacheService {
	private db: IDBDatabase | null = null;
	private readonly DB_NAME = 'novel-reader-cache';
	private readonly STORE_NAME = 'file-cache';
	private readonly MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
	private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB

	constructor(private app: App, private plugin: NovelReaderPlugin) {
		this.initDatabase();
	}

	private async initDatabase(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.DB_NAME, 1);

			request.onerror = () => reject(request.error);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(this.STORE_NAME)) {
					db.createObjectStore(this.STORE_NAME, {keyPath: 'metadata.path'});
				}
			};

			request.onsuccess = () => {
				this.db = request.result;
				this.cleanOldCache();
				resolve();
			};
		});
	}

	async getFileContent(file: TFile): Promise<string | ArrayBuffer | null> {
		if (!this.db) await this.initDatabase();

		try {
			const cache = await this.getCacheEntry(file.path);

			// Check if cache is valid
			if (cache && this.isCacheValid(cache, file)) {
				console.log('Cache hit:', file.path);
				return cache.content;
			}

			// Cache miss or invalid, read file and update cache
			console.log('Cache miss:', file.path);
			const content = file.extension === 'txt'
				? await this.app.vault.read(file)
				: await this.app.vault.readBinary(file);

			await this.setCacheEntry(file, content);
			return content;

		} catch (error) {
			console.error('Error reading from cache:', error);
			return null;
		}
	}

	async setChaptersCache(file: TFile, chapters: any[]): Promise<void> {
		if (!this.db) await this.initDatabase();

		try {
			const cache = await this.getCacheEntry(file.path);
			if (cache) {
				cache.chapters = chapters;
				await this.setCacheEntry(file, cache.content, chapters);
			}
		} catch (error) {
			console.error('Error caching chapters:', error);
		}
	}

	async getChaptersCache(file: TFile): Promise<any[] | null> {
		if (!this.db) await this.initDatabase();

		try {
			const cache = await this.getCacheEntry(file.path);
			if (cache && this.isCacheValid(cache, file)) {
				return cache.chapters || null;
			}
			return null;
		} catch (error) {
			console.error('Error reading chapters cache:', error);
			return null;
		}
	}

	private async getCacheEntry(path: string): Promise<CacheEntry | null> {
		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
			const store = transaction.objectStore(this.STORE_NAME);
			const request = store.get(path);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	private async setCacheEntry(file: TFile, content: string | ArrayBuffer, chapters?: any[]): Promise<void> {
		const entry: CacheEntry = {
			metadata: {
				path: file.path,
				mtime: file.stat.mtime,
				size: file.stat.size
			},
			content,
			chapters,
			timestamp: Date.now()
		};

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);
			const request = store.put(entry);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	private isCacheValid(cache: CacheEntry, file: TFile): boolean {
		const age = Date.now() - cache.timestamp;
		return (
			cache.metadata.mtime === file.stat.mtime &&
			cache.metadata.size === file.stat.size &&
			age < this.MAX_CACHE_AGE
		);
	}

	private async cleanOldCache(): Promise<void> {
		try {
			const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);
			const request = store.openCursor();

			let totalSize = 0;
			const now = Date.now();
			const itemsToDelete: string[] = [];

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const entry = cursor.value as CacheEntry;
					const age = now - entry.timestamp;

					// Mark for deletion if too old or if content is too large
					if (age > this.MAX_CACHE_AGE) {
						itemsToDelete.push(entry.metadata.path);
					} else {
						if (typeof entry.content === "string") {
							totalSize += entry.content.length;
						}
						// If total size exceeds limit, delete oldest entries
						if (totalSize > this.MAX_CACHE_SIZE) {
							itemsToDelete.push(entry.metadata.path);
						}
					}
					cursor.continue();
				} else {
					// Delete marked entries
					itemsToDelete.forEach(path => {
						store.delete(path);
					});
				}
			};
		} catch (error) {
			console.error('Error cleaning cache:', error);
		}
	}

	async clearCache(): Promise<void> {
		if (!this.db) return;

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);
			const request = store.clear();

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async setFileContent(file: TFile, content: string | ArrayBuffer): Promise<void> {
		if (!this.db) await this.initDatabase();

		try {
			await this.setCacheEntry(file, content);
		} catch (error) {
			console.error('Error setting file cache:', error);
			throw error;
		}
	}

	async clearFileCache(path: string): Promise<void> {
		if (!this.db) await this.initDatabase();

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);
			const request = store.delete(path);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}
}
