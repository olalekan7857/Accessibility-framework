import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";
import {
	generateFallbackLabel,
	getAllFormControls,
	hasAccessibleLabel,
} from "../../utils/domUtils.js";

const ALGORITHM_NAME = "Form Labels";

export function runFormLabelsAlgorithm({ mode, document: documentNode, root }) {
	const scope = root || documentNode;
	const formControls = getAllFormControls(scope).filter(
		(element) => element?.disabled !== true
	);

	const failingControls = formControls.filter(
		(element) => !hasAccessibleLabel(element)
	);

	const elementsAffected = failingControls.length;
	const bucket = classifyIssue({ isSafeAutoFix: true });
	const shouldApplyAutoFix =
		shouldApplyFix({ mode, bucket }) && elementsAffected > 0;

	if (shouldApplyAutoFix) {
		failingControls.forEach((element) => {
			const fallbackLabel = generateFallbackLabel(element);
			element.setAttribute("aria-label", fallbackLabel);
		});
	}

	return {
		algorithm: ALGORITHM_NAME,
		severity: "High",
		bucket,
		action:
			elementsAffected === 0
				? "skipped"
				: shouldApplyAutoFix
					? "applied"
					: "skipped",
		mode,
		elementsAffected,
		whatThisMeans:
			"Form inputs without labels are not accessible to screen reader users and can make forms unusable.",
	};
}

const formLabelsAlgorithm = {
	id: "formLabels",
	name: ALGORITHM_NAME,
	execute: runFormLabelsAlgorithm,
};

export default formLabelsAlgorithm;
