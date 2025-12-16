/**
 * 插件设置类型定义
 * 添加渲染器样式设置支持
 */

import type { RendererStyleSettings } from './unified-renderer';

export interface NovelReaderSettings {
    // ... 其他现有设置 ...

    /**
     * 每本书的渲染器样式设置
     * key: novelId
     * value: RendererStyleSettings
     */
    readerStyles?: Record<string, RendererStyleSettings>;
}
