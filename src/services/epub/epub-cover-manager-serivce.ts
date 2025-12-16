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
	async ensureCoverDirectory(format: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		const formatCoverPath = await this.plugin.bookCoverManagerService.coverFormatDir(format);
		
		// 并行检查两个目录是否存在
		const [coverDirExists, formatDirExists] = await Promise.all([
			adapter.exists(this.coverDir),
			adapter.exists(formatCoverPath)
		]);

		// 按顺序创建目录（父目录必须先存在）
		if (!coverDirExists) {
			await adapter.mkdir(this.coverDir);
		}
		if (!formatDirExists) {
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
		// 临时保存原始console.error，用于抑制epubjs内部的非致命错误
		const originalConsoleError = console.error;
		let suppressErrors = false;

		try {
			const arrayBuffer = await this.app.vault.readBinary(file);
			const book = ePub() as unknown as EpubBook;

			// 抑制epubjs解析时的非致命错误（如缺失的图片引用）
			suppressErrors = true;
			console.error = (...args: any[]) => {
				// 只抑制"File not found in the epub"这类非致命错误
				const errorMessage = args[0]?.message || args[0]?.toString() || '';
				if (typeof errorMessage === 'string' && errorMessage.includes('File not found in the epub')) {
					// 静默处理，不打印到控制台
					return;
				}
				// 其他错误仍然打印
				originalConsoleError.apply(console, args);
			};

			await book.open(arrayBuffer);
			await book.ready;

			// 恢复console.error
			suppressErrors = false;
			console.error = originalConsoleError;

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
		} finally {
			// 确保恢复console.error
			if (suppressErrors) {
				console.error = originalConsoleError;
			}
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
