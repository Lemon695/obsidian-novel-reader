/**
 * SVG图标集合 - 简洁优美的图标设计
 * 遵循 16px 网格，笔触宽度 1.5px
 */

export const icons = {
	// 刷新图标 - 循环箭头
	refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
	</svg>`,

	// 筛选图标 - 漏斗
	filter: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
	</svg>`,

	// 图书库图标 - 书架/书本堆叠
	library: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
		<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
	</svg>`,

	// 喜爱图标 - 心形
	heart: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
	</svg>`,

	// 喜爱图标（实心） - 激活状态
	heartFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
		<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
	</svg>`,

	// 书架图标 - 文件夹
	shelf: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
	</svg>`,

	// 侧边栏切换图标
	menu: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="3" y1="12" x2="21" y2="12"/>
		<line x1="3" y1="6" x2="21" y2="6"/>
		<line x1="3" y1="18" x2="21" y2="18"/>
	</svg>`,

	// 搜索图标
	search: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="11" cy="11" r="8"/>
		<path d="m21 21-4.35-4.35"/>
	</svg>`,

	// 编辑图标
	edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
		<path d="m15 5 4 4"/>
	</svg>`,

	// 删除图标
	trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M3 6h18"/>
		<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
		<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
		<line x1="10" y1="11" x2="10" y2="17"/>
		<line x1="14" y1="11" x2="14" y2="17"/>
	</svg>`,

	// 统计图标
	barChart: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="12" y1="20" x2="12" y2="10"/>
		<line x1="18" y1="20" x2="18" y2="4"/>
		<line x1="6" y1="20" x2="6" y2="16"/>
	</svg>`,

	// 日历图标
	calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
		<line x1="16" y1="2" x2="16" y2="6"/>
		<line x1="8" y1="2" x2="8" y2="6"/>
		<line x1="3" y1="10" x2="21" y2="10"/>
	</svg>`,

	// 时钟图标
	clock: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="10"/>
		<polyline points="12 6 12 12 16 14"/>
	</svg>`,

	// 加号图标
	plus: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="12" y1="5" x2="12" y2="19"/>
		<line x1="5" y1="12" x2="19" y2="12"/>
	</svg>`,

	// 关闭图标
	x: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="18" y1="6" x2="6" y2="18"/>
		<line x1="6" y1="6" x2="18" y2="18"/>
	</svg>`,

	// 排序图标
	sort: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="m3 16 4 4 4-4"/>
		<path d="M7 20V4"/>
		<path d="m21 8-4-4-4 4"/>
		<path d="M17 4v16"/>
	</svg>`,

	// 书本图标 - 用于封面、阅读等
	book: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
		<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
	</svg>`,

	// 书籍展开图标 - 用于阅读相关
	bookOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
		<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
	</svg>`,

	// 笔记图标
	note: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
		<polyline points="14 2 14 8 20 8"/>
		<line x1="16" y1="13" x2="8" y2="13"/>
		<line x1="16" y1="17" x2="8" y2="17"/>
		<line x1="10" y1="9" x2="8" y2="9"/>
	</svg>`,

	// 标签图标
	tag: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
		<line x1="7" y1="7" x2="7.01" y2="7"/>
	</svg>`,

	// 文件夹图标（已有folder，但这是更详细的版本）
	folderOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v2"/>
	</svg>`,

	// 设置图标
	settings: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="3"/>
		<path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
	</svg>`,

	// 历史记录图标
	history: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M3 3v5h5"/>
		<path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
		<polyline points="12 7 12 12 15 15"/>
	</svg>`,

	// 列表图标 - 用于目录
	list: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="8" y1="6" x2="21" y2="6"/>
		<line x1="8" y1="12" x2="21" y2="12"/>
		<line x1="8" y1="18" x2="21" y2="18"/>
		<line x1="3" y1="6" x2="3.01" y2="6"/>
		<line x1="3" y1="12" x2="3.01" y2="12"/>
		<line x1="3" y1="18" x2="3.01" y2="18"/>
	</svg>`,

	// 信息图标
	info: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="10"/>
		<line x1="12" y1="16" x2="12" y2="12"/>
		<line x1="12" y1="8" x2="12.01" y2="8"/>
	</svg>`,

	// 缩小图标
	zoomOut: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="11" cy="11" r="8"/>
		<line x1="21" y1="21" x2="16.65" y2="16.65"/>
		<line x1="8" y1="11" x2="14" y2="11"/>
	</svg>`,

	// 放大图标
	zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="11" cy="11" r="8"/>
		<line x1="21" y1="21" x2="16.65" y2="16.65"/>
		<line x1="11" y1="8" x2="11" y2="14"/>
		<line x1="8" y1="11" x2="14" y2="11"/>
	</svg>`,

	// 关闭图标（X）
	close: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<line x1="18" y1="6" x2="6" y2="18"/>
		<line x1="6" y1="6" x2="18" y2="18"/>
	</svg>`,

	// 下载图标
	download: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
		<polyline points="7 10 12 15 17 10"/>
		<line x1="12" y1="15" x2="12" y2="3"/>
	</svg>`,

	// 趋势上升图标
	trendingUp: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
		<polyline points="17 6 23 6 23 12"/>
	</svg>`,

	// 奖杯图标
	award: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="8" r="7"/>
		<polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
	</svg>`,

	// 闪电图标
	zap: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
	</svg>`,

	// 火焰图标
	flame: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
	</svg>`,

	// 目标图标
	target: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<circle cx="12" cy="12" r="10"/>
		<circle cx="12" cy="12" r="6"/>
		<circle cx="12" cy="12" r="2"/>
	</svg>`,

	// 文件夹图标
	folder: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
	</svg>`,

	// 书签图标
	bookmark: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
	</svg>`,

	// 书签图标（实心）
	bookmarkFilled: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
		<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
	</svg>`,

	// ===== 书架系统图标 =====

	// 在读书架 - 打开的书本
	shelfReading: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
		<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
	</svg>`,

	// 待读书架 - 书本堆叠
	shelfToRead: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
		<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
	</svg>`,

	// 已读书架 - 带勾的书本
	shelfFinished: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
		<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
		<path d="M9 10l2 2 4-4"/>
	</svg>`,

	// 归档书架 - 存档盒
	shelfArchived: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<polyline points="21 8 21 21 3 21 3 8"/>
		<rect x="1" y="3" width="22" height="5"/>
		<line x1="10" y1="12" x2="14" y2="12"/>
	</svg>`,

	// 全部图书 - 书库
	shelfAll: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
		<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
		<line x1="12" y1="7" x2="12" y2="21"/>
	</svg>`,

	// 自定义书架 - 文件夹加星标
	shelfCustom: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
		<polygon points="12 10 13.5 13 17 13.5 14.5 16 15 19.5 12 17.5 9 19.5 9.5 16 7 13.5 10.5 13 12 10" fill="currentColor"/>
	</svg>`,
};

/**
 * 获取图标HTML字符串
 * @param name 图标名称
 * @returns SVG HTML字符串
 */
export function getIcon(name: keyof typeof icons): string {
	return icons[name] || '';
}

/**
 * 获取书架图标
 * @param shelfId 书架ID
 * @returns SVG HTML字符串
 */
export function getShelfIcon(shelfId: string): string {
	const iconMap: Record<string, string> = {
		'all': icons.shelfAll,
		'reading': icons.shelfReading,
		'toread': icons.shelfToRead,
		'finished': icons.shelfFinished,
		'archived': icons.shelfArchived,
	};

	return iconMap[shelfId] || icons.shelfCustom;
}
