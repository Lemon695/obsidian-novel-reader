import {type App, FileSystemAdapter, parseYaml, TFile} from "obsidian";
import type NovelReaderPlugin from "../main";

export class CoverManagerService {

	private app: App;
	private plugin: NovelReaderPlugin;

	constructor(app: App, plugin: NovelReaderPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	async getNovelCover(epubCoverPath: string): Promise<string | null> {

		try {
			if (!epubCoverPath) return null;

			// 处理不同类型的图片路径
			if (this.isExternalUrl(epubCoverPath)) {
				// 如果是外部URL，直接返回
				return epubCoverPath;
			}

			// 如果是本地路径，需要处理一下路径
			const coverFile = this.app.vault.getAbstractFileByPath(this.normalizePath(epubCoverPath));
			if (coverFile instanceof TFile) {
				// 使用getResourcePath获取正确的访问路径
				return this.app.vault.getResourcePath(coverFile);
			}

			return null;
		} catch (error) {
			console.error('Error reading novel cover:', error);
			return null;
		}
	}

	// 检查是否为外部URL
	private isExternalUrl(path: string): boolean {
		return path.startsWith('http://') || path.startsWith('https://');
	}

	// 标准化路径
	private normalizePath(path: string): string {
		// 移除开头的斜杠
		path = path.replace(/^\/+/, '');
		// 将Windows风格的路径转换为POSIX风格
		path = path.replace(/\\/g, '/');
		return path;
	}
}
