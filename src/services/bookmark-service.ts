/**
 * 书签服务
 * 负责书签的创建、管理、存储和检索
 */

import { App, Notice } from 'obsidian';
import type NovelReaderPlugin from '../main';
import type { 
  Bookmark, 
  BookmarkColor, 
  BookmarkStats, 
  AddBookmarkParams,
  ColorConfig,
  BOOKMARK_COLORS
} from '../types/bookmark';
import { v4 as uuidv4 } from 'uuid';

export class BookmarkService {
  private bookmarks: Map<string, Bookmark[]> = new Map();
  private plugin: NovelReaderPlugin;
  private app: App;

  constructor(app: App, plugin: NovelReaderPlugin) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    await this.loadAllBookmarks();
    console.log('✅ BookmarkService initialized');
  }

  /**
   * 添加书签
   */
  async addBookmark(params: AddBookmarkParams): Promise<Bookmark> {
    const bookmark: Bookmark = {
      id: uuidv4(),
      novelId: params.novelId,
      novelTitle: params.novelTitle,
      chapterId: params.chapterId,
      chapterTitle: params.chapterTitle,
      position: params.position,
      positionType: params.positionType || 'offset',
      selectedText: params.selectedText,
      contextBefore: params.contextBefore,
      contextAfter: params.contextAfter,
      note: params.note,
      color: params.color || 'gray',
      tags: params.tags || [],
      category: params.category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0
    };

    // 添加到内存
    const novelBookmarks = this.bookmarks.get(params.novelId) || [];
    novelBookmarks.push(bookmark);
    
    // 按位置排序
    novelBookmarks.sort((a, b) => {
      if (a.chapterId !== b.chapterId) {
        return a.chapterId - b.chapterId;
      }
      return a.position - b.position;
    });
    
    this.bookmarks.set(params.novelId, novelBookmarks);

    // 保存到文件
    await this.saveBookmarks(params.novelId);

    // 通知由调用方处理，避免重复
    console.log('✓ Bookmark added:', bookmark.id);
    
    return bookmark;
  }

  /**
   * 删除书签
   */
  async removeBookmark(novelId: string, bookmarkId: string): Promise<void> {
    const novelBookmarks = this.bookmarks.get(novelId);
    if (!novelBookmarks) return;

    const index = novelBookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) return;

    novelBookmarks.splice(index, 1);
    await this.saveBookmarks(novelId);

    // 通知由调用方处理，避免重复
    console.log('✓ Bookmark removed:', bookmarkId);
  }

  /**
   * 更新书签
   */
  async updateBookmark(
    novelId: string, 
    bookmarkId: string, 
    updates: Partial<Bookmark>
  ): Promise<void> {
    const novelBookmarks = this.bookmarks.get(novelId);
    if (!novelBookmarks) return;

    const bookmark = novelBookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) return;

    Object.assign(bookmark, updates, { updatedAt: Date.now() });
    await this.saveBookmarks(novelId);

    console.log('✓ Bookmark updated:', bookmarkId);
  }

  /**
   * 获取小说的所有书签
   */
  getBookmarks(novelId: string): Bookmark[] {
    return this.bookmarks.get(novelId) || [];
  }

  /**
   * 获取特定章节的书签
   */
  getChapterBookmarks(novelId: string, chapterId: number): Bookmark[] {
    const novelBookmarks = this.bookmarks.get(novelId) || [];
    return novelBookmarks.filter(b => b.chapterId === chapterId);
  }

  /**
   * 获取当前位置附近的书签
   */
  getNearbyBookmark(
    novelId: string, 
    chapterId: number, 
    position: number, 
    threshold: number = 100
  ): Bookmark | undefined {
    const chapterBookmarks = this.getChapterBookmarks(novelId, chapterId);
    return chapterBookmarks.find(b => 
      Math.abs(b.position - position) < threshold
    );
  }

  /**
   * 获取书签详情
   */
  getBookmark(novelId: string, bookmarkId: string): Bookmark | undefined {
    const novelBookmarks = this.bookmarks.get(novelId);
    return novelBookmarks?.find(b => b.id === bookmarkId);
  }

  /**
   * 跳转到书签
   */
  async jumpToBookmark(bookmark: Bookmark): Promise<void> {
    // 更新访问统计
    bookmark.lastAccessedAt = Date.now();
    bookmark.accessCount = (bookmark.accessCount || 0) + 1;
    await this.updateBookmark(bookmark.novelId, bookmark.id, {
      lastAccessedAt: bookmark.lastAccessedAt,
      accessCount: bookmark.accessCount
    });

    console.log('✓ Jumping to bookmark:', bookmark.id);
  }

  /**
   * 搜索书签
   */
  searchBookmarks(novelId: string, query: string): Bookmark[] {
    const novelBookmarks = this.bookmarks.get(novelId) || [];
    const lowerQuery = query.toLowerCase();

    return novelBookmarks.filter(bookmark => 
      bookmark.chapterTitle.toLowerCase().includes(lowerQuery) ||
      bookmark.note?.toLowerCase().includes(lowerQuery) ||
      bookmark.selectedText?.toLowerCase().includes(lowerQuery) ||
      bookmark.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 按颜色筛选
   */
  filterByColor(novelId: string, color: BookmarkColor): Bookmark[] {
    const novelBookmarks = this.bookmarks.get(novelId) || [];
    return novelBookmarks.filter(b => b.color === color);
  }

  /**
   * 按分类筛选
   */
  filterByCategory(novelId: string, category: string): Bookmark[] {
    const novelBookmarks = this.bookmarks.get(novelId) || [];
    return novelBookmarks.filter(b => b.category === category);
  }

  /**
   * 获取书签统计
   */
  getStats(novelId: string): BookmarkStats {
    const novelBookmarks = this.bookmarks.get(novelId) || [];

    const byColor: Record<BookmarkColor, number> = {
      red: 0, orange: 0, yellow: 0, green: 0, 
      blue: 0, purple: 0, gray: 0
    };

    const byCategory: Record<string, number> = {};

    novelBookmarks.forEach(bookmark => {
      byColor[bookmark.color || 'gray']++;
      if (bookmark.category) {
        byCategory[bookmark.category] = (byCategory[bookmark.category] || 0) + 1;
      }
    });

    const recentlyAdded = [...novelBookmarks]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    const mostAccessed = [...novelBookmarks]
      .sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))
      .slice(0, 5);

    return {
      total: novelBookmarks.length,
      byColor,
      byCategory,
      recentlyAdded,
      mostAccessed
    };
  }

  /**
   * 导出书签为 Markdown
   */
  async exportToMarkdown(novelId: string): Promise<string> {
    const novelBookmarks = this.bookmarks.get(novelId) || [];
    if (novelBookmarks.length === 0) {
      return '# 暂无书签\n';
    }

    const novel = novelBookmarks[0];
    let markdown = `# ${novel.novelTitle} - 书签\n\n`;
    markdown += `> 导出时间: ${new Date().toLocaleString()}\n`;
    markdown += `> 书签数量: ${novelBookmarks.length}\n\n`;

    // 按章节分组
    const byChapter = new Map<number, Bookmark[]>();
    novelBookmarks.forEach(bookmark => {
      const chapter = byChapter.get(bookmark.chapterId) || [];
      chapter.push(bookmark);
      byChapter.set(bookmark.chapterId, chapter);
    });

    // 生成 Markdown
    byChapter.forEach((bookmarks, chapterId) => {
      const chapterTitle = bookmarks[0].chapterTitle;
      markdown += `## ${chapterTitle}\n\n`;

      bookmarks.forEach(bookmark => {
        const colorEmoji = this.getColorEmoji(bookmark.color || 'gray');
        markdown += `### ${colorEmoji} 书签\n\n`;
        
        if (bookmark.selectedText) {
          markdown += `> ${bookmark.selectedText}\n\n`;
        }
        
        if (bookmark.note) {
          markdown += `**备注**: ${bookmark.note}\n\n`;
        }
        
        if (bookmark.tags && bookmark.tags.length > 0) {
          markdown += `**标签**: ${bookmark.tags.map(t => `#${t}`).join(' ')}\n\n`;
        }
        
        markdown += `*创建时间: ${new Date(bookmark.createdAt).toLocaleString()}*\n\n`;
        markdown += `---\n\n`;
      });
    });

    return markdown;
  }

  /**
   * 保存书签到文件
   */
  private async saveBookmarks(novelId: string): Promise<void> {
    try {
      const bookmarks = this.bookmarks.get(novelId) || [];
      const path = this.getBookmarksPath(novelId);
      const dir = this.getBookmarksDir();
      
      // 确保目录存在
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }
      
      await this.app.vault.adapter.write(
        path,
        JSON.stringify(bookmarks, null, 2)
      );
      
      console.log('✓ Bookmarks saved:', novelId);
    } catch (error) {
      console.error('Failed to save bookmarks:', error);
      new Notice('保存书签失败');
    }
  }

  /**
   * 加载所有书签
   */
  private async loadAllBookmarks(): Promise<void> {
    try {
      const dir = this.getBookmarksDir();
      
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
        return;
      }

      const files = await this.app.vault.adapter.list(dir);
      
      for (const file of files.files) {
        if (file.endsWith('.json')) {
          const content = await this.app.vault.adapter.read(file);
          const bookmarks: Bookmark[] = JSON.parse(content);
          const novelId = file.split('/').pop()?.replace('.json', '') || '';
          this.bookmarks.set(novelId, bookmarks);
        }
      }
      
      console.log('✓ Bookmarks loaded:', this.bookmarks.size, 'novels');
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  }

  /**
   * 获取书签目录路径
   */
  private getBookmarksDir(): string {
    return `${this.plugin.settings.libraryPath}/bookmarks`;
  }

  /**
   * 获取书签文件路径
   */
  private getBookmarksPath(novelId: string): string {
    return `${this.getBookmarksDir()}/${novelId}.json`;
  }

  /**
   * 获取颜色对应的 emoji
   */
  private getColorEmoji(color: BookmarkColor): string {
    const emojiMap: Record<BookmarkColor, string> = {
      red: '🔴',
      orange: '🟠',
      yellow: '🟡',
      green: '🟢',
      blue: '🔵',
      purple: '🟣',
      gray: '⚪'
    };
    return emojiMap[color];
  }
}
