import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";
import {
	getInteractiveElements,
	isElementEligible,
	injectStyleOnce,
	isFocusIndicatorVisible,
} from "../../utils/domUtils.js";

const ALGORITHM_NAME = "Focus Visibility";
const FOCUS_STYLE_ID = "af-focus-visibility-fix";
const FOCUS_FIX_CSS = `:focus {
	outline: 2px solid black !important;
	outline-offset: 2px !important;
}`;

export function runFocusVisibilityAlgorithm({ mode, document: documentNode, window: windowObject, root }) {
	const scope = root || documentNode;
	const eligibleElements = getInteractiveElements(scope).filter(
		(element) => isElementEligible(element, windowObject)
	);
	const failingElements = eligibleElements.filter(
		(element) => !isFocusIndicatorVisible(element, windowObject, documentNode)
	);
	const elementsAffected = failingElements.length;
	const bucket = classifyIssue({ isSafeAutoFix: true });

	const shouldInjectFix =
		shouldApplyFix({ mode, bucket }) && elementsAffected > 0;

	if (shouldInjectFix) {
		injectStyleOnce(FOCUS_STYLE_ID, FOCUS_FIX_CSS, documentNode);
	}

	return {
		algorithm: ALGORITHM_NAME,
		bucket,
		action: shouldInjectFix ? "applied" : "skipped",
		mode,
		elementsAffected,
	};
}

const focusVisibilityAlgorithm = {
	id: "focusVisibility",
	name: ALGORITHM_NAME,
	execute: runFocusVisibilityAlgorithm,
};

export default focusVisibilityAlgorithm;
