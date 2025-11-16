// 图书信息
export interface Novel {
	id: string;
	title: string;
	author: string;
	path: string;
	notePath?: string; // 关联的笔记文档路径
	cover?: string;
	format: 'txt' | 'epub' | 'pdf';
	coverFileName?: string;  // 封面文件名(EPUB封面/PDF封面)
	lastRead?: number;
	addTime: number;
	progress?: number;
	totalChapters?: number;
	currentChapter?: number;
	isHidden?: boolean;
	shelfId?: string;    // 添加书架ID
	categoryId?: string; // 添加分类ID
	tags?: string[];
	customMetadata?: Record<string, any>;
	customSettings?: {
		// 存储单个自定义正则表达式
		chapterPattern?: string | undefined;
		// 存储各个阅读器的视图模式
		txtViewMode?: 'scroll' | 'chapters';
		epubViewMode?: 'scroll' | 'chapters';
		pdfViewMode?: 'chapters' | 'pages';
	};
	pdfMetadata?: {
		numPages?: number;
		outlines?: any[];  // PDF 大纲信息
		lastPage?: number; // 上次阅读的页码
	};
}

// TXT-章节信息接口
export interface Chapter {
	id: number;
	title: string;        // 章节标题
	content: string;      // 章节内容
	index: number;        // 章节索引
	isRead: boolean;      // 是否已读
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

// 笔记接口
export interface Note {
	id: string;
	novelId: string;
	chapterIndex: number;
	selection: {
		start: number;
		end: number;
		text: string;
	};
	content: string;
	timestamp: number;
	tags?: string[];
}

declare module 'obsidian' {
	interface Workspace {
		on(name: 'novel-chapter-selected', callback: (chapterId: number) => void): EventRef;

		trigger(name: 'novel-chapter-selected', chapterId: number): void;
	}
}
