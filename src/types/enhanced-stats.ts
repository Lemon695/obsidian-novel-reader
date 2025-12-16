/**
 * 增强的阅读统计数据类型定义
 * 版本：2.0.0
 *
 * 设计原则：
 * 1. 向后兼容 - 保留所有1.0字段
 * 2. 数据完整性 - 添加校验和和版本控制
 * 3. 分散存储 - 支持多文件拆分
 * 4. 企业级分析 - 丰富的统计维度
 */

// ============================================
// 核心数据结构
// ============================================

/**
 * 数据版本标识
 */
export const STATS_VERSION = '2.0.0';

/**
 * 阅读位置信息
 */
export interface ReadingPosition {
  chapterId: number; // 章节ID
  chapterTitle: string; // 章节标题
  scrollPosition?: number; // 滚动位置（TXT）
  cfi?: string; // EPUB CFI 位置
  pageNumber?: number; // PDF 页码
  percentage?: number; // 进度百分比（0-100）
}

/**
 * 阅读速度记录点
 */
export interface SpeedDataPoint {
  timestamp: number; // 时间戳
  speed: number; // 阅读速度（字/分钟或页/分钟）
  chapterId: number; // 章节ID
  accuracy: number; // 准确度（0-1，基于阅读时长判断）
}

/**
 * 跳读事件
 */
export interface JumpEvent {
  fromChapterId: number; // 跳出章节
  toChapterId: number; // 跳入章节
  timestamp: number; // 发生时间
  type: 'forward' | 'backward' | 'random'; // 跳读类型
}

/**
 * 重读统计
 */
export interface RereadStats {
  [chapterId: number]: {
    count: number; // 重读次数
    lastReread: number; // 最后重读时间
    totalTimeSpent: number; // 重读总时长
  };
}

/**
 * 进度追踪点
 */
export interface ProgressDataPoint {
  timestamp: number; // 时间戳
  progress: number; // 进度百分比（0-100）
  chapterId: number; // 当前章节ID
  position?: {
    // 详细位置（可选）
    line?: number; // TXT行号
    page?: number; // PDF页码
    cfi?: string; // EPUB CFI
  };
}

/**
 * 每日统计数据（增强版）
 */
export interface EnhancedDailyStats {
  totalDuration: number; // 总时长（毫秒）
  sessionsCount: number; // 会话数
  chaptersRead: number[]; // 阅读的章节ID列表
  averageSpeed: number; // 平均阅读速度
  peakSpeed: number; // 峰值速度
  readingStartTime?: number; // 当天首次阅读时间
  readingEndTime?: number; // 当天最后阅读时间
  pauseCount: number; // 暂停次数
  notes: number; // 新增笔记数
}

/**
 * 月度聚合统计
 */
export interface MonthlyStats {
  month: string; // 格式："2024-01"
  totalDuration: number; // 总时长
  daysRead: number; // 阅读天数
  averageDaily: number; // 日均阅读时长
  booksCompleted: number; // 完成书籍数
  chaptersRead: number; // 阅读章节数
}

/**
 * 时间段偏好
 */
export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * 章节难度评级（基于阅读速度）
 */
export type ChapterDifficulty = 'easy' | 'medium' | 'hard';

/**
 * 增强的章节统计
 */
export interface EnhancedChapterStats {
  timeSpent: number; // 总花费时间
  readCount: number; // 阅读次数
  lastRead: number; // 最后阅读时间
  firstRead: number; // 首次阅读时间
  averageSpeed: number; // 平均阅读速度
  peakSpeed: number; // 峰值速度
  notesCount: number; // 笔记数量
  bookmarked: boolean; // 是否书签
  difficulty: ChapterDifficulty; // 难度评级
  completionRate: number; // 完成度（0-1）
}

/**
 * 连续阅读记录
 */
export interface StreakRecord {
  start: string; // 开始日期（ISO格式）
  end: string; // 结束日期
  length: number; // 天数
  isActive: boolean; // 是否是当前连续
}

/**
 * 速度记录
 */
export interface SpeedRecords {
  fastest: number; // 最快速度
  slowest: number; // 最慢速度
  average: number; // 平均速度
  median: number; // 中位数速度
}

/**
 * 成就数据
 */
export interface Achievements {
  milestonesReached: string[]; // 已达成的成就ID
  streakRecords: {
    current: number;
    longest: number;
    longestStartDate: string;
    longestEndDate: string;
    history: StreakRecord[];
  };
  speedRecords: SpeedRecords;
  timeRecords: {
    singleSession: number; // 最长单次会话
    singleDay: number; // 单日最长
    singleWeek: number; // 单周最长
  };
}

// ============================================
// 小说统计数据结构（增强版）
// ============================================

/**
 * 增强的小说阅读统计（完整版，用于文件存储）
 */
export interface EnhancedNovelStats {
  version: typeof STATS_VERSION; // 数据版本
  novelId: string;

  // 小说元数据
  novel: {
    title: string;
    author?: string;
    type: 'txt' | 'epub' | 'pdf';
    totalChapters?: number;
    totalPages?: number; // PDF专用
    totalCharacters?: number; // TXT专用
  };

  // 基础统计（兼容1.0）
  basicStats: {
    totalReadingTime: number;
    sessionsCount: number;
    firstReadTime: number;
    lastReadTime: number;
    lastUpdateTime: number;
    dataChecksum: string; // MD5校验和
  };

  // 阅读行为分析
  behaviorStats: {
    averageReadingSpeed: number;
    speedHistory: SpeedDataPoint[];
    jumpEvents: JumpEvent[];
    rereadStats: RereadStats;
    pauseResumeCount: number;
    continuousReadingTime: number; // 最长连续阅读时长
  };

  // 进度追踪
  progressTracking: {
    currentProgress: number; // 当前百分比（0-100）
    progressHistory: ProgressDataPoint[];
    completedChapters: number[];
    bookmarkedChapters: number[];
    lastChapterId: number;
    lastPosition?: ReadingPosition; // 详细位置信息
  };

  // 时间分析
  timeAnalysis: {
    hourlyDistribution: number[]; // 24小时分布 [0-23]
    weekdayDistribution: number[]; // 星期分布 [0-6]，0=周日
    preferredTimeSlot: TimeSlot;
    dailyStats: {
      [date: string]: EnhancedDailyStats; // "YYYY-MM-DD"
    };
    monthlyStats: {
      [month: string]: MonthlyStats; // "YYYY-MM"
    };
  };

  // 章节统计
  chapterStats: {
    [chapterId: number]: EnhancedChapterStats;
  };

  // 笔记关联
  notesCorrelation: {
    totalNotes: number;
    notesPerChapter: {
      [chapterId: number]: number;
    };
    heatmapChapters: number[]; // 笔记密集的章节ID
    averageNotesPerChapter: number;
  };

  // 成就系统
  achievements: Achievements;
}

// ============================================
// 全局统计数据结构
// ============================================

/**
 * 书籍状态
 */
export type BookStatus = 'notStarted' | 'reading' | 'completed' | 'abandoned';

/**
 * 书籍排行项
 */
export interface RankingItem {
  novelId: string;
  title: string;
  value: number; // 排序值（时长/速度等）
  lastRead?: number;
}

/**
 * 年度目标
 */
export interface YearlyGoal {
  year: number;
  targetBooks: number; // 目标书籍数
  currentBooks: number; // 已完成数
  targetTime: number; // 目标阅读时长（小时）
  currentTime: number; // 已阅读时长（小时）
  progress: number; // 完成百分比（0-100）
  customGoals?: {
    // 自定义目标
    [key: string]: {
      target: number;
      current: number;
    };
  };
}

/**
 * 成就分类统计
 */
export interface AchievementCategory {
  unlocked: number;
  total: number;
  achievements: string[]; // 已解锁的成就ID列表
}

/**
 * 全局统计数据（增强版）
 */
export interface EnhancedGlobalStats {
  version: typeof STATS_VERSION;
  lastUpdate: number;

  // 书籍概览
  library: {
    totalBooks: number;
    booksCompleted: number;
    booksInProgress: number;
    booksNotStarted: number;
    booksAbandoned: number;
    booksByType: {
      txt: number;
      epub: number;
      pdf: number;
    };
    booksByStatus: {
      [status in BookStatus]: number;
    };
  };

  // 时间统计
  timeStats: {
    totalReadingTime: number; // 总时长（毫秒）
    thisYear: number;
    thisMonth: number;
    thisWeek: number;
    today: number;
    averageDaily: number; // 日均阅读时长
    averagePerBook: number; // 每本书平均时长
    longestSession: {
      duration: number;
      novelId: string;
      date: string;
    };
  };

  // 阅读习惯
  readingHabits: {
    preferredTimeSlot: TimeSlot;
    mostProductiveDay: string; // 最高效的星期几
    averageSessionLength: number;
    readingPeakHours: number[]; // 阅读高峰时段
  };

  // 连续性统计
  streaks: {
    currentStreak: number;
    longestStreak: number;
    streakStartDate: string;
    streakHistory: StreakRecord[];
  };

  // 排行榜
  rankings: {
    mostReadBooks: RankingItem[]; // TOP10
    fastestBooks: RankingItem[]; // TOP10
    recentBooks: RankingItem[]; // 最近10本
    favoriteBooks: RankingItem[]; // 收藏/重读最多
  };

  // 年度目标
  yearlyGoals: {
    [year: number]: YearlyGoal;
  };

  // 成就系统
  globalAchievements: {
    unlocked: string[];
    total: number;
    categories: {
      [category: string]: AchievementCategory;
    };
    recentUnlocked: Array<{
      achievementId: string;
      timestamp: number;
    }>;
  };
}

// ============================================
// 索引文件结构
// ============================================

/**
 * 小说索引项
 */
export interface NovelIndexEntry {
  title: string;
  author?: string;
  type: 'txt' | 'epub' | 'pdf';
  lastAccess: number;
  statsFile: string; // 相对路径
  checksum: string; // 文件校验和
  status: BookStatus;
  progress: number; // 0-100
}

/**
 * 全局索引文件
 */
export interface StatsIndexFile {
  version: typeof STATS_VERSION;
  lastUpdate: number;
  totalNovels: number;
  globalStatsFile: string; // 全局统计文件路径

  // 全局聚合数据（缓存，避免频繁计算）
  globalStats: {
    totalReadingTime: number;
    totalBooks: number;
    booksCompleted: number;
    currentStreak: number;
    longestStreak: number;
  };

  // 小说索引映射
  novelIndex: {
    [novelId: string]: NovelIndexEntry;
  };
}

// ============================================
// 会话数据结构（增强版）
// ============================================

/**
 * 增强的阅读会话记录
 */
export interface EnhancedReadingSession {
  sessionId: string;
  novelId: string;
  chapterId: number;
  chapterTitle: string;
  startTime: number;
  endTime: number | null;
  totalDuration: number;

  // 新增字段
  platform?: string; // 平台信息（可选）
  device?: string; // 设备信息（可选）
  readingSpeed?: number; // 该会话的阅读速度
  pauseCount: number; // 暂停次数
  scrollDistance?: number; // 滚动距离（可选）
  positionStart?: ReadingPosition; // 开始位置
  positionEnd?: ReadingPosition; // 结束位置
}

// ============================================
// 数据迁移相关
// ============================================

/**
 * 迁移状态
 */
export type MigrationStatus = 'pending' | 'inProgress' | 'completed' | 'failed';

/**
 * 迁移记录
 */
export interface MigrationRecord {
  version: string; // 迁移到的版本
  fromVersion: string; // 原版本
  timestamp: number;
  status: MigrationStatus;
  novelsProcessed: number;
  novelsFailed: string[]; // 失败的novelId列表
  backupPath: string; // 备份路径
  errors?: string[]; // 错误信息
}

// ============================================
// 工具类型
// ============================================

/**
 * 统计查询过滤器
 */
export interface StatsQueryFilter {
  novelId?: string;
  startDate?: number;
  endDate?: number;
  bookType?: 'txt' | 'epub' | 'pdf';
  status?: BookStatus;
  minReadingTime?: number;
  maxReadingTime?: number;
}

/**
 * 统计聚合选项
 */
export interface StatsAggregationOptions {
  groupBy: 'day' | 'week' | 'month' | 'year';
  metrics: ('time' | 'speed' | 'chapters' | 'sessions')[];
  includeEmpty?: boolean; // 是否包含空数据点
}

/**
 * 导出格式
 */
export type ExportFormat = 'json' | 'csv' | 'markdown' | 'html';

/**
 * 数据完整性检查结果
 */
export interface IntegrityCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: number;
  checksumMatches: boolean;
}
