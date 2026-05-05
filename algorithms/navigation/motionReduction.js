import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";
import { injectStyleOnce } from "../../utils/domUtils.js";

const ALGORITHM_NAME = "Motion Reduction";
const MOTION_STYLE_ID = "af-reduce-motion-style";
const MOTION_CLASS = "af-reduce-motion";
const MOTION_CSS = `.${MOTION_CLASS} * {
	animation-duration: 0.01ms !important;
	animation-iteration-count: 1 !important;
	transition-duration: 0.01ms !important;
	scroll-behavior: auto !important;
}`;

function parseTimeValueToMs(value) {
	if (typeof value !== "string") {
		return 0;
	}

	const normalized = value.trim().toLowerCase();
	if (!normalized) {
		return 0;
	}

	if (normalized.endsWith("ms")) {
		const msValue = Number.parseFloat(normalized);
		return Number.isFinite(msValue) ? msValue : 0;
	}

	if (normalized.endsWith("s")) {
		const secondsValue = Number.parseFloat(normalized);
		return Number.isFinite(secondsValue) ? secondsValue * 1000 : 0;
	}

	const numericValue = Number.parseFloat(normalized);
	return Number.isFinite(numericValue) ? numericValue : 0;
}

function maxDurationFromList(durationList) {
	if (typeof durationList !== "string") {
		return 0;
	}

	return durationList
		.split(",")
		.map((value) => parseTimeValueToMs(value))
		.reduce((maxValue, current) => (current > maxValue ? current : maxValue), 0);
}

function parseIterationCountValue(value) {
	if (typeof value !== "string") {
		return 0;
	}

	const normalized = value.trim().toLowerCase();
	if (!normalized) {
		return 0;
	}

	if (normalized === "infinite") {
		return Number.POSITIVE_INFINITY;
	}

	const numericValue = Number.parseFloat(normalized);
	return Number.isFinite(numericValue) ? numericValue : 0;
}

function getIterationCountInfo(iterationList) {
	if (typeof iterationList !== "string") {
		return { maxCount: 0, hasInfinite: false };
	}

	let maxCount = 0;
	let hasInfinite = false;
	iterationList
		.split(",")
		.map((value) => parseIterationCountValue(value))
		.forEach((count) => {
			if (count === Number.POSITIVE_INFINITY) {
				hasInfinite = true;
			}
			if (Number.isFinite(count) && count > maxCount) {
				maxCount = count;
			}
		});

	return { maxCount, hasInfinite };
}

function hasMeaningfulAnimation(styles) {
	const animationName = String(styles?.animationName ?? "")
		.trim()
		.toLowerCase();
	if (!animationName || animationName === "none") {
		return false;
	}

	const durationMs = maxDurationFromList(String(styles?.animationDuration ?? ""));
	const { maxCount, hasInfinite } = getIterationCountInfo(
		String(styles?.animationIterationCount ?? "")
	);

	if (hasInfinite) {
		return true;
	}

	if (maxCount > 1) {
		return true;
	}

	return durationMs > 150;
}

function hasTransformOrOpacityPotential(element, styles) {
	const transformValue = String(styles?.transform ?? "")
		.trim()
		.toLowerCase();
	const opacityValue = Number.parseFloat(String(styles?.opacity ?? "1"));
	const inlineStyle = String(element?.getAttribute?.("style") ?? "").toLowerCase();

	const hasComputedTransform = transformValue && transformValue !== "none";
	const hasComputedOpacity = Number.isFinite(opacityValue) && opacityValue < 1;
	const hasInlineTransform = inlineStyle.includes("transform");
	const hasInlineOpacity = inlineStyle.includes("opacity");

	return hasComputedTransform || hasComputedOpacity || hasInlineTransform || hasInlineOpacity;
}

function getTransitionPairs(transitionProperty, transitionDuration) {
	if (typeof transitionProperty !== "string") {
		return [];
	}

	const properties = transitionProperty
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
	if (properties.length === 0) {
		return [];
	}

	const durations = typeof transitionDuration === "string"
		? transitionDuration
				.split(",")
				.map((value) => parseTimeValueToMs(value))
		: [];
	const normalizedDurations = durations.length > 0 ? durations : [0];

	return properties.map((property, index) => ({
		property,
		durationMs: normalizedDurations[index % normalizedDurations.length],
	}));
}

function hasMeaningfulTransition(element, styles) {
	const transitionProperty = String(styles?.transitionProperty ?? "")
		.trim()
		.toLowerCase();
	if (!transitionProperty || transitionProperty === "none") {
		return false;
	}

	const pairs = getTransitionPairs(
		transitionProperty,
		String(styles?.transitionDuration ?? "")
	);
	if (pairs.length === 0) {
		return false;
	}

	const meaningfulProps = new Set([
		"transform",
		"top",
		"left",
		"right",
		"bottom",
		"opacity",
	]);

	for (let index = 0; index < pairs.length; index += 1) {
		const { property, durationMs } = pairs[index];
		if (durationMs <= 200) {
			continue;
		}

		if (property === "all") {
			if (hasTransformOrOpacityPotential(element, styles)) {
				return true;
			}
			continue;
		}

		if (meaningfulProps.has(property)) {
			return true;
		}
	}

	return false;
}

function hasSmoothScroll(styles) {
	const scrollBehavior = String(styles?.scrollBehavior ?? "")
		.trim()
		.toLowerCase();
	return scrollBehavior === "smooth";
}

function isElementHiddenForMotion(element, styles) {
	if (!element) {
		return true;
	}

	const ariaHidden = String(element.getAttribute?.("aria-hidden") ?? "")
		.trim()
		.toLowerCase();
	if (ariaHidden === "true") {
		return true;
	}

	if (!styles) {
		return false;
	}

	const display = String(styles.display ?? "").trim().toLowerCase();
	const visibility = String(styles.visibility ?? "").trim().toLowerCase();

	if (display === "none" || visibility === "hidden") {
		return true;
	}

	return false;
}

function collectMotionScanTargets(documentNode, maxElements = 150) {
	const targets = [];
	const seen = new Set();

	const addTargets = (elements) => {
		for (let index = 0; index < elements.length; index += 1) {
			const element = elements[index];
			if (!element || seen.has(element) || targets.length >= maxElements) {
				continue;
			}
			seen.add(element);
			targets.push(element);
		}
	};

	addTargets(Array.from(documentNode?.body?.children ?? []));
	addTargets(Array.from(documentNode?.querySelectorAll?.("main, section, article") ?? []));
	addTargets(Array.from(documentNode?.querySelectorAll?.("main *, section *, article *") ?? []));
	addTargets(Array.from(documentNode?.querySelectorAll?.("body *") ?? []));

	return targets;
}

function detectMotionPresence(documentNode, windowObject) {
	if (!documentNode?.querySelectorAll || typeof windowObject?.getComputedStyle !== "function") {
		return false;
	}

	const elements = collectMotionScanTargets(documentNode, 150);
	let scanned = 0;
	for (let index = 0; index < elements.length && scanned < 150; index += 1) {
		const element = elements[index];
		scanned += 1;
		const styles = windowObject.getComputedStyle(element);
		if (isElementHiddenForMotion(element, styles)) {
			continue;
		}

		const hasSmooth = hasSmoothScroll(styles);
		const animationName = String(styles?.animationName ?? "")
			.trim()
			.toLowerCase();
		const transitionProperty = String(styles?.transitionProperty ?? "")
			.trim()
			.toLowerCase();

		const hasActiveMotion =
			animationName !== "none" || transitionProperty !== "none" || hasSmooth;

		if (!hasActiveMotion) {
			continue;
		}

		const hasAnimation =
			animationName !== "none" && hasMeaningfulAnimation(styles);
		const hasTransition =
			transitionProperty !== "none" && hasMeaningfulTransition(element, styles);

		if (hasSmooth || hasAnimation || hasTransition) {
			return true;
		}

		scanned += 1;
	}

	return false;
}

function shouldForceReduce(motionOverride) {
	if (typeof motionOverride !== "string") {
		return false;
	}

	return motionOverride.trim().toLowerCase() === "force-reduce";
}

export function runMotionReductionAlgorithm({ mode, document: documentNode, window: windowObject, motion }) {
	const prefersReducedMotion = Boolean(
		windowObject?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
	);
	const forceReduce = shouldForceReduce(motion);
	const reduceMotion = prefersReducedMotion || forceReduce;
	const motionDetected = reduceMotion ? true : detectMotionPresence(documentNode, windowObject);
	const bucket = reduceMotion ? classifyIssue({ isSafeAutoFix: true }) : "two";

	if (!reduceMotion && !motionDetected) {
		return {
			algorithm: ALGORITHM_NAME,
			bucket,
			severity: "Medium",
			action: "no issues",
			mode,
			elementsAffected: 0,
			whatThisMeans:
				"Animations and motion effects may cause discomfort for users with motion sensitivity. Reduced motion mode minimizes these effects.",
		};
	}

	if (!reduceMotion && motionDetected) {
		return {
			algorithm: ALGORITHM_NAME,
			bucket,
			severity: "Medium",
			action: "reported",
			mode,
			elementsAffected: 0,
			whatThisMeans:
				"Animations and motion effects may cause discomfort for users with motion sensitivity. Reduced motion mode minimizes these effects.",
		};
	}

	const shouldApplyAutoFix = shouldApplyFix({ mode, bucket });
	const rootClassList = documentNode?.documentElement?.classList ?? null;
	const hadClass = Boolean(rootClassList?.contains(MOTION_CLASS));
	const hadStyle = Boolean(documentNode?.getElementById?.(MOTION_STYLE_ID));
	let applied = false;

	if (shouldApplyAutoFix) {
		const styleInjected = injectStyleOnce(MOTION_STYLE_ID, MOTION_CSS, documentNode);
		if (rootClassList && !rootClassList.contains(MOTION_CLASS)) {
			rootClassList.add(MOTION_CLASS);
		}
		const hasClass = Boolean(rootClassList?.contains(MOTION_CLASS));
		const hasStyle = Boolean(documentNode?.getElementById?.(MOTION_STYLE_ID));
		applied = hasClass && hasStyle;
		if (!applied) {
			applied = styleInjected || !hadStyle || !hadClass;
		}
	}

	const elementsAffected = applied ? 1 : 0;

	return {
		algorithm: ALGORITHM_NAME,
		bucket,
		severity: "Medium",
		action: shouldApplyAutoFix ? (applied ? "applied" : "reported") : "reported",
		mode,
		elementsAffected,
		whatThisMeans:
			"Animations and motion effects may cause discomfort for users with motion sensitivity. Reduced motion mode minimizes these effects.",
	};
}

const motionReductionAlgorithm = {
	id: "motionReduction",
	name: ALGORITHM_NAME,
	execute: runMotionReductionAlgorithm,
};

export default motionReductionAlgorithm;
