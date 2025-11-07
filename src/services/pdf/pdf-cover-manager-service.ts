import type { App, TFile } from "obsidian";
import type NovelReaderPlugin from "../../main";
import * as pdfjs from 'pdfjs-dist';

export class PDFCoverManagerService {
	private coverDir: string;

	constructor(private app: App, private plugin: NovelReaderPlugin) {
		this.coverDir = this.plugin.settings.coverPath;
	}

	async coverFormatDir(format: string) {
		return this.plugin.settings.coverPath + "/" + format;
	}

	private async ensureCoverDirectory(format: string) {
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.coverDir))) {
			await adapter.mkdir(this.coverDir);
		}

		const formatCoverPath = await this.coverFormatDir(format);
		if (!(await adapter.exists(formatCoverPath))) {
			await adapter.mkdir(formatCoverPath);
		}
	}

	private getCoverFileName(bookPath: string): string {
		const hash = this.hashString(bookPath);
		return `${hash}.jpg`;
	}

	private hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(16);
	}

	async getPDFCover(file: TFile, format: string): Promise<string | null> {
		try {
			// 配置 PDF.js worker
			pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

			const arrayBuffer = await this.app.vault.readBinary(file);
			const pdfDoc = await pdfjs.getDocument(arrayBuffer).promise;

			// 获取第一页
			const page = await pdfDoc.getPage(1);
			const viewport = page.getViewport({ scale: 1.0 });

			// 创建 canvas
			const canvas = document.createElement('canvas');
			const context = canvas.getContext('2d');
			canvas.height = viewport.height;
			canvas.width = viewport.width;

			if (!context) throw new Error('Cannot get canvas context');

			// 渲染页面到 canvas
			await page.render({
				canvasContext: context,
				viewport: viewport
			}).promise;

			// 将 canvas 转换为 blob
			const blob = await new Promise<Blob>((resolve) => {
				canvas.toBlob((blob) => {
					resolve(blob!);
				}, 'image/jpeg', 0.8);
			});

			// 转换为 ArrayBuffer
			const coverArrayBuffer = await blob.arrayBuffer();

			// 保存封面
			const coverFileName = await this.saveCover(file.path, format, coverArrayBuffer);
			return coverFileName;

		} catch (error) {
			console.error('Error getting PDF cover:', error);
			return null;
		}
	}

	private async saveCover(bookPath: string, format: string, coverData: ArrayBuffer): Promise<string | null> {
		try {
			await this.ensureCoverDirectory(format);
			const coverFileName = this.getCoverFileName(bookPath);
			const saveCoverPath = await this.coverFormatDir(format);//保存目录
			const coverPath = `${saveCoverPath}/${coverFileName}`;

			await this.app.vault.adapter.writeBinary(coverPath, coverData);
			return coverFileName;
		} catch (error) {
			console.error('Error saving cover:', error);
			return null;
		}
	}
}
