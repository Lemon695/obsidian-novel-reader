import type {ReadingProgress} from "./index";

export interface ProgressEventDetail {
	progress: ReadingProgress;
}

export interface CustomProgressEvent extends CustomEvent<ProgressEventDetail> {
	detail: ProgressEventDetail;
}
