/**
 * 应用配置常量
 * 集中管理应用中的魔术数字，提升代码可维护性
 */

/**
 * 时间相关配置（毫秒）
 */
export const TIMING = {
	/** 保存操作防抖延迟 */
	SAVE_DEBOUNCE: 1000,

	/** 重试操作延迟 */
	RETRY_DELAY: 1000,

	/** 自动保存间隔 */
	AUTOSAVE_INTERVAL: 4000,

	/** 阅读会话自动保存间隔 */
	READING_SESSION_SAVE: 60000, // 1分钟

	/** UI动画持续时间 */
	ANIMATION_DURATION: {
		FAST: 150,
		NORMAL: 200,
		SLOW: 300,
	},
} as const;

/**
 * 文件处理配置
 */
export const FILE_CONFIG = {
	/** 最大重试次数 */
	MAX_RETRY_COUNT: 3,

	/** 大文件阈值（字节） */
	LARGE_FILE_THRESHOLD: 1024 * 1024 * 10, // 10MB

	/** 缓存过期时间（毫秒） */
	CACHE_EXPIRY: 1000 * 60 * 15, // 15分钟
} as const;

/**
 * 章节解析配置
 */
export const CHAPTER_CONFIG = {
	/** 最小章节标题长度 */
	MIN_TITLE_LENGTH: 1,

	/** 最大章节标题长度 */
	MAX_TITLE_LENGTH: 100,

	/** 章节内容最小行数 */
	MIN_CONTENT_LINES: 3,

	/** 默认章节正则表达式 */
	DEFAULT_PATTERN: /^第[0-9一二三四五六七八九十百千]+[章节回]/,
} as const;

/**
 * UI配置
 */
export const UI_CONFIG = {
	/** 默认页面大小 */
	DEFAULT_PAGE_SIZE: 20,

	/** 加载更多触发距离（像素） */
	LOAD_MORE_THRESHOLD: 100,

	/** Toast消息显示时长（毫秒） */
	TOAST_DURATION: 3000,

	/** 菜单最小宽度（像素） */
	MENU_MIN_WIDTH: 150,

	/** z-index层级 */
	Z_INDEX: {
		MODAL: 1000,
		DROPDOWN: 1000,
		TOOLTIP: 2000,
		NOTIFICATION: 3000,
	},
} as const;

/**
 * 阅读器配置
 */
export const READER_CONFIG = {
	/** PDF默认缩放级别 */
	PDF_DEFAULT_ZOOM: 1.5,

	/** PDF最小缩放 */
	PDF_MIN_ZOOM: 0.5,

	/** PDF最大缩放 */
	PDF_MAX_ZOOM: 3.0,

	/** PDF缩放步进 */
	PDF_ZOOM_STEP: 0.1,

	/** 默认字体大小（px） */
	DEFAULT_FONT_SIZE: 16,

	/** 默认行高 */
	DEFAULT_LINE_HEIGHT: 1.8,
} as const;

/**
 * 数据库配置
 */
export const DATABASE_CONFIG = {
	/** 数据库自动保存间隔（毫秒） */
	AUTOSAVE_INTERVAL: 4000,

	/** 批量操作大小 */
	BATCH_SIZE: 100,
} as const;
