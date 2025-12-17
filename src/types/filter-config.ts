// 筛选配置接口
export interface FilterConfig {
    shelfId: string;
    categoryId: string; // 保留用于向后兼容
    categoryIds: string[]; // 新增：支持多分类
    categoryMode?: 'AND' | 'OR'; // 新增：分类组合逻辑
    tagIds: string[];
    tagMode?: 'AND' | 'OR'; // 新增：标签组合逻辑
    excludeTagIds?: string[]; // 新增：排除的标签
    progressStatus: 'all' | 'new' | 'reading' | 'finished';
    progressRange?: { min: number; max: number }; // 新增：进度范围
    addTimeRange: 'all' | 'week' | 'month';
    addTimePreset?: 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year'; // 新增：更多预设
    addTimeCustom?: { startDate?: number; endDate?: number }; // 新增：自定义时间范围
    stalledBooks?: { enabled: boolean; days: number }; // 新增：停滞图书筛选
}
