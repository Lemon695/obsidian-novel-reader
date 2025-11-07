import {ItemView, WorkspaceLeaf} from 'obsidian';
import type {Novel} from '../../types';
import {TxtNovelReaderView} from './txt-novel-reader-view';
import {VIEW_TYPE_OUTLINE, VIEW_TYPE_TXT_READER} from 'src/types/constants';
import {LibraryService} from "../../services/library-service";
import type NovelReaderPlugin from "../../main";
import type {ComponentType} from "svelte";
import NovelOutlineViewComponent from "../../components/txt/NovelOutlineViewComponent.svelte";

export class TxtNovelOutlineView extends ItemView {
	private component: NovelOutlineViewComponent | null = null;
	private currentNovel: Novel | null = null;
	private chapters: Array<{ id: number, title: string }> = [];
	private currentChapterId: number | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_OUTLINE;
	}

	getDisplayText(): string {
		return '章节大纲';
	}

	getIcon(): string {
		return 'list-ordered';
	}

	async setNovelData(novel: Novel | null, chapters: Array<{ id: number, title: string }>) {
		console.log("OutlineView setNovelData called:", novel?.title, chapters?.length);
		this.currentNovel = novel;
		this.chapters = chapters;

		// 如果有novel，获取保存的阅读进度
		let savedChapterId = null;
		if (novel) {
			const libraryService = new LibraryService(this.app, this.plugin);
			const progress = await libraryService.getProgress(novel.id);
			if (progress?.position?.chapterId) {
				savedChapterId = progress.position.chapterId;
				console.log("存在保存的进度--->" + savedChapterId)
				this.currentChapterId = savedChapterId;
			}
		}

		if (this.component) {
			console.log("Updating outline component with chapters:", chapters);
			this.component.$set({
				chapters: this.chapters,
				currentChapterId: this.currentChapterId // 使用保存的进度
			});
		} else {
			console.log("Outline component not initialized yet");
			await this.onOpen(); // 尝试重新初始化组件
		}
	}

	async onOpen() {
		console.log("Opening outline view with chapters:", this.chapters?.length);
		const container = this.contentEl;
		container.empty();

		this.component = new (NovelOutlineViewComponent as unknown as ComponentType)({
			target: container,
			props: {
				chapters: this.chapters || [],
				currentChapterId: this.currentChapterId,
				onChapterSelect: (chapterId: number) => {
					this.app.workspace.trigger('novel-chapter-selected', chapterId);
				}
			}
		});

		// 如果视图打开时还没有章节数据，尝试从当前打开的阅读器获取
		if (!this.chapters || this.chapters.length === 0) {
			const readerLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TXT_READER);
			for (const leaf of readerLeaves) {
				const view = leaf.view as TxtNovelReaderView;
				if (view?.component && view.novel && view.content) {
					console.log("Found reader view, requesting chapter update");
					try {
						await view.setNovelData(view.novel, view.content);
						break;
					} catch (error) {
						console.error("Error updating novel data:", error);
					}
				}
			}
		}
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}
	}

	async setCurrentChapter(chapterId: number) {
		console.log("Outline view setCurrentChapter:", chapterId);
		this.currentChapterId = chapterId;
		if (this.component) {
			this.component.$set({currentChapterId: chapterId});
		}
	}

	async updateChapter(chapterId: number) {
		console.log("Outline view updating chapter:", chapterId);
		this.currentChapterId = chapterId; // 保存当前章节ID
		if (this.component) {
			this.component.$set({
				currentChapterId: chapterId,
				chapters: this.chapters // 确保chapters数据也被传递
			});
		}
	}
}
