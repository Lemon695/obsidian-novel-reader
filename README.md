# Obsidian Novel Reader

一个功能强大的 Obsidian 小说阅读器插件，支持多种格式的小说文件，提供完整的阅读体验、统计分析和笔记管理功能。

## ✨ 核心功能

### 📚 多格式支持
- **TXT 格式**: 智能章节识别（支持12种章节模式 + 自定义正则），自动分章，流畅阅读
- **EPUB 格式**: 支持标准电子书格式，保留原书目录结构和样式
- **PDF 格式**: PDF文档阅读，支持大纲/书签导航，页码跳转

### 📖 强大的阅读功能
- 📄 **章节导航**: 悬浮菜单、侧边栏、独立大纲视图三种模式
- 🔖 **阅读进度**: 自动保存阅读位置，跨设备同步（Obsidian Sync）
- ⌨️ **键盘快捷键**: 左右键切换章节，上下键翻页
- 🎨 **自定义样式**: 字体大小、行距、主题颜色可调节
- 📝 **章节历史**: 记录最近访问的章节，快速跳转

### 📊 阅读统计系统
- ⏱️ **时长统计**: 总阅读时长、平均会话时长、每日阅读趋势
- 📈 **可视化图表**: Recharts 图表展示阅读数据
- 🔥 **连续阅读**: 追踪阅读连续天数
- 📑 **章节统计**: 每章阅读时长、阅读次数

### 🗂️ 图书管理
- 📚 **智能书架**: 在读、待读、已读、归档四个默认书架
- 🏷️ **标签系统**: 支持多标签分类，自定义标签颜色
- 📁 **自定义分类**: 创建自定义书架和分类
- 🔍 **搜索过滤**: 按书名、标签、分类、书架筛选
- 📊 **多视图切换**: 网格视图、列表视图
- 🖼️ **封面管理**: 自动提取 EPUB/PDF 封面，支持自定义上传

### 📝 笔记功能
- ✍️ **文本批注**: 选中文本添加笔记，高亮显示
- 📍 **位置关联**: 笔记与章节、行号精确关联
- 💾 **双重存储**: JSON 格式存储 + Markdown 笔记导出
- 🔗 **全局笔记视图**: 统一查看和管理所有笔记
- 📅 **时间组织**: 按月份自动分类笔记文件

### ⚡ 性能优化
- 💾 **三层缓存**: 内容缓存、章节缓存、缓存索引
- 🚀 **异步加载**: Promise-based 异步初始化
- 🔒 **数据锁机制**: 防止并发数据污染
- ⏲️ **防抖刷新**: 5秒冷却时间，避免频繁更新

## 🚀 安装

### 从 Obsidian 社区插件安装
1. 打开 Obsidian 设置
2. 进入「第三方插件」
3. 关闭安全模式
4. 点击「浏览」搜索 "Novel Reader"
5. 点击安装并启用

### 手动安装
1. 下载最新的 release
2. 解压到 `.obsidian/plugins/novel-reader/` 目录
3. 重启 Obsidian
4. 在设置中启用插件

## 📖 使用指南

### 基础使用

#### 1. 添加小说
- 点击左侧边栏的📚图标打开图书库
- 点击「添加小说」按钮
- 选择 TXT、EPUB 或 PDF 文件
- 小说会自动添加到「待读」书架

#### 2. 开始阅读
- 在图书库中点击小说封面或标题
- 对于 TXT 格式，插件会自动识别章节
- 使用左右键切换章节，上下键滚动页面

#### 3. 章节导航
- **悬浮模式**: 鼠标移动到屏幕左侧显示章节列表
- **大纲模式**: 点击右上角章节大纲图标
- **侧边栏模式**: 在设置中可切换为固定侧边栏

#### 4. 添加笔记
- 选中想要标注的文本
- 在弹出的菜单中点击「添加笔记」
- 输入笔记内容并保存
- 笔记会在文中高亮显示

#### 5. 查看统计
- 点击图书卡片的「更多」菜单
- 选择「阅读统计」
- 查看详细的阅读数据和图表

### 高级功能

#### 自定义章节识别
1. 打开小说详情
2. 点击「设置」
3. 在「章节正则表达式」中输入自定义模式
4. 例如：`^序章|^第[0-9零一二三四五六七八九十百千]+[章节]`

#### 管理书架和标签
1. 在图书库点击「书架管理」
2. 可以创建、编辑、删除自定义书架
3. 点击「标签管理」管理标签
4. 为小说分配标签，方便分类检索

#### 批量导出笔记
1. 打开「笔记管理」视图
2. 选择要导出的笔记
3. 点击导出为 Markdown
4. 笔记会保存到 `NovelNotes/` 目录（可在设置中修改）

## ⚙️ 设置

### 基础设置
- **图书库路径**: 图书数据存储位置（默认：`.obsidian/plugins/novel-reader/library`）
- **封面路径**: 封面图片存储位置（默认：`NovelNotes/covers`）
- **笔记路径**: Markdown 笔记存储位置（默认：`NovelNotes`）

### 阅读设置
- **章节显示模式**: hover（悬浮）/ outline（大纲）/ sidebar（侧边栏）
- **默认字体大小**: 18px
- **默认行距**: 1.6
- **默认主题**: 浅色/深色

### 屏蔽设置
- **具体路径屏蔽**: 精确匹配路径，不显示在图书库
- **正则表达式屏蔽**: 使用正则表达式灵活屏蔽文件

### 快捷键设置
- 打开图书库: 默认无
- 切换章节大纲: 默认无
- 打开阅读统计: 默认无
- 下一章: `ArrowRight`
- 上一章: `ArrowLeft`
- 添加笔记: `Cmd/Ctrl + M`

## 🏗️ 技术架构

### 技术栈
- **前端框架**: Svelte 4.2.19
- **构建工具**: esbuild + esbuild-svelte
- **语言**: TypeScript
- **数据库**: LokiJS（阅读统计）
- **图表库**: Recharts, Chart.js
- **文件格式**:
  - EPUB: epubjs (0.3.93)
  - PDF: pdfjs-dist (3.11.174)

### 项目结构
```
obsidian-novel-reader/
├── src/
│   ├── main.ts                    # 插件主入口
│   ├── components/                # 29个 Svelte UI 组件
│   │   ├── library/              # 图书库组件
│   │   ├── txt/                  # TXT 阅读器组件
│   │   ├── epub/                 # EPUB 阅读器组件
│   │   ├── pdf/                  # PDF 阅读器组件
│   │   ├── note/                 # 笔记组件
│   │   └── setting/              # 设置组件
│   ├── services/                  # 18个业务逻辑服务
│   │   ├── library-service.ts    # 图书库管理
│   │   ├── database-service.ts   # LokiDB 数据库
│   │   ├── shelf-service.ts      # 书架管理
│   │   ├── note/                 # 笔记服务
│   │   ├── epub/                 # EPUB 服务
│   │   ├── pdf/                  # PDF 服务
│   │   └── utils/                # 工具服务
│   ├── views/                     # Obsidian 视图类
│   │   ├── novel-library-view.ts       # 图书库视图
│   │   ├── txt/                        # TXT 阅读视图
│   │   ├── epub-novel-reader-view.ts   # EPUB 阅读视图
│   │   ├── pdf/                        # PDF 阅读视图
│   │   ├── novel-stats-view.ts         # 统计视图
│   │   └── note/                       # 笔记视图
│   ├── types/                     # TypeScript 类型定义
│   ├── lib/                       # 工具库和辅助函数
│   └── stores/                    # Svelte 状态存储
├── styles.css                     # 全局样式
├── manifest.json                  # 插件清单
├── package.json                   # 项目依赖
└── esbuild.config.mjs            # 构建配置
```

### 核心数据类型
```typescript
// 小说信息
interface Novel {
  id: string;
  title: string;
  author: string;
  path: string;
  format: 'txt' | 'epub' | 'pdf';
  cover?: string;
  progress?: number;
  shelfId?: string;
  categoryId?: string;
  tags?: string[];
  customMetadata?: Record<string, any>;
  pdfMetadata?: {
    numPages?: number;
    lastPage?: number;
  };
}

// 阅读进度
interface ReadingProgress {
  novelId: string;
  chapterIndex: number;
  progress: number;
  position?: {
    page?: number;
    offset?: number;
    cfi: string;
    percentage: number;
    chapterId?: number;
    chapterTitle?: string;
  };
}

// 阅读统计
interface NovelReadingStats {
  novelId: string;
  stats: {
    totalReadingTime: number;
    sessionsCount: number;
    firstReadTime: number;
    lastReadTime: number;
    averageSessionTime: number;
    dailyStats: { [key: string]: DailyStats };
    chapterStats: { [key: number]: ChapterStats };
  };
}
```

## 📊 数据存储

### 存储位置
```
.obsidian/plugins/novel-reader/
├── library/
│   ├── library.json              # 图书库数据
│   ├── progress.json             # 阅读进度
│   ├── shelves.json              # 书架数据
│   ├── categories.json           # 分类数据
│   ├── tags.json                 # 标签数据
│   ├── chapter-history.json      # 章节历史
│   ├── custom-shelves.json       # 自定义书架
│   ├── notes/                    # 笔记 JSON 文件
│   │   └── {novelId}.json
│   └── .cache/                   # 缓存目录
│       ├── cache-index.json
│       ├── {path}.cache          # 内容缓存
│       └── {path}.chapters.json  # 章节缓存
│
└── stats/
    └── reading-stats.json        # LokiDB 数据库（阅读统计）

NovelNotes/                       # 用户可见的笔记目录
├── covers/                       # 封面图片
└── YYYY-MM/                      # 按月份组织的笔记
    └── {小说名}-笔记.md
```

## 🐛 已知问题和改进计划

### 代码质量问题
- [ ] 修复 TxtNovelReaderView.ts:108 中未 await 的 Promise
- [ ] 修复 TxtReaderViewComponent.svelte 中的事件监听器内存泄漏
- [ ] 完善 null/undefined 检查
- [ ] 改进数据库初始化的竞态条件处理
- [ ] 优化数据锁实现，避免忙等待

### 性能优化
- [ ] 实现封面加载缓存机制，避免重复加载
- [ ] 优化章节解析，增加缓存策略
- [ ] 减少 DOM 更新频率，添加防抖
- [ ] 优化事件监听器（移除高频 mousemove）
- [ ] 改进 JSON 序列化/反序列化性能

### UI/UX 改进
- [ ] 建立统一的设计系统（颜色、间距、字体）
- [ ] 移除硬编码的颜色值，使用 CSS 变量
- [ ] 统一间距系统（采用 8px 基础间距）
- [ ] 统一字体大小系统
- [ ] 改进响应式设计，增加移动端适配
- [ ] 增强无障碍性（添加 aria-label, role 等）
- [ ] 优化按钮样式，建立清晰的视觉层次
- [ ] 改进卡片设计，参考 Material Design 规范
- [ ] 增加过渡动画，提升交互体验
- [ ] 重构菜单定位逻辑，使用 Popper.js

### 功能增强
- [ ] 支持更多文件格式（MOBI, AZW3）
- [ ] 添加书签功能
- [ ] 支持全文搜索
- [ ] 添加翻译功能集成
- [ ] 支持朗读功能（TTS）
- [ ] 添加导入导出功能
- [ ] 支持小说更新检测
- [ ] 添加阅读目标设定

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发环境设置
```bash
# 克隆仓库
git clone https://github.com/Lemon695/obsidian-novel-reader.git
cd obsidian-novel-reader

# 安装依赖
npm install

# 开发模式（自动编译）
npm run dev

# 构建生产版本
npm run build
```

### 开发指南
1. 遵循 TypeScript 严格模式
2. 使用 ESLint 检查代码
3. 组件使用 Svelte 编写
4. 提交前运行 `npm run build` 确保编译通过
5. 遵循现有的代码风格和架构

## 📄 许可证

MIT License

## 🙏 致谢

- [Obsidian](https://obsidian.md/) - 强大的知识管理工具
- [epubjs](https://github.com/futurepress/epub.js/) - EPUB 阅读支持
- [PDF.js](https://github.com/mozilla/pdf.js/) - PDF 渲染支持
- [LokiJS](https://github.com/techfort/LokiJS) - 轻量级数据库
- [Svelte](https://svelte.dev/) - 优雅的前端框架

## 📮 联系方式

- GitHub Issues: [提交问题](https://github.com/Lemon695/obsidian-novel-reader/issues)
- GitHub Discussions: [讨论区](https://github.com/Lemon695/obsidian-novel-reader/discussions)

## 📅 更新日志

### v1.0.0 (2024)
- 🎉 初始版本发布
- ✅ 支持 TXT、EPUB、PDF 三种格式
- ✅ 完整的阅读统计系统
- ✅ 笔记管理功能
- ✅ 图书库管理
- ✅ 书架和标签系统

---

如果这个插件对你有帮助，请给项目点个 ⭐️ Star！
