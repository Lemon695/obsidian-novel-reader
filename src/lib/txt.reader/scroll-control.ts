
// export function handleKeyDown(event: KeyboardEvent) { }
// export function handleFocus() { }
// export function handleBlur() { }

export function scrollPage(direction: 'up' | 'down', contentSelector: string = '.content-area') {
	const scrollAmount = 230;
	// 获取当前阅读区域的元素
	const contentElement = document.querySelector(contentSelector);

	if (contentElement) {
		// 如果找到了内容元素，滚动这个元素
		contentElement.scrollBy({
			top: direction === 'up' ? -scrollAmount : scrollAmount,
			behavior: 'smooth'
		});
	} else {
		// 否则滚动整个窗口
		window.scrollBy({
			top: direction === 'up' ? -scrollAmount : scrollAmount,
			behavior: 'smooth'
		});
	}
}
