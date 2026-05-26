import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";

const ALGORITHM_NAME = "Language Declaration";
const VALID_LANG_REGEX = /^([a-z]{2,3})(?:-([a-z]{2}))?$/i;
const PLACEHOLDER_VALUES = new Set(["unknown", "default", "none", "xx"]);

function getTrimmedLangValue(htmlElement, attribute = "lang") {
	if (!htmlElement || typeof htmlElement.getAttribute !== "function") {
		return "";
	}

	const rawValue = htmlElement.getAttribute(attribute);
	return typeof rawValue === "string" ? rawValue.trim() : "";
}

function normalizeLangValue(value) {
	if (typeof value !== "string") {
		return "";
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return "";
	}

	const match = trimmed.match(VALID_LANG_REGEX);
	if (!match) {
		return "";
	}

	const primary = match[1].toLowerCase();
	const region = match[2] ? match[2].toUpperCase() : "";
	return region ? `${primary}-${region}` : primary;
}

function isPlaceholderLang(value) {
	if (typeof value !== "string") {
		return false;
	}

	return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function isValidLangValue(value) {
	return Boolean(normalizeLangValue(value));
}

export function runLanguageDeclarationAlgorithm({ mode, document: documentNode }) {
	const htmlElement = documentNode?.documentElement ?? null;
	const bucketOne = classifyIssue({ isSafeAutoFix: true });
	const bucketTwo = "two";
	const trimmedLang = getTrimmedLangValue(htmlElement, "lang");
	const trimmedXmlLang = getTrimmedLangValue(htmlElement, "xml:lang");
	const normalizedLang = normalizeLangValue(trimmedLang);
	const normalizedXmlLang = normalizeLangValue(trimmedXmlLang);

	const hasMissingLang = !htmlElement || trimmedLang.length === 0;
	const hasPlaceholderLang = !hasMissingLang && isPlaceholderLang(trimmedLang);
	const hasValidLang = !hasMissingLang && !hasPlaceholderLang && Boolean(normalizedLang);
	const hasInvalidLang = !hasMissingLang && !hasPlaceholderLang && !hasValidLang;
	const hasValidXmlLang = Boolean(normalizedXmlLang);
	const hasLangConflict =
		hasValidLang && hasValidXmlLang && normalizedLang !== normalizedXmlLang;

	const bucketOneAffected = hasMissingLang && !hasValidXmlLang ? 1 : 0;
	const bucketTwoAffected =
		hasPlaceholderLang || hasInvalidLang || hasLangConflict ? 1 : 0;

	const shouldApplyAutoFix =
		shouldApplyFix({ mode, bucket: bucketOne }) && bucketOneAffected > 0;

	if (shouldApplyAutoFix && htmlElement) {
		htmlElement.setAttribute("lang", "en");
	}

	const bucketOneResult = {
		algorithm: ALGORITHM_NAME,
		bucket: bucketOne,
		severity: "High",
		action:
			bucketOneAffected > 0
				? shouldApplyAutoFix
					? "applied"
					: "skipped"
				: "no issues",
			mode,
			elementsAffected: bucketOneAffected,
			whatThisMeans:
				"Language declarations help screen readers, pronunciation engines, translation tools, and other assistive technologies interpret content correctly.",
	};

	const bucketTwoResult = {
		algorithm: ALGORITHM_NAME,
		bucket: bucketTwo,
		severity: "Medium",
		action: bucketTwoAffected > 0 ? "reported" : "no issues",
		mode,
		elementsAffected: bucketTwoAffected,
		whatThisMeans:
			"Language declarations help screen readers, pronunciation engines, translation tools, and other assistive technologies interpret content correctly.",
	};

	return [bucketOneResult, bucketTwoResult];
}

const languageDeclarationAlgorithm = {
	id: "languageDeclaration",
	name: ALGORITHM_NAME,
	execute: runLanguageDeclarationAlgorithm,
};

export default languageDeclarationAlgorithm;
