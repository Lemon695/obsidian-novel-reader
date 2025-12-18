<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type NovelReaderPlugin from '../../main';
  import type { Novel } from '../../types';
  import type { ReaderStyleManager } from '../../services/renderer/reader-style-manager';
  import type { RendererCapabilities } from '../../types/unified-renderer';

  const dispatch = createEventDispatcher();

  export let plugin: NovelReaderPlugin;
  export let novel: Novel;
  export let styleManager: ReaderStyleManager | null = null;

  // 当前样式设置
  let fontSize = 16;
  let fontFamily = 'system-ui, -apple-system, sans-serif';
  let textColor = '#333333';
  let backgroundColor = '#FFFFFF';
  let lineHeight = 1.6;
  let fontWeight = 400;
  let letterSpacing = 0;
  let wordSpacing = 0;
  let textAlign: 'left' | 'center' | 'right' | 'justify' = 'left';
  let theme = 'light';

  // 渲染器能力
  let capabilities: RendererCapabilities | null = null;

  // 默认样式
  let DEFAULT_STYLES = {
    fontSize: novel.format === 'pdf' ? 32 : 16,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textColor: '#333333',
    backgroundColor: '#FFFFFF',
    lineHeight: 1.6,
    fontWeight: 400,
    letterSpacing: 0,
    wordSpacing: 0,
    textAlign: 'left' as const,
    theme: 'light',
  };

  fontSize = DEFAULT_STYLES.fontSize;

  // 常用字体列表
  const FONT_FAMILIES = [
    { value: 'system-ui, -apple-system, sans-serif', label: '系统默认' },
    { value: 'serif', label: '衬线字体' },
    { value: 'sans-serif', label: '无衬线字体' },
    { value: 'monospace', label: '等宽字体' },
    { value: '"Songti SC", "SimSun", serif', label: '宋体' },
    { value: '"Heiti SC", "SimHei", sans-serif', label: '黑体' },
    { value: '"Kaiti SC", "KaiTi", serif', label: '楷体' },
    { value: '"PingFang SC", "Microsoft YaHei", sans-serif', label: '苹方/微软雅黑' },
  ];

  onMount(() => {
    loadStyles();
  });

  // 加载当前样式
  function loadStyles() {
    const savedStyles = plugin.settings.readerStyles?.[novel.id];
    if (savedStyles) {
      fontSize = savedStyles.fontSize ?? DEFAULT_STYLES.fontSize;
      fontFamily = savedStyles.fontFamily ?? DEFAULT_STYLES.fontFamily;
      textColor = savedStyles.textColor ?? DEFAULT_STYLES.textColor;
      backgroundColor = savedStyles.backgroundColor ?? DEFAULT_STYLES.backgroundColor;
      lineHeight = savedStyles.lineHeight ?? DEFAULT_STYLES.lineHeight;
      fontWeight = savedStyles.fontWeight ?? DEFAULT_STYLES.fontWeight;
      letterSpacing = savedStyles.letterSpacing ?? DEFAULT_STYLES.letterSpacing;
      wordSpacing = savedStyles.wordSpacing ?? DEFAULT_STYLES.wordSpacing;
      textAlign = savedStyles.textAlign ?? DEFAULT_STYLES.textAlign;
      theme = savedStyles.theme ?? DEFAULT_STYLES.theme;
    }
  }

  // 响应式加载渲染器能力
  $: if (styleManager) {
    capabilities = styleManager.getCapabilities();
  }

  // 保存样式
  async function saveStyles() {
    if (!plugin.settings.readerStyles) {
      plugin.settings.readerStyles = {};
    }

    plugin.settings.readerStyles[novel.id] = {
      fontSize,
      fontFamily,
      textColor,
      backgroundColor,
      lineHeight,
      fontWeight,
      letterSpacing,
      wordSpacing,
      textAlign,
      theme,
    };

    await plugin.saveSettings();
  }

  // 应用样式
  async function applyStyles(feature: string, value: any) {
    if (!styleManager) return;

    // 根据功能调用 styleManager 的对应方法
    switch (feature) {
      case 'fontSize':
        await styleManager.setFontSize(value);
        break;
      case 'fontFamily':
        await styleManager.setFontFamily(value);
        break;
      case 'textColor':
        await styleManager.setTextColor(value);
        break;
      case 'backgroundColor':
        await styleManager.setBackgroundColor(value);
        break;
      case 'lineHeight':
        await styleManager.setLineHeight(value);
        break;
      case 'fontWeight':
        await styleManager.setFontWeight(value);
        break;
      case 'letterSpacing':
        await styleManager.setLetterSpacing(value);
        break;
      case 'wordSpacing':
        await styleManager.setWordSpacing(value);
        break;
      case 'textAlign':
        await styleManager.setTextAlign(value);
        break;
      case 'theme':
        await styleManager.setTheme(value);
        // 主题切换后同步背景色和文字颜色数据
        const updatedSettings = styleManager.getSettings();
        backgroundColor = updatedSettings.backgroundColor;
        textColor = updatedSettings.textColor;
        break;
    }

    dispatch('styleChange');
  }

  // 批量应用所有样式 (用于重置或初始化)
  async function applyAllStyles() {
    if (!styleManager) return;

    // 手动同步 local state 到 plugin settings (因为 resetToDefaults 会修改 local state)
    if (!plugin.settings.readerStyles) plugin.settings.readerStyles = {};
    plugin.settings.readerStyles[novel.id] = {
      fontSize,
      fontFamily,
      textColor,
      backgroundColor,
      lineHeight,
      fontWeight,
      letterSpacing,
      wordSpacing,
      textAlign,
      theme,
    };
    await plugin.saveSettings();

    // 让 styleManager 重新加载并应用
    // @ts-ignore - styleManager 内部 settings 是私有的，但我们可以通过重新 load 加载
    styleManager.settings = (styleManager as any).loadSettings();
    styleManager.applyAllSettings();
    dispatch('styleChange');
  }

  // 重置为默认值
  async function resetToDefaults() {
    fontSize = DEFAULT_STYLES.fontSize;
    fontFamily = DEFAULT_STYLES.fontFamily;
    textColor = DEFAULT_STYLES.textColor;
    backgroundColor = DEFAULT_STYLES.backgroundColor;
    lineHeight = DEFAULT_STYLES.lineHeight;
    fontWeight = DEFAULT_STYLES.fontWeight;
    letterSpacing = DEFAULT_STYLES.letterSpacing;
    wordSpacing = DEFAULT_STYLES.wordSpacing;
    textAlign = DEFAULT_STYLES.textAlign;
    theme = DEFAULT_STYLES.theme;

    await applyAllStyles();
  }

  // 检查功能是否支持
  function isSupported(feature: keyof RendererCapabilities): boolean {
    return capabilities?.[feature] ?? false;
  }

  // 获取不支持功能的提示信息
  function getUnsupportedMessage(): string {
    if (!capabilities) return '';

    const unsupported: string[] = [];
    if (!capabilities.supportsFontFamily) unsupported.push('字体');
    if (!capabilities.supportsTextColor) unsupported.push('文本颜色');

    if (unsupported.length > 0) {
      return `⚠️ 注意: 当前格式仅支持部分样式设置。${unsupported.join('、')}等功能不可用。`;
    }
    return '';
  }

  // 格式化颜色显示（将 CSS 变量转换为友好名称）
  function formatColorValue(value: string) {
    if (!value) return '';
    if (value.includes('--background-primary')) return '默认背景';
    if (value.includes('--text-normal')) return '默认文字';
    return value;
  }
</script>

<div class="unified-style-settings">
  <div class="settings-content">
    <!-- 字体大小 -->
    {#if isSupported('supportsFontSize')}
      <div class="setting-item">
        <label class="setting-label">
          <span class="label-text">字体大小</span>
          <span class="label-value">{fontSize}px</span>
        </label>
        <div class="control-group">
          <button
            class="step-button"
            on:click={() => {
              fontSize = Math.max(12, fontSize - 1);
              applyStyles('fontSize', fontSize);
            }}>-</button
          >
          <input
            type="range"
            min="12"
            max="64"
            step="1"
            bind:value={fontSize}
            on:change={() => applyStyles('fontSize', fontSize)}
            class="slider"
          />
          <button
            class="step-button"
            on:click={() => {
              fontSize = Math.min(64, fontSize + 1);
              applyStyles('fontSize', fontSize);
            }}>+</button
          >
          <input
            type="number"
            min="12"
            max="64"
            bind:value={fontSize}
            on:change={() => applyStyles('fontSize', fontSize)}
            class="number-input"
          />
        </div>
      </div>
    {/if}

    <!-- 字体系列 -->
    {#if isSupported('supportsFontFamily')}
      <div class="setting-item">
        <label class="setting-label">
          <span class="label-text">字体</span>
        </label>
        <select
          bind:value={fontFamily}
          on:change={() => applyStyles('fontFamily', fontFamily)}
          class="select-input"
        >
          {#each FONT_FAMILIES as font}
            <option value={font.value}>{font.label}</option>
          {/each}
        </select>
      </div>
    {:else}
      <div class="setting-item disabled">
        <label class="setting-label">
          <span class="label-text">字体</span>
          <span class="disabled-badge">不支持</span>
        </label>
        <select disabled class="select-input">
          <option>当前格式不支持字体设置</option>
        </select>
      </div>
    {/if}

    <!-- 文本颜色 -->
    {#if isSupported('supportsTextColor')}
      <div class="setting-item">
        <label class="setting-label">
          <span class="label-text">文本颜色</span>
          <span class="label-value">{formatColorValue(textColor)}</span>
        </label>
        <div class="color-control">
          <input
            type="color"
            bind:value={textColor}
            on:change={() => applyStyles('textColor', textColor)}
            class="color-input"
          />
          <input
            type="text"
            value={textColor.includes('--') ? '' : textColor}
            placeholder={formatColorValue(textColor)}
            on:change={(e) => {
              const val = e.currentTarget.value;
              if (val) {
                textColor = val;
                applyStyles('textColor', textColor);
              }
            }}
            class="text-input"
          />
        </div>
      </div>
    {:else}
      <div class="setting-item disabled">
        <label class="setting-label">
          <span class="label-text">文本颜色</span>
          <span class="disabled-badge">不支持</span>
        </label>
        <div class="color-control">
          <input type="color" disabled class="color-input" />
          <input type="text" disabled class="text-input" value="不支持" />
        </div>
      </div>
    {/if}

    <!-- 背景颜色 -->
    {#if isSupported('supportsBackgroundColor')}
      <div class="setting-item">
        <label class="setting-label">
          <span class="label-text">背景颜色</span>
          <span class="label-value">{formatColorValue(backgroundColor)}</span>
        </label>
        <div class="color-control">
          <input
            type="color"
            bind:value={backgroundColor}
            on:change={() => applyStyles('backgroundColor', backgroundColor)}
            class="color-input"
          />
          <input
            type="text"
            value={backgroundColor.includes('--') ? '' : backgroundColor}
            placeholder={formatColorValue(backgroundColor)}
            on:change={(e) => {
              const val = e.currentTarget.value;
              if (val) {
                backgroundColor = val;
                applyStyles('backgroundColor', backgroundColor);
              }
            }}
            class="text-input"
          />
        </div>
      </div>
    {/if}

    <div class="setting-item theme-selection">
      <div class="setting-header-with-desc">
        <label class="setting-label-text">阅读主题</label>
        <span class="setting-desc">选择适合当前环境的视觉主题</span>
      </div>
      <div class="theme-options">
        <button
          class="theme-card {theme === 'light' ? 'active' : ''}"
          on:click={() => {
            theme = 'light';
            applyStyles('theme', theme);
          }}
          title="浅色"
        >
          <div class="theme-preview theme-light"></div>
          <span>浅色</span>
        </button>
        <button
          class="theme-card {theme === 'sepia' ? 'active' : ''}"
          on:click={() => {
            theme = 'sepia';
            applyStyles('theme', theme);
          }}
          title="护眼"
        >
          <div class="theme-preview theme-sepia"></div>
          <span>护眼</span>
        </button>
        <button
          class="theme-card {theme === 'dark' ? 'active' : ''}"
          on:click={() => {
            theme = 'dark';
            applyStyles('theme', theme);
          }}
          title="深夜"
        >
          <div class="theme-preview theme-dark"></div>
          <span>深夜</span>
        </button>
        <button
          class="theme-card {theme === 'green' ? 'active' : ''}"
          on:click={() => {
            theme = 'green';
            applyStyles('theme', theme);
          }}
          title="清新"
        >
          <div class="theme-preview theme-green"></div>
          <span>清新</span>
        </button>
      </div>
    </div>

    <!-- 行高 -->
    {#if isSupported('supportsLineHeight')}
      <div class="setting-item">
        <label class="setting-label">
          <span class="label-text">行高</span>
          <span class="label-value">{lineHeight.toFixed(1)}</span>
        </label>
        <input
          type="range"
          min="1.0"
          max="3.0"
          step="0.1"
          bind:value={lineHeight}
          on:change={() => applyStyles('lineHeight', lineHeight)}
          class="slider"
        />
      </div>
    {/if}

    <!-- 字重 -->
    {#if isSupported('supportsFontWeight')}
      <div class="setting-item">
        <label class="setting-label">
          <span class="label-text">字重</span>
          <span class="label-value">{fontWeight}</span>
        </label>
        <input
          type="range"
          min="100"
          max="900"
          step="100"
          bind:value={fontWeight}
          on:change={() => applyStyles('fontWeight', fontWeight)}
          class="slider"
        />
      </div>
    {/if}

    <!-- 字间距 (可选) -->
    {#if isSupported('supportsLetterSpacing')}
      <div class="setting-item">
        <label class="setting-label">
          <span class="label-text">字间距</span>
          <span class="label-value">{letterSpacing}px</span>
        </label>
        <input
          type="range"
          min="-2"
          max="10"
          step="0.5"
          bind:value={letterSpacing}
          on:change={() => applyStyles('letterSpacing', letterSpacing)}
          class="slider"
        />
      </div>
    {/if}

    <!-- 词间距 (可选) -->
    {#if isSupported('supportsWordSpacing')}
      <div class="setting-item">
        <label class="setting-label">
          <span class="label-text">词间距</span>
          <span class="label-value">{wordSpacing}px</span>
        </label>
        <input
          type="range"
          min="-5"
          max="20"
          step="1"
          bind:value={wordSpacing}
          on:change={() => applyStyles('wordSpacing', wordSpacing)}
          class="slider"
        />
      </div>
    {/if}

    <!-- 文本对齐 (可选) -->
    {#if isSupported('supportsTextAlign')}
      <div class="setting-item">
        <label class="setting-label">
          <span class="label-text">文本对齐</span>
        </label>
        <div class="button-group">
          <button
            class="align-button"
            class:active={textAlign === 'left'}
            on:click={() => {
              textAlign = 'left';
              applyStyles('textAlign', textAlign);
            }}
          >
            左对齐
          </button>
          <button
            class="align-button"
            class:active={textAlign === 'center'}
            on:click={() => {
              textAlign = 'center';
              applyStyles('textAlign', textAlign);
            }}
          >
            居中
          </button>
          <button
            class="align-button"
            class:active={textAlign === 'right'}
            on:click={() => {
              textAlign = 'right';
              applyStyles('textAlign', textAlign);
            }}
          >
            右对齐
          </button>
          <button
            class="align-button"
            class:active={textAlign === 'justify'}
            on:click={() => {
              textAlign = 'justify';
              applyStyles('textAlign', textAlign);
            }}
          >
            两端对齐
          </button>
        </div>
      </div>
    {/if}

    <!-- 不支持功能提示 -->
    {#if getUnsupportedMessage()}
      <div class="warning-message">
        {getUnsupportedMessage()}
      </div>
    {/if}
  </div>

  <!-- 底部按钮 -->
  <div class="settings-footer">
    <button class="reset-button" on:click={resetToDefaults}> 重置为默认值 </button>
    <button class="close-button-text" on:click={() => dispatch('close')}> 关闭 </button>
  </div>
</div>

<style>
  .unified-style-settings {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .setting-item {
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .setting-item:last-child {
    border-bottom: none;
  }

  .setting-item.disabled {
    opacity: 0.5;
  }

  .setting-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .setting-header-with-desc {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
  }

  .setting-label-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .setting-desc {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: normal;
  }

  .label-text {
    font-size: 14px;
  }

  .label-value {
    font-size: 13px;
    color: var(--text-muted);
    font-family: monospace;
  }

  .disabled-badge {
    font-size: 11px;
    padding: 2px 8px;
    background: var(--background-modifier-error);
    color: var(--text-on-accent);
    border-radius: 4px;
  }

  .control-group {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .slider {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--background-modifier-border);
    outline: none;
    -webkit-appearance: none;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--interactive-accent);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px rgba(var(--interactive-accent-rgb), 0.2);
  }

  .slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--interactive-accent);
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }

  .slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px rgba(var(--interactive-accent-rgb), 0.2);
  }

  .number-input {
    width: 70px;
    padding: 6px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    text-align: center;
  }

  .select-input {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    line-height: 38px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
  }

  .select-input:hover:not(:disabled) {
    border-color: var(--interactive-accent);
  }

  /* 步进按钮样式 */
  .step-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    cursor: pointer;
    font-size: 18px;
    transition: all 0.2s ease;
  }

  .step-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
  }

  .step-button:active {
    background: var(--background-modifier-active);
  }

  .select-input:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .color-control {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .color-input {
    width: 50px;
    height: 40px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .color-input:hover:not(:disabled) {
    border-color: var(--interactive-accent);
    transform: scale(1.05);
  }

  .color-input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .text-input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    font-family: monospace;
  }

  .text-input:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .button-group {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .align-button {
    padding: 10px 16px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .align-button:hover {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .align-button.active {
    border-color: var(--interactive-accent);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-weight: 600;
  }

  .warning-message {
    padding: 16px;
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 8px;
    color: var(--text-warning);
    font-size: 13px;
    line-height: 1.5;
    margin-top: 16px;
  }

  .settings-footer {
    display: flex;
    justify-content: space-between;
    padding: 20px 24px;
    border-top: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .reset-button,
  .close-button-text {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reset-button {
    border: 2px solid var(--interactive-accent);
    background: transparent;
    color: var(--interactive-accent);
  }

  .reset-button:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .close-button-text {
    border: 2px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .close-button-text:hover {
    border-color: var(--text-muted);
    background: var(--background-modifier-hover);
  }
</style>
