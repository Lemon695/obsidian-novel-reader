<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { EpubBook, EpubRendition } from '../../types/epub/epub-rendition';

	export let book: EpubBook;
	export let currentChapter: any;
	export let rendition: EpubRendition;

	let images: string[] = [];
	let loading = true;

	async function loadChapterImages() {
		if (!book || !currentChapter) return;

		loading = true;
		images = []; // 清空现有图片

		try {
			// 获取当前章节的内容
			const spineItem = book.spine.get(currentChapter.href);
			const content = await spineItem.load();

			// 将 NodeList 转换为数组并获取所有图片元素
			const imgElements = Array.from(content.querySelectorAll('img'));
			const imageUrls: string[] = [];

			// 处理每个图片元素
			for (const img of imgElements) {
				const src = img.getAttribute('src');
				if (src) {
					try {
						// 使用相对路径和 base href 构建完整路径
						let fullPath = src;
						if (!src.startsWith('blob:') && !src.startsWith('data:')) {
							const baseHref = currentChapter.href || '';
							const basePath = baseHref.substring(0, baseHref.lastIndexOf('/') + 1);
							fullPath = basePath + src;
						}

						// 从 archive 中获取图片数据
						const imageData = await book.archive.getBlob(fullPath, { base64: false });

						// 将字符串内容转换为 Blob
						let blob: Blob;
						if (typeof imageData === 'string') {
							// 如果返回的是 base64 字符串
							const byteCharacters = atob(imageData.split(',')[1]);
							const byteNumbers = new Array(byteCharacters.length);
							for (let i = 0; i < byteCharacters.length; i++) {
								byteNumbers[i] = byteCharacters.charCodeAt(i);
							}
							const byteArray = new Uint8Array(byteNumbers);
							blob = new Blob([byteArray], { type: 'image/jpeg' });
						} else {
							{ // 如果返回的是 ArrayBuffer
								blob = new Blob([imageData], {type: 'image/jpeg'});
							}
						}

						// 创建 URL
						const url = URL.createObjectURL(blob);
						imageUrls.push(url);
					} catch (error) {
						console.error('Error loading image:', src, error);
					}
				}
			}

			images = imageUrls;
		} catch (error) {
			console.error('Error loading manga chapter:', error);
		}

		loading = false;
	}

	// 监听章节变化
	$: if (currentChapter) {
		loadChapterImages();
	}

	// 清理创建的对象URL
	onDestroy(() => {
		images.forEach(url => URL.revokeObjectURL(url));
	});
</script>

<div class="manga-container">
	{#if loading}
		<div class="loading">加载中...</div>
	{:else}
		<div class="manga-content">
			{#each images as imageUrl, index}
				<div class="manga-page">
					<img
						src={imageUrl}
						alt="Page {index + 1}"
						loading="lazy"
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.manga-container {
		height: 100%;
		overflow-y: auto;
		scroll-behavior: smooth;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted);
		font-size: 1.2em;
	}

	.manga-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
	}

	.manga-page {
		width: 100%;
		max-width: 800px;
		display: flex;
		justify-content: center;
	}

	.manga-page img {
		width: 100%;
		height: auto;
		object-fit: contain;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
</style>
