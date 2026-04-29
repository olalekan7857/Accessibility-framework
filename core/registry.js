import focusVisibilityAlgorithm from "../algorithms/navigation/focusVisibility.js";
import altTextAlgorithm from "../algorithms/semantic/altText.js";

const registry = [focusVisibilityAlgorithm, altTextAlgorithm];

export function getRegisteredAlgorithms() {
	return [...registry];
}