import { FRAMEWORK_MODES } from "./config.js";

export const ISSUE_BUCKETS = Object.freeze({
	ONE: "one",
	TWO: "two",
});

export function classifyIssue({ isSafeAutoFix }) {
	return isSafeAutoFix ? ISSUE_BUCKETS.ONE : ISSUE_BUCKETS.TWO;
}

export function shouldApplyFix({ mode, bucket }) {
	if (bucket !== ISSUE_BUCKETS.ONE) {
		return false;
	}

	return mode === FRAMEWORK_MODES.AUTO || mode === FRAMEWORK_MODES.HYBRID;
}
