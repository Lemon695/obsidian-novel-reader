import { App, TFile, normalizePath } from 'obsidian';
import type NovelReaderPlugin from '../../main';
import { MobiLoaderService } from './mobi-loader-service';

/**
 * MOBI 封面管理服务
 * 负责提取、缓存和管理 MOBI 封面
 */
export class MobiCoverManagerService {
    private loaderService: MobiLoaderService;

    constructor(
        private app: App,
        private plugin: NovelReaderPlugin
    ) {
        this.loaderService = new MobiLoaderService(app);
    }

    /**
     * 提取 MOBI 封面
     * @param file MOBI 文件
     * @param novelId 小说 ID
     * @returns 封面 URL 或 null
     */
    async extractCover(file: TFile, novelId: string): Promise<string | null> {
        try {
            console.log('[MobiCover] Extracting cover for:', file.path);

            // 加载 MOBI
            const book = await this.loaderService.loadMobi(file);

            if (!book) {
                console.warn('[MobiCover] Book not loaded, cannot extract cover');
                return null;
            }

            // 获取封面 Blob
            const coverBlob = await this.getCoverBlob(book);

            if (!coverBlob) {
                console.warn('[MobiCover] No cover found in MOBI');
                return null;
            }

            // 保存封面
            const relativePath = await this.saveCover(novelId, coverBlob);

            console.log('[MobiCover] Cover extracted successfully, relative path:', relativePath);
            return relativePath;
        } catch (error) {
            console.error('[MobiCover] Failed to extract cover:', error);
            return null;
        }
    }

    /**
     * 从 MOBI 书籍对象获取封面 Blob
     * @param book MOBI 书籍对象
     * @returns 封面 Blob 或 null
     */
    async getCoverBlob(book: any): Promise<Blob | null> {
        if (!book) return null;

        try {
            console.log('[MobiCover] Attempting to get cover from book object');

            // foliate-js 的 MOBI 对象有 getCover 方法
            if (typeof book.getCover === 'function') {
                const coverBlob = await book.getCover();

                if (coverBlob && coverBlob instanceof Blob) {
                    console.log('[MobiCover] Cover blob obtained:', {
                        size: coverBlob.size,
                        type: coverBlob.type
                    });
                    return coverBlob;
                } else {
                    console.log('[MobiCover] getCover returned null or invalid blob');
                    return null;
                }
            } else {
                console.warn('[MobiCover] Book object does not have getCover method');
                return null;
            }
        } catch (error) {
            console.error('[MobiCover] Failed to get cover blob:', error);
            return null;
        }
    }

    /**
     * 保存封面到 vault
     * @param novelId 小说 ID
     * @param blob 封面 Blob
     * @returns 封面文件路径
     */
    async saveCover(novelId: string, blob: Blob): Promise<string> {
        try {
            // 确定封面保存路径 - 添加mobi子目录
            const coverDir = this.plugin.settings.coverPath;
            const mobiCoverDir = normalizePath(`${coverDir}/mobi`);
            const coverFileName = `${novelId}.jpg`;
            const coverPath = normalizePath(`${mobiCoverDir}/${coverFileName}`);

            // 确保目录存在
            if (!(await this.app.vault.adapter.exists(mobiCoverDir))) {
                await this.app.vault.adapter.mkdir(mobiCoverDir);
            }

            // 转换 Blob 为 ArrayBuffer
            const arrayBuffer = await blob.arrayBuffer();

            // 保存文件
            await this.app.vault.adapter.writeBinary(coverPath, arrayBuffer);

            console.log('[MobiCover] Cover saved to:', coverPath);
            // 返回相对于coverPath的路径 (mobi/filename.jpg)
            return `mobi/${coverFileName}`;
        } catch (error) {
            console.error('[MobiCover] Failed to save cover:', error);
            throw error;
        }
    }

    /**
     * 获取封面路径
     * @param novelId 小说 ID
     * @returns 封面路径或 null
     */
    getCoverPath(novelId: string): string | null {
        const coverDir = this.plugin.settings.coverPath;
        const coverFileName = `${novelId}.jpg`;
        const coverPath = normalizePath(`${coverDir}/${coverFileName}`);

        return coverPath;
    }

    /**
     * 检查封面是否存在
     * @param novelId 小说 ID
     * @returns 是否存在
     */
    async coverExists(novelId: string): Promise<boolean> {
        const coverPath = this.getCoverPath(novelId);
        if (!coverPath) return false;

        return await this.app.vault.adapter.exists(coverPath);
    }

    /**
     * 删除封面
     * @param novelId 小说 ID
     */
    async deleteCover(novelId: string): Promise<void> {
        const coverPath = this.getCoverPath(novelId);
        if (!coverPath) return;

        try {
            if (await this.app.vault.adapter.exists(coverPath)) {
                await this.app.vault.adapter.remove(coverPath);
                console.log('[MobiCover] Cover deleted:', coverPath);
            }
        } catch (error) {
            console.error('[MobiCover] Failed to delete cover:', error);
        }
    }
}
