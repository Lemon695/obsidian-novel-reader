import {writable} from 'svelte/store';

interface ChapterState {
	id: number | null;
	title: string;
	timestamp: number;
}

function createChapterStore() {
	const {subscribe, set, update} = writable<ChapterState>({
		id: null,
		title: '',
		timestamp: Date.now()
	});

	return {
		subscribe,
		set: (value: ChapterState) => {
			console.log("DEBUG - Setting store value:", value);
			set(value);
		},
		update
	};
}

export const currentChapterStore = createChapterStore();
