/**
 * 统一渲染器接口
 * 为所有格式（TXT, EPUB, PDF, MOBI）提供统一的渲染和样式控制接口
 */

import type { Note } from './notes';

/**
 * 笔记位置抽象类型
 * 不同格式使用不同的定位方式
 */
export type NotePosition =
    | { type: 'line'; lineNumber: number }                           // TXT: 行号定位
    | { type: 'cfi'; cfi: string }                                   // EPUB: CFI (Canonical Fragment Identifier)
    | { type: 'page-coord'; page: number; x: number; y: number }     // PDF: 页面坐标
    | { type: 'dom-path'; path: string; offset?: number };           // MOBI: DOM 路径

/**
 * 渲染器样式设置
 */
export interface RendererStyleSettings {
    fontSize: number;           // 字体大小 (px)
    fontFamily: string;         // 字体系列
    textColor: string;          // 文本颜色
    backgroundColor: string;    // 背景颜色
    lineHeight: number;         // 行高 (倍数)
    fontWeight: number;         // 字重 (100-900)
    letterSpacing?: number;     // 字间距 (px)
    wordSpacing?: number;       // 词间距 (px)
    textAlign?: 'left' | 'center' | 'right' | 'justify';  // 对齐方式
    theme?: string;             // 阅读主题 (light, sepia, dark, green, etc.)
}

/**
 * 渲染器能力标识
 * 不同格式支持的功能不同
 */
export interface RendererCapabilities {
    supportsFontSize: boolean;
    supportsFontFamily: boolean;
    supportsTextColor: boolean;
    supportsBackgroundColor: boolean;
    supportsLineHeight: boolean;
    supportsFontWeight: boolean;
    supportsLetterSpacing: boolean;
    supportsWordSpacing: boolean;
    supportsTextAlign: boolean;
    supportsNoteMarkers: boolean;
    supportsTextSelection: boolean;
}

/**
 * 统一渲染器接口
 */
export interface UnifiedRenderer {
    /**
     * 获取渲染器能力
     */
    getCapabilities(): RendererCapabilities;

    /**
     * 渲染内容
     */
    render(content: any): Promise<void>;

    /**
     * 获取当前内容
     */
    getContent(): any;

    /**
     * 样式控制方法
     */
    setFontSize(size: number): void;
    setFontFamily(family: string): void;
    setTextColor(color: string): void;
    setBackgroundColor(color: string): void;
    setLineHeight(height: number): void;
    setFontWeight(weight: number): void;
    setLetterSpacing(spacing: number): void;
    setWordSpacing(spacing: number): void;
    setTextAlign(align: 'left' | 'center' | 'right' | 'justify'): void;

    /**
     * 批量应用样式
     */
    applyStyles(settings: Partial<RendererStyleSettings>): void;

    /**
     * 获取当前样式
     */
    getStyles(): RendererStyleSettings;

    /**
     * 笔记管理方法
     */
    addNoteMarker(position: NotePosition, note: Note): void;
    removeNoteMarker(noteId: string): void;
    updateNoteMarker(noteId: string, note: Note): void;
    getNotePosition(noteId: string): NotePosition | null;
    highlightNote(noteId: string): void;
    unhighlightNote(noteId: string): void;

    /**
     * 导航方法
     */
    scrollToPosition(position: NotePosition): void;
    getCurrentPosition(): NotePosition | null;

    /**
     * 清理资源
     */
    destroy(): void;
}

/**
 * 渲染器工厂函数类型
 */
export type RendererFactory = (
    container: HTMLElement,
    format: 'txt' | 'epub' | 'pdf' | 'mobi'
) => UnifiedRenderer;
