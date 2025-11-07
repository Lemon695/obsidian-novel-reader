import type {App} from "obsidian";
import type NovelReaderPlugin from "../../main";
import {LibraryService} from "../library-service";
import type {Novel} from "../../types";
import type {ChapterProgress} from "../../types/txt/txt-reader";

//阅读进度
export class ReadingProgressService {
	private app: App;
	private plugin: NovelReaderPlugin;
	private libraryService: LibraryService;

	constructor(app: App, plugin: NovelReaderPlugin) {
		this.app = app;
		this.plugin = plugin;
		this.libraryService = this.plugin.libraryService;
	}

	//获取阅读章节(优先选定章节,没有选定则使用阅读进度章节)
	async getReadingChapterId(novel: Novel, txtChapterProgress: ChapterProgress[], initialChapterId: number | null = null,
							  currentSessionId: string | undefined) {
		// 获取上次阅读进度
		const progress = await this.libraryService.getProgress(novel.id);
		console.log("TxtView,Retrieved reading progress:", progress);

		let selectChapterId = initialChapterId || progress?.position?.chapterId || 1;
		try {
			// 优先使用传入的章节ID
			currentSessionId = await this.plugin.dbService?.startReadingSession(
				novel.id, selectChapterId,
				txtChapterProgress?.find(c => c.id === (initialChapterId || progress?.position?.chapterId))?.title || 'Chapter 1'
			);
			console.log("Started new reading session:", selectChapterId, currentSessionId);
		} catch (error) {
			console.error("Failed to start reading session:", error);
		}

		return selectChapterId;
	}
}
