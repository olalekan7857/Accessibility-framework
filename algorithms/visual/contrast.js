import { classifyIssue } from "../../core/classifier.js";

const ALGORITHM_NAME = "Contrast Evaluation";
const MAX_SCAN = 300;
const MAX_DEBUG_ITEMS = 5;

const TARGET_SELECTOR =
	"p, span, li, a, button, label, input, textarea, select, h1, h2, h3, h4, h5, h6";

const IGNORED_ANCESTOR_TAGS = new Set(["svg", "canvas", "picture"]);

function clamp255(value) {
	return Math.min(255, Math.max(0, Math.round(value)));
}

function parseAlphaValue(alphaValue) {
	if (alphaValue === undefined || alphaValue === null || alphaValue === "") {
		return 1;
	}

	const normalized = String(alphaValue).trim().toLowerCase();
	if (normalized.endsWith("%")) {
		const percentage = Number.parseFloat(normalized);
		return Number.isFinite(percentage) ? Math.min(1, Math.max(0, percentage / 100)) : 1;
	}

	const numeric = Number.parseFloat(normalized);
	return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 1;
}

function hslToRgb(h, s, l, alpha = 1) {
	const hue = ((Number(h) % 360) + 360) % 360;
	const saturation = Math.min(1, Math.max(0, s));
	const lightness = Math.min(1, Math.max(0, l));
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const huePrime = hue / 60;
	const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
	let r1 = 0;
	let g1 = 0;
	let b1 = 0;

	if (huePrime >= 0 && huePrime < 1) {
		r1 = chroma;
		g1 = x;
	} else if (huePrime >= 1 && huePrime < 2) {
		r1 = x;
		g1 = chroma;
	} else if (huePrime >= 2 && huePrime < 3) {
		g1 = chroma;
		b1 = x;
	} else if (huePrime >= 3 && huePrime < 4) {
		g1 = x;
		b1 = chroma;
	} else if (huePrime >= 4 && huePrime < 5) {
		r1 = x;
		b1 = chroma;
	} else {
		r1 = chroma;
		b1 = x;
	}

	const match = lightness - chroma / 2;
	return {
		r: clamp255((r1 + match) * 255),
		g: clamp255((g1 + match) * 255),
		b: clamp255((b1 + match) * 255),
		a: alpha,
	};
}

function parseColor(cssColor) {
	if (!cssColor || typeof cssColor !== "string") {
		return { r: 0, g: 0, b: 0, a: 0 };
	}

	const normalized = cssColor.trim().toLowerCase();
	if (!normalized || normalized === "transparent") {
		return { r: 0, g: 0, b: 0, a: 0 };
	}

	const rgbMatch = normalized.match(/^rgba?\((.+)\)$/);
	if (rgbMatch) {
		const body = rgbMatch[1];
		const slashParts = body.split("/");
		const alphaFromSlash =
			slashParts.length > 1 ? parseAlphaValue(slashParts[1]) : undefined;
		const components = slashParts[0]
			.replace(/,/g, " ")
			.trim()
			.split(/\s+/)
			.filter(Boolean);

		if (components.length >= 3) {
			const alpha =
				components.length >= 4
					? parseAlphaValue(components[3])
					: alphaFromSlash ?? 1;
			return {
				r: clamp255(Number.parseFloat(components[0])),
				g: clamp255(Number.parseFloat(components[1])),
				b: clamp255(Number.parseFloat(components[2])),
				a: alpha,
			};
		}
	}

	const hexMatch = normalized.match(/^#([0-9a-f]{3,8})$/i);
	if (hexMatch) {
		let hex = hexMatch[1];
		if (hex.length === 3 || hex.length === 4) {
			hex = hex
				.split("")
				.map((character) => character + character)
				.join("");
		}

		if (hex.length === 6) {
			return {
				r: Number.parseInt(hex.slice(0, 2), 16),
				g: Number.parseInt(hex.slice(2, 4), 16),
				b: Number.parseInt(hex.slice(4, 6), 16),
				a: 1,
			};
		}

		if (hex.length === 8) {
			return {
				r: Number.parseInt(hex.slice(0, 2), 16),
				g: Number.parseInt(hex.slice(2, 4), 16),
				b: Number.parseInt(hex.slice(4, 6), 16),
				a: Number.parseInt(hex.slice(6, 8), 16) / 255,
			};
		}
	}

	const hslMatch = normalized.match(/^hsla?\((.+)\)$/);
	if (hslMatch) {
		const body = hslMatch[1];
		const slashParts = body.split("/");
		const alphaFromSlash =
			slashParts.length > 1 ? parseAlphaValue(slashParts[1]) : undefined;
		const components = slashParts[0]
			.replace(/,/g, " ")
			.trim()
			.split(/\s+/)
			.filter(Boolean);

		if (components.length >= 3) {
			const hue = Number.parseFloat(components[0]);
			const saturation =
				Number.parseFloat(String(components[1]).replace("%", "")) / 100;
			const lightness =
				Number.parseFloat(String(components[2]).replace("%", "")) / 100;
			const alpha =
				components.length >= 4
					? parseAlphaValue(components[3])
					: alphaFromSlash ?? 1;
			return hslToRgb(hue, saturation, lightness, alpha);
		}
	}

	return { r: 0, g: 0, b: 0, a: 0 };
}

function getLuminance({ r, g, b }) {
	const channels = [r, g, b].map((value) => {
		const channel = value / 255;
		return channel <= 0.03928
			? channel / 12.92
			: Math.pow((channel + 0.055) / 1.055, 2.4);
	});
	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function getRatio(l1, l2) {
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

function blendColors(foreground, background) {
	const alpha = foreground.a;
	return {
		r: Math.round(foreground.r * alpha + background.r * (1 - alpha)),
		g: Math.round(foreground.g * alpha + background.g * (1 - alpha)),
		b: Math.round(foreground.b * alpha + background.b * (1 - alpha)),
		a: 1,
	};
}

function resolveOpaqueColor(color, background) {
	if (color.a >= 1) {
		return color;
	}
	if (color.a <= 0) {
		return background;
	}
	return blendColors(color, background);
}

function getEffectiveBackground(element, windowObject, backgroundCache) {
	if (backgroundCache?.has(element)) {
		return backgroundCache.get(element);
	}

	let current = element;
	let blended = { r: 255, g: 255, b: 255, a: 1 };
	const layers = [];

	while (current && current.nodeType === 1) {
		if (typeof windowObject?.getComputedStyle === "function") {
			try {
				const styles = windowObject.getComputedStyle(current);
				const color = parseColor(styles.backgroundColor);
				if (color.a > 0) {
					layers.push(color);
					if (color.a === 1) {
						break;
					}
				}
			} catch (error) {
				// getComputedStyle may fail in sandboxed contexts
			}
		}
		current = current.parentElement;
	}

	for (let index = layers.length - 1; index >= 0; index -= 1) {
		blended = blendColors(layers[index], blended);
	}

	backgroundCache?.set(element, blended);
	return blended;
}

function isLargeText(styles) {
	const fontSize = Number.parseFloat(String(styles?.fontSize ?? ""));
	const fontWeight = String(styles?.fontWeight ?? "");
	const isBold =
		fontWeight === "bold" || Number.parseInt(fontWeight, 10) >= 700;

	if (!Number.isFinite(fontSize)) {
		return false;
	}

	if (fontSize >= 24) {
		return true;
	}

	return isBold && fontSize >= 18.66;
}

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

function isDecorativeElement(element) {
	const role = String(element?.getAttribute?.("role") ?? "")
		.trim()
		.toLowerCase();
	return role === "presentation" || role === "none";
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

function hasVisibleTextDescendantTarget(element, windowObject) {
	const descendants = element.querySelectorAll(TARGET_SELECTOR);
	for (let index = 0; index < descendants.length; index += 1) {
		const descendant = descendants[index];
		if (descendant === element) {
			continue;
		}
		if (isElementHidden(descendant, windowObject)) {
			continue;
		}
		if (!hasReadableText(descendant)) {
			continue;
		}
		return true;
	}
	return false;
}

function getRequiredRatio(styles) {
	return isLargeText(styles) ? 3.0 : 4.5;
}

function getFailureSeverity(ratio) {
	if (ratio < 3.0) {
		return "High";
	}
	return "Medium";
}

function formatLabel(element, isPlaceholder = false) {
	const tag = String(element?.tagName ?? "").toUpperCase();
	const id = String(element?.getAttribute?.("id") ?? "").trim();
	const className = String(element?.getAttribute?.("class") ?? "").trim();
	const classToken = className ? className.split(/\s+/)[0] : "";
	const idSuffix = id ? `#${id}` : "";
	const classSuffix = classToken ? `.${classToken}` : "";
	const placeholderSuffix = isPlaceholder ? "::placeholder" : "";
	return `${tag}${idSuffix}${classSuffix}${placeholderSuffix}`;
}

function evaluateTextContrast(element, styles, windowObject, backgroundCache) {
	const effectiveBackground = getEffectiveBackground(
		element,
		windowObject,
		backgroundCache
	);
	const foreground = resolveOpaqueColor(
		parseColor(styles.color),
		effectiveBackground
	);
	const ratio = getRatio(
		getLuminance(foreground),
		getLuminance(effectiveBackground)
	);
	const requiredRatio = getRequiredRatio(styles);

	return {
		ratio: Number(ratio.toFixed(2)),
		requiredRatio,
		passes: ratio >= requiredRatio,
	};
}

function evaluatePlaceholderContrast(element, styles, windowObject, backgroundCache) {
	const placeholder = String(element.placeholder ?? "").trim();
	if (!placeholder) {
		return null;
	}

	const effectiveBackground = getEffectiveBackground(
		element,
		windowObject,
		backgroundCache
	);

	let placeholderStyles;
	try {
		placeholderStyles = windowObject.getComputedStyle(element, "::placeholder");
	} catch (error) {
		return null;
	}

	const rawPlaceholderColor =
		placeholderStyles?.color &&
		placeholderStyles.color !== styles.color &&
		placeholderStyles.color !== "inherit"
			? placeholderStyles.color
			: "rgba(118, 118, 118, 1)";

	const foreground = resolveOpaqueColor(
		parseColor(rawPlaceholderColor),
		effectiveBackground
	);
	const ratio = getRatio(
		getLuminance(foreground),
		getLuminance(effectiveBackground)
	);
	const requiredRatio = 4.5;

	return {
		ratio: Number(ratio.toFixed(2)),
		requiredRatio,
		passes: ratio >= requiredRatio,
	};
}

function collectContrastFailures(scope, windowObject) {
	const candidates = Array.from(scope.querySelectorAll(TARGET_SELECTOR)).slice(
		0,
		MAX_SCAN
	);
	const failures = [];
	const failureKeys = new Set();
	const backgroundCache = new WeakMap();

	const recordFailure = (element, details) => {
		const key = `${details.isPlaceholder ? "placeholder" : "text"}:${element}`;
		if (failureKeys.has(key)) {
			return;
		}
		failureKeys.add(key);
		failures.push({
			element,
			ratio: details.ratio,
			reqRatio: details.requiredRatio,
			isPlaceholder: details.isPlaceholder,
			severity: getFailureSeverity(details.ratio),
		});
	};

	for (let index = 0; index < candidates.length; index += 1) {
		const element = candidates[index];
		const tag = String(element.tagName ?? "").toLowerCase();

		if (tag === "img" || tag === "svg" || tag === "canvas") {
			continue;
		}
		if (isElementHidden(element, windowObject)) {
			continue;
		}
		if (isInsideIgnoredContainer(element)) {
			continue;
		}
		if (isDecorativeElement(element)) {
			continue;
		}
		if (!hasReadableText(element)) {
			continue;
		}
		if (hasVisibleTextDescendantTarget(element, windowObject)) {
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

		const isTextControl = tag === "input" || tag === "textarea";
		const hasValue =
			isTextControl && String(element.value ?? "").trim().length > 0;

		if (!isTextControl || hasValue) {
			const textResult = evaluateTextContrast(
				element,
				styles,
				windowObject,
				backgroundCache
			);
			if (!textResult.passes) {
				recordFailure(element, {
					ratio: textResult.ratio,
					requiredRatio: textResult.requiredRatio,
					isPlaceholder: false,
				});
			}
		}

		if (isTextControl && String(element.placeholder ?? "").trim()) {
			const placeholderResult = evaluatePlaceholderContrast(
				element,
				styles,
				windowObject,
				backgroundCache
			);
			if (placeholderResult && !placeholderResult.passes) {
				recordFailure(element, {
					ratio: placeholderResult.ratio,
					requiredRatio: placeholderResult.requiredRatio,
					isPlaceholder: true,
				});
			}
		}
	}

	return failures;
}

export function runContrastAlgorithm({
	mode,
	document: documentNode,
	window: windowObject,
	root,
}) {
	const scope = root || documentNode;
	const bucket = classifyIssue({ isSafeAutoFix: false });

	if (!scope?.querySelectorAll || typeof windowObject?.getComputedStyle !== "function") {
		return {
			algorithm: ALGORITHM_NAME,
			bucket,
			severity: "Info",
			action: "no issues",
			mode,
			elementsAffected: 0,
			whatThisMeans:
				"No visible text elements were available for contrast evaluation in this document.",
		};
	}

	const failures = collectContrastFailures(scope, windowObject);
	const elementsAffected = failures.length;

	if (elementsAffected === 0) {
		return {
			algorithm: ALGORITHM_NAME,
			bucket,
			severity: "Info",
			action: "no issues",
			mode,
			elementsAffected: 0,
			whatThisMeans:
				"No standard visual color contrast failures detected on scanned text elements.",
			debug: [],
		};
	}

	const highestSeverity = failures.some((failure) => failure.severity === "High")
		? "High"
		: "Medium";
	const examples = failures.slice(0, 3).map((failure) => {
		return `${formatLabel(failure.element, failure.isPlaceholder)} (${failure.ratio}:1)`;
	});
	const debug = failures.slice(0, MAX_DEBUG_ITEMS).map((failure) => ({
		tag: String(failure.element.tagName ?? "").toLowerCase(),
		id: String(failure.element.getAttribute?.("id") ?? ""),
		class: String(failure.element.getAttribute?.("class") ?? ""),
		ratio: failure.ratio,
		requiredRatio: failure.reqRatio,
		isPlaceholder: failure.isPlaceholder,
	}));

	return {
		algorithm: ALGORITHM_NAME,
		bucket,
		severity: highestSeverity,
		action: "reported",
		mode,
		elementsAffected,
		whatThisMeans: `${elementsAffected} contrast failures detected. Highest severity: ${highestSeverity}. Examples: ${examples.join(", ")}.`,
		debug,
	};
}

const contrastAlgorithm = {
	id: "contrastAnalysis",
	name: ALGORITHM_NAME,
	execute: runContrastAlgorithm,
};

export default contrastAlgorithm;
