import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";

const ALGORITHM_NAME = "Navigation Ordering";
const INTERACTIVE_SELECTOR =
	"button, a[href], input:not([type=\"hidden\"]), textarea, select, [tabindex]";

function isElementEligible(element, windowObject = globalThis.window) {
	if (!element) {
		return false;
	}

	if (element.offsetParent === null) {
		return false;
	}

	const ariaHidden = String(element.getAttribute?.("aria-hidden") ?? "")
		.trim()
		.toLowerCase();
	if (ariaHidden === "true") {
		return false;
	}

	if (element.disabled === true) {
		return false;
	}

	if (!windowObject?.getComputedStyle) {
		return false;
	}

	const styles = windowObject.getComputedStyle(element);
	if (styles.display === "none" || styles.visibility === "hidden") {
		return false;
	}

	return true;
}

function hasPositiveTabIndex(element) {
	if (!element || typeof element.getAttribute !== "function") {
		return false;
	}

	const rawTabIndex = element.getAttribute("tabindex");
	if (typeof rawTabIndex !== "string") {
		return false;
	}

	const parsed = Number.parseInt(rawTabIndex, 10);
	return Number.isFinite(parsed) && parsed > 0;
}

function isNativeInteractiveElement(element) {
	if (!element) {
		return false;
	}

	const tagName = String(element.tagName ?? "").toLowerCase();
	if (tagName === "button" || tagName === "textarea" || tagName === "select") {
		return true;
	}

	if (tagName === "a") {
		return element.hasAttribute("href");
	}

	if (tagName === "input") {
		const type = String(element.getAttribute("type") ?? "").trim().toLowerCase();
		return type !== "hidden";
	}

	return false;
}

export function runNavigationOrderAlgorithm({ mode, document: documentNode, root, window: windowObject }) {
	const scope = root || documentNode;
	const bucket = classifyIssue({ isSafeAutoFix: true });

	if (!scope?.querySelectorAll) {
		return {
			algorithm: ALGORITHM_NAME,
			bucket,
			severity: "High",
			action: "no issues",
			mode,
			elementsAffected: 0,
			whatThisMeans:
				"Using tabindex values greater than 0 disrupts natural keyboard navigation order.",
		};
	}

	const candidates = Array.from(scope.querySelectorAll(INTERACTIVE_SELECTOR));
	const seen = new Set();
	const failingElements = candidates.filter((element) => {
		if (!element || seen.has(element)) {
			return false;
		}
		seen.add(element);
		if (!isElementEligible(element, windowObject)) {
			return false;
		}
		return hasPositiveTabIndex(element);
	});
	const nativeFailingElements = failingElements.filter((element) =>
		isNativeInteractiveElement(element)
	);
	const nonNativeFailingElements = failingElements.filter(
		(element) => !isNativeInteractiveElement(element)
	);

	const buildDebugMeta = (elements) =>
		elements
			.map((element) => {
				const tag = String(element?.tagName ?? "");
				const id = String(element?.getAttribute?.("id") ?? "").trim();
				const className = String(element?.getAttribute?.("class") ?? "").trim();
				const originalTabindex = String(element?.getAttribute?.("tabindex") ?? "").trim();
				return {
					tag,
					id: id || undefined,
					class: className || undefined,
					originalTabindex,
				};
			})
			.slice(0, 5);

	const nativeElementsAffected = nativeFailingElements.length;
	const nonNativeElementsAffected = nonNativeFailingElements.length;
	const shouldApplyAutoFix =
		shouldApplyFix({ mode, bucket }) && nativeElementsAffected > 0;

	if (shouldApplyAutoFix) {
		nativeFailingElements.forEach((element) => {
			element.setAttribute("tabindex", "0");
		});
	}

	const bucketOneResult = {
		algorithm: ALGORITHM_NAME,
		bucket,
		severity: "High",
		action: nativeElementsAffected > 0 ? "applied" : "no issues",
		mode,
		elementsAffected: nativeElementsAffected,
		debug: buildDebugMeta(nativeFailingElements),
		whatThisMeans:
			"Using tabindex values greater than 0 disrupts natural keyboard navigation order.",
	};

	const bucketTwoResult = {
		algorithm: ALGORITHM_NAME,
		bucket: "two",
		severity: "Medium",
		action: nonNativeElementsAffected > 0 ? "reported" : "no issues",
		mode,
		elementsAffected: nonNativeElementsAffected,
		debug: buildDebugMeta(nonNativeFailingElements),
		whatThisMeans:
			"Using tabindex values greater than 0 disrupts natural keyboard navigation order.",
	};

	return [bucketOneResult, bucketTwoResult];
}

const navigationOrderAlgorithm = {
	id: "navigationOrder",
	name: ALGORITHM_NAME,
	execute: runNavigationOrderAlgorithm,
};

export default navigationOrderAlgorithm;
