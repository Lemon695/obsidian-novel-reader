/**
 * MOBI 渲染器
 * 为 MOBI 格式提供统一的渲染接口
 */

import type {
    UnifiedRenderer,
    NotePosition,
    RendererStyleSettings,
    RendererCapabilities,
} from '../../types/unified-renderer';
import type { Note } from '../../types/notes';

export class MobiRenderer implements UnifiedRenderer {
    private container: HTMLElement;
    private settings: RendererStyleSettings;
    private noteMarkers: Map<string, { element: HTMLElement; position: NotePosition }> = new Map();
    private styleElement: HTMLStyleElement | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        this.settings = {
            fontSize: 16,
            fontFamily: 'inherit',
            textColor: 'var(--text-normal)',
            backgroundColor: 'var(--background-primary)',
            lineHeight: 1.8,
            fontWeight: 400,
            letterSpacing: 0,
            wordSpacing: 0,
            textAlign: 'left',
        };

        this.initializeStyles();
    }

    /**
     * 初始化样式元素
     */
    private initializeStyles(): void {
        this.styleElement = document.createElement('style');
        this.styleElement.id = 'mobi-renderer-styles';
        document.head.appendChild(this.styleElement);
        this.updateStyles();
    }

    /**
     * 更新样式
     */
    private updateStyles(): void {
        if (!this.styleElement) return;

        const css = `
      .mobi-reader-content {
        font-size: ${this.settings.fontSize}px !important;
        font-family: ${this.settings.fontFamily} !important;
        color: ${this.settings.textColor} !important;
        background-color: ${this.settings.backgroundColor} !important;
        line-height: ${this.settings.lineHeight} !important;
        font-weight: ${this.settings.fontWeight} !important;
        letter-spacing: ${this.settings.letterSpacing}px !important;
        word-spacing: ${this.settings.wordSpacing}px !important;
        text-align: ${this.settings.textAlign} !important;
      }

      .mobi-reader-content * {
        font-size: inherit !important;
        font-family: inherit !important;
        color: inherit !important;
        line-height: inherit !important;
        font-weight: inherit !important;
        letter-spacing: inherit !important;
        word-spacing: inherit !important;
      }

      .mobi-reader-content p,
      .mobi-reader-content div {
        text-align: ${this.settings.textAlign} !important;
      }

      .mobi-note-marker {
        display: inline-block;
        margin-left: 4px;
        cursor: pointer;
        font-size: 14px;
        opacity: 0.7;
        transition: opacity 0.2s;
        user-select: none;
      }

      .mobi-note-marker:hover {
        opacity: 1;
      }

      .mobi-note-marker.highlighted {
        opacity: 1;
        animation: pulse 1s ease-in-out 3;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }
    `;

        this.styleElement.textContent = css;
    }

    /**
     * 获取渲染器能力
     */
    getCapabilities(): RendererCapabilities {
        return {
            supportsFontSize: true,
            supportsFontFamily: true,
            supportsTextColor: true,
            supportsBackgroundColor: true,
            supportsLineHeight: true,
            supportsFontWeight: true,
            supportsLetterSpacing: true,
            supportsWordSpacing: true,
            supportsTextAlign: true,
            supportsNoteMarkers: true,
            supportsTextSelection: true,
        };
    }

    /**
     * 渲染内容
     */
    async render(content: any): Promise<void> {
        // MOBI 渲染由 MobiReaderViewComponent 处理
        // 这里只需要确保容器有正确的类名
        this.container.classList.add('mobi-reader-content');
    }

    /**
     * 获取当前内容
     */
    getContent(): any {
        return this.container.innerHTML;
    }

    /**
     * 设置字体大小
     */
    setFontSize(size: number): void {
        this.settings.fontSize = size;
        this.updateStyles();
    }

    /**
     * 设置字体系列
     */
    setFontFamily(family: string): void {
        this.settings.fontFamily = family;
        this.updateStyles();
    }

    /**
     * 设置文本颜色
     */
    setTextColor(color: string): void {
        this.settings.textColor = color;
        this.updateStyles();
    }

    /**
     * 设置背景颜色
     */
    setBackgroundColor(color: string): void {
        this.settings.backgroundColor = color;
        this.updateStyles();
    }

    /**
     * 设置行高
     */
    setLineHeight(height: number): void {
        this.settings.lineHeight = height;
        this.updateStyles();
    }

    /**
     * 设置字重
     */
    setFontWeight(weight: number): void {
        this.settings.fontWeight = weight;
        this.updateStyles();
    }

    /**
     * 设置字间距
     */
    setLetterSpacing(spacing: number): void {
        this.settings.letterSpacing = spacing;
        this.updateStyles();
    }

    /**
     * 设置词间距
     */
    setWordSpacing(spacing: number): void {
        this.settings.wordSpacing = spacing;
        this.updateStyles();
    }

    /**
     * 设置文本对齐
     */
    setTextAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
        this.settings.textAlign = align;
        this.updateStyles();
    }

    /**
     * 批量应用样式
     */
    applyStyles(settings: Partial<RendererStyleSettings>): void {
        this.settings = { ...this.settings, ...settings };
        this.updateStyles();
    }

    /**
     * 获取当前样式
     */
    getStyles(): RendererStyleSettings {
        return { ...this.settings };
    }

    /**
     * 根据 DOM 路径查找元素
     */
    private getElementByPath(path: string): HTMLElement | null {
        try {
            return this.container.querySelector(path);
        } catch (error) {
            console.error('无效的 DOM 路径:', path, error);
            return null;
        }
    }

    /**
     * 添加笔记标记
     */
    addNoteMarker(position: NotePosition, note: Note): void {
        if (position.type !== 'dom-path') {
            console.warn('MobiRenderer 只支持 dom-path 类型的位置');
            return;
        }

        const targetElement = this.getElementByPath(position.path);
        if (!targetElement) {
            console.warn(`找不到路径 ${position.path} 的元素`);
            return;
        }

        // 创建笔记标记
        const marker = document.createElement('span');
        marker.className = 'mobi-note-marker';
        marker.textContent = '📝';
        marker.dataset.noteId = note.id;
        marker.title = note.content;

        // 添加到目标元素
        targetElement.appendChild(marker);

        // 保存引用
        this.noteMarkers.set(note.id, { element: marker, position });
    }

    /**
     * 删除笔记标记
     */
    removeNoteMarker(noteId: string): void {
        const markerData = this.noteMarkers.get(noteId);
        if (markerData) {
            markerData.element.remove();
            this.noteMarkers.delete(noteId);
        }
    }

    /**
     * 更新笔记标记
     */
    updateNoteMarker(noteId: string, note: Note): void {
        const markerData = this.noteMarkers.get(noteId);
        if (markerData) {
            markerData.element.title = note.content;
        }
    }

    /**
     * 获取笔记位置
     */
    getNotePosition(noteId: string): NotePosition | null {
        const markerData = this.noteMarkers.get(noteId);
        return markerData ? markerData.position : null;
    }

    /**
     * 高亮笔记
     */
    highlightNote(noteId: string): void {
        const markerData = this.noteMarkers.get(noteId);
        if (markerData) {
            markerData.element.classList.add('highlighted');
        }
    }

    /**
     * 取消高亮
     */
    unhighlightNote(noteId: string): void {
        const markerData = this.noteMarkers.get(noteId);
        if (markerData) {
            markerData.element.classList.remove('highlighted');
        }
    }

    /**
     * 滚动到位置
     */
    scrollToPosition(position: NotePosition): void {
        if (position.type !== 'dom-path') {
            console.warn('MobiRenderer 只支持 dom-path 类型的位置');
            return;
        }

        const element = this.getElementByPath(position.path);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * 获取当前位置
     */
    getCurrentPosition(): NotePosition | null {
        // 获取视口中间的元素
        const containerRect = this.container.getBoundingClientRect();
        const centerY = containerRect.top + containerRect.height / 2;

        const elements = this.container.querySelectorAll('p, div');
        for (const element of Array.from(elements)) {
            const elementRect = element.getBoundingClientRect();
            if (elementRect.top <= centerY && elementRect.bottom >= centerY) {
                // 生成 CSS 选择器路径
                const path = this.generateCssPath(element as HTMLElement);
                return { type: 'dom-path', path };
            }
        }

        return null;
    }

    /**
     * 生成元素的 CSS 路径
     */
    private generateCssPath(element: HTMLElement): string {
        const path: string[] = [];
        let current: HTMLElement | null = element;

        while (current && current !== this.container) {
            let selector = current.tagName.toLowerCase();

            // 添加 nth-child 以确保唯一性
            if (current.parentElement) {
                const siblings = Array.from(current.parentElement.children);
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    /**
     * 清理资源
     */
    destroy(): void {
        // 移除样式元素
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }

        // 清除所有笔记标记
        this.noteMarkers.forEach((markerData) => {
            markerData.element.remove();
        });
        this.noteMarkers.clear();

        // 移除容器类名
        this.container.classList.remove('mobi-reader-content');
    }
}
