/**
 * EPUB 渲染器
 * 为 EPUB 格式提供统一的渲染接口
 * 使用 ePub.js 的 themes API 进行样式控制
 */

import type {
    UnifiedRenderer,
    NotePosition,
    RendererStyleSettings,
    RendererCapabilities,
} from '../../types/unified-renderer';
import type { Note } from '../../types/notes';

export class EpubRenderer implements UnifiedRenderer {
    private rendition: any; // ePub.js Rendition
    private settings: RendererStyleSettings;
    private noteAnnotations: Map<string, { cfi: string; position: NotePosition }> = new Map();

    constructor(rendition: any) {
        this.rendition = rendition;
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

        this.initializeTheme();
    }

    /**
     * 初始化主题
     */
    private initializeTheme(): void {
        // 注册自定义主题
        this.rendition.themes.register('unified-renderer', {
            body: {
                'font-size': `${this.settings.fontSize}px !important`,
                'font-family': `${this.settings.fontFamily} !important`,
                'color': `${this.settings.textColor} !important`,
                'background-color': `${this.settings.backgroundColor} !important`,
                'line-height': `${this.settings.lineHeight} !important`,
                'font-weight': `${this.settings.fontWeight} !important`,
                'letter-spacing': `${this.settings.letterSpacing}px !important`,
                'word-spacing': `${this.settings.wordSpacing}px !important`,
            },
            'p, div, span': {
                'text-align': `${this.settings.textAlign} !important`,
            },
        });

        // 应用主题
        this.rendition.themes.select('unified-renderer');
    }

    /**
     * 更新主题样式
     */
    private updateTheme(): void {
        // 更新已注册的主题
        this.rendition.themes.override('unified-renderer', {
            body: {
                'font-size': `${this.settings.fontSize}px !important`,
                'font-family': `${this.settings.fontFamily} !important`,
                'color': `${this.settings.textColor} !important`,
                'background-color': `${this.settings.backgroundColor} !important`,
                'line-height': `${this.settings.lineHeight} !important`,
                'font-weight': `${this.settings.fontWeight} !important`,
                'letter-spacing': `${this.settings.letterSpacing}px !important`,
                'word-spacing': `${this.settings.wordSpacing}px !important`,
            },
            'p, div, span': {
                'text-align': `${this.settings.textAlign} !important`,
            },
        });
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
        // EPUB 渲染由 EpubReaderViewComponent 和 ePub.js 处理
        // 这里只需要确保主题已应用
        this.updateTheme();
    }

    /**
     * 获取当前内容
     */
    getContent(): any {
        return this.rendition;
    }

    /**
     * 设置字体大小
     */
    setFontSize(size: number): void {
        this.settings.fontSize = size;
        // ePub.js 提供了便捷方法
        this.rendition.themes.fontSize(`${size}px`);
    }

    /**
     * 设置字体系列
     */
    setFontFamily(family: string): void {
        this.settings.fontFamily = family;
        this.updateTheme();
    }

    /**
     * 设置文本颜色
     */
    setTextColor(color: string): void {
        this.settings.textColor = color;
        this.updateTheme();
    }

    /**
     * 设置背景颜色
     */
    setBackgroundColor(color: string): void {
        this.settings.backgroundColor = color;
        this.updateTheme();
    }

    /**
     * 设置行高
     */
    setLineHeight(height: number): void {
        this.settings.lineHeight = height;
        this.updateTheme();
    }

    /**
     * 设置字重
     */
    setFontWeight(weight: number): void {
        this.settings.fontWeight = weight;
        this.updateTheme();
    }

    /**
     * 设置字间距
     */
    setLetterSpacing(spacing: number): void {
        this.settings.letterSpacing = spacing;
        this.updateTheme();
    }

    /**
     * 设置词间距
     */
    setWordSpacing(spacing: number): void {
        this.settings.wordSpacing = spacing;
        this.updateTheme();
    }

    /**
     * 设置文本对齐
     */
    setTextAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
        this.settings.textAlign = align;
        this.updateTheme();
    }

    /**
     * 批量应用样式
     */
    applyStyles(settings: Partial<RendererStyleSettings>): void {
        this.settings = { ...this.settings, ...settings };
        this.updateTheme();
    }

    /**
     * 获取当前样式
     */
    getStyles(): RendererStyleSettings {
        return { ...this.settings };
    }

    /**
     * 添加笔记标记
     */
    addNoteMarker(position: NotePosition, note: Note): void {
        if (position.type !== 'cfi') {
            console.warn('EpubRenderer 只支持 cfi 类型的位置');
            return;
        }

        try {
            // 使用 ePub.js 的 annotations API
            this.rendition.annotations.add(
                'highlight',
                position.cfi,
                {
                    fill: 'yellow',
                    'fill-opacity': '0.3',
                    'mix-blend-mode': 'multiply',
                },
                (e: any) => {
                    // 点击高亮时的回调
                    console.log('Note clicked:', note.id);
                },
                'note-marker',
                {
                    noteId: note.id,
                    content: note.content,
                }
            );

            // 保存引用
            this.noteAnnotations.set(note.id, { cfi: position.cfi, position });
        } catch (error) {
            console.error('添加笔记标记失败:', error);
        }
    }

    /**
     * 删除笔记标记
     */
    removeNoteMarker(noteId: string): void {
        const annotation = this.noteAnnotations.get(noteId);
        if (annotation) {
            try {
                this.rendition.annotations.remove(annotation.cfi, 'highlight');
                this.noteAnnotations.delete(noteId);
            } catch (error) {
                console.error('删除笔记标记失败:', error);
            }
        }
    }

    /**
     * 更新笔记标记
     */
    updateNoteMarker(noteId: string, note: Note): void {
        // ePub.js 的 annotations 不支持直接更新
        // 需要先删除再添加
        const annotation = this.noteAnnotations.get(noteId);
        if (annotation) {
            this.removeNoteMarker(noteId);
            this.addNoteMarker(annotation.position, note);
        }
    }

    /**
     * 获取笔记位置
     */
    getNotePosition(noteId: string): NotePosition | null {
        const annotation = this.noteAnnotations.get(noteId);
        return annotation ? annotation.position : null;
    }

    /**
     * 高亮笔记
     */
    highlightNote(noteId: string): void {
        const annotation = this.noteAnnotations.get(noteId);
        if (annotation) {
            try {
                // 临时改变高亮颜色
                this.rendition.annotations.remove(annotation.cfi, 'highlight');
                this.rendition.annotations.add(
                    'highlight',
                    annotation.cfi,
                    {
                        fill: 'orange',
                        'fill-opacity': '0.5',
                        'mix-blend-mode': 'multiply',
                    },
                    null,
                    'note-marker-highlighted'
                );
            } catch (error) {
                console.error('高亮笔记失败:', error);
            }
        }
    }

    /**
     * 取消高亮
     */
    unhighlightNote(noteId: string): void {
        const annotation = this.noteAnnotations.get(noteId);
        if (annotation) {
            try {
                // 恢复原始高亮
                this.rendition.annotations.remove(annotation.cfi, 'highlight');
                this.rendition.annotations.add(
                    'highlight',
                    annotation.cfi,
                    {
                        fill: 'yellow',
                        'fill-opacity': '0.3',
                        'mix-blend-mode': 'multiply',
                    },
                    null,
                    'note-marker'
                );
            } catch (error) {
                console.error('取消高亮失败:', error);
            }
        }
    }

    /**
     * 滚动到位置
     */
    scrollToPosition(position: NotePosition): void {
        if (position.type !== 'cfi') {
            console.warn('EpubRenderer 只支持 cfi 类型的位置');
            return;
        }

        try {
            this.rendition.display(position.cfi);
        } catch (error) {
            console.error('滚动到位置失败:', error);
        }
    }

    /**
     * 获取当前位置
     */
    getCurrentPosition(): NotePosition | null {
        try {
            const currentLocation = this.rendition.currentLocation();
            if (currentLocation && currentLocation.start) {
                return {
                    type: 'cfi',
                    cfi: currentLocation.start.cfi,
                };
            }
        } catch (error) {
            console.error('获取当前位置失败:', error);
        }
        return null;
    }

    /**
     * 清理资源
     */
    destroy(): void {
        // 清除所有笔记标记
        this.noteAnnotations.forEach((annotation) => {
            try {
                this.rendition.annotations.remove(annotation.cfi, 'highlight');
            } catch (error) {
                console.error('清理笔记标记失败:', error);
            }
        });
        this.noteAnnotations.clear();

        // 重置主题
        try {
            this.rendition.themes.select('default');
        } catch (error) {
            console.error('重置主题失败:', error);
        }
    }
}
