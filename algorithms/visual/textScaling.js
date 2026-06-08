import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";

const ALGORITHM_NAME = "Text Scaling";
const TARGET_SELECTOR =
	"h1, h2, h3, h4, h5, h6, p, span, div, li, a, button, label, input, textarea, select";

const MAX_SCAN = 250;
const MIN_FONT_SIZE_PX = 10;

const IGNORED_ANCESTOR_TAGS = new Set(["svg", "canvas"]);
const IGNORED_CLASSES = new Set(["logo", "brand"]);
const ICON_FONT_CLASSES = new Set(["fa", "fas", "far", "fab", "material-icons"]);

function isElementHidden(element, windowObject) {
	if (!element) {
		return true;
	}

	let node = element;
	let depth = 0;
	while (node && node.nodeType === 1 && depth < 6) {
		const ariaHidden = String(node.getAttribute?.("aria-hidden") ?? "")
			.trim()
			.toLowerCase();
		if (ariaHidden === "true") {
			return true;
		}

		if (node.hasAttribute?.("hidden")) {
			return true;
		}

		if (typeof windowObject?.getComputedStyle === "function") {
			try {
				const styles = windowObject.getComputedStyle(node);
				if (
					styles &&
					(styles.display === "none" || styles.visibility === "hidden")
				) {
					return true;
				}
			} catch (error) {
				// ignore sandbox exceptions
			}
		}

		node = node.parentElement;
		depth += 1;
	}

	return false;
}

function isInsideIgnoredContainer(element) {
	let node = element?.parentElement;
	while (node && node.nodeType === 1) {
		const tag = String(node.tagName ?? "").toLowerCase();
		if (IGNORED_ANCESTOR_TAGS.has(tag)) {
			return true;
		}
		node = node.parentElement;
	}
	return false;
}

function isBrandOrLogoElement(element) {
	if (!element) {
		return false;
	}

	if (element.hasAttribute?.("data-brand")) {
		return true;
	}

	if (element.classList) {
		for (let i = 0; i < element.classList.length; i++) {
			const cls = String(element.classList[i]).toLowerCase();
			if (IGNORED_CLASSES.has(cls)) {
				return true;
			}
		}
	}

	return false;
}

function isIconFontElement(element) {
	if (!element?.classList) {
		return false;
	}

	for (let i = 0; i < element.classList.length; i++) {
		const cls = String(element.classList[i]).toLowerCase();
		if (ICON_FONT_CLASSES.has(cls)) {
			return true;
		}
	}

	return false;
}

function getReadableText(node) {
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

	if (tagName === "img" || tagName === "svg" || tagName === "canvas") {
		return "";
	}

	if (tagName === "i") {
		return "";
	}

	const textParts = [];
	const childNodes = elementNode.childNodes ?? [];
	for (let index = 0; index < childNodes.length; index += 1) {
		const childText = getReadableText(childNodes[index]);
		if (childText) {
			textParts.push(childText);
		}
	}

	return textParts.join(" ").trim();
}

function hasReadableText(element) {
	const tag = String(element?.tagName ?? "").toLowerCase();
	if (tag === "input" || tag === "textarea") {
		const value = String(element.value ?? "").trim();
		if (value.length > 0) {
			return true;
		}
		return String(element.placeholder ?? "").trim().length > 0;
	}

	return getReadableText(element).length > 0;
}

function isIconOnlyElement(element) {
	const text = getReadableText(element);
	if (!text || text.length === 0) {
		const tag = String(element?.tagName ?? "").toLowerCase();
		if (tag === "i" || tag === "span") {
			return true;
		}
	}
	return false;
}

function isAlreadyScalable(fontSize) {
	if (typeof fontSize !== "string") {
		return false;
	}

	const normalized = fontSize.trim().toLowerCase();
	if (!normalized) {
		return false;
	}

	if (normalized.endsWith("rem")) {
		return true;
	}

	if (normalized.endsWith("em")) {
		return true;
	}

	if (normalized.endsWith("%")) {
		return true;
	}

	if (normalized.startsWith("clamp(")) {
		return true;
	}

	if (normalized.includes("var(")) {
		return true;
	}

	return false;
}

function hasInlineScalableFontSize(element) {
	if (!element?.style?.fontSize) {
		return false;
	}

	const inlineFontSize = String(element.style.fontSize).trim();
	return isAlreadyScalable(inlineFontSize);
}

function formatElementLabel(element) {
	const tag = String(element?.tagName ?? "").toUpperCase();
	const id = String(element?.getAttribute?.("id") ?? "").trim();
	const className = String(element?.getAttribute?.("class") ?? "").trim();
	const classToken = className ? className.split(/\s+/)[0] : "";
	const idSuffix = id ? `#${id}` : "";
	const classSuffix = classToken ? `.${classToken}` : "";
	return `${tag}${idSuffix}${classSuffix}`;
}

function isFormControl(element) {
	if (!element) {
		return false;
	}
	const tag = String(element.tagName ?? "").toLowerCase();
	return tag === "input" || tag === "select" || tag === "textarea";
}

function isBrowserManagedFontSize(fontSize) {
	if (typeof fontSize !== "string") {
		return false;
	}

	const normalized = fontSize.trim().toLowerCase();
	if (!normalized) {
		return false;
	}

	if (normalized === "inherit") {
		return true;
	}

	if (normalized === "initial") {
		return true;
	}

	return false;
}

function parsePxFontSize(fontSize) {
	if (typeof fontSize !== "string") {
		return null;
	}

	const normalized = fontSize.trim().toLowerCase();
	if (!normalized) {
		return null;
	}

	if (normalized.endsWith("px")) {
		const value = Number.parseFloat(normalized);
		return Number.isFinite(value) && value > 0 ? value : null;
	}

	return null;
}

function pxToRem(pxValue) {
	return pxValue / 16;
}

function collectFixedPixelElements(scope, windowObject) {
	const candidates = Array.from(scope.querySelectorAll(TARGET_SELECTOR)).slice(0, MAX_SCAN);
	const fixedPixelElements = [];
	const seenElements = new WeakSet();

	for (let index = 0; index < candidates.length; index += 1) {
		const element = candidates[index];

		if (seenElements.has(element)) {
			continue;
		}

		if (isElementHidden(element, windowObject)) {
			continue;
		}

		if (isInsideIgnoredContainer(element)) {
			continue;
		}

		if (isBrandOrLogoElement(element)) {
			continue;
		}

		if (isIconFontElement(element)) {
			continue;
		}

		if (!hasReadableText(element)) {
			continue;
		}

		if (isIconOnlyElement(element)) {
			continue;
		}

		if (hasInlineScalableFontSize(element)) {
			continue;
		}

		let styles;
		try {
			styles = windowObject.getComputedStyle(element);
		} catch (error) {
			continue;
		}

		if (!styles) {
			continue;
		}

		if (isAlreadyScalable(styles.fontSize)) {
			continue;
		}

		const pxSize = parsePxFontSize(styles.fontSize);
		if (pxSize !== null) {
			if (pxSize < MIN_FONT_SIZE_PX) {
				continue;
			}

			seenElements.add(element);
			fixedPixelElements.push({
				element,
				pxSize,
				remValue: pxToRem(pxSize),
				label: formatElementLabel(element),
			});
		}
	}

	return fixedPixelElements;
}

function collectExcludedElements(scope, windowObject) {
	const candidates = Array.from(scope.querySelectorAll(TARGET_SELECTOR)).slice(0, MAX_SCAN);
	const excludedElements = [];
	const seenElements = new WeakSet();

	const exclusionReasons = {
		brandLogo: [],
		svgCanvas: [],
		iconOnly: [],
		iconFont: [],
		noText: [],
		alreadyScalable: [],
		tinyText: [],
		browserManaged: [],
	};

	for (let index = 0; index < candidates.length; index += 1) {
		const element = candidates[index];

		if (seenElements.has(element)) {
			continue;
		}

		if (isElementHidden(element, windowObject)) {
			continue;
		}

		let reason = null;

		if (isInsideIgnoredContainer(element)) {
			reason = "svgCanvas";
		} else if (isBrandOrLogoElement(element)) {
			reason = "brandLogo";
		} else if (isIconFontElement(element)) {
			reason = "iconFont";
		} else if (!hasReadableText(element)) {
			reason = "noText";
		} else if (isIconOnlyElement(element)) {
			reason = "iconOnly";
		} else if (hasInlineScalableFontSize(element)) {
			reason = "alreadyScalable";
		} else if (isFormControl(element) && isBrowserManagedFontSize(styles?.fontSize)) {
			reason = "browserManaged";
		} else {
			let styles;
			try {
				styles = windowObject.getComputedStyle(element);
			} catch (error) {
				continue;
			}

			if (!styles) {
				continue;
			}

			if (isAlreadyScalable(styles.fontSize)) {
				reason = "alreadyScalable";
			} else {
				const pxSize = parsePxFontSize(styles.fontSize);
				if (pxSize !== null && pxSize < MIN_FONT_SIZE_PX) {
					reason = "tinyText";
				}
			}
		}

		if (reason) {
			seenElements.add(element);
			excludedElements.push({
				element,
				reason,
				label: formatElementLabel(element),
			});
			exclusionReasons[reason].push(element);
		}
	}

	return { excludedElements, exclusionReasons };
}

export function runTextScalingAlgorithm({
	mode,
	document: documentNode,
	window: windowObject,
	root,
}) {
	const scope = root || documentNode;

	if (!scope?.querySelectorAll || typeof windowObject?.getComputedStyle !== "function") {
		return {
			algorithm: ALGORITHM_NAME,
			bucket: classifyIssue({ isSafeAutoFix: false }),
			severity: "Info",
			action: "no issues",
			mode,
			elementsAffected: 0,
			whatThisMeans:
				"No visible text elements were available for text scaling evaluation in this document.",
		};
	}

	const fixedPixelElements = collectFixedPixelElements(scope, windowObject);
	const bucketOne = classifyIssue({ isSafeAutoFix: true });
	const shouldApplyBucketOne = shouldApplyFix({ mode, bucket: bucketOne });

	let bucketOneAction = "no issues";
	let bucketOneElementsAffected = 0;
	let bucketOneWhatThisMeans = "No fixed pixel font sizes detected on scanned text elements.";
	let bucketOneExamples = [];

	if (fixedPixelElements.length > 0) {
		bucketOneElementsAffected = fixedPixelElements.length;

		if (shouldApplyBucketOne) {
			fixedPixelElements.forEach(({ element, remValue }) => {
				if (element.style && typeof element.style.setProperty === "function") {
					element.style.setProperty("font-size", `${remValue.toFixed(3)}rem`, "important");
				}
			});
			bucketOneAction = "applied";
			bucketOneWhatThisMeans = `Converted ${fixedPixelElements.length} fixed pixel font sizes to scalable rem units (16px = 1rem). Text scaling is now responsive to user font size preferences.`;
		} else {
			bucketOneAction = "reported";
			bucketOneWhatThisMeans = `Detected ${fixedPixelElements.length} fixed pixel font sizes that should be converted to rem units for better text scaling. Conversion not applied in audit mode.`;
		}

		bucketOneExamples = fixedPixelElements.slice(0, 5).map(({ label, pxSize, remValue }) => {
			return `${label} (${pxSize}px → ${remValue.toFixed(2)}rem)`;
		});
	}

	const { excludedElements, exclusionReasons } = collectExcludedElements(scope, windowObject);
	const bucketTwo = classifyIssue({ isSafeAutoFix: false });
	const totalExcluded = excludedElements.length;

	let bucketTwoWhatThisMeans = "No text elements were excluded from text scaling analysis.";
	let bucketTwoExamples = [];

	if (totalExcluded > 0) {
		const reasonCounts = {
			brandLogo: exclusionReasons.brandLogo.length,
			svgCanvas: exclusionReasons.svgCanvas.length,
			iconOnly: exclusionReasons.iconOnly.length,
			iconFont: exclusionReasons.iconFont.length,
			noText: exclusionReasons.noText.length,
			alreadyScalable: exclusionReasons.alreadyScalable.length,
			tinyText: exclusionReasons.tinyText.length,
			browserManaged: exclusionReasons.browserManaged.length,
		};

		const reasonDescriptions = [];
		if (reasonCounts.brandLogo > 0) {
			reasonDescriptions.push(`${reasonCounts.brandLogo} brand/logo elements`);
		}
		if (reasonCounts.svgCanvas > 0) {
			reasonDescriptions.push(`${reasonCounts.svgCanvas} SVG/canvas elements`);
		}
		if (reasonCounts.iconFont > 0) {
			reasonDescriptions.push(`${reasonCounts.iconFont} icon font elements`);
		}
		if (reasonCounts.iconOnly > 0) {
			reasonDescriptions.push(`${reasonCounts.iconOnly} icon-only elements`);
		}
		if (reasonCounts.alreadyScalable > 0) {
			reasonDescriptions.push(`${reasonCounts.alreadyScalable} already scalable typography`);
		}
		if (reasonCounts.tinyText > 0) {
			reasonDescriptions.push(`${reasonCounts.tinyText} tiny micro-text (<10px)`);
		}
		if (reasonCounts.browserManaged > 0) {
			reasonDescriptions.push(`${reasonCounts.browserManaged} browser-managed typography`);
		}
		if (reasonCounts.noText > 0) {
			reasonDescriptions.push(`${reasonCounts.noText} elements without meaningful text`);
		}

		bucketTwoWhatThisMeans = `Excluded ${totalExcluded} text elements from text scaling analysis: ${reasonDescriptions.join(", ")}. These elements are intentionally excluded to preserve branding, icons, custom-rendered text, already scalable typography, micro-text, and browser-managed form control typography.`;

		bucketTwoExamples = excludedElements.slice(0, 5).map(({ label, reason }) => {
			const reasonLabels = {
				brandLogo: "branding excluded",
				svgCanvas: "SVG/canvas excluded",
				iconFont: "icon font excluded",
				iconOnly: "icon-only excluded",
				alreadyScalable: "already scalable",
				tinyText: "micro-text excluded",
				browserManaged: "browser-managed typography",
				noText: "no text",
			};
			return `${label} (${reasonLabels[reason] || reason})`;
		});
	}

	const totalElementsAffected = bucketOneElementsAffected + totalExcluded;
	const overallSeverity = bucketOneElementsAffected > 0 ? "Medium" : "Info";
	const overallAction = bucketOneAction === "applied" ? "applied" : bucketOneElementsAffected > 0 ? "reported" : "no issues";

	return {
		algorithm: ALGORITHM_NAME,
		bucket: bucketOne,
		severity: overallSeverity,
		action: overallAction,
		mode,
		elementsAffected: totalElementsAffected,
		whatThisMeans: `${bucketOneWhatThisMeans} ${bucketTwoWhatThisMeans}`,
		debug: {
			bucketOne: {
				elementsAffected: bucketOneElementsAffected,
				action: bucketOneAction,
				description: bucketOneWhatThisMeans,
				examples: bucketOneExamples,
			},
			bucketTwo: {
				elementsAffected: totalExcluded,
				description: bucketTwoWhatThisMeans,
				examples: bucketTwoExamples,
			},
		},
	};
}

const textScalingAlgorithm = {
	id: "textScaling",
	name: ALGORITHM_NAME,
	execute: runTextScalingAlgorithm,
};

export default textScalingAlgorithm;
