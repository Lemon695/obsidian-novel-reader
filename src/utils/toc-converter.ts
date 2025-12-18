import type { Novel } from '../types';
import type { EpubChapter } from '../types/epub/epub-rendition';

/**
 * 统一的目录章节接口
 */
export interface TOCChapter {
    id: number | string;
    title: string;
    level: number;
    href?: string;
    page?: number;
    subChapters?: TOCChapter[];
}

/**
 * 将EPUB章节转换为统一的TOC格式
 */
export function convertEpubChaptersToTOC(chapters: EpubChapter[]): TOCChapter[] {
    return chapters.map((ch, index) => ({
        id: ch.id,
        title: ch.title,
        level: ch.level || 0,
        page: index + 1,
        href: ch.href,
        subChapters: ch.children ? convertEpubChaptersToTOC(ch.children) : undefined,
    }));
}

/**
 * 将PDF outline转换为统一的TOC格式
 */
export function convertPdfOutlineToTOC(outline: any[], totalPages?: number): TOCChapter[] {
    if (outline && outline.length > 0) {
        return outline.map((item, index) => ({
            id: item.id || index,
            title: item.title || `第 ${item.page} 页`,
            level: item.level || 0,
            page: item.page,
            subChapters: item.children ? convertPdfOutlineToTOC(item.children) : undefined,
        }));
    }

    // 如果没有outline,生成页码列表
    if (totalPages) {
        return Array.from({ length: totalPages }, (_, i) => ({
            id: i,
            title: `第 ${i + 1} 页`,
            level: 0,
            page: i + 1,
        }));
    }

    return [];
}

/**
 * 将MOBI TOC转换为统一的TOC格式
 */
export function convertMobiTOCToTOC(toc: any[]): TOCChapter[] {
    if (!toc || !Array.isArray(toc)) {
        return [];
    }

    return toc.map((item, index) => ({
        id: index,
        title: item.title || `Section ${index + 1}`,
        level: item.level || 0,
        page: index + 1,
        href: item.href,
        subChapters: item.children ? convertMobiTOCToTOC(item.children) : undefined,
    }));
}

/**
 * 扁平化TOC章节列表(用于搜索)
 */
export function flattenTOCChapters(chapters: TOCChapter[]): TOCChapter[] {
    const result: TOCChapter[] = [];

    function flatten(items: TOCChapter[]) {
        for (const item of items) {
            result.push(item);
            if (item.subChapters && item.subChapters.length > 0) {
                flatten(item.subChapters);
            }
        }
    }

    flatten(chapters);
    return result;
}
