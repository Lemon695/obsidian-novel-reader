/**
 * 应用配置常量
 *
 * 集中管理所有魔法数字和配置值，提高代码可维护性。
 * 遵循 Google Style Guide 的常量命名规范。
 */

/**
 * 时间相关常量（单位：毫秒）
 */
export const TIMING = {
  /** 缓存过期时间：5秒 */
  CACHE_EXPIRY: 5000,

  /** 保存防抖延迟：5秒 */
  SAVE_DEBOUNCE: 5000,

  /** 搜索防抖延迟：300毫秒 */
  SEARCH_DEBOUNCE: 300,

  /** 重试延迟：1秒 */
  RETRY_DELAY: 1000,

  /** 一天的毫秒数 */
  ONE_DAY: 24 * 60 * 60 * 1000,

  /** 一周的毫秒数 */
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,

  /** 动画过渡时间：快速 */
  TRANSITION_FAST: 150,

  /** 动画过渡时间：标准 */
  TRANSITION_BASE: 200,

  /** 动画过渡时间：慢速 */
  TRANSITION_SLOW: 300,
} as const;

/**
 * 文件和路径相关常量
 */
export const FILE_CONFIG = {
  /** 支持的文件格式 */
  SUPPORTED_FORMATS: ['txt', 'epub', 'pdf'] as const,

  /** 默认图书库路径 */
  DEFAULT_LIBRARY_PATH: '.obsidian/plugins/novel-reader/library',

  /** 默认封面路径 */
  DEFAULT_COVER_PATH: 'NovelNotes/covers',

  /** 默认笔记路径 */
  DEFAULT_NOTE_PATH: 'NovelNotes',

  /** 默认统计路径 */
  DEFAULT_STATS_PATH: '.obsidian/plugins/novel-reader/stats',

  /** 缓存目录名 */
  CACHE_DIR: '.cache',

  /** 文件名最大长度 */
  MAX_FILENAME_LENGTH: 255,

  /** 缓存过期时间（毫秒） */
  CACHE_EXPIRY: 5000,
} as const;

/**
 * UI 相关常量
 */
export const UI_CONFIG = {
  /** 默认字体大小（像素） */
  DEFAULT_FONT_SIZE: 18,

  /** 字体大小范围 */
  FONT_SIZE_MIN: 12,
  FONT_SIZE_MAX: 32,

  /** 默认行距 */
  DEFAULT_LINE_HEIGHT: 1.6,

  /** 行距范围 */
  LINE_HEIGHT_MIN: 1.2,
  LINE_HEIGHT_MAX: 2.5,

  /** 默认每页行数 */
  DEFAULT_LINES_PER_PAGE: 30,

  /** 菜单最小宽度（像素） */
  MENU_MIN_WIDTH: 180,

  /** 菜单最小高度（像素） */
  MENU_MIN_HEIGHT: 200,

  /** 网格视图列数 */
  GRID_COLUMNS: {
    MOBILE: 2,
    TABLET: 3,
    DESKTOP: 4,
    WIDE: 5,
  },

  /** 卡片尺寸 */
  CARD_SIZE: {
    WIDTH: 200,
    HEIGHT: 300,
    COVER_ASPECT_RATIO: 3 / 4,
  },
} as const;

/**
 * 数据库和存储相关常量
 */
export const STORAGE_CONFIG = {
  /** 最大重试次数 */
  MAX_RETRY_COUNT: 3,

  /** 批量操作的批次大小 */
  BATCH_SIZE: 50,

  /** 数据库自动保存间隔（毫秒） */
  AUTO_SAVE_INTERVAL: 5000,

  /** 最大缓存条目数 */
  MAX_CACHE_ENTRIES: 100,

  /** JSON 缩进空格数 */
  JSON_INDENT: 2,
} as const;

/**
 * 数据库配置（LokiJS）
 * 为了向后兼容，保留 DATABASE_CONFIG 别名
 */
export const DATABASE_CONFIG = {
  /** 自动保存间隔（毫秒） */
  AUTOSAVE_INTERVAL: STORAGE_CONFIG.AUTO_SAVE_INTERVAL,

  /** 最大重试次数 */
  MAX_RETRY_COUNT: STORAGE_CONFIG.MAX_RETRY_COUNT,
} as const;

/**
 * 阅读统计相关常量
 */
export const STATS_CONFIG = {
  /** 最小有效阅读时长（秒） */
  MIN_READING_DURATION: 5,

  /** 最大单次阅读时长（小时） */
  MAX_SESSION_DURATION: 12,

  /** 连续阅读天数阈值 */
  STREAK_THRESHOLD_DAYS: 1,

  /** 统计图表显示的最大天数 */
  MAX_CHART_DAYS: 30,

  /** 每章统计的最大保存数量 */
  MAX_CHAPTER_STATS: 1000,
} as const;

/**
 * 章节识别相关常量
 */
export const CHAPTER_CONFIG = {
  /** 默认章节正则表达式模式 */
  DEFAULT_PATTERNS: [
    '^第[0-9零一二三四五六七八九十百千万]+章',
    '^第[0-9零一二三四五六七八九十百千万]+节',
    '^Chapter\\s+\\d+',
    '^CHAPTER\\s+\\d+',
    '^第[0-9]+话',
    '^\\d+\\.',
    '^[0-9]+、',
    '^序章',
    '^楔子',
    '^引子',
    '^尾声',
    '^后记',
  ] as const,

  /** 章节标题最大长度 */
  MAX_TITLE_LENGTH: 100,

  /** 章节内容最小长度（字符数） */
  MIN_CONTENT_LENGTH: 50,

  /** 最大章节数量 */
  MAX_CHAPTER_COUNT: 10000,
} as const;

/**
 * 书架相关常量
 */
export const SHELF_CONFIG = {
  /** 默认书架 ID */
  DEFAULT_SHELVES: {
    READING: 'reading',
    TO_READ: 'toread',
    FINISHED: 'finished',
    ARCHIVED: 'archived',
  } as const,

  /** 书架颜色 */
  SHELF_COLORS: {
    READING: '#4caf50',
    TO_READ: '#2196f3',
    FINISHED: '#9c27b0',
    ARCHIVED: '#757575',
  } as const,

  /** 最大自定义书架数量 */
  MAX_CUSTOM_SHELVES: 50,
} as const;

/**
 * 笔记相关常量
 */
export const NOTE_CONFIG = {
  /** 笔记文件名日期格式 */
  DATE_FORMAT: 'YYYY-MM',

  /** 笔记高亮颜色 */
  HIGHLIGHT_COLOR: '#FFE4B5',

  /** 笔记最大长度（字符数） */
  MAX_NOTE_LENGTH: 10000,

  /** 每本书最大笔记数量 */
  MAX_NOTES_PER_BOOK: 1000,
} as const;

/**
 * PDF 相关常量
 */
export const PDF_CONFIG = {
  /** PDF.js Worker 文件名 */
  WORKER_FILENAME: 'pdf.worker.min.js',

  /** 默认缩放比例 */
  DEFAULT_SCALE: 1.5,

  /** 缩放范围 */
  SCALE_MIN: 0.5,
  SCALE_MAX: 3.0,

  /** 缩放步进 */
  SCALE_STEP: 0.1,

  /** 渲染质量 */
  RENDER_QUALITY: 2,
} as const;

/**
 * 获取 PDF.js Worker 的 Blob URL
 * @param app Obsidian App 实例
 * @param vaultBasePath vault 的绝对路径
 * @param manifestDir 插件的 manifest.dir 路径
 * @returns Worker 文件的 Blob URL
 */
export async function getPDFWorkerPath(
  app: any,
  vaultBasePath: string,
  manifestDir: string
): Promise<string> {
  try {
    // 构建 worker 文件的完整路径
    const workerFilePath = `${manifestDir}/${PDF_CONFIG.WORKER_FILENAME}`;
    console.log('[getPDFWorkerPath] workerFilePath:', workerFilePath);

    // 读取 worker 文件内容
    const workerContent = await app.vault.adapter.read(workerFilePath);
    console.log('[getPDFWorkerPath] Worker file loaded, size:', workerContent.length);

    // 创建 Blob 并生成 URL
    const blob = new Blob([workerContent], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    console.log('[getPDFWorkerPath] Blob URL created:', blobUrl);

    return blobUrl;
  } catch (error) {
    console.error('[getPDFWorkerPath] Failed to load worker:', error);
    throw new Error(`Failed to load PDF worker: ${error}`);
  }
}

/**
 * EPUB 相关常量
 */
export const EPUB_CONFIG = {
  /** 默认主题 */
  DEFAULT_THEME: 'light',

  /** 支持的主题 */
  THEMES: ['light', 'dark', 'sepia'] as const,

  /** 默认字体 */
  DEFAULT_FONT: 'serif',

  /** 支持的字体 */
  FONTS: ['serif', 'sans-serif', 'monospace'] as const,
} as const;

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
  // 文件相关
  FILE_NOT_FOUND: '文件不存在',
  FILE_READ_ERROR: '文件读取失败',
  FILE_WRITE_ERROR: '文件写入失败',
  UNSUPPORTED_FORMAT: '不支持的文件格式',

  // 小说相关
  NOVEL_NOT_FOUND: '图书不存在',
  NOVEL_ALREADY_EXISTS: '图书已存在',
  NOVEL_ADD_FAILED: '添加图书失败',
  NOVEL_UPDATE_FAILED: '更新图书失败',
  NOVEL_DELETE_FAILED: '删除图书失败',

  // 数据相关
  DATA_LOAD_ERROR: '数据加载失败',
  DATA_SAVE_ERROR: '数据保存失败',
  DATA_PARSE_ERROR: '数据解析失败',

  // 网络相关
  NETWORK_ERROR: '网络错误',
  TIMEOUT_ERROR: '请求超时',

  // 通用错误
  UNKNOWN_ERROR: '未知错误',
  OPERATION_CANCELLED: '操作已取消',
} as const;

/**
 * 成功消息常量
 */
export const SUCCESS_MESSAGES = {
  NOVEL_ADDED: '图书添加成功',
  NOVEL_UPDATED: '图书更新成功',
  NOVEL_DELETED: '图书删除成功',
  PROGRESS_SAVED: '进度保存成功',
  NOTE_SAVED: '笔记保存成功',
  SETTINGS_SAVED: '设置保存成功',
} as const;

/**
 * 视图类型常量
 */
export const VIEW_TYPES = {
  LIBRARY: 'novel-reader.library',
  TXT_READER: 'novel-reader.txt-novel-reader',
  EPUB_READER: 'novel-reader.epub-novel-reader',
  PDF_READER: 'novel-reader.pdf-novel-reader',
  OUTLINE: 'novel-reader.outline',
  STATS: 'novel-reader.stats',
  COMPLETED: 'novel-reader.completed',
  COLLECTION: 'novel-reader.collection',
  CHAPTER_GRID: 'novel-reader.txt-chapter-grid',
  GLOBAL_STATS: 'novel-reader.global-stats',
  GLOBAL_NOTES: 'novel-reader.global-notes',
} as const;

/**
 * 类型守卫：检查是否为支持的文件格式
 */
export function isSupportedFormat(format: string): format is typeof FILE_CONFIG.SUPPORTED_FORMATS[number] {
  return FILE_CONFIG.SUPPORTED_FORMATS.includes(format as any);
}

/**
 * 类型守卫：检查是否为有效的书架 ID
 */
export function isDefaultShelfId(id: string): id is keyof typeof SHELF_CONFIG.DEFAULT_SHELVES {
  return Object.values(SHELF_CONFIG.DEFAULT_SHELVES).includes(id as any);
}

/**
 * 获取书架颜色
 */
export function getShelfColor(shelfId: string): string {
  const shelfKey = Object.entries(SHELF_CONFIG.DEFAULT_SHELVES)
    .find(([_, value]) => value === shelfId)?.[0] as keyof typeof SHELF_CONFIG.SHELF_COLORS | undefined;

  return shelfKey ? SHELF_CONFIG.SHELF_COLORS[shelfKey] : SHELF_CONFIG.SHELF_COLORS.ARCHIVED;
}

/**
 * 格式化时间戳为相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / TIMING.ONE_DAY);

  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}月前`;
}

/**
 * 验证文件名是否合法
 */
export function isValidFilename(filename: string): boolean {
  if (!filename || filename.length === 0) return false;
  if (filename.length > FILE_CONFIG.MAX_FILENAME_LENGTH) return false;

  // 检查非法字符
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
  return !invalidChars.test(filename);
}

/**
 * 限制数值在指定范围内
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
