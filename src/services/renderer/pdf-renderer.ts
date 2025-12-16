/**
 * PDF 渲染器
 * 为 PDF 格式提供统一的渲染接口
 * 
 * ⚠️ 限制说明:
 * PDF 使用 Canvas 渲染，无法修改文本样式
 * 只支持缩放（相当于字体大小）和背景颜色
 */

import type {
    UnifiedRenderer,
    NotePosition,
    RendererStyleSettings,
    RendererCapabilities,
} from '../../types/unified-renderer';
import type { Note } from '../../types/notes';

export class PdfRenderer implements UnifiedRenderer {
    private container: HTMLElement;
    private settings: RendererStyleSettings;
    private noteMarkers: Map<string, { element: HTMLElement; position: NotePosition }> = new Map();
    private zoomLevel: number = 1.0;
    private onZoomChange?: (zoom: number) => void;

    constructor(container: HTMLElement, onZoomChange?: (zoom: number) => void) {
        this.container = container;
        this.onZoomChange = onZoomChange;
        this.settings = {
            fontSize: 16,
            fontFamily: 'inherit', // ❌ 不支持
            textColor: 'var(--text-normal)', // ❌ 不支持
            backgroundColor: 'var(--background-primary)',
            lineHeight: 1.8, // ❌ 不支持
            fontWeight: 400, // ❌ 不支持
            letterSpacing: 0, // ❌ 不支持
            wordSpacing: 0, // ❌ 不支持
            textAlign: 'left', // ❌ 不支持
        };

        this.applyBackgroundColor();
    }

    /**
     * 应用背景颜色
     */
    private applyBackgroundColor(): void {
        this.container.style.backgroundColor = this.settings.backgroundColor;
    }

    /**
     * 获取渲染器能力
     */
    getCapabilities(): RendererCapabilities {
        return {
            supportsFontSize: true,        // ✅ 通过缩放实现
            supportsFontFamily: false,     // ❌ Canvas 渲染
            supportsTextColor: false,      // ❌ Canvas 渲染
            supportsBackgroundColor: true, // ✅ 容器背景
            supportsLineHeight: false,     // ❌ Canvas 渲染
            supportsFontWeight: false,     // ❌ Canvas 渲染
            supportsLetterSpacing: false,  // ❌ Canvas 渲染
            supportsWordSpacing: false,    // ❌ Canvas 渲染
            supportsTextAlign: false,      // ❌ Canvas 渲染
            supportsNoteMarkers: true,     // ✅ 覆盖层
            supportsTextSelection: true,   // ✅ Text layer
        };
    }

    /**
     * 渲染内容
     */
    async render(content: any): Promise<void> {
        // PDF 渲染由 PDFReaderViewComponent 和 PDF.js 处理
        // 这里只需要应用背景颜色
        this.applyBackgroundColor();
    }

    /**
     * 获取当前内容
     */
    getContent(): any {
        return this.container;
    }

    /**
     * 设置字体大小（通过缩放实现）
     */
    setFontSize(size: number): void {
        this.settings.fontSize = size;

        // 计算缩放级别（基准 16px）
        const baseSize = 16;
        this.zoomLevel = size / baseSize;

        // 通知外部组件重新渲染
        if (this.onZoomChange) {
            this.onZoomChange(this.zoomLevel);
        }
    }

    /**
     * 设置字体系列（不支持）
     */
    setFontFamily(family: string): void {
        console.warn('PDF 格式不支持修改字体系列（Canvas 渲染）');
        this.settings.fontFamily = family; // 保存但不应用
    }

    /**
     * 设置文本颜色（不支持）
     */
    setTextColor(color: string): void {
        console.warn('PDF 格式不支持修改文本颜色（Canvas 渲染）');
        this.settings.textColor = color; // 保存但不应用
    }

    /**
     * 设置背景颜色
     */
    setBackgroundColor(color: string): void {
        this.settings.backgroundColor = color;
        this.applyBackgroundColor();
    }

    /**
     * 设置行高（不支持）
     */
    setLineHeight(height: number): void {
        console.warn('PDF 格式不支持修改行高（Canvas 渲染）');
        this.settings.lineHeight = height; // 保存但不应用
    }

    /**
     * 设置字重（不支持）
     */
    setFontWeight(weight: number): void {
        console.warn('PDF 格式不支持修改字重（Canvas 渲染）');
        this.settings.fontWeight = weight; // 保存但不应用
    }

    /**
     * 设置字间距（不支持）
     */
    setLetterSpacing(spacing: number): void {
        console.warn('PDF 格式不支持修改字间距（Canvas 渲染）');
        this.settings.letterSpacing = spacing; // 保存但不应用
    }

    /**
     * 设置词间距（不支持）
     */
    setWordSpacing(spacing: number): void {
        console.warn('PDF 格式不支持修改词间距（Canvas 渲染）');
        this.settings.wordSpacing = spacing; // 保存但不应用
    }

    /**
     * 设置文本对齐（不支持）
     */
    setTextAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
        console.warn('PDF 格式不支持修改文本对齐（Canvas 渲染）');
        this.settings.textAlign = align; // 保存但不应用
    }

    /**
     * 批量应用样式
     */
    applyStyles(settings: Partial<RendererStyleSettings>): void {
        this.settings = { ...this.settings, ...settings };

        // 只应用支持的样式
        if (settings.fontSize !== undefined) {
            this.setFontSize(settings.fontSize);
        }
        if (settings.backgroundColor !== undefined) {
            this.setBackgroundColor(settings.backgroundColor);
        }
    }

    /**
     * 获取当前样式
     */
    getStyles(): RendererStyleSettings {
        return { ...this.settings };
    }

    /**
     * 添加笔记标记（使用覆盖层）
     */
    addNoteMarker(position: NotePosition, note: Note): void {
        if (position.type !== 'page-coord') {
            console.warn('PdfRenderer 只支持 page-coord 类型的位置');
            return;
        }

        // 创建覆盖层标记
        const marker = document.createElement('div');
        marker.className = 'pdf-note-marker';
        marker.textContent = '📝';
        marker.dataset.noteId = note.id;
        marker.title = note.content;

        // 定位标记
        marker.style.position = 'absolute';
        marker.style.left = `${position.x}px`;
        marker.style.top = `${position.y}px`;
        marker.style.cursor = 'pointer';
        marker.style.fontSize = '14px';
        marker.style.opacity = '0.7';
        marker.style.transition = 'opacity 0.2s';
        marker.style.userSelect = 'none';
        marker.style.zIndex = '1000';

        // 悬停效果
        marker.addEventListener('mouseenter', () => {
            marker.style.opacity = '1';
        });
        marker.addEventListener('mouseleave', () => {
            marker.style.opacity = '0.7';
        });

        // 添加到容器
        this.container.appendChild(marker);

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
            markerData.element.style.opacity = '1';
            markerData.element.style.animation = 'pulse 1s ease-in-out 3';
        }
    }

    /**
     * 取消高亮
     */
    unhighlightNote(noteId: string): void {
        const markerData = this.noteMarkers.get(noteId);
        if (markerData) {
            markerData.element.style.opacity = '0.7';
            markerData.element.style.animation = '';
        }
    }

    /**
     * 滚动到位置
     */
    scrollToPosition(position: NotePosition): void {
        if (position.type !== 'page-coord') {
            console.warn('PdfRenderer 只支持 page-coord 类型的位置');
            return;
        }

        // 滚动到指定页面和坐标
        // 这需要外部组件配合（跳转到页面）
        console.log('滚动到 PDF 位置:', position);
    }

    /**
     * 获取当前位置
     */
    getCurrentPosition(): NotePosition | null {
        // PDF 的当前位置需要外部组件提供（当前页码）
        // 这里返回 null，由外部组件实现
        return null;
    }

    /**
     * 获取当前缩放级别
     */
    getZoomLevel(): number {
        return this.zoomLevel;
    }

    /**
     * 清理资源
     */
    destroy(): void {
        // 清除所有笔记标记
        this.noteMarkers.forEach((markerData) => {
            markerData.element.remove();
        });
        this.noteMarkers.clear();

        // 重置背景颜色
        this.container.style.backgroundColor = '';
    }
}
