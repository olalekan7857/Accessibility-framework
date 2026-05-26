import focusVisibilityAlgorithm from "../algorithms/navigation/focusVisibility.js";
import skipNavigationAlgorithm from "../algorithms/navigation/skipNav.js";
import navigationOrderAlgorithm from "../algorithms/navigation/navigationOrder.js";
import motionReductionAlgorithm from "../algorithms/navigation/motionReduction.js";
import textSpacingAlgorithm from "../algorithms/visual/textSpacing.js";
import languageDeclarationAlgorithm from "../algorithms/semantic/language.js";
import altTextAlgorithm from "../algorithms/semantic/altText.js";
import formLabelsAlgorithm from "../algorithms/semantic/formLabels.js";
import roleLabelValidationAlgorithm from "../algorithms/semantic/buttonLinkText.js";

const registry = [
	focusVisibilityAlgorithm,
	skipNavigationAlgorithm,
	navigationOrderAlgorithm,
	motionReductionAlgorithm,
	textSpacingAlgorithm,
	languageDeclarationAlgorithm,
	altTextAlgorithm,
	formLabelsAlgorithm,
	roleLabelValidationAlgorithm,
];

export function getRegisteredAlgorithms() {
	return [...registry];
}