import type {Note} from "../notes";

export interface EpubNote extends Note {
	cfi: string;
}
