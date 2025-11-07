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

export interface NovelReadingStatsDTO {
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
