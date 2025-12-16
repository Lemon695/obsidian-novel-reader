// 筛选配置接口
export interface FilterConfig {
    shelfId: string;
    categoryId: string;
    tagIds: string[];
    progressStatus: 'all' | 'new' | 'reading' | 'finished';
    addTimeRange: 'all' | 'week' | 'month';
}
