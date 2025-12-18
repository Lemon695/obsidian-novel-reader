import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type NovelReaderPlugin from '../main';
import type { Novel } from '../types';
import type { TOCChapter } from '../utils/toc-converter';
import { TOCLoaderService } from '../services/toc-loader-service';
import type { ComponentType } from 'svelte';
import BookTOCViewComponent from '../components/reader/BookTOCViewComponent.svelte';
import {
    VIEW_TYPE_LIBRARY,
    VIEW_TYPE_TXT_READER,
    VIEW_TYPE_EPUB_READER,
    VIEW_TYPE_PDF_READER,
    VIEW_TYPE_MOBI_READER
} from '../types/constants';
import { PDFNovelReaderView } from './pdf/pdf-novel-reader-view';
import { EpubNovelReaderView } from './epub-novel-reader-view';
import { MobiNovelReaderView } from './mobi/mobi-novel-reader-view';

export const VIEW_TYPE_BOOK_TOC = 'book-toc-view';

/**
 * 图书目录视图 (EPUB/PDF/MOBI)
 * 在新标签页中显示图书的完整目录结构
 */
export class BookTOCView extends ItemView {
    private component: BookTOCViewComponent | null = null;
    private novel: Novel | null = null;
    private chapters: TOCChapter[] = [];
    private dataReady = false;

    constructor(
        leaf: WorkspaceLeaf,
        private plugin: NovelReaderPlugin
    ) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_BOOK_TOC;
    }

    getDisplayText(): string {
        return this.novel ? `${this.novel.title} - 目录` : '图书目录';
    }

    async setNovel(novel: Novel) {
        console.log('[BookTOCView] setNovel called with:', novel.title);
        this.novel = novel;
        this.dataReady = true;

        await this.leaf.setViewState({
            type: VIEW_TYPE_BOOK_TOC,
            state: { title: novel.title }
        });

        // 加载目录
        await this.loadTOC();

        if (this.component) {
            console.log('[BookTOCView] Updating component');
            this.component.$set({
                novel: this.novel,
                chapters: this.chapters
            });
        }
    }

    private async loadTOC() {
        if (!this.novel) return;

        try {
            const tocLoaderService = new TOCLoaderService(this.plugin.app);
            this.chapters = await tocLoaderService.loadTOC(this.novel);
            console.log('[BookTOCView] Loaded chapters:', this.chapters.length);
        } catch (error) {
            console.error('[BookTOCView] Failed to load TOC:', error);
            new Notice(`加载目录失败: ${(error as Error).message}`);
            this.chapters = [];
        }
    }

    async onOpen() {
        console.log('[BookTOCView] onOpen called');
        const container = this.containerEl.children[1];
        if (!container) {
            console.error('[BookTOCView] Container not found');
            return;
        }
        container.empty();

        console.log('[BookTOCView] Initializing with novel:', this.novel?.title);
        console.log('[BookTOCView] Chapters count:', this.chapters.length);

        this.component = new (BookTOCViewComponent as unknown as ComponentType)({
            target: container,
            props: {
                novel: this.novel,
                chapters: this.chapters,
                plugin: this.plugin,
                onChapterSelect: async (chapter: TOCChapter) => {
                    try {
                        console.log('[BookTOCView] Chapter selected:', chapter.title);
                        await this.handleChapterSelect(chapter);
                    } catch (error) {
                        console.error('[BookTOCView] Error in onChapterSelect:', error);
                        new Notice(`打开失败：${(error as Error).message}`);
                    }
                }
            }
        });

        if (this.novel) {
            console.log('[BookTOCView] Updating with existing novel');
            await this.setNovel(this.novel);
        }
    }

    private async handleChapterSelect(chapter: TOCChapter) {
        console.log('[BookTOCView] handleChapterSelect START', {
            hasNovel: !!this.novel,
            novelId: this.novel?.id,
            novelFormat: this.novel?.format,
            chapterTitle: chapter.title
        });

        if (!this.novel) {
            console.error('[BookTOCView] No novel set');
            return;
        }

        // 根据格式获取对应的View类型
        const viewType = this.getViewTypeByFormat(this.novel.format);
        console.log('[BookTOCView] View type:', viewType);

        // 查找已打开的阅读器
        const existingView = this.findExistingReaderView(this.novel.id, viewType);
        console.log('[BookTOCView] Existing view found:', !!existingView);

        if (existingView) {
            // 如果阅读器已打开,跳转到章节
            console.log('[BookTOCView] Jumping to chapter in existing view');
            await this.jumpToChapter(existingView, chapter);
            await this.plugin.app.workspace.revealLeaf(existingView.leaf);
        } else {
            // 如果阅读器未打开,先打开图书
            console.log('[BookTOCView] Opening novel first');
            await this.openNovel(this.novel, chapter);
        }
    }

    private async openNovel(novel: Novel, chapter?: TOCChapter) {
        console.log('[BookTOCView] openNovel called', {
            novelTitle: novel.title,
            novelFormat: novel.format,
            hasChapter: !!chapter,
            chapterPage: chapter?.page
        });

        try {
            // 使用与ChapterGridView相同的模式
            const viewType = this.getViewTypeByFormat(novel.format);
            console.log('[BookTOCView] Opening view type:', viewType);

            // 创建新的leaf并打开阅读器
            const leaf = this.plugin.app.workspace.getLeaf('tab');
            await leaf.setViewState({
                type: viewType,
                active: true
            });

            // 轮询等待setNovelData方法可用
            let attempts = 0;
            const maxAttempts = 20; // 最多等待2秒
            while (attempts < maxAttempts) {
                const currentView = leaf.view as any;
                if (typeof currentView?.setNovelData === 'function') {
                    console.log(`[BookTOCView] setNovelData found at attempt ${attempts}`);
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
                console.log(`[BookTOCView] Attempt ${attempts}: setNovelData available =`, typeof (leaf.view as any)?.setNovelData === 'function');
            }

            const view = leaf.view as any;

            if (typeof view?.setNovelData !== 'function') {
                console.error('[BookTOCView] setNovelData method not available after waiting');
                new Notice('阅读器初始化失败');
                return;
            }

            console.log('[BookTOCView] setNovelData is now available, calling it');

            try {
                // 根据格式传递不同的参数
                if (novel.format === 'pdf') {
                    const options = chapter?.page ? { initialPage: chapter.page } : undefined;
                    console.log('[BookTOCView] PDF setNovelData options:', options);
                    await view.setNovelData(novel, options);
                } else if (novel.format === 'mobi') {
                    const options = chapter?.id && typeof chapter.id === 'number' ? { initialSection: chapter.id } : undefined;
                    console.log('[BookTOCView] MOBI setNovelData options:', options);
                    await view.setNovelData(novel, options);
                } else if (novel.format === 'epub') {
                    console.log('[BookTOCView] EPUB setNovelData');
                    await view.setNovelData(novel);
                    // EPUB需要等待加载后跳转
                    if (chapter) {
                        setTimeout(async () => {
                            await this.jumpToChapter(view, chapter);
                        }, 1000);
                    }
                }
                await this.plugin.app.workspace.revealLeaf(leaf);
                console.log('[BookTOCView] Reader opened successfully');
            } catch (error) {
                console.error('[BookTOCView] Error calling setNovelData:', error);
                new Notice(`初始化失败: ${(error as Error).message}`);
            }
        } catch (error) {
            console.error('[BookTOCView] Failed to open novel:', error);
            new Notice(`打开失败: ${(error as Error).message}`);
        }
    }

    private getViewTypeByFormat(format: string): string {
        switch (format) {
            case 'epub':
                return VIEW_TYPE_EPUB_READER;
            case 'pdf':
                return VIEW_TYPE_PDF_READER;
            case 'mobi':
                return VIEW_TYPE_MOBI_READER;
            default:
                return VIEW_TYPE_TXT_READER;
        }
    }

    private findExistingReaderView(novelId: string, viewType: string): any {
        const leaves = this.plugin.app.workspace.getLeavesOfType(viewType);
        for (const leaf of leaves) {
            const view = leaf.view as any;
            if (view?.novel?.id === novelId) {
                return view;
            }
        }
        return null;
    }

    private async jumpToChapter(view: any, chapter: TOCChapter) {
        console.log('[BookTOCView] jumpToChapter called', {
            hasComponent: !!view.component,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            chapterPage: chapter.page
        });

        if (!view.component) {
            console.error('[BookTOCView] No component found on view');
            return;
        }

        // 检查可用的方法
        console.log('[BookTOCView] Available methods:', {
            hasJumpToChapter: typeof view.component.jumpToChapter === 'function',
            hasGoToSection: typeof view.component.goToSection === 'function',
            hasJumpToPage: typeof view.component.jumpToPage === 'function',
            hasJumpToPageAndLocate: typeof view.component.jumpToPageAndLocate === 'function'
        });

        // 根据不同的阅读器类型调用不同的跳转方法
        if (typeof view.component.jumpToChapter === 'function') {
            // EPUB使用
            console.log('[BookTOCView] Calling jumpToChapter with id:', chapter.id);
            await view.component.jumpToChapter(chapter.id);
        } else if (typeof view.component.goToSection === 'function') {
            // MOBI使用goToSection
            console.log('[BookTOCView] Calling goToSection with id:', chapter.id);
            await view.component.goToSection(chapter.id);
        } else if (typeof view.component.jumpToPageAndLocate === 'function') {
            // PDF使用jumpToPageAndLocate
            const pageNum = chapter.page || (typeof chapter.id === 'number' ? chapter.id : 1);
            console.log('[BookTOCView] Calling jumpToPageAndLocate with page:', pageNum);
            await view.component.jumpToPageAndLocate(pageNum, null);
        } else {
            console.error('[BookTOCView] No suitable jump method found');
            new Notice('该阅读器不支持章节跳转');
        }
    }

    async onClose() {
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
    }
}
