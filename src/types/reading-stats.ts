interface ChapterStats {
	timeSpent: number;
	readCount: number;
	lastRead: number;
}

interface ChapterStats {
	timeSpent: number;
	readCount: number;
	lastRead: number;
}

interface DailyStats {
	totalDuration: number;
	sessionsCount: number;
	chaptersRead: number;
}

export interface NovelReadingStats extends LokiObj {
	novelId: string;
	stats: {
		totalReadingTime: number;
		sessionsCount: number;
		firstReadTime: number; // 添加首次阅读时间
		lastReadTime: number;
		averageSessionTime: number;
		dailyStats: { [key: string]: DailyStats };
		chapterStats: { [key: number]: ChapterStats };
	};
}

export interface ReadingSession {
	sessionId: string;
	novelId: string;
	chapterId: number;
	chapterTitle: string;
	startTime: number;
	endTime: number | null;
	totalDuration: number;
}

export interface ChapterHistory {
	novelId: string;
	chapterId: number;
	chapterTitle: string;
	timestamp: number;
	readingDuration?: number;
	isImportant?: boolean;
}

export interface NovelChapterHistory {
	[novelId: string]: ChapterHistory[];
}

export interface ReadingStats {
	todayTime: number;
	totalTime: number;
	averageSpeed: number;
	readingDays: number;
	dailyStats: Array<{
		date: string;
		minutes: number;
		speed?: number;
	}>;
	speedStats: Array<{
		time: string;
		speed: number;
	}>;
	completionRate: number;
	lastChapter: string;
	readingStreak: number;
	firstReadTime: string;
}

// 公共数据处理接口
interface ReaderStats {
	readTime: number;
	progress: number;
}

// 格式特定的数据扩展
interface TxtReaderStats extends ReaderStats {
	chaptersRead: number;
}

interface PdfReaderStats extends ReaderStats {
	pagesRead: number;
}
