import focusVisibilityAlgorithm from "../algorithms/navigation/focusVisibility.js";
import altTextAlgorithm from "../algorithms/semantic/altText.js";
import formLabelsAlgorithm from "../algorithms/semantic/formLabels.js";

const registry = [
	focusVisibilityAlgorithm,
	altTextAlgorithm,
	formLabelsAlgorithm,
];

export function getRegisteredAlgorithms() {
	return [...registry];
}