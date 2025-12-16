/**
 * 统一笔记管理器
 * 提供统一的笔记管理接口，支持所有格式
 */

import type { UnifiedRenderer, NotePosition } from '../../types/unified-renderer';
import type { Note } from '../../types/notes';

export class UnifiedNoteManager {
    private renderer: UnifiedRenderer;
    private notes: Map<string, { note: Note; position: NotePosition }> = new Map();

    constructor(renderer: UnifiedRenderer) {
        this.renderer = renderer;
    }

    /**
     * 添加笔记
     */
    addNote(note: Note, position: NotePosition): void {
        const capabilities = this.renderer.getCapabilities();
        if (!capabilities.supportsNoteMarkers) {
            console.warn('当前格式不支持笔记标记');
            return;
        }

        this.notes.set(note.id, { note, position });
        this.renderer.addNoteMarker(position, note);
    }

    /**
     * 删除笔记
     */
    removeNote(noteId: string): void {
        if (!this.notes.has(noteId)) {
            console.warn(`笔记 ${noteId} 不存在`);
            return;
        }

        this.notes.delete(noteId);
        this.renderer.removeNoteMarker(noteId);
    }

    /**
     * 更新笔记内容
     */
    updateNote(noteId: string, content: string): void {
        const noteData = this.notes.get(noteId);
        if (!noteData) {
            console.warn(`笔记 ${noteId} 不存在`);
            return;
        }

        // 更新笔记内容
        noteData.note.content = content;
        noteData.note.updatedAt = Date.now();

        // 重新渲染标记
        this.renderer.updateNoteMarker(noteId, noteData.note);
    }

    /**
     * 获取笔记
     */
    getNote(noteId: string): Note | null {
        const noteData = this.notes.get(noteId);
        return noteData ? noteData.note : null;
    }

    /**
     * 获取笔记位置
     */
    getNotePosition(noteId: string): NotePosition | null {
        const noteData = this.notes.get(noteId);
        return noteData ? noteData.position : null;
    }

    /**
     * 获取所有笔记
     */
    getAllNotes(): Note[] {
        return Array.from(this.notes.values()).map((data) => data.note);
    }

    /**
     * 跳转到笔记
     */
    jumpToNote(noteId: string): void {
        const noteData = this.notes.get(noteId);
        if (!noteData) {
            console.warn(`笔记 ${noteId} 不存在`);
            return;
        }

        this.renderer.scrollToPosition(noteData.position);
        this.renderer.highlightNote(noteId);

        // 3秒后取消高亮
        setTimeout(() => {
            this.renderer.unhighlightNote(noteId);
        }, 3000);
    }

    /**
     * 高亮笔记
     */
    highlightNote(noteId: string): void {
        if (!this.notes.has(noteId)) {
            console.warn(`笔记 ${noteId} 不存在`);
            return;
        }

        this.renderer.highlightNote(noteId);
    }

    /**
     * 取消高亮
     */
    unhighlightNote(noteId: string): void {
        if (!this.notes.has(noteId)) {
            console.warn(`笔记 ${noteId} 不存在`);
            return;
        }

        this.renderer.unhighlightNote(noteId);
    }

    /**
     * 批量加载笔记
     */
    loadNotes(notes: Array<{ note: Note; position: NotePosition }>): void {
        this.notes.clear();

        notes.forEach(({ note, position }) => {
            this.addNote(note, position);
        });
    }

    /**
     * 清空所有笔记
     */
    clearAll(): void {
        this.notes.forEach((_, noteId) => {
            this.renderer.removeNoteMarker(noteId);
        });
        this.notes.clear();
    }

    /**
     * 获取笔记数量
     */
    getCount(): number {
        return this.notes.size;
    }
}
