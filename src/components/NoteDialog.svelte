<script lang="ts">
	import {createEventDispatcher, onMount} from 'svelte';
	import type {Note} from '../types/notes';

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

			console.log('NoteDialog,noteContent---', noteContent)
			console.log('NoteDialog,selectedText---', selectedText)
		} else {
			noteContent = '';
			// 保持传入的selectedText不变
		}
		// 对话框打开时，自动聚焦到textarea
		setTimeout(() => {
			console.log('[NoteDialog] Attempting to focus textarea, element exists:', !!textareaElement);
			if (textareaElement) {
				textareaElement.focus();
				console.log('[NoteDialog] After focus(), activeElement is:', document.activeElement?.tagName, document.activeElement?.className);
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
			cancelable: event.cancelable
		});
		event.stopPropagation();
	}

	function handleInputEvent(event: Event) {
		console.log('[NoteDialog textarea] input event, value:', (event.target as HTMLTextAreaElement).value);
	}

	// 处理文本输入
	function handleInput(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		noteContent = target.value;
	}

	function handleSave() {
		dispatch('save', {content: noteContent});
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
				<button class="cancel-button" on:click={() => dispatch('close')}>
					取消
				</button>
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
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.note-dialog {
		background: var(--background-primary);
		border-radius: 12px;
		width: 90%;
		max-width: 500px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
		animation: slideIn 0.2s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.note-header {
		padding: 16px 20px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.note-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
	}

	.note-content {
		padding: 20px;
	}

	.selected-text {
		padding: 12px 16px;
		background: var(--background-secondary);
		border-radius: 8px;
		margin-bottom: 16px;
		font-style: italic;
		color: var(--text-muted);
		line-height: 1.5;
		position: relative;
		font-size: 14px;
	}

	.selected-text::before {
		content: '"';
		position: absolute;
		left: 8px;
		top: 4px;
		font-size: 24px;
		color: var(--text-muted);
		opacity: 0.5;
	}

	textarea {
		width: 100%;
		padding: 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		resize: vertical;
		min-height: 120px;
		font-size: 14px;
		line-height: 1.6;
		background: var(--background-primary);
		color: var(--text-normal);
		transition: border-color 0.2s;
	}

	textarea:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.1);
	}

	.note-footer {
		padding: 16px 20px;
		border-top: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}

	button {
		padding: 8px 16px;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.save-button {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.save-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cancel-button {
		background: var(--background-modifier-error);
		color: white;
	}

	button:hover:not(:disabled) {
		filter: brightness(1.1);
		transform: translateY(-1px);
	}

	.close-button {
		background: none;
		border: none;
		font-size: 24px;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		transition: color 0.2s;
	}

	.close-button:hover {
		color: var(--text-error);
	}

	.note-textarea {
		width: 100%;
		padding: 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		resize: vertical;
		min-height: 120px;
		font-size: 14px;
		line-height: 1.6;
		background: var(--background-primary);
		color: var(--text-normal);
		transition: border-color 0.2s;
	}

	.note-textarea:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.1);
	}
</style>
