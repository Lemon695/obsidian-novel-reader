import { App } from 'obsidian';
import type NovelReaderPlugin from '../main';
import type { FilterConfig } from '../types/filter-config';
import { PathsService } from "./utils/paths-service";

export class FilterStateService {
    private app: App;
    private plugin: NovelReaderPlugin;
    private currentState: FilterConfig | null = null;
    private pathsService!: PathsService;

    constructor(app: App, plugin: NovelReaderPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.pathsService = this.plugin.pathsService;
    }

    // 加载筛选状态
    async loadFilterState(): Promise<FilterConfig | null> {
        try {
            const path = this.pathsService.getFilterStateFilePath();
            if (await this.app.vault.adapter.exists(path)) {
                const data = await this.app.vault.adapter.read(path);
                this.currentState = JSON.parse(data);
                return this.currentState;
            }
        } catch (error) {
            console.error('Failed to load filter state:', error);
        }
        return null;
    }

    // 保存筛选状态
    async saveFilterState(filters: FilterConfig): Promise<void> {
        try {
            const path = this.pathsService.getFilterStateFilePath();
            await this.app.vault.adapter.write(
                path,
                JSON.stringify(filters, null, 2)
            );
            this.currentState = filters;
        } catch (error) {
            console.error('Failed to save filter state:', error);
            throw error;
        }
    }

    // 清除筛选状态
    async clearFilterState(): Promise<void> {
        try {
            const path = this.pathsService.getFilterStateFilePath();
            if (await this.app.vault.adapter.exists(path)) {
                await this.app.vault.adapter.remove(path);
            }
            this.currentState = null;
        } catch (error) {
            console.error('Failed to clear filter state:', error);
        }
    }

    // 获取当前状态
    getCurrentState(): FilterConfig | null {
        return this.currentState;
    }
}
