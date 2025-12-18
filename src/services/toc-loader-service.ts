import { TFile, App } from 'obsidian';
import type { Novel } from '../types';
import type { TOCChapter } from '../utils/toc-converter';
import {
    convertEpubChaptersToTOC,
    convertPdfOutlineToTOC,
    convertMobiTOCToTOC,
} from '../utils/toc-converter';
import type { EpubBook, EpubNavigationItem, EpubChapter } from '../types/epub/epub-rendition';
import ePub from 'epubjs';
import { MobiLoaderService } from './mobi/mobi-loader-service';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * 统一的TOC加载服务
 * 用于从图书文件中加载目录,无需打开阅读器
 */
export class TOCLoaderService {
    constructor(private app: App) { }

    /**
     * 根据图书格式加载TOC
     */
    async loadTOC(novel: Novel): Promise<TOCChapter[]> {
        const file = this.app.vault.getAbstractFileByPath(novel.path);
        if (!(file instanceof TFile)) {
            throw new Error('File not found: ' + novel.path);
        }

        switch (novel.format) {
            case 'epub':
                return await this.loadEpubTOC(file);
            case 'pdf':
                return await this.loadPdfTOC(file);
            case 'mobi':
                return await this.loadMobiTOC(file);
            default:
                throw new Error('Unsupported format: ' + novel.format);
        }
    }

    /**
     * 加载EPUB目录
     */
    private async loadEpubTOC(file: TFile): Promise<TOCChapter[]> {
        try {
            // 读取文件
            const arrayBuffer = await this.app.vault.readBinary(file);

            // 使用epubjs加载
            const book = ePub() as unknown as EpubBook;
            await book.open(arrayBuffer);

            // 加载导航
            await book.loaded.navigation;
            const toc = book.navigation.toc;

            // 处理导航项为章节
            const chapters = this.processEpubNavItems(toc);

            // 转换为统一格式
            return convertEpubChaptersToTOC(chapters);
        } catch (error) {
            console.error('Failed to load EPUB TOC:', error);
            throw error;
        }
    }

    /**
     * 处理EPUB导航项(参考EpubNovelReaderView的逻辑)
     */
    private processEpubNavItems(
        items: EpubNavigationItem[],
        parentTitle: string = '',
        level: number = 0
    ): EpubChapter[] {
        let chapters: EpubChapter[] = [];
        let index = 0;

        const processItem = (
            item: EpubNavigationItem,
            currentLevel: number,
            parentTitle: string
        ) => {
            const title = item.label.trim();
            if (item.href) {
                index++;

                const chapter: EpubChapter = {
                    id: index,
                    title: currentLevel === 0 ? title : `${parentTitle} - ${title}`,
                    content: '',
                    index: index,
                    isRead: false,
                    href: item.href,
                    spinePos: chapters.length,
                    level: currentLevel,
                    parent: currentLevel > 0 ? parentTitle : undefined,
                    children: [],
                };
                chapters.push(chapter);

                // 处理子项
                if (item.subitems && item.subitems.length > 0) {
                    item.subitems.forEach((subitem) => {
                        processItem(subitem, currentLevel + 1, title);
                    });
                }
            }
        };

        items.forEach((item) => processItem(item, level, parentTitle));
        return chapters;
    }

    /**
     * 加载PDF目录
     */
    private async loadPdfTOC(file: TFile): Promise<TOCChapter[]> {
        try {
            // 配置PDF.js worker
            try {
                const { getPDFWorkerPath } = await import('../constants/app-config');
                const vaultPath = (this.app.vault.adapter as any).getBasePath();
                // 使用.obsidian/plugins路径来推断manifest目录
                const pluginDir = '.obsidian/plugins/novel-reader';
                const workerUrl = await getPDFWorkerPath(this.app, vaultPath, pluginDir);
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
            } catch (error) {
                console.error('Failed to configure PDF worker:', error);
                throw new Error('PDF引擎配置失败');
            }

            // 读取文件
            const arrayBuffer = await this.app.vault.readBinary(file);

            // 加载PDF文档
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDoc = await loadingTask.promise;

            // 获取outline
            const outline = await pdfDoc.getOutline();
            const totalPages = pdfDoc.numPages;

            // 处理outline
            const processedOutline = outline ? await this.processPdfOutline(outline, pdfDoc) : [];

            // 转换为统一格式
            return convertPdfOutlineToTOC(processedOutline, totalPages);
        } catch (error) {
            console.error('Failed to load PDF TOC:', error);
            throw error;
        }
    }

    /**
     * 处理PDF outline
     */
    private async processPdfOutline(
        outline: any[],
        pdfDoc: any,
        level: number = 0
    ): Promise<any[]> {
        const result: any[] = [];

        for (let i = 0; i < outline.length; i++) {
            const item = outline[i];

            // 获取页码
            let pageNum = 1;
            try {
                if (item.dest) {
                    const dest = typeof item.dest === 'string'
                        ? await pdfDoc.getDestination(item.dest)
                        : item.dest;

                    if (dest && dest[0]) {
                        const pageIndex = await pdfDoc.getPageIndex(dest[0]);
                        pageNum = pageIndex + 1;
                    }
                }
            } catch (error) {
                console.warn('Failed to get page number for outline item:', error);
            }

            const processedItem: any = {
                id: i,
                title: item.title || `Section ${i + 1}`,
                page: pageNum,
                level: level,
            };

            // 递归处理子项
            if (item.items && item.items.length > 0) {
                processedItem.children = await this.processPdfOutline(
                    item.items,
                    pdfDoc,
                    level + 1
                );
            }

            result.push(processedItem);
        }

        return result;
    }

    /**
     * 加载MOBI目录
     */
    private async loadMobiTOC(file: TFile): Promise<TOCChapter[]> {
        try {
            const loaderService = new MobiLoaderService(this.app);
            const book = await loaderService.loadMobi(file);

            if (!book) {
                throw new Error('Failed to load MOBI book');
            }

            // 获取目录
            const rawToc = await loaderService.getTOC(book);

            // 展平嵌套的目录结构
            const flatToc = this.flattenMobiTOC(rawToc);

            // 转换为统一格式
            return convertMobiTOCToTOC(flatToc);
        } catch (error) {
            console.error('Failed to load MOBI TOC:', error);
            throw error;
        }
    }

    /**
     * 展平MOBI TOC(参考MobiReaderViewComponent的逻辑)
     */
    private flattenMobiTOC(items: any[], level: number = 0, result: any[] = []): any[] {
        if (!Array.isArray(items)) {
            return result;
        }

        for (const item of items) {
            if (!item) continue;

            result.push({
                title: item.title || 'Untitled',
                href: item.href || '',
                level: level,
            });

            if (item.children && Array.isArray(item.children) && item.children.length > 0) {
                this.flattenMobiTOC(item.children, level + 1, result);
            }
        }

        return result;
    }
}
