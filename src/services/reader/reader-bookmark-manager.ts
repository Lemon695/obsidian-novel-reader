/**
 * 阅读器书签管理器
 * 提供统一的书签管理接口，支持所有格式
 */

import { writable, derived, get, type Readable } from 'svelte/store';
import type { BookmarkService } from '../bookmark-service';
import type { Bookmark, AddBookmarkParams } from '../../types/bookmark';
import { Notice } from 'obsidian';

/**
 * 书签位置信息
 */
export interface BookmarkPosition {
    novelId: string;
    novelTitle: string;
    chapterId: number;
    chapterTitle: string;
    progress?: number;
    metadata?: Record<string, any>;
}

/**
 * 书签跳转回调
 */
export type BookmarkJumpCallback = (bookmark: Bookmark) => Promise<void>;

/**
 * 阅读器书签管理器
 * 
 * 功能：
 * - 书签加载和缓存
 * - 当前书签自动检测
 * - 书签添加/删除
 * - 响应式状态管理（Svelte stores）
 * - 书签跳转回调
 */
export class ReaderBookmarkManager {
    // 私有状态 stores
    private _bookmarks = writable<Bookmark[]>([]);
    private _currentBookmark = writable<Bookmark | null>(null);
    private _currentPosition: BookmarkPosition | null = null;

    // 公开的只读 stores
    public readonly bookmarks: Readable<Bookmark[]>;
    public readonly currentBookmark: Readable<Bookmark | null>;
    public readonly hasBookmarkAtCurrentPosition: Readable<boolean>;

    constructor(
        private bookmarkService: BookmarkService,
        private novelId: string,
        private onJumpToBookmark?: BookmarkJumpCallback
    ) {
        // 创建只读 stores - 使用箭头函数保持正确的 this 绑定
        this.bookmarks = {
            subscribe: (run, invalidate) => this._bookmarks.subscribe(run, invalidate)
        };
        this.currentBookmark = {
            subscribe: (run, invalidate) => this._currentBookmark.subscribe(run, invalidate)
        };

        // 派生 store：是否有书签
        this.hasBookmarkAtCurrentPosition = derived(
            this._currentBookmark,
            ($currentBookmark) => $currentBookmark !== null
        );
    }

    /**
     * 初始化管理器
     * 加载所有书签
     */
    async initialize(): Promise<void> {
        try {
            const bookmarks = await this.bookmarkService.getBookmarks(this.novelId);
            this._bookmarks.set(bookmarks);
            this.updateCurrentBookmarkInternal();
        } catch (error) {
            console.error('[ReaderBookmarkManager] Failed to load bookmarks:', error);
            this._bookmarks.set([]);
        }
    }

    /**
     * 更新当前位置
     * 自动检测当前位置是否有书签
     */
    updateCurrentPosition(position: BookmarkPosition): void {
        this._currentPosition = position;
        this.updateCurrentBookmarkInternal();
    }

    /**
     * 内部方法：更新当前书签
     */
    private updateCurrentBookmarkInternal(): void {
        if (!this._currentPosition) {
            this._currentBookmark.set(null);
            return;
        }

        // 使用 get() 获取当前书签列表
        const bookmarks = get(this._bookmarks);

        const currentBookmark = bookmarks.find(
            b => b.chapterId === this._currentPosition!.chapterId
        ) || null;

        this._currentBookmark.set(currentBookmark);
    }

    /**
     * 切换书签
     * 如果当前位置有书签则删除，否则添加
     */
    async toggleBookmark(position: BookmarkPosition): Promise<void> {
        const currentBookmark = get(this._currentBookmark);

        if (currentBookmark) {
            await this.removeBookmark(currentBookmark.id);
        } else {
            await this.addBookmark(position);
        }
    }

    /**
     * 添加书签
     */
    async addBookmark(position: BookmarkPosition): Promise<Bookmark> {
        try {
            const params: AddBookmarkParams = {
                novelId: position.novelId,
                novelTitle: position.novelTitle,
                chapterId: position.chapterId,
                chapterTitle: position.chapterTitle,
                position: position.progress || 0,
                positionType: 'offset',
                ...position.metadata
            };

            const bookmark = await this.bookmarkService.addBookmark(params);

            // 更新 store
            this._bookmarks.update(bookmarks => [...bookmarks, bookmark]);

            // 立即更新当前书签状态
            this.updateCurrentBookmarkInternal();

            new Notice('书签已添加');
            return bookmark;
        } catch (error) {
            console.error('[ReaderBookmarkManager] Failed to add bookmark:', error);
            new Notice('添加书签失败');
            throw error;
        }
    }

    /**
     * 删除书签
     */
    async removeBookmark(bookmarkId: string): Promise<void> {
        try {
            await this.bookmarkService.removeBookmark(this.novelId, bookmarkId);

            // 更新 store
            this._bookmarks.update(bookmarks =>
                bookmarks.filter(b => b.id !== bookmarkId)
            );

            // 立即更新当前书签状态
            this.updateCurrentBookmarkInternal();

            new Notice('书签已删除');
        } catch (error) {
            console.error('[ReaderBookmarkManager] Failed to remove bookmark:', error);
            new Notice('删除书签失败');
            throw error;
        }
    }

    /**
     * 跳转到书签
     */
    async goToBookmark(bookmark: Bookmark): Promise<void> {
        if (!this.onJumpToBookmark) {
            console.warn('[ReaderBookmarkManager] No jump callback provided');
            return;
        }

        try {
            await this.onJumpToBookmark(bookmark);
        } catch (error) {
            console.error('[ReaderBookmarkManager] Failed to jump to bookmark:', error);
            new Notice('跳转到书签失败');
            throw error;
        }
    }

    /**
     * 获取所有书签（非响应式）
     */
    getBookmarks(): Bookmark[] {
        return get(this._bookmarks);
    }

    /**
     * 获取当前书签（非响应式）
     */
    getCurrentBookmark(): Bookmark | null {
        return get(this._currentBookmark);
    }

    /**
     * 检查指定章节是否有书签（非响应式）
     */
    hasBookmark(chapterId: number): boolean {
        const bookmarks = this.getBookmarks();
        return bookmarks.some(b => b.chapterId === chapterId);
    }

    /**
     * 清理资源
     */
    destroy(): void {
        // Svelte stores 会自动清理，这里预留用于未来扩展
        this._currentPosition = null;
    }
}
