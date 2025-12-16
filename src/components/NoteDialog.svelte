<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Note } from '../types/notes';

  const dispatch = createEventDispatcher();

  export let selectedText: string;
  export let isOpen = false;
  export let existingNote: Note | null = null;

  let noteContent = '';
  // 确保对话框打开时文本区域获得焦点
  let textareaElement: HTMLTextAreaElement;

  // 在组件挂载时设置初始内容
  onMount(() => {
    if (existingNote) {
      // 提取局部常量解决IDE类型推断问题
      const note = existingNote;
      noteContent = note.content;
      // 确保显示正确的选中文本
      selectedText = note.selectedText;
    }
  });

  // 用于防止响应式语句重复执行
  let isInitialized = false;

  // 监听打开状态变化 - 只在对话框打开/关闭时执行
  $: if (isOpen && !isInitialized) {
    console.log('[NoteDialog] Dialog opened, initializing content');
    isInitialized = true;
    if (existingNote) {
      const note = existingNote;

      //无视警告,正常数据,可打印
      noteContent = note.content;
      selectedText = note.selectedText;

      console.log('NoteDialog,noteContent---', noteContent);
      console.log('NoteDialog,selectedText---', selectedText);
    } else {
      noteContent = '';
      // 保持传入的selectedText不变
    }
    // 对话框打开时，自动聚焦到textarea
    setTimeout(() => {
      console.log('[NoteDialog] Attempting to focus textarea, element exists:', !!textareaElement);
      if (textareaElement) {
        textareaElement.focus();
        console.log(
          '[NoteDialog] After focus(), activeElement is:',
          document.activeElement?.tagName,
          document.activeElement?.className
        );
        console.log('[NoteDialog] Focus successful:', document.activeElement === textareaElement);
      }
    }, 100);
  } else if (!isOpen && isInitialized) {
    // 对话框关闭时重置标志
    console.log('[NoteDialog] Dialog closed, resetting');
    isInitialized = false;
  }

  // 诊断：监听 textarea 的各种事件
  function handleKeyDownDebug(event: KeyboardEvent) {
    console.log('[NoteDialog textarea] keydown event:', {
      key: event.key,
      target: (event.target as HTMLElement)?.tagName,
      currentTarget: (event.currentTarget as HTMLElement)?.tagName,
      defaultPrevented: event.defaultPrevented,
      bubbles: event.bubbles,
      cancelable: event.cancelable,
    });
    event.stopPropagation();
  }

  function handleInputEvent(event: Event) {
    console.log(
      '[NoteDialog textarea] input event, value:',
      (event.target as HTMLTextAreaElement).value
    );
  }

  // 处理文本输入
  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    noteContent = target.value;
  }

  function handleSave() {
    dispatch('save', { content: noteContent });
    isOpen = false;
  }

  function handleClose() {
    isOpen = false;
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click|self={() => dispatch('close')}>
    <div class="note-dialog" on:click|stopPropagation>
      <div class="note-header">
        <h3>{existingNote ? '编辑笔记' : '添加笔记'}</h3>
        <button class="close-button" on:click={() => dispatch('close')}>×</button>
      </div>

      <div class="note-content">
        <!-- 显示选中的文本 -->
        {#if selectedText}
          <div class="selected-text">
            {selectedText}
          </div>
        {/if}

        <textarea
          bind:value={noteContent}
          bind:this={textareaElement}
          placeholder="输入笔记内容..."
          rows="4"
          class="note-textarea"
          on:keydown={handleKeyDownDebug}
          on:input={handleInputEvent}
        ></textarea>
      </div>

      <div class="note-footer">
        <button class="cancel-button" on:click={() => dispatch('close')}> 取消 </button>
        <button
          class="save-button"
          on:click={() => dispatch('save', { content: noteContent })}
          disabled={!noteContent.trim()}
        >
          {existingNote ? '保存修改' : '保存'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .note-dialog {
    background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 520px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
    border: 2px solid var(--interactive-accent);
    animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: hidden;
  }

  @keyframes slideIn {
    from {
      transform: translateY(30px) scale(0.95);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  .note-header {
    padding: 20px 24px;
    background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .note-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-on-accent);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .note-content {
    padding: 24px;
  }

  .selected-text {
    padding: 14px 18px;
    background: linear-gradient(135deg, rgba(var(--interactive-accent-rgb), 0.1) 0%, rgba(var(--interactive-accent-rgb), 0.05) 100%);
    border-radius: 10px;
    margin-bottom: 18px;
    font-style: italic;
    color: var(--text-muted);
    line-height: 1.6;
    position: relative;
    font-size: 14px;
    border-left: 3px solid var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .selected-text::before {
    content: '"';
    position: absolute;
    left: 10px;
    top: 2px;
    font-size: 28px;
    color: var(--interactive-accent);
    opacity: 0.3;
    font-weight: bold;
  }

  textarea {
    width: 100%;
    padding: 14px 16px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 10px;
    resize: vertical;
    min-height: 140px;
    font-size: 14px;
    line-height: 1.6;
    background: var(--background-primary);
    color: var(--text-normal);
    transition: all 0.2s ease;
  }

  textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15);
  }

  .note-footer {
    padding: 16px 24px;
    background: var(--background-secondary);
    border-top: 2px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  button {
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .save-button {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    color: var(--text-on-accent);
    box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .save-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.4);
  }

  .save-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-button {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
  }

  .cancel-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
  }

  .close-button {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    font-size: 24px;
    color: var(--text-on-accent);
    cursor: pointer;
    padding: 4px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: rotate(90deg);
  }

  .note-textarea {
    width: 100%;
    padding: 14px 16px;
    border: 2px solid var(--background-modifier-border);
    border-radius: 10px;
    resize: vertical;
    min-height: 140px;
    font-size: 14px;
    line-height: 1.6;
    background: var(--background-primary);
    color: var(--text-normal);
    transition: all 0.2s ease;
  }

  .note-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15);
  }
</style>
