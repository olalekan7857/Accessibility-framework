export const INTERACTIVE_ELEMENT_SELECTORS = Object.freeze([
	"button",
	"a",
	"input",
	"textarea",
	"select",
]);

const INTERACTIVE_SELECTOR_QUERY = INTERACTIVE_ELEMENT_SELECTORS.join(", ");

function parseAlphaValue(alphaValue) {
	if (typeof alphaValue !== "string") {
		return Number.NaN;
	}

	const normalizedAlpha = alphaValue.trim().toLowerCase();

	if (!normalizedAlpha) {
		return Number.NaN;
	}

	if (normalizedAlpha.endsWith("%")) {
		const percentage = Number.parseFloat(normalizedAlpha);
		return Number.isFinite(percentage) ? percentage / 100 : Number.NaN;
	}

	const numericAlpha = Number.parseFloat(normalizedAlpha);
	return Number.isFinite(numericAlpha) ? numericAlpha : Number.NaN;
}

function isZeroOutlineWidth(outlineWidthValue) {
	if (typeof outlineWidthValue !== "string") {
		return true;
	}

	const normalizedWidth = outlineWidthValue.trim().toLowerCase();

	if (normalizedWidth === "0px" || normalizedWidth === "0") {
		return true;
	}

	const numericWidth = Number.parseFloat(normalizedWidth);
	return Number.isFinite(numericWidth) && numericWidth === 0;
}

function isTransparentHexColor(colorValue) {
	const normalizedColor = colorValue.trim().toLowerCase();

	if (!/^#([0-9a-f]{4}|[0-9a-f]{8})$/i.test(normalizedColor)) {
		return false;
	}

	if (normalizedColor.length === 5) {
		const alphaChannel = normalizedColor.slice(4);
		return alphaChannel === "0";
	}

	const alphaChannel = normalizedColor.slice(7);
	return alphaChannel === "00";
}

function getFunctionalColorAlpha(colorValue) {
	const normalizedColor = colorValue.trim().toLowerCase();

	const modernAlphaMatch = normalizedColor.match(/\/\s*([0-9.]+%?)\s*\)$/);
	if (modernAlphaMatch) {
		return parseAlphaValue(modernAlphaMatch[1]);
	}

	const functionBodyMatch = normalizedColor.match(/^[a-z]+\((.*)\)$/);
	if (!functionBodyMatch) {
		return Number.NaN;
	}

	const commaSeparatedValues = functionBodyMatch[1]
		.split(",")
		.map((value) => value.trim());

	if (commaSeparatedValues.length !== 4) {
		return Number.NaN;
	}

	return parseAlphaValue(commaSeparatedValues[3]);
}

function isColorFullyTransparent(colorValue) {
	if (!colorValue || typeof colorValue !== "string") {
		return true;
	}

	const normalizedColor = colorValue.trim().toLowerCase();

	if (!normalizedColor || normalizedColor === "transparent") {
		return true;
	}

	if (isTransparentHexColor(normalizedColor)) {
		return true;
	}

	const alphaChannel = getFunctionalColorAlpha(normalizedColor);
	return Number.isFinite(alphaChannel) && alphaChannel === 0;
}

function focusElementForStyleComputation(element) {
	if (typeof element.focus !== "function") {
		return;
	}

	try {
		element.focus({ preventScroll: true });
	} catch (error) {
		element.focus();
	}
}

function restoreActiveElement(previousActiveElement, documentNode) {
	if (
		!previousActiveElement ||
		previousActiveElement === documentNode?.body ||
		typeof previousActiveElement.focus !== "function"
	) {
		return;
	}

	try {
		previousActiveElement.focus({ preventScroll: true });
	} catch (error) {
		previousActiveElement.focus();
	}
}

export function isElementEligible(element, windowObject = globalThis.window) {
	if (!element) {
		return false;
	}

	if (element.disabled === true) {
		return false;
	}

	if (typeof element.tabIndex === "number" && element.tabIndex === -1) {
		return false;
	}

	if (element.offsetParent === null) {
		return false;
	}

	if (!windowObject?.getComputedStyle) {
		return true;
	}

	const styles = windowObject.getComputedStyle(element);
	if (styles.display === "none" || styles.visibility === "hidden") {
		return false;
	}

	return true;
}

export function getInteractiveElements(documentNode = globalThis.document) {
	if (!documentNode?.querySelectorAll) {
		return [];
	}

	const selector =
		"button, input:not([type='hidden']), textarea, select, a[href]";
	return Array.from(documentNode.querySelectorAll(selector));
}

export function isFocusIndicatorVisible(
	element,
	windowObject = globalThis.window,
	documentNode = globalThis.document
) {
	if (!element || typeof windowObject?.getComputedStyle !== "function") {
		return false;
	}

	const previousActiveElement = documentNode?.activeElement ?? null;
	const wasAlreadyFocused = previousActiveElement === element;
	let computedStyles;

	try {
		if (!wasAlreadyFocused) {
			focusElementForStyleComputation(element);
		}

		computedStyles = windowObject.getComputedStyle(element);
	} catch (error) {
		return false;
	} finally {
		if (!wasAlreadyFocused && typeof element.blur === "function") {
			try {
				element.blur();
			} catch (error) {
				// no-op: best effort cleanup
			}
		}

		if (!wasAlreadyFocused) {
			restoreActiveElement(previousActiveElement, documentNode);
		}
	}

	if (!computedStyles) {
		return false;
	}

	const outlineStyle = String(computedStyles.outlineStyle || "")
		.trim()
		.toLowerCase();
	const outlineWidth = String(computedStyles.outlineWidth || "")
		.trim()
		.toLowerCase();
	const outlineColor = String(computedStyles.outlineColor || "")
		.trim()
		.toLowerCase();

	const hasNoVisibleFocusIndicator =
		outlineStyle === "none" ||
		isZeroOutlineWidth(outlineWidth) ||
		isColorFullyTransparent(outlineColor);

	return !hasNoVisibleFocusIndicator;
}

export function injectStyleOnce(
	styleId,
	cssText,
	documentNode = globalThis.document
) {
	if (!styleId || !cssText || !documentNode?.createElement) {
		return false;
	}

	if (documentNode.getElementById(styleId)) {
		return false;
	}

	const styleTag = documentNode.createElement("style");
	styleTag.id = styleId;
	styleTag.setAttribute("data-a11y-framework", "true");
	styleTag.textContent = cssText;

	const targetParent =
		documentNode.head || documentNode.documentElement || documentNode.body;

	if (!targetParent?.appendChild) {
		return false;
	}

	targetParent.appendChild(styleTag);

	return true;
}

export function getAllImages(root = globalThis.document) {
	if (!root?.querySelectorAll) {
		return [];
	}

	return Array.from(root.querySelectorAll("img"));
}

export function hasMissingAlt(element) {
	if (!element) {
		return false;
	}

	if (!element.hasAttribute("alt")) {
		return true;
	}

	const altText = element.getAttribute("alt");
	if (altText === "") {
		return true;
	}

	if (typeof altText === "string" && altText.trim() === "") {
		return true;
	}

	return false;
}

export function hasWeakAltText(element) {
	if (!element) {
		return false;
	}

	const altText = element.getAttribute("alt");
	if (typeof altText !== "string" || altText.trim() === "") {
		return false;
	}

	const normalized = altText.trim().toLowerCase();
	const weakAltTexts = ["image", "photo", "picture", "img"];

	return weakAltTexts.includes(normalized);
}

export function generateFallbackAlt(element) {
	if (!element) {
		return "Image";
	}

	const src = element.getAttribute("src");
	if (typeof src !== "string" || src.trim() === "") {
		return "Image";
	}

	const filename = src.split("/").pop();
	const nameWithoutExt = filename.split(".")[0];
	const friendlyName = nameWithoutExt
		.replace(/[-_]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	return friendlyName.length > 0 ? friendlyName : "Image";
}
