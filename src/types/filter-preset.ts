// 筛选预设接口
export interface FilterPreset {
    id: string;
    name: string;
    icon?: string;
    config: FilterConfig;
    created: number;
    updated: number;
    isSystem?: boolean;  // 系统预设
}

// 筛选预设系统
export interface FilterPresetSystem {
    systemPresets: FilterPreset[];
    customPresets: FilterPreset[];
}

import type { FilterConfig } from './filter-config';
