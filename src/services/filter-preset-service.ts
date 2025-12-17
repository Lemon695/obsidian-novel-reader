import { App, TFile } from 'obsidian';
import type NovelReaderPlugin from '../main';
import type { FilterPreset, FilterPresetSystem } from '../types/filter-preset';
import type { FilterConfig } from '../types/filter-config';

export class FilterPresetService {
    private app: App;
    private plugin: NovelReaderPlugin;
    private presets: FilterPresetSystem = {
        systemPresets: [],
        customPresets: [],
    };

    constructor(app: App, plugin: NovelReaderPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.initializeSystemPresets();
    }

    // 初始化系统预设
    private initializeSystemPresets() {
        this.presets.systemPresets = [
            {
                id: 'reading-now',
                name: '正在阅读',
                icon: '📖',
                config: {
                    shelfId: 'reading',
                    categoryId: '',
                    categoryIds: [],
                    tagIds: [],
                    progressStatus: 'reading',
                    addTimeRange: 'all',
                },
                created: Date.now(),
                updated: Date.now(),
                isSystem: true,
            },
            {
                id: 'new-arrivals',
                name: '新书到货',
                icon: '🆕',
                config: {
                    shelfId: 'all',
                    categoryId: '',
                    categoryIds: [],
                    tagIds: [],
                    progressStatus: 'new',
                    addTimeRange: 'week',
                    addTimePreset: 'week',
                },
                created: Date.now(),
                updated: Date.now(),
                isSystem: true,
            },
            {
                id: 'to-read',
                name: '待读书单',
                icon: '📚',
                config: {
                    shelfId: 'toread',
                    categoryId: '',
                    categoryIds: [],
                    tagIds: [],
                    progressStatus: 'all',
                    addTimeRange: 'all',
                },
                created: Date.now(),
                updated: Date.now(),
                isSystem: true,
            },
            {
                id: 'finished',
                name: '已读完成',
                icon: '✅',
                config: {
                    shelfId: 'finished',
                    categoryId: '',
                    categoryIds: [],
                    tagIds: [],
                    progressStatus: 'finished',
                    addTimeRange: 'all',
                },
                created: Date.now(),
                updated: Date.now(),
                isSystem: true,
            },
        ];
    }

    // 获取预设文件路径
    private getPresetsFilePath(): string {
        return `${this.plugin.settings.libraryPath}/filter-presets.json`;
    }

    // 加载预设
    async loadPresets(): Promise<void> {
        try {
            const filePath = this.getPresetsFilePath();
            const file = this.app.vault.getAbstractFileByPath(filePath);

            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                const data = JSON.parse(content);
                this.presets.customPresets = data.customPresets || [];
            }
        } catch (error) {
            console.error('Failed to load filter presets:', error);
            this.presets.customPresets = [];
        }
    }

    // 保存预设
    async savePresets(): Promise<void> {
        try {
            const filePath = this.getPresetsFilePath();
            const data = {
                customPresets: this.presets.customPresets,
            };

            const content = JSON.stringify(data, null, 2);
            const file = this.app.vault.getAbstractFileByPath(filePath);

            if (file instanceof TFile) {
                await this.app.vault.modify(file, content);
            } else {
                await this.app.vault.create(filePath, content);
            }
        } catch (error) {
            console.error('Failed to save filter presets:', error);
        }
    }

    // 获取所有预设
    getAllPresets(): FilterPreset[] {
        return [...this.presets.systemPresets, ...this.presets.customPresets];
    }

    // 获取系统预设
    getSystemPresets(): FilterPreset[] {
        return this.presets.systemPresets;
    }

    // 获取自定义预设
    getCustomPresets(): FilterPreset[] {
        return this.presets.customPresets;
    }

    // 根据ID获取预设
    getPresetById(id: string): FilterPreset | undefined {
        return this.getAllPresets().find((preset) => preset.id === id);
    }

    // 创建预设
    async createPreset(name: string, config: FilterConfig, icon?: string): Promise<FilterPreset> {
        const preset: FilterPreset = {
            id: `custom-${Date.now()}`,
            name,
            icon,
            config,
            created: Date.now(),
            updated: Date.now(),
            isSystem: false,
        };

        this.presets.customPresets.push(preset);
        await this.savePresets();
        return preset;
    }

    // 更新预设
    async updatePreset(id: string, updates: Partial<FilterPreset>): Promise<void> {
        const preset = this.presets.customPresets.find((p) => p.id === id);
        if (preset) {
            Object.assign(preset, updates, { updated: Date.now() });
            await this.savePresets();
        }
    }

    // 删除预设
    async deletePreset(id: string): Promise<void> {
        const index = this.presets.customPresets.findIndex((p) => p.id === id);
        if (index !== -1) {
            this.presets.customPresets.splice(index, 1);
            await this.savePresets();
        }
    }

    // 导出预设
    exportPreset(id: string): string | null {
        const preset = this.getPresetById(id);
        if (preset) {
            return JSON.stringify(preset, null, 2);
        }
        return null;
    }

    // 导入预设
    async importPreset(presetJson: string): Promise<FilterPreset | null> {
        try {
            const preset = JSON.parse(presetJson) as FilterPreset;
            // 生成新ID避免冲突
            preset.id = `custom-${Date.now()}`;
            preset.isSystem = false;
            preset.created = Date.now();
            preset.updated = Date.now();

            this.presets.customPresets.push(preset);
            await this.savePresets();
            return preset;
        } catch (error) {
            console.error('Failed to import preset:', error);
            return null;
        }
    }
}
