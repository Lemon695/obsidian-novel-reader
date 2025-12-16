/**
 * 书签功能类型定义
 */

/**
 * 书签颜色枚举
 */
export type BookmarkColor = 
  | 'red'      // 重要
  | 'orange'   // 待办
  | 'yellow'   // 标记
  | 'green'    // 完成
  | 'blue'     // 信息
  | 'purple'   // 问题
  | 'gray';    // 默认

/**
 * 位置类型
 */
export type PositionType = 'offset' | 'page' | 'percentage';

/**
 * 书签接口
 */
export interface Bookmark {
  // 基础信息
  id: string;                    // 唯一标识符
  novelId: string;               // 所属小说ID
  novelTitle: string;            // 小说标题
  
  // 位置信息
  chapterId: number;             // 章节ID
  chapterTitle: string;          // 章节标题
  position: number;              // 在章节中的位置
  positionType: PositionType;    // 位置类型
  
  // 内容信息
  contextBefore?: string;        // 书签位置前的文本
  contextAfter?: string;         // 书签位置后的文本
  selectedText?: string;         // 选中的文本
  
  // 元数据
  note?: string;                 // 书签备注
  color?: BookmarkColor;         // 书签颜色
  tags?: string[];               // 书签标签
  category?: string;             // 书签分类
  
  // 时间戳
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
  lastAccessedAt?: number;       // 最后访问时间
  
  // 统计信息
  accessCount?: number;          // 访问次数
}

/**
 * 书签分类
 */
export interface BookmarkCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description?: string;
}

/**
 * 书签统计
 */
export interface BookmarkStats {
  total: number;
  byColor: Record<BookmarkColor, number>;
  byCategory: Record<string, number>;
  recentlyAdded: Bookmark[];
  mostAccessed: Bookmark[];
}

/**
 * 添加书签参数
 */
export interface AddBookmarkParams {
  novelId: string;
  novelTitle: string;
  chapterId: number;
  chapterTitle: string;
  position: number;
  positionType?: PositionType;
  selectedText?: string;
  contextBefore?: string;
  contextAfter?: string;
  note?: string;
  color?: BookmarkColor;
  tags?: string[];
  category?: string;
}

/**
 * 颜色配置
 */
export interface ColorConfig {
  value: BookmarkColor;
  label: string;
  color: string;
  emoji: string;
}

/**
 * 预定义颜色配置
 */
export const BOOKMARK_COLORS: ColorConfig[] = [
  { value: 'red', label: '重要', color: '#ef4444', emoji: '🔴' },
  { value: 'orange', label: '待办', color: '#f97316', emoji: '🟠' },
  { value: 'yellow', label: '标记', color: '#eab308', emoji: '🟡' },
  { value: 'green', label: '完成', color: '#22c55e', emoji: '🟢' },
  { value: 'blue', label: '信息', color: '#3b82f6', emoji: '🔵' },
  { value: 'purple', label: '问题', color: '#a855f7', emoji: '🟣' },
  { value: 'gray', label: '默认', color: '#6b7280', emoji: '⚪' }
];
