import { App, TFile } from 'obsidian';
import { inflate } from 'fflate';

/**
 * MOBI 加载服务
 * 负责加载和解析 MOBI/AZW3 文件
 */
export class MobiLoaderService {
    constructor(private app: App) { }

    /**
     * 加载 MOBI 文件
     * @param file MOBI 文件
     * @returns MOBI 书籍对象
     */
    async loadMobi(file: TFile): Promise<any> {
        try {
            // 读取文件
            const arrayBuffer = await this.app.vault.readBinary(file);
            console.log('[MobiLoader] MOBI file loaded, size:', arrayBuffer.byteLength);

            // 动态导入 foliate-js
            const { MOBI } = await import('foliate-js/mobi.js');

            // 创建 MOBI 实例并加载
            const mobiInstance = new MOBI({ unzlib: this.createUnzlibFunction() });

            // open() 返回实际的 book 对象 (KF8 或 MOBI6)
            const book = await mobiInstance.open(new Blob([arrayBuffer]));

            // 检查 book 对象结构
            console.log('[MobiLoader] Book structure after open:', {
                hasMetadata: !!book.metadata,
                hasSections: !!book.sections,
                hasToc: !!book.toc,
                hasNav: !!book.nav,
                metadata: book.metadata,
                sectionsCount: book.sections?.length,
                tocCount: book.toc?.length
            });

            console.log('[MobiLoader] MOBI book created successfully');
            return book;
        } catch (error) {
            console.error('[MobiLoader] Failed to load MOBI:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to load MOBI file: ${errorMsg}`);
        }
    }

    /**
     * 获取 MOBI 元数据
     * @param file MOBI 文件
     * @returns 元数据对象
     */
    async getMetadata(file: TFile): Promise<MobiMetadata> {
        try {
            const book = await this.loadMobi(file);

            if (!book) {
                return this.getDefaultMetadata(file);
            }

            // 从 book 对象提取元数据
            const metadata = book.metadata || {};

            return {
                title: metadata.title || file.basename,
                author: metadata.creator || metadata.author || 'Unknown',
                language: metadata.language || 'unknown',
                encoding: metadata.encoding || 'utf-8',
                version: book.version || 'unknown',
                hasKF8: book.hasKF8 || false,
                sections: book.sections?.length || 0
            };
        } catch (error) {
            console.error('[MobiLoader] Failed to get metadata:', error);
            return this.getDefaultMetadata(file);
        }
    }

    /**
     * 获取章节列表
     * @param book MOBI 书籍对象
     * @returns 章节数组
     */
    async getSections(book: any): Promise<MobiSection[]> {
        if (!book || !book.sections) return [];

        try {
            return book.sections.map((section: any, index: number) => ({
                index,
                title: section.title || `Section ${index + 1}`,
                content: section.content || ''
            }));
        } catch (error) {
            console.error('[MobiLoader] Failed to get sections:', error);
            return [];
        }
    }

    /**
     * 获取目录
     * @param book MOBI 书籍对象
     * @returns 目录项数组
     */
    async getTOC(book: any): Promise<TOCItem[]> {
        if (!book) return [];

        try {
            // foliate-js 的 MOBI 对象可能有 toc 属性
            const toc = book.toc || book.nav || [];

            return this.parseTOC(toc);
        } catch (error) {
            console.error('[MobiLoader] Failed to get TOC:', error);
            return [];
        }
    }

    /**
     * 解析目录结构
     * @private
     */
    private parseTOC(toc: any[], level: number = 0): TOCItem[] {
        if (!Array.isArray(toc)) return [];

        return toc.map(item => ({
            title: item.label || item.title || 'Untitled',
            href: item.href || item.id || '',
            level,
            children: item.subitems ? this.parseTOC(item.subitems, level + 1) : undefined
        }));
    }

    /**
     * 获取默认元数据
     * @private
     */
    private getDefaultMetadata(file: TFile): MobiMetadata {
        return {
            title: file.basename,
            author: 'Unknown',
            language: 'unknown',
            encoding: 'utf-8',
            version: 'unknown',
            hasKF8: false,
            sections: 0
        };
    }

    /**
     * 创建 unzlib 函数用于 KF8 字体解压
     * @private
     */
    private createUnzlibFunction() {
        return (data: Uint8Array): Promise<Uint8Array> => {
            return new Promise((resolve, reject) => {
                inflate(data, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        };
    }
}

/**
 * MOBI 元数据接口
 */
export interface MobiMetadata {
    title: string;
    author: string;
    language: string;
    encoding?: string;
    version?: string;
    hasKF8?: boolean;
    sections?: number;
}

/**
 * MOBI 章节接口
 */
export interface MobiSection {
    index: number;
    title?: string;
    content: string;
}

/**
 * 目录项接口
 */
export interface TOCItem {
    title: string;
    href: string;
    level: number;
    children?: TOCItem[];
}
