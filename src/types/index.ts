/**
 * PDF 大纲项
 */
export interface PDFOutline {
  title: string; // 大纲标题
  pageNum: number; // 页码
  level: number; // 层级（0 为顶层）
  children?: PDFOutline[]; // 子大纲
}

// 图书信息
export interface Novel {
  id: string;
  title: string;
  author: string;
  path: string;
  notePath?: string; // 关联的笔记文档路径
  cover?: string;
  format: 'txt' | 'epub' | 'pdf' | 'mobi';
  coverFileName?: string; // 封面文件名(EPUB封面/PDF封面)
  lastRead?: number;
  addTime: number;
  progress?: number;
  totalChapters?: number;
  currentChapter?: number;
  isHidden?: boolean;
  shelfId?: string; // 添加书架ID
  categoryId?: string; // 添加分类ID
  tags?: string[];
  customMetadata?: Record<string, any>;
  customSettings?: {
    // 存储单个自定义正则表达式
    chapterPattern?: string | undefined;
    // 存储各个阅读器的视图模式
    txtViewMode?: 'chapters' | 'pages';
    epubViewMode?: 'chapters' | 'pages';
    pdfViewMode?: 'chapters' | 'pages';
  };
  pdfMetadata?: {
    numPages?: number;
    outlines?: PDFOutline[]; // PDF 大纲信息
    lastPage?: number; // 上次阅读的页码
  };
  mobiMetadata?: {
    encoding?: string;
    version?: string;
    hasKF8?: boolean; // 是否包含 KF8
    sections?: number;
    lastSection?: number; // 上次阅读的章节
  };
}

// TXT-章节信息接口
export interface Chapter {
  id: number;
  title: string; // 章节标题
  content: string; // 章节内容
  index: number; // 章节索引
  isRead: boolean; // 是否已读
  location?: {
    start: number;
    end: number;
  };
}

// 阅读进度接口
export interface ReadingProgress {
  novelId: string;
  chapterIndex: number;
  progress: number;
  timestamp: number;
  totalChapters?: number;
  position?: {
    page?: number;
    offset?: number;
    anchor?: string;
    chapterId?: number;
    chapterTitle?: string;
    cfi: string; //EPUB字段
    percentage: number; //EPUB字段
  };
}

// 阅读器主题接口
export interface Theme {
  id: string;
  name: string;
  colors: {
    background: string;
    text: string;
    accent: string;
    border: string;
  };
  typography: {
    fontSize: number;
    lineHeight: number;
    fontFamily?: string;
  };
}

// 排序选项
export type SortOption = 'title' | 'author' | 'lastRead' | 'addTime' | 'progress';
export type SortDirection = 'asc' | 'desc';

// 视图模式
export type ViewMode = 'grid' | 'list' | 'compact';

// 阅读模式
export type ReadingMode = 'scroll' | 'paginated';

// 书签接口
export interface Bookmark {
  id: string;
  novelId: string;
  chapterIndex: number;
  position: number;
  text: string;
  note?: string;
  color?: string;
  timestamp: number;
}

declare module 'obsidian' {
  interface Workspace {
    on(name: 'novel-chapter-selected', callback: (chapterId: number) => void): EventRef;

    trigger(name: 'novel-chapter-selected', chapterId: number): void;
  }
}
