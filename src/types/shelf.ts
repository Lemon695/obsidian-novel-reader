export interface Shelf {
	id: string;
	name: string;
	sort: number;
	isDefault?: boolean;
	count?: number; // 书籍数量
}

export interface Category {
	id: string;
	name: string;
	parentId?: string;
	sort: number;
}

export interface Tag {
	id: string;
	name: string;
	color?: string;
}

// 扩展现有的 Novel 接口
export interface NovelExtension {
	shelfId?: string;
	categoryId?: string;
	tags: string[];
}

// 定义默认书架
export const DEFAULT_SHELVES: Shelf[] = [
	{ id: 'all', name: '全部', sort: 0, isDefault: true },
	{ id: 'reading', name: '在读', sort: 1, isDefault: true },
	{ id: 'toread', name: '待读', sort: 2, isDefault: true },
	{ id: 'finished', name: '已读', sort: 3, isDefault: true },
	{ id: 'archived', name: '归档', sort: 4, isDefault: true }
];

export interface CustomShelf {
	id: string;
	name: string;
	novels: string[];   // 存储图书ID数组
	created: number;    // 创建时间戳
	description?: string;  // 可选的书架描述
	icon?: string;      // 可选的图标
	sort?: number;      // 排序
	isHidden?: boolean; // 是否隐藏
}
