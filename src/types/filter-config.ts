// 筛选配置接口
export interface FilterConfig {
    shelfId?: string;
    categoryId?: string;
    categoryIds?: string[]; // 多选分类
    categoryMode?: 'AND' | 'OR'; // 分类匹配模式
    tagIds?: string[];
    tagMode?: 'AND' | 'OR'; // 标签匹配模式：AND=同时满足所有标签，OR=满足任一标签
    excludeTagIds?: string[]; // 排除的标签
    progressStatus?: 'all' | 'new' | 'reading' | 'finished';
    progressRange?: { min: number; max: number };
    addTimeRange?: string;
    addTimePreset?: string; // 预设时间范围
    addTimeCustom?: { startDate: string; endDate: string }; // 自定义时间范围
    stalledBooks?: {
        // 搁置图书筛选
        enabled: boolean;
        days: number; // 多少天未读算搁置
    };
    formats?: string[]; // 格式筛选：PDF, EPUB, MOBI, TXT
}
