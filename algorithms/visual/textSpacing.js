import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";
import { injectStyleOnce } from "../../utils/domUtils.js";

const ALGORITHM_NAME = "Text Spacing";
const TEXT_SPACING_STYLE_ID = "af-text-spacing-style";
const LINE_HEIGHT_CLASS = "af-line-height-fix";
const LETTER_SPACING_CLASS = "af-letter-spacing-fix";
const WORD_SPACING_CLASS = "af-word-spacing-fix";
const PARAGRAPH_SPACING_CLASS = "af-paragraph-spacing-fix";
const TEXT_SPACING_CSS = `.${LINE_HEIGHT_CLASS} {
	line-height: 1.5 !important;
}

.${LETTER_SPACING_CLASS} {
	letter-spacing: 0.12em !important;
}

.${WORD_SPACING_CLASS} {
	word-spacing: 0.16em !important;
}

.${PARAGRAPH_SPACING_CLASS} {
	margin-bottom: 1em !important;
}`;

const TEXT_ELEMENT_SELECTOR =
	"p, li, blockquote, dd, dt, div, section, article";

const PRIORITY_TEXT_TAGS = new Set(["p", "li", "blockquote"]);
const SECONDARY_TEXT_TAGS = new Set(["dd", "dt"]);
const OPTIONAL_TEXT_TAGS = new Set(["div", "section", "article"]);

function getNormalizedFilteredText(node) {
	if (!node) {
		return "";
	}

	if (node.nodeType === 3) {
		return String(node.textContent ?? "").replace(/\s+/g, " ").trim();
	}

	if (node.nodeType !== 1) {
		return "";
	}

	const elementNode = node;
	const tagName = String(elementNode.tagName ?? "").toLowerCase();
	const ariaHidden = String(elementNode.getAttribute?.("aria-hidden") ?? "")
		.trim()
		.toLowerCase();

	if (ariaHidden === "true") {
		return "";
	}

	if (tagName === "i" || tagName === "svg") {
		return "";
	}

	const textParts = [];
	const childNodes = elementNode.childNodes ?? [];
	for (let index = 0; index < childNodes.length; index += 1) {
		const childText = getNormalizedFilteredText(childNodes[index]);
		if (childText) {
			textParts.push(childText);
		}
	}

	return textParts.join(" ").trim();
}

function hasVisibleText(element) {
	if (!element) {
		return false;
	}

	const rawText = String(element.textContent ?? "");
	if (!rawText || rawText.trim().length === 0) {
		return false;
	}

	const filteredText = getNormalizedFilteredText(element);
	return filteredText.trim().length > 0;
}

function hasDirectReadableText(element) {
	if (!element?.childNodes) {
		return false;
	}

	for (let index = 0; index < element.childNodes.length; index += 1) {
		const node = element.childNodes[index];
		if (node?.nodeType === 3) {
			const text = String(node.textContent ?? "").trim();
			if (text.length > 0) {
				return true;
			}
		}
	}

	return false;
}

function isElementHidden(element, windowObject = globalThis.window) {
	if (!element || typeof element.getAttribute !== "function") {
		return true;
	}

	const ariaHidden = String(element.getAttribute("aria-hidden") ?? "")
		.trim()
		.toLowerCase();
	if (ariaHidden === "true") {
		return true;
	}

	if (typeof windowObject?.getComputedStyle !== "function") {
		return false;
	}

	const styles = windowObject.getComputedStyle(element);
	if (styles.display === "none" || styles.visibility === "hidden") {
		return true;
	}

	return false;
}

function parseFontSizePx(styles) {
	const fontSize = Number.parseFloat(String(styles?.fontSize ?? ""));
	return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : Number.NaN;
}

function parseRootFontSizePx(documentNode, windowObject) {
	if (!documentNode?.documentElement || typeof windowObject?.getComputedStyle !== "function") {
		return Number.NaN;
	}

	const rootStyles = windowObject.getComputedStyle(documentNode.documentElement);
	const rootFontSize = Number.parseFloat(String(rootStyles?.fontSize ?? ""));
	return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : Number.NaN;
}

function toEm(value, fontSizePx, rootFontSizePx) {
	if (typeof value !== "string") {
		return Number.NaN;
	}

	const normalized = value.trim().toLowerCase();
	if (!normalized) {
		return Number.NaN;
	}

	if (normalized === "normal") {
		return Number.NaN;
	}

	const numeric = Number.parseFloat(normalized);
	if (!Number.isFinite(numeric)) {
		return Number.NaN;
	}

	if (numeric === 0) {
		return 0;
	}

	if (normalized.endsWith("em")) {
		return numeric;
	}

	if (normalized.endsWith("rem")) {
		if (!Number.isFinite(rootFontSizePx) || !Number.isFinite(fontSizePx) || fontSizePx <= 0) {
			return Number.NaN;
		}
		return (numeric * rootFontSizePx) / fontSizePx;
	}

	if (normalized.endsWith("px")) {
		if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) {
			return Number.NaN;
		}
		return numeric / fontSizePx;
	}

	if (normalized.endsWith("%")) {
		return numeric / 100;
	}

	return Number.NaN;
}

function getLineHeightRatio(lineHeightValue, fontSizePx, rootFontSizePx) {
	if (typeof lineHeightValue !== "string") {
		return Number.NaN;
	}

	const normalized = lineHeightValue.trim().toLowerCase();
	if (!normalized || normalized === "normal") {
		return Number.NaN;
	}

	const numeric = Number.parseFloat(normalized);
	if (!Number.isFinite(numeric) || !Number.isFinite(fontSizePx) || fontSizePx <= 0) {
		return Number.NaN;
	}

	if (normalized.endsWith("em")) {
		return numeric;
	}

	if (normalized.endsWith("rem")) {
		if (!Number.isFinite(rootFontSizePx)) {
			return Number.NaN;
		}
		return (numeric * rootFontSizePx) / fontSizePx;
	}

	if (normalized.endsWith("%")) {
		return numeric / 100;
	}

	return numeric / fontSizePx;
}

function isParagraphSpacingEligible(element, styles) {
	if (!element) {
		return false;
	}

	const tagName = String(element.tagName ?? "").toLowerCase();
	const eligibleTags = new Set(["p", "li", "blockquote"]);

	if (!eligibleTags.has(tagName)) {
		return false;
	}

	const display = String(styles?.display ?? "").trim().toLowerCase();
	const blockDisplays = new Set(["block", "list-item", "flex", "grid", "flow-root"]);

	return blockDisplays.has(display);
}

function getTextSpacingFailures(element, windowObject, documentNode) {
	if (!element || typeof windowObject?.getComputedStyle !== "function") {
		return {
			lineHeight: true,
			letterSpacing: true,
			wordSpacing: true,
			paragraphSpacing: false,
		};
	}

	const styles = windowObject.getComputedStyle(element);
	const normalizedLineHeight = String(styles.lineHeight ?? "")
		.trim()
		.toLowerCase();
	if (normalizedLineHeight === "normal") {
		return {
			lineHeight: false,
			letterSpacing: false,
			wordSpacing: false,
			paragraphSpacing: false,
		};
	}
	const fontSizePx = parseFontSizePx(styles);
	const rootFontSizePx = parseRootFontSizePx(documentNode, windowObject);

	const lineHeightRatio = getLineHeightRatio(styles.lineHeight, fontSizePx, rootFontSizePx);
	const letterSpacingEm = toEm(styles.letterSpacing, fontSizePx, rootFontSizePx);
	const wordSpacingEm = toEm(styles.wordSpacing, fontSizePx, rootFontSizePx);
	const marginBottomEm = toEm(styles.marginBottom, fontSizePx, rootFontSizePx);

	const lineHeightFail = !Number.isFinite(lineHeightRatio) || lineHeightRatio < 1.4;
	const letterSpacingFail = !Number.isFinite(letterSpacingEm) || letterSpacingEm < 0.08;
	const wordSpacingFail = !Number.isFinite(wordSpacingEm) || wordSpacingEm < 0.12;
	const paragraphSpacingEligible = isParagraphSpacingEligible(element, styles);
	const paragraphSpacingFail =
		paragraphSpacingEligible &&
		(!Number.isFinite(marginBottomEm) || marginBottomEm < 1);

	return {
		lineHeight: lineHeightFail,
		letterSpacing: letterSpacingFail,
		wordSpacing: wordSpacingFail,
		paragraphSpacing: paragraphSpacingFail,
	};
}

export function runTextSpacingAlgorithm({ mode, document: documentNode, window: windowObject, root }) {
	const scope = root || documentNode;
	const bucket = classifyIssue({ isSafeAutoFix: true });

	if (!scope?.querySelectorAll) {
		return {
			algorithm: ALGORITHM_NAME,
			bucket,
			severity: "Medium",
			action: "no issues",
			mode,
			elementsAffected: 0,
			whatThisMeans:
				"Insufficient text spacing reduces readability and can make content difficult to consume, especially for users with cognitive or visual impairments.",
		};
	}

	const candidates = Array.from(scope.querySelectorAll(TEXT_ELEMENT_SELECTOR));
	const eligibleElements = candidates.filter(
		(element) => {
			if (isElementHidden(element, windowObject) || !hasVisibleText(element)) {
				return false;
			}

			const tagName = String(element.tagName ?? "").toLowerCase();
			const trimmedText = String(element.textContent ?? "").trim();
			const textLength = trimmedText.length;
			const words = trimmedText ? trimmedText.split(/\s+/) : [];
			const wordCount = words.length;

			if (PRIORITY_TEXT_TAGS.has(tagName)) {
				return textLength >= 20;
			}

			if (OPTIONAL_TEXT_TAGS.has(tagName)) {
				return (
					hasDirectReadableText(element) &&
					textLength >= 40 &&
					wordCount >= 6
				);
			}

			if (SECONDARY_TEXT_TAGS.has(tagName)) {
				return textLength >= 40 && wordCount >= 6;
			}

			return false;
		}
	);

	const failingElements = eligibleElements
		.map((element) => {
			const failures = getTextSpacingFailures(element, windowObject, documentNode);
			const needsFix =
				failures.lineHeight ||
				failures.letterSpacing ||
				failures.wordSpacing ||
				failures.paragraphSpacing;
			return needsFix ? { element, failures } : null;
		})
		.filter(Boolean);

	const elementsAffected = failingElements.length;
	const shouldApplyAutoFix =
		shouldApplyFix({ mode, bucket }) && elementsAffected > 0;

	if (shouldApplyAutoFix) {
		injectStyleOnce(TEXT_SPACING_STYLE_ID, TEXT_SPACING_CSS, documentNode);
		failingElements.forEach(({ element, failures }) => {
			if (!element?.classList) {
				return;
			}

			if (failures.lineHeight && !element.classList.contains(LINE_HEIGHT_CLASS)) {
				element.classList.add(LINE_HEIGHT_CLASS);
			}

			if (failures.letterSpacing && !element.classList.contains(LETTER_SPACING_CLASS)) {
				element.classList.add(LETTER_SPACING_CLASS);
			}

			if (failures.wordSpacing && !element.classList.contains(WORD_SPACING_CLASS)) {
				element.classList.add(WORD_SPACING_CLASS);
			}

			if (failures.paragraphSpacing && !element.classList.contains(PARAGRAPH_SPACING_CLASS)) {
				element.classList.add(PARAGRAPH_SPACING_CLASS);
			}
		});
	}

	return {
		algorithm: ALGORITHM_NAME,
		bucket,
		severity: "Medium",
		action:
			elementsAffected > 0
				? shouldApplyAutoFix
					? "applied"
					: "skipped"
				: "no issues",
			mode,
			elementsAffected,
			whatThisMeans:
				"Insufficient text spacing reduces readability and can make content difficult to consume, especially for users with cognitive or visual impairments.",
	};
}

const textSpacingAlgorithm = {
	id: "textSpacing",
	name: ALGORITHM_NAME,
	execute: runTextSpacingAlgorithm,
};

export default textSpacingAlgorithm;
