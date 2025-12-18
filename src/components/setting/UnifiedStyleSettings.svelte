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
    loadCapabilities();
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
    }
  }

  // 加载渲染器能力
  function loadCapabilities() {
    if (styleManager) {
      capabilities = styleManager.getCapabilities();
    }
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
    };

    await plugin.saveSettings();
  }

  // 应用样式
  async function applyStyles() {
    await saveStyles();
    if (styleManager) {
      styleManager.applyAllSettings();
    }
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

    await applyStyles();
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
          <input
            type="range"
            min="12"
            max="32"
            step="1"
            bind:value={fontSize}
            on:change={applyStyles}
            class="slider"
          />
          <input
            type="number"
            min="12"
            max="32"
            bind:value={fontSize}
            on:change={applyStyles}
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
        <select bind:value={fontFamily} on:change={applyStyles} class="select-input">
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
          <span class="label-value">{textColor}</span>
        </label>
        <div class="color-control">
          <input type="color" bind:value={textColor} on:change={applyStyles} class="color-input" />
          <input
            type="text"
            bind:value={textColor}
            on:change={applyStyles}
            class="text-input"
            placeholder="#333333"
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
          <span class="label-value">{backgroundColor}</span>
        </label>
        <div class="color-control">
          <input
            type="color"
            bind:value={backgroundColor}
            on:change={applyStyles}
            class="color-input"
          />
          <input
            type="text"
            bind:value={backgroundColor}
            on:change={applyStyles}
            class="text-input"
            placeholder="#FFFFFF"
          />
        </div>
      </div>
    {/if}

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
          on:change={applyStyles}
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
          on:change={applyStyles}
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
          on:change={applyStyles}
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
          on:change={applyStyles}
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
              applyStyles();
            }}
          >
            左对齐
          </button>
          <button
            class="align-button"
            class:active={textAlign === 'center'}
            on:click={() => {
              textAlign = 'center';
              applyStyles();
            }}
          >
            居中
          </button>
          <button
            class="align-button"
            class:active={textAlign === 'right'}
            on:click={() => {
              textAlign = 'right';
              applyStyles();
            }}
          >
            右对齐
          </button>
          <button
            class="align-button"
            class:active={textAlign === 'justify'}
            on:click={() => {
              textAlign = 'justify';
              applyStyles();
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
    padding: 10px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .select-input:hover:not(:disabled) {
    border-color: var(--interactive-accent);
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
