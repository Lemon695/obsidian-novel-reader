import type { ViewMode, ReadingMode, Theme } from './index';

export interface NovelSettings {
	// 库设置
	libraryPath: string;
	coverPath: string;
	statsPath: string;
	defaultViewMode: ViewMode;
	showHiddenBooks: boolean;
	customMetadataFields: string[];
	notePath: string; // 添加小说笔记路径设置

	// 屏蔽设置
	blockConfig: {
		patterns: string[];    // 正则表达式列表
		specificPaths: string[]; // 具体路径列表
	};

	// 读取目录设置
	readDirectories: string[];  // 指定读取小说的目录列表，为空则读取所有

	// 阅读设置
	defaultTheme: string;
	defaultFontSize: number;
	defaultLineHeight: number;
	readingMode: ReadingMode;
	showProgress: boolean;
	showChapterTitle: boolean;
	enablePageAnimation: boolean;
	scrollSmoothness: number;
	chapterDisplayMode: 'hover' | 'outline' | 'sidebar';

	// 章节设置
	chapterPatterns: Array<{
		pattern: string;
		enabled: boolean;
		description: string;
	}>;
	autoDetectChapters: boolean;

	// 备份设置
	autoBackup: boolean;
	backupInterval: number;
	backupPath: string;
	maxBackupCount: number;

	// 同步设置
	enableSync: boolean;
	syncMethod: 'local' | 'obsidian' | 'custom';
	syncInterval: number;

	// 统计系统设置（新增）
	useEnhancedStats: boolean;       // 是否启用增强统计系统
	dualWriteStats: boolean;          // 是否双写（新旧系统同时写入）
	autoMigrateStats: boolean;        // 是否自动迁移旧数据
	backupBeforeMigration: boolean;   // 迁移前是否备份

	// 界面设置
	showToolbar: boolean;
	showStatusBar: boolean;
	toolbarButtons: string[];
	customCss: string;

	// 快捷键
	keyBindings: {
		nextChapter: string;
		prevChapter: string;
		toggleNightMode: string;
		toggleBookmarks: string;
		addBookmark: string;
		addNote: string;
	};

	// 渲染器样式设置（每本书独立）
	readerStyles?: Record<string, {
		fontSize: number;
		fontFamily: string;
		textColor: string;
		backgroundColor: string;
		lineHeight: number;
		fontWeight: number;
		letterSpacing?: number;
		wordSpacing?: number;
		textAlign?: 'left' | 'center' | 'right' | 'justify';
		theme?: string;
	}>;
}

// 默认设置
export const DEFAULT_SETTINGS: NovelSettings = {
	libraryPath: '.obsidian/plugins/novel-reader/library',
	coverPath: 'NovelNotes/covers',
	statsPath: '.obsidian/plugins/novel-reader/stats',
	defaultViewMode: 'grid',
	showHiddenBooks: false,
	customMetadataFields: [],
	notePath: 'NovelNotes',

	blockConfig: {
		patterns: [],
		specificPaths: []
	},

	readDirectories: [],

	defaultTheme: 'light',
	defaultFontSize: 18,
	defaultLineHeight: 1.6,
	readingMode: 'scroll',
	showProgress: true,
	showChapterTitle: true,
	enablePageAnimation: true,
	scrollSmoothness: 0.1,
	chapterDisplayMode: 'hover',

	chapterPatterns: [
		{
			pattern: "^第[0-9零一二三四五六七八九十百千]+章\\s*.*$",
			enabled: true,
			description: "标准章节"
		},
		{
			pattern: "^Chapter\\s*[0-9]+.*$",
			enabled: true,
			description: "英文章节"
		}
	],
	autoDetectChapters: true,

	autoBackup: true,
	backupInterval: 24 * 60 * 60 * 1000, // 24小时
	backupPath: '.obsidian/plugins/novel-reader/backups',
	maxBackupCount: 5,

	enableSync: false,
	syncMethod: 'local',
	syncInterval: 30 * 60 * 1000, // 30分钟

	useEnhancedStats: true,          // 默认启用新统计系统
	dualWriteStats: true,            // 默认启用双写
	autoMigrateStats: false,         // 不自动迁移，需用户确认
	backupBeforeMigration: true,     // 迁移前必须备份

	showToolbar: true,
	showStatusBar: true,
	toolbarButtons: ['theme', 'font', 'toc', 'bookmark', 'note'],
	customCss: '',

	keyBindings: {
		nextChapter: 'ArrowRight',
		prevChapter: 'ArrowLeft',
		toggleNightMode: 'Mod+N',
		toggleBookmarks: 'Mod+B',
		addBookmark: 'Mod+D',
		addNote: 'Mod+M'
	}
};
