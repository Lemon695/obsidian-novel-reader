import { TFile, Notice } from 'obsidian';
import type NovelReaderPlugin from '../main';

export class ContentLoaderService {
	constructor(private plugin: NovelReaderPlugin) {}

	async loadContent(file: TFile): Promise<string | ArrayBuffer> {
		try {
			// 首先尝试从缓存获取
			const cachedContent = await this.plugin.obsidianCacheService.getFileContent(file);
			if (cachedContent) {
				return cachedContent;
			}

			// 如果没有缓存，读取文件
			const content = file.extension === 'txt'
				? await this.plugin.app.vault.read(file)
				: await this.plugin.app.vault.readBinary(file);

			// 缓存内容
			await this.plugin.obsidianCacheService.setFileContent(file, content);

			return content;
		} catch (error) {
			console.error('Error loading file content:', error);
			const errorMsg = error instanceof Error ? error.message : '未知错误';
			new Notice(`加载文件失败: ${file.name} - ${errorMsg}`);
			throw error;
		}
	}

	// 用于处理 EPUB 文件的方法
	async loadEpubContent(file: TFile): Promise<ArrayBuffer> {
		const content = await this.loadContent(file);
		return content instanceof ArrayBuffer
			? content
			: new TextEncoder().encode(content).buffer;
	}

	// 用于处理 PDF 文件的方法
	async loadPdfContent(file: TFile): Promise<ArrayBuffer> {
		const content = await this.loadContent(file);
		return content instanceof ArrayBuffer
			? content
			: new TextEncoder().encode(content).buffer;
	}
}
