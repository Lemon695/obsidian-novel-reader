import type {App, TFile} from "obsidian";
import type {EpubBook} from "../../types/epub/epub-rendition";
import type NovelReaderPlugin from "../../main";
import ePub from "epubjs";

export class EpubCoverManager {

	private app: App;
	private plugin: NovelReaderPlugin;

	constructor(app: App, plugin: NovelReaderPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	// 获取当前配置的封面主目录
	private get coverDir(): string {
		return this.plugin.settings.coverPath;
	}

	// 确保封面目录存在
	async ensureCoverDirectory(format: string) {
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.coverDir))) {
			await adapter.mkdir(this.coverDir);
		}

		const formatCoverPath = await this.plugin.bookCoverManagerService.coverFormatDir(format);
		if (!(await adapter.exists(formatCoverPath))) {
			await adapter.mkdir(formatCoverPath);
		}
	}

	// 生成封面文件名
	private getCoverFileName(bookPath: string): string {
		// 使用文件路径的哈希作为封面文件名，避免特殊字符问题
		const hash = this.hashString(bookPath);
		return `${hash}.jpg`;
	}

	// 简单的字符串哈希函数
	private hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(16);
	}

	// 获取EPUB封面
	async getEpubCover(file: TFile, format: string): Promise<string | null> {
		try {
			const arrayBuffer = await this.app.vault.readBinary(file);
			const book = ePub() as unknown as EpubBook;
			await book.open(arrayBuffer);
			await book.ready;

			const coverPath = await book.loaded.cover;
			console.log('Cover path:', coverPath);

			if (coverPath) {
				try {
					// 从archive中获取封面blob
					const coverBlob = await book.archive.getBlob(coverPath, {base64: false});
					console.log("coverBlob--->", coverBlob);

					if (coverBlob) {
						// 使用FileReader读取Blob内容
						const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
							const reader = new FileReader();
							reader.onload = () => resolve(reader.result as ArrayBuffer);
							reader.onerror = () => reject(reader.error);
							reader.readAsArrayBuffer(new Blob([coverBlob]));
						});

						// 保存封面
						return await this.saveCover(file.path, format, arrayBuffer);
					}
				} catch (error) {
					console.error('Error extracting cover from archive:', error);
				}
			}

			book.destroy();
			return null;
		} catch (error) {
			console.error('Error getting EPUB cover:', error);
			return null;
		}
	}

	// 保存封面数据
	private async saveCover(bookPath: string, format: string, coverData: ArrayBuffer): Promise<string | null> {
		try {
			await this.ensureCoverDirectory(format);
			const coverFileName = this.getCoverFileName(bookPath);
			const saveCoverPath = await this.plugin.bookCoverManagerService.coverFormatDir(format);//保存目录
			const coverPath = `${saveCoverPath}/${coverFileName}`;

			await this.app.vault.adapter.writeBinary(coverPath, coverData);
			return coverFileName;
		} catch (error) {
			console.error('Error saving cover:', error);
			return null;
		}
	}


}
