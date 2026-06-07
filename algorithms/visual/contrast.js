import { classifyIssue } from "../../core/classifier.js";

const ALGORITHM_NAME = "Contrast Evaluation";
const MAX_SCAN = 300;
const MAX_DEBUG_ITEMS = 5;

const TARGET_SELECTOR = "p, span, li, a, button, label, input, textarea, select, h1, h2, h3, h4, h5, h6";

function parseColor(cssColor) {
	if (!cssColor || typeof cssColor !== "string") return { r: 0, g: 0, b: 0, a: 0 };
	const r = cssColor.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
	if (r) {
		return {
			r: Number.parseInt(r[1], 10),
			g: Number.parseInt(r[2], 10),
			b: Number.parseInt(r[3], 10),
			a: r[4] !== undefined ? Number.parseFloat(r[4]) : 1,
		};
	}
	return { r: 0, g: 0, b: 0, a: 0 };
}

function getLuminance({ r, g, b }) {
	const a = [r, g, b].map((v) => {
		const val = v / 255;
		return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
	});
	return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getRatio(l1, l2) {
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

function blendColors(fg, bg) {
	// Simple alpha blending to compute actual RGB over a solid background
	const alpha = fg.a;
	const r = Math.round(fg.r * alpha + bg.r * (1 - alpha));
	const g = Math.round(fg.g * alpha + bg.g * (1 - alpha));
	const b = Math.round(fg.b * alpha + bg.b * (1 - alpha));
	return { r, g, b, a: 1 };
}

function getEffectiveBackground(element, windowObject) {
	let current = element;
	// default to white if we traverse up to document and find no background
	let bg = { r: 255, g: 255, b: 255, a: 1 };
	const layers = [];

	while (current && current.nodeType === 1) {
		if (windowObject?.getComputedStyle) {
			try {
				const styles = windowObject.getComputedStyle(current);
				const color = parseColor(styles.backgroundColor);
				if (color.a > 0) {
					layers.push(color);
					if (color.a === 1) break;
				}
			} catch (e) {
				// ignore sandbox exceptions
			}
		}
		current = current.parentElement;
	}

	// blend from bottom (background) up to top layer
	for (let i = layers.length - 1; i >= 0; i--) {
		bg = blendColors(layers[i], bg);
	}
	return bg;
}

function isLargeText(styles) {
	const fontSize = Number.parseFloat(styles.fontSize); // computed styles are usually px
	const fontWeight = styles.fontWeight;
	const isBold = fontWeight === "bold" || Number.parseInt(fontWeight, 10) >= 700;
	// 18pt ~ 24px, 14pt ~ 18.67px
	if (fontSize >= 24) return true;
	if (isBold && fontSize >= 18.66) return true;
	return false;
}

function isElementHidden(element, windowObject) {
	if (!element) return true;

	let node = element;
	let depth = 0;
	while (node && node.nodeType === 1 && depth < 6) {
		const ariaHidden = String(node.getAttribute?.("aria-hidden") ?? "").trim().toLowerCase();
		if (ariaHidden === "true") return true;

		if (windowObject?.getComputedStyle) {
			try {
				const styles = windowObject.getComputedStyle(node);
				if (styles && (styles.display === "none" || styles.visibility === "hidden")) {
					return true;
				}
			} catch (e) {}
		}
		node = node.parentElement;
		depth += 1;
	}
	return false;
}

function hasMeaningfulText(element) {
	const tag = String(element.tagName ?? "").toLowerCase();
	if (tag === "input" || tag === "textarea") {
		const val = element.value || element.placeholder;
		return val && val.trim().length > 0;
	}
	// Just check if it visually holds text
	return element.textContent && element.textContent.trim().length > 0;
}

function formatLabel(element) {
	const tag = String(element.tagName ?? "").toUpperCase();
	const id = element.id ? `#${element.id}` : "";
	const cls = element.className && typeof element.className === "string" 
		? `.${element.className.trim().split(/\s+/)[0]}` : "";
	return `${tag}${id}${cls}`;
}

export function runContrastAlgorithm({ mode, document: documentNode, window: windowObject, root }) {
	const scope = root || documentNode;
	const bucketTwo = "two"; // report-only bucket

	if (!scope?.querySelectorAll) {
		return {
			algorithm: ALGORITHM_NAME,
			bucket: bucketTwo,
			severity: "Info",
			action: "no issues",
			mode,
			elementsAffected: 0,
			whatThisMeans: "Contrast Evaluation completed with no issues detected.",
		};
	}

	const candidates = Array.from(scope.querySelectorAll(TARGET_SELECTOR)).slice(0, MAX_SCAN);
	const failures = [];
	
	candidates.forEach((element) => {
		if (isElementHidden(element, windowObject)) return;
		if (!hasMeaningfulText(element)) return;

		let styles;
		try {
			styles = windowObject.getComputedStyle(element);
		} catch (e) {
			return;
		}
		if (!styles) return;

		// 1. Text contrast check
		const fgColorTemp = parseColor(styles.color);
		let fgColor = fgColorTemp;
		const effectiveBg = getEffectiveBackground(element, windowObject);
		
		if (fgColorTemp.a < 1) {
			fgColor = blendColors(fgColorTemp, effectiveBg);
		}

		const l1 = getLuminance(fgColor);
		const l2 = getLuminance(effectiveBg);
		const ratio = getRatio(l1, l2);
		
		const largeText = isLargeText(styles);
		const reqRatio = largeText ? 3.0 : 4.5;
		
		if (ratio < reqRatio) {
			failures.push({
				element,
				ratio: Number(ratio.toFixed(2)),
				reqRatio,
				isPlaceholder: false
			});
			return; // Don't check placeholders if text itself fails
		}

		// 2. Placeholder contrast check for inputs
		const tag = String(element.tagName ?? "").toLowerCase();
		if ((tag === "input" || tag === "textarea") && element.placeholder) {
			try {
				const phStyles = windowObject.getComputedStyle(element, "::placeholder");
				// Fallback to text color if placeholder pseudo-style isn't exposed (some browsers)
				const phColorRaw = phStyles.color !== styles.color ? phStyles.color : "rgba(118, 118, 118, 1)";
				const phColorParsed = parseColor(phColorRaw);
				const phColor = phColorParsed.a < 1 ? blendColors(phColorParsed, effectiveBg) : phColorParsed;
				
				const phL1 = getLuminance(phColor);
				const phRatio = getRatio(phL1, l2);
				if (phRatio < 4.5) { // placeholders require 4.5
					failures.push({
						element,
						ratio: Number(phRatio.toFixed(2)),
						reqRatio: 4.5,
						isPlaceholder: true
					});
				}
			} catch (e) {}
		}
	});

	const elementsAffected = failures.length;
	let highestSeverity = "Info";
	let whatThisMeans = "No standard visual color contrast failures detected on scanned text elements.";
	let debug = [];

	if (elementsAffected > 0) {
		const highSeverityFailures = failures.filter((f) => f.ratio < 3.0);
		highestSeverity = highSeverityFailures.length > 0 ? "High" : "Medium";
		
		const examples = failures.slice(0, 3).map((f) => {
			const label = formatLabel(f.element) + (f.isPlaceholder ? "::placeholder" : "");
			return `${label} (${f.ratio}:1)`;
		});
		
		whatThisMeans = `${elementsAffected} contrast failures detected. Highest severity: ${highestSeverity}. Examples: ${examples.join(", ")}.`;
		
		debug = failures.slice(0, MAX_DEBUG_ITEMS).map((f) => ({
			tag: String(f.element.tagName ?? "").toLowerCase(),
			id: f.element.id || "",
			class: f.element.className || "",
			ratio: f.ratio,
			requiredRatio: f.reqRatio,
			isPlaceholder: f.isPlaceholder
		}));
	}

	return {
		algorithm: ALGORITHM_NAME,
		bucket: bucketTwo,
		severity: elementsAffected > 0 ? highestSeverity : "Info",
		action: elementsAffected > 0 ? "reported" : "no issues",
		mode,
		elementsAffected,
		whatThisMeans,
		debug
	};
}

const contrastAlgorithm = {
	id: "contrastAnalysis",
	name: ALGORITHM_NAME,
	execute: runContrastAlgorithm,
};

export default contrastAlgorithm;