import { type App, TFile } from "obsidian";
import type NovelReaderPlugin from "../main";
import type { Novel } from "../types";
import { NovelNoteService } from "./note/novel-note-service";
import { CoverManagerService } from "./cover-manager-service";
import { LibraryService } from "./library-service";
import { EpubCoverManager } from "./epub/epub-cover-manager-serivce";
import { PDFCoverManagerService } from "./pdf/pdf-cover-manager-service";

//图书封面
export class BookCoverManagerService {
	private app: App;
	private plugin: NovelReaderPlugin;
	private noteService!: NovelNoteService;
	private coverManagerService!: CoverManagerService
	private epubCoverManager!: EpubCoverManager;
	private pdfCoverManagerService!: PDFCoverManagerService;
	private libraryService!: LibraryService;

	constructor(app: App, plugin: NovelReaderPlugin) {
		this.app = app;
		this.plugin = plugin;
		this.noteService = this.plugin.noteService;
		this.coverManagerService = this.plugin.coverManagerService;
		this.epubCoverManager = this.plugin.epubCoverManager;
		this.pdfCoverManagerService = this.plugin.pdfCoverManagerService;
		this.libraryService = this.plugin.libraryService;
	}

	// 不同格式文档封面路径
	async coverFormatDir(format: string) {
		return this.plugin.settings.coverPath + "/" + format;
	}

	// 获取封面全路径
	async getLocalCoverPath(novel: Novel): Promise<string | null> {
		if (novel.format === 'epub' || novel.format === 'pdf' || novel.format === 'mobi') {
			const saveCoverPath = await this.coverFormatDir(novel.format);
			if (novel.coverFileName) {
				return saveCoverPath + "/" + novel.coverFileName;
			}
		}

		return null;
	}

	//加载图书本地封面
	async loadNovelWithCover(novel: Novel): Promise<Novel> {
		try {
			// 获取笔记路径
			novel.notePath = await this.noteService.getNotePath(novel);

			// 获取笔记中的封面
			const cover = await this.noteService.getNovelCover(novel);
			if (cover) {
				novel.cover = cover;
				return novel;
			}

			const localCoverPath = await this.getLocalCoverPath(novel);
			if (localCoverPath) {
				const coverFullPath = await this.coverManagerService.getNovelCover(localCoverPath);
				if (coverFullPath) {
					novel.cover = coverFullPath;
					return novel;
				}
			}

			const novelFormat = novel.format;
			if (novelFormat != 'epub' && novelFormat != 'pdf' && novelFormat != 'mobi') {
				return novel;
			}

			const file = this.app.vault.getAbstractFileByPath(novel.path);
			if (file && file instanceof TFile) {
				let coverFileName = null;
				if (novelFormat === 'epub') {
					coverFileName = await this.epubCoverManager.getEpubCover(file, novelFormat);
				} else if (novelFormat === 'pdf') {
					coverFileName = await this.pdfCoverManagerService.getPDFCover(file, novelFormat);
				}

				if (coverFileName) {
					novel.coverFileName = coverFileName;
					await this.libraryService.updateNovel(novel);
				}
			}
		} catch (error) {
			console.error(`Error loading cover for novel ${novel.title}:`, error);
		}

		return novel;
	}
}
