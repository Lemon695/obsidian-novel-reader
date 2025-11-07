declare module '*.svelte' {
	import type { SvelteComponent,ComponentType } from 'svelte';
	const component: ComponentType;
	export default component;
}
