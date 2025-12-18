/**
 * 阅读器样式管理器
 * 提供统一的样式管理接口，支持所有格式
 */

import type { UnifiedRenderer, RendererStyleSettings } from '../../types/unified-renderer';
import type NovelReaderPlugin from '../../main';

export class ReaderStyleManager {
    private renderer: UnifiedRenderer;
    private plugin: NovelReaderPlugin;
    private settings: RendererStyleSettings;
    private novelId: string;
    private defaultFontSize: number;

    constructor(renderer: UnifiedRenderer, plugin: NovelReaderPlugin, novelId: string, defaultFontSize: number = 16) {
        this.renderer = renderer;
        this.plugin = plugin;
        this.novelId = novelId;
        this.defaultFontSize = defaultFontSize;
        this.settings = this.loadSettings();
    }

    /**
     * 加载样式设置
     */
    private loadSettings(): RendererStyleSettings {
        // 从插件设置中加载，如果没有则使用默认值
        const savedSettings = this.plugin.settings.readerStyles?.[this.novelId];

        return {
            fontSize: savedSettings?.fontSize ?? this.defaultFontSize,
            fontFamily: savedSettings?.fontFamily ?? 'inherit',
            textColor: savedSettings?.textColor ?? 'var(--text-normal)',
            backgroundColor: savedSettings?.backgroundColor ?? 'var(--background-primary)',
            lineHeight: savedSettings?.lineHeight ?? 1.8,
            fontWeight: savedSettings?.fontWeight ?? 400,
            letterSpacing: savedSettings?.letterSpacing ?? 0,
            wordSpacing: savedSettings?.wordSpacing ?? 0,
            textAlign: savedSettings?.textAlign ?? 'left',
            theme: savedSettings?.theme ?? 'light',
        };
    }

    /**
     * 保存样式设置
     */
    private async saveSettings(): Promise<void> {
        if (!this.plugin.settings.readerStyles) {
            this.plugin.settings.readerStyles = {};
        }

        this.plugin.settings.readerStyles[this.novelId] = this.settings;
        await this.plugin.saveSettings();
    }

    /**
     * 设置字体大小
     */
    async setFontSize(size: number): Promise<void> {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsFontSize) {
            console.warn('当前格式不支持修改字体大小');
            return;
        }

        this.settings.fontSize = size;
        this.renderer.setFontSize(size);
        await this.saveSettings();
    }

    /**
     * 设置字体系列
     */
    async setFontFamily(family: string): Promise<void> {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsFontFamily) {
            console.warn('当前格式不支持修改字体系列');
            return;
        }

        this.settings.fontFamily = family;
        this.renderer.setFontFamily(family);
        await this.saveSettings();
    }

    /**
     * 设置文本颜色
     */
    async setTextColor(color: string): Promise<void> {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsTextColor) {
            console.warn('当前格式不支持修改文本颜色');
            return;
        }

        this.settings.textColor = color;
        this.renderer.setTextColor(color);
        await this.saveSettings();
    }

    /**
     * 设置背景颜色
     */
    async setBackgroundColor(color: string): Promise<void> {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsBackgroundColor) {
            console.warn('当前格式不支持修改背景颜色');
            return;
        }

        this.settings.backgroundColor = color;
        this.renderer.setBackgroundColor(color);
        await this.saveSettings();
    }

    /**
     * 设置行高
     */
    async setLineHeight(height: number): Promise<void> {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsLineHeight) {
            console.warn('当前格式不支持修改行高');
            return;
        }

        this.settings.lineHeight = height;
        this.renderer.setLineHeight(height);
        await this.saveSettings();
    }

    /**
     * 设置字重
     */
    async setFontWeight(weight: number): Promise<void> {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsFontWeight) {
            console.warn('当前格式不支持修改字重');
            return;
        }

        this.settings.fontWeight = weight;
        this.renderer.setFontWeight(weight);
        await this.saveSettings();
    }

    /**
     * 设置字间距
     */
    async setLetterSpacing(spacing: number): Promise<void> {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsLetterSpacing) {
            console.warn('当前格式不支持修改字间距');
            return;
        }

        this.settings.letterSpacing = spacing;
        this.renderer.setLetterSpacing(spacing);
        await this.saveSettings();
    }

    /**
     * 设置词间距
     */
    async setWordSpacing(spacing: number): Promise<void> {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsWordSpacing) {
            console.warn('当前格式不支持修改词间距');
            return;
        }

        this.settings.wordSpacing = spacing;
        this.renderer.setWordSpacing(spacing);
        await this.saveSettings();
    }

    /**
     * 设置文本对齐
     */
    async setTextAlign(align: 'left' | 'center' | 'right' | 'justify'): Promise<void> {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsTextAlign) {
            console.warn('当前格式不支持修改文本对齐');
            return;
        }

        this.settings.textAlign = align;
        this.renderer.setTextAlign(align);
        await this.saveSettings();
    }

    /**
     * 设置阅读主题
     */
    async setTheme(theme: string): Promise<void> {
        this.settings.theme = theme;

        // 设置主题对应的颜色
        switch (theme) {
            case 'sepia':
                this.settings.backgroundColor = '#f4ecd8';
                this.settings.textColor = '#5b4636';
                break;
            case 'dark':
                this.settings.backgroundColor = '#1a1a1a';
                this.settings.textColor = '#d1d1d1';
                break;
            case 'green':
                this.settings.backgroundColor = '#e7f3e7';
                this.settings.textColor = '#2d3e2d';
                break;
            case 'light':
            default:
                this.settings.backgroundColor = 'var(--background-primary)';
                this.settings.textColor = 'var(--text-normal)';
                break;
        }

        // 应用颜色到渲染器
        const capabilities = this.renderer.getCapabilities();
        if (capabilities.supportsBackgroundColor) {
            this.renderer.setBackgroundColor(this.settings.backgroundColor);
        }
        if (capabilities.supportsTextColor) {
            this.renderer.setTextColor(this.settings.textColor);
        }

        // 如果渲染器本身支持 setTheme（如 PDF 的特殊处理），则调用
        if ((this.renderer as any).setTheme) {
            (this.renderer as any).setTheme(theme);
        }
        await this.saveSettings();
    }

    /**
     * 批量应用所有设置
     */
    applyAllSettings(): void {
        const capabilities = this.renderer.getCapabilities();

        if (capabilities.supportsFontSize) {
            this.renderer.setFontSize(this.settings.fontSize);
        }
        if (capabilities.supportsFontFamily) {
            this.renderer.setFontFamily(this.settings.fontFamily);
        }
        if (capabilities.supportsTextColor) {
            this.renderer.setTextColor(this.settings.textColor);
        }
        if (capabilities.supportsBackgroundColor) {
            this.renderer.setBackgroundColor(this.settings.backgroundColor);
        }
        if (capabilities.supportsLineHeight) {
            this.renderer.setLineHeight(this.settings.lineHeight);
        }
        if (capabilities.supportsFontWeight) {
            this.renderer.setFontWeight(this.settings.fontWeight);
        }
        if (capabilities.supportsLetterSpacing && this.settings.letterSpacing !== undefined) {
            this.renderer.setLetterSpacing(this.settings.letterSpacing);
        }
        if (capabilities.supportsWordSpacing && this.settings.wordSpacing !== undefined) {
            this.renderer.setWordSpacing(this.settings.wordSpacing);
        }
        if (capabilities.supportsTextAlign && this.settings.textAlign) {
            this.renderer.setTextAlign(this.settings.textAlign);
        }
    }

    /**
     * 获取当前设置
     */
    getSettings(): RendererStyleSettings {
        return { ...this.settings };
    }

    /**
     * 获取渲染器能力
     */
    getCapabilities() {
        return this.renderer.getCapabilities();
    }

    /**
     * 重置为默认设置
     */
    async resetToDefaults(): Promise<void> {
        this.settings = {
            fontSize: this.defaultFontSize,
            fontFamily: 'inherit',
            textColor: 'var(--text-normal)',
            backgroundColor: 'var(--background-primary)',
            lineHeight: 1.8,
            fontWeight: 400,
            letterSpacing: 0,
            wordSpacing: 0,
            textAlign: 'left',
            theme: 'light',
        };

        this.applyAllSettings();
        await this.saveSettings();
    }
}
