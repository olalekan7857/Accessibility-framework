import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";
import { injectStyleOnce } from "../../utils/domUtils.js";

const ALGORITHM_NAME = "High Contrast Mode";
const HIGH_CONTRAST_CLASS = "af-high-contrast";
const HIGH_CONTRAST_STYLE_ID = "af-high-contrast-style";

const CLASS_SURFACE = "af-hc-surface";
const CLASS_TEXT = "af-hc-text";
const CLASS_LINK = "af-hc-link";
const CLASS_BUTTON = "af-hc-button";
const CLASS_CONTROL = "af-hc-control";
const CLASS_CARD = "af-hc-card";

const MAX_SCAN_PER_GROUP = 160;

const HIGH_CONTRAST_CSS = `
.${HIGH_CONTRAST_CLASS} .${CLASS_SURFACE} {
	background-color: #ffffff !important;
	color: #0f172a !important;
}

.${HIGH_CONTRAST_CLASS} .${CLASS_TEXT} {
	color: #0f172a !important;
}

.${HIGH_CONTRAST_CLASS} .${CLASS_LINK} {
	color: #1d4ed8 !important;
	text-decoration: underline !important;
}

.${HIGH_CONTRAST_CLASS} .${CLASS_LINK}:visited {
	color: #6d28d9 !important;
}

.${HIGH_CONTRAST_CLASS} .${CLASS_BUTTON} {
	background-color: #1f2937 !important;
	color: #ffffff !important;
	border: 2px solid #0f172a !important;
}

.${HIGH_CONTRAST_CLASS} .${CLASS_CONTROL} {
	background-color: #ffffff !important;
	color: #0f172a !important;
	border: 2px solid #0f172a !important;
}

.${HIGH_CONTRAST_CLASS} .${CLASS_CONTROL}::placeholder {
	color: #475569 !important;
}

.${HIGH_CONTRAST_CLASS} .${CLASS_CARD} {
	background-color: #ffffff !important;
	border: 2px solid #0f172a !important;
	color: #0f172a !important;
}

.${HIGH_CONTRAST_CLASS} :focus-visible,
.${HIGH_CONTRAST_CLASS} a:focus,
.${HIGH_CONTRAST_CLASS} button:focus,
.${HIGH_CONTRAST_CLASS} input:focus,
.${HIGH_CONTRAST_CLASS} select:focus,
.${HIGH_CONTRAST_CLASS} textarea:focus {
	outline: 3px solid #f59e0b !important;
	outline-offset: 2px;
}
`;

function normalizeHighContrastSetting(value) {
	if (value === true || value === "on" || value === "enabled") {
		return "on";
	}

	if (value === false || value === "off" || value === "disabled") {
		return "off";
	}

	return "auto";
}

function parseColor(value) {
	if (typeof value !== "string") return null;
	const normalized = value.trim().toLowerCase();
	if (!normalized) return null;
	if (normalized === "transparent") {
		return { r: 0, g: 0, b: 0, a: 0 };
	}

	const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
	if (rgbMatch) {
		const parts = rgbMatch[1].split(",").map((part) => part.trim());
		if (parts.length < 3) return null;
		const r = Number.parseFloat(parts[0]);
		const g = Number.parseFloat(parts[1]);
		const b = Number.parseFloat(parts[2]);
		const a = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
		return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
			? { r, g, b, a: Number.isFinite(a) ? a : 1 }
			: null;
	}

	if (normalized.startsWith("#")) {
		const hex = normalized.slice(1);
		if (hex.length === 3 || hex.length === 4) {
			const r = Number.parseInt(hex[0] + hex[0], 16);
			const g = Number.parseInt(hex[1] + hex[1], 16);
			const b = Number.parseInt(hex[2] + hex[2], 16);
			const a = hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) / 255 : 1;
			return { r, g, b, a };
		}
		if (hex.length === 6 || hex.length === 8) {
			const r = Number.parseInt(hex.slice(0, 2), 16);
			const g = Number.parseInt(hex.slice(2, 4), 16);
			const b = Number.parseInt(hex.slice(4, 6), 16);
			const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
			return { r, g, b, a };
		}
	}

	return null;
}

function isTransparentColor(color) {
	return color ? color.a <= 0.2 : false;
}

function isLowOpacityColor(color) {
	return color ? color.a < 0.6 : false;
}

function isGrayish(color) {
	if (!color) return false;
	return Math.abs(color.r - color.g) < 8 && Math.abs(color.g - color.b) < 8;
}

function isMutedGray(color) {
	return isGrayish(color) && color.r >= 90 && color.r <= 180;
}

function isLightColor(color) {
	return color && color.r > 200 && color.g > 200 && color.b > 200;
}

function colorsEqual(a, b) {
	if (!a || !b) return false;
	return Math.abs(a.r - b.r) < 3 && Math.abs(a.g - b.g) < 3 && Math.abs(a.b - b.b) < 3;
}

function addClassIfNeeded(element, className) {
	if (!element?.classList || element.classList.contains(className)) {
		return 0;
	}

	element.classList.add(className);
	return 1;
}

function shouldEnhanceText(element, styles) {
	if (!element || !styles) return false;
	if (element.classList?.contains("low-contrast-text")) return true;
	const color = parseColor(styles.color);
	return isLowOpacityColor(color) || isMutedGray(color);
}

function shouldEnhanceLink(element, styles, parentStyles) {
	if (!element || !styles) return false;
	const color = parseColor(styles.color);
	const parentColor = parseColor(parentStyles?.color ?? "");
	const decoration = String(styles.textDecorationLine ?? "").toLowerCase();
	return (
		isLowOpacityColor(color) ||
		isMutedGray(color) ||
		(decoration && !decoration.includes("underline")) ||
		(colorsEqual(color, parentColor))
	);
}

function shouldEnhanceButton(styles) {
	if (!styles) return false;
	const textColor = parseColor(styles.color);
	const bgColor = parseColor(styles.backgroundColor);
	const borderColor = parseColor(styles.borderColor);
	const borderWidth = Number.parseFloat(styles.borderWidth ?? "0");
	return (
		isLowOpacityColor(textColor) ||
		isMutedGray(textColor) ||
		!Number.isFinite(borderWidth) ||
		borderWidth < 1.5 ||
		isTransparentColor(bgColor) ||
		isLightColor(borderColor)
	);
}

function shouldEnhanceControl(styles) {
	if (!styles) return false;
	const borderWidth = Number.parseFloat(styles.borderWidth ?? "0");
	const borderColor = parseColor(styles.borderColor);
	const bgColor = parseColor(styles.backgroundColor);
	return (
		!Number.isFinite(borderWidth) ||
		borderWidth < 1.5 ||
		isLightColor(borderColor) ||
		isTransparentColor(bgColor)
	);
}

function shouldEnhanceSurface(styles) {
	if (!styles) return false;
	const bgColor = parseColor(styles.backgroundColor);
	const textColor = parseColor(styles.color);
	return isTransparentColor(bgColor) && isMutedGray(textColor);
}

function shouldEnhanceCard(styles) {
	if (!styles) return false;
	const borderColor = parseColor(styles.borderColor);
	const textColor = parseColor(styles.color);
	return isLightColor(borderColor) || isMutedGray(textColor);
}

function isHighContrastActive(documentNode) {
	if (!documentNode) {
		return false;
	}

	const root = documentNode.documentElement;
	const body = documentNode.body;
	return Boolean(
		root?.classList?.contains(HIGH_CONTRAST_CLASS) ||
		body?.classList?.contains(HIGH_CONTRAST_CLASS)
	);
}

function applyHighContrast(documentNode, windowObject) {
	if (!documentNode) {
		return 0;
	}

	injectStyleOnce(HIGH_CONTRAST_STYLE_ID, HIGH_CONTRAST_CSS, documentNode);

	const root = documentNode.documentElement;
	const body = documentNode.body;
	const target = root?.classList ? root : body;

	if (!target?.classList) {
		return 0;
	}

	let elementsAffected = 0;
	if (!target.classList.contains(HIGH_CONTRAST_CLASS)) {
		target.classList.add(HIGH_CONTRAST_CLASS);
		elementsAffected += 1;
	}

	const doc = documentNode;
	const win = windowObject ?? doc.defaultView ?? globalThis.window;
	const safeWindow = win?.getComputedStyle ? win : null;
	if (!safeWindow) return elementsAffected;

	const surfaces = [doc.body, doc.querySelector("main")].filter(Boolean);
	surfaces.forEach((element) => {
		const styles = safeWindow.getComputedStyle(element);
		if (shouldEnhanceSurface(styles)) {
			elementsAffected += addClassIfNeeded(element, CLASS_SURFACE);
		}
	});

	const textBlocks = Array.from(
		doc.querySelectorAll("p, li, blockquote, dd, dt, .low-contrast-text")
	).slice(0, MAX_SCAN_PER_GROUP);
	textBlocks.forEach((element) => {
		const styles = safeWindow.getComputedStyle(element);
		if (shouldEnhanceText(element, styles)) {
			elementsAffected += addClassIfNeeded(element, CLASS_TEXT);
		}
	});

	const links = Array.from(doc.querySelectorAll("a")).slice(0, MAX_SCAN_PER_GROUP);
	links.forEach((element) => {
		const styles = safeWindow.getComputedStyle(element);
		const parentStyles = element.parentElement
			? safeWindow.getComputedStyle(element.parentElement)
			: null;
		if (shouldEnhanceLink(element, styles, parentStyles)) {
			elementsAffected += addClassIfNeeded(element, CLASS_LINK);
		}
	});

	const buttons = Array.from(
		doc.querySelectorAll(
			"button, [role='button'], input[type='button'], input[type='submit']"
		)
	).slice(0, MAX_SCAN_PER_GROUP);
	buttons.forEach((element) => {
		const styles = safeWindow.getComputedStyle(element);
		if (shouldEnhanceButton(styles)) {
			elementsAffected += addClassIfNeeded(element, CLASS_BUTTON);
		}
	});

	const controls = Array.from(
		doc.querySelectorAll("input, select, textarea")
	).slice(0, MAX_SCAN_PER_GROUP);
	controls.forEach((element) => {
		const styles = safeWindow.getComputedStyle(element);
		if (shouldEnhanceControl(styles)) {
			elementsAffected += addClassIfNeeded(element, CLASS_CONTROL);
		}
	});

	const cards = Array.from(
		doc.querySelectorAll(
			".hc-card, .card, .panel, .image-card, .high-contrast-demo, .form-section"
		)
	).slice(0, MAX_SCAN_PER_GROUP);
	cards.forEach((element) => {
		const styles = safeWindow.getComputedStyle(element);
		if (shouldEnhanceCard(styles)) {
			elementsAffected += addClassIfNeeded(element, CLASS_CARD);
		}
	});

	return elementsAffected;
}

export function runHighContrastAlgorithm({
	mode,
	document: documentNode,
	window: windowObject,
	highContrast,
}) {
	const bucket = classifyIssue({ isSafeAutoFix: true });
	const isActive = isHighContrastActive(documentNode);
	const normalizedSetting = normalizeHighContrastSetting(highContrast);
	const isExplicitOff = normalizedSetting === "off";
	const shouldApply = shouldApplyFix({ mode, bucket }) && !isExplicitOff;

	let action = "no issues";
	let elementsAffected = 0;
	let whatThisMeans =
		"High contrast mode provides a deterministic accessibility theme that strengthens visibility without changing layout.";

	if (!isActive && shouldApply) {
		elementsAffected = applyHighContrast(documentNode, windowObject);
		action = "applied";
		whatThisMeans =
			"High contrast accessibility theme activated.";
	} else if (!isActive && isExplicitOff) {
		action = "no issues";
		elementsAffected = 0;
		whatThisMeans =
			"High contrast enhancement is disabled by configuration.";
	} else if (!isActive && !shouldApply) {
		action = "reported";
		elementsAffected = 1;
		whatThisMeans =
			"High contrast enhancement available but not applied in audit mode.";
	} else if (isActive) {
		action = "no issues";
		elementsAffected = 0;
		whatThisMeans =
			"High contrast mode already present; no duplicate enhancement applied.";
	}

	return {
		algorithm: ALGORITHM_NAME,
		bucket,
		severity: "Medium",
		action,
		mode,
		elementsAffected,
		whatThisMeans,
	};
}

const highContrastAlgorithm = {
	id: "highContrast",
	name: ALGORITHM_NAME,
	execute: runHighContrastAlgorithm,
};

export default highContrastAlgorithm;
