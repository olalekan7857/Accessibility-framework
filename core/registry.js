import focusVisibilityAlgorithm from "../algorithms/navigation/focusVisibility.js";
import altTextAlgorithm from "../algorithms/semantic/altText.js";
import formLabelsAlgorithm from "../algorithms/semantic/formLabels.js";
import roleLabelValidationAlgorithm from "../algorithms/semantic/buttonLinkText.js";

const registry = [
	focusVisibilityAlgorithm,
	altTextAlgorithm,
	formLabelsAlgorithm,
	roleLabelValidationAlgorithm,
];

export function getRegisteredAlgorithms() {
	return [...registry];
}