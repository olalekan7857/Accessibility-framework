import focusVisibilityAlgorithm from "../algorithms/navigation/focusVisibility.js";
import skipNavigationAlgorithm from "../algorithms/navigation/skipNav.js";
import navigationOrderAlgorithm from "../algorithms/navigation/navigationOrder.js";
import motionReductionAlgorithm from "../algorithms/navigation/motionReduction.js";
import contrastAlgorithm from "../algorithms/visual/contrast.js";
import textSpacingAlgorithm from "../algorithms/visual/textSpacing.js";
import highContrastAlgorithm from "../algorithms/visual/highContrast.js";
import textScalingAlgorithm from "../algorithms/visual/textScaling.js";
import languageDeclarationAlgorithm from "../algorithms/semantic/language.js";
import headingStructureAlgorithm from "../algorithms/semantic/headings.js";
import altTextAlgorithm from "../algorithms/semantic/altText.js";
import formLabelsAlgorithm from "../algorithms/semantic/formLabels.js";
import formErrorsAlgorithm from "../algorithms/semantic/formErrors.js";
import roleLabelValidationAlgorithm from "../algorithms/semantic/buttonLinkText.js";

const registry = [
	focusVisibilityAlgorithm,
	skipNavigationAlgorithm,
	navigationOrderAlgorithm,
	motionReductionAlgorithm,
	contrastAlgorithm,
	textSpacingAlgorithm,
	highContrastAlgorithm,
	textScalingAlgorithm,
	languageDeclarationAlgorithm,
	headingStructureAlgorithm,
	altTextAlgorithm,
	formLabelsAlgorithm,
	formErrorsAlgorithm,
	roleLabelValidationAlgorithm,
];

export function getRegisteredAlgorithms() {
	return [...registry];
}