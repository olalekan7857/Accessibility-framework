import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";

const ALGORITHM_NAME = "Skip Navigation";
const DEFAULT_TARGET_ID = "main-content";

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
	const ariaHidden = String(elementNode.getAttribute?.("aria-hidden") ?? "").toLowerCase();

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

function hasContextualSkipText(text) {
	if (typeof text !== "string") {
		return false;
	}

	const normalizedText = text.trim().toLowerCase();
	if (!normalizedText) {
		return false;
	}

	return (
		normalizedText.includes("main") ||
		normalizedText.includes("content") ||
		normalizedText.includes("navigation") ||
		normalizedText.includes("section")
	);
}

function hasValidSkipTarget(href, documentNode) {
	if (typeof href !== "string") {
		return false;
	}

	const trimmedHref = href.trim();
	if (!trimmedHref.startsWith("#")) {
		return false;
	}

	const targetId = trimmedHref.replace(/^#/, "").trim();
	if (!targetId) {
		return false;
	}

	return Boolean(documentNode?.getElementById?.(targetId));
}

function isSkipTextMeaningful(text, href, documentNode) {
	if (typeof text !== "string") {
		return false;
	}

	const normalizedText = text.trim().toLowerCase();
	if (!normalizedText || !normalizedText.includes("skip")) {
		return false;
	}

	return hasValidSkipTarget(href, documentNode) || hasContextualSkipText(normalizedText);
}

function isVisibleSkipLink(link, windowObject = globalThis.window) {
	if (!link || typeof link.getAttribute !== "function") {
		return false;
	}

	const ariaHidden = String(link.getAttribute("aria-hidden") ?? "").trim().toLowerCase();
	if (ariaHidden === "true") {
		return false;
	}

	if (typeof windowObject?.getComputedStyle === "function") {
		const styles = windowObject.getComputedStyle(link);
		if (styles.display === "none" || styles.visibility === "hidden") {
			return false;
		}
	}

	return true;
}

function analyzeSkipLink(link, documentNode, windowObject) {
	if (!isVisibleSkipLink(link, windowObject)) {
		return null;
	}

	const href = String(link.getAttribute("href") ?? "").trim();
	const text = getNormalizedFilteredText(link);

	if (!isSkipTextMeaningful(text, href, documentNode)) {
		return null;
	}

	if (!href.startsWith("#")) {
		return {
			link,
			text,
			targetId: "",
			isValid: false,
			reason: "Skip link target missing",
		};
	}

	const targetId = href.replace(/^#/, "").trim();
	if (!targetId) {
		return {
			link,
			text,
			targetId: "",
			isValid: false,
			reason: "Skip link target missing",
		};
	}

	const target = documentNode?.getElementById?.(targetId) ?? null;
	if (!target) {
		return {
			link,
			text,
			targetId,
			isValid: false,
			reason: "Skip link target missing",
		};
	}

	return {
		link,
		text,
		targetId,
		isValid: true,
		reason: null,
	};
}

function ensureUniqueId(documentNode, preferredId = DEFAULT_TARGET_ID) {
	if (!documentNode?.getElementById) {
		return preferredId;
	}

	if (!documentNode.getElementById(preferredId)) {
		return preferredId;
	}

	let counter = 2;
	let candidateId = `${preferredId}-${counter}`;
	while (documentNode.getElementById(candidateId)) {
		counter += 1;
		candidateId = `${preferredId}-${counter}`;
	}

	return candidateId;
}

function ensureTargetId(element, documentNode, preferredId = DEFAULT_TARGET_ID) {
	if (!element || typeof element.getAttribute !== "function") {
		return "";
	}

	const existingId = String(element.getAttribute("id") ?? "").trim();
	if (existingId) {
		return existingId;
	}

	const safeId = ensureUniqueId(documentNode, preferredId);
	element.setAttribute("id", safeId);
	return safeId;
}

function findBestTargetElement(documentNode) {
	if (!documentNode?.querySelector) {
		return documentNode?.body ?? null;
	}

	const mainByTag = documentNode.querySelector("main");
	if (mainByTag) {
		return mainByTag;
	}

	const mainById = documentNode.getElementById?.("main") ?? null;
	if (mainById) {
		return mainById;
	}

	const contentById = documentNode.getElementById?.("content") ?? null;
	if (contentById) {
		return contentById;
	}

	const deterministicCandidates = Array.from(
		documentNode.querySelectorAll("main, section, article, div")
	);
	const firstRichContainer = deterministicCandidates.find(
		(candidate) => (candidate?.childNodes?.length ?? 0) > 3
	);

	if (firstRichContainer) {
		return firstRichContainer;
	}

	return documentNode.body ?? null;
}

function resolveOrCreateTarget(documentNode, preferredId = DEFAULT_TARGET_ID) {
	const bestTarget = findBestTargetElement(documentNode);
	if (bestTarget) {
		const targetId = ensureTargetId(bestTarget, documentNode, preferredId);
		return { targetElement: bestTarget, targetId, assigned: true, element: bestTarget };
	}

	return { targetElement: null, targetId: "", assigned: false };
}

function ensureTargetFocusable(element, documentNode) {
	if (!element || typeof element.getAttribute !== "function") {
		return false;
	}

	const nativeFocusableTags = new Set([
		"a",
		"button",
		"input",
		"select",
		"textarea",
		"area",
		"iframe",
	]);

	const tagName = String(element.tagName ?? "").toLowerCase();
	if (nativeFocusableTags.has(tagName)) {
		return false;
	}

	const existingTabIndex = String(element.getAttribute("tabindex") ?? "").trim();
	if (existingTabIndex && existingTabIndex !== "-1") {
		return false;
	}

	if (existingTabIndex === "-1") {
		return false;
	}

	element.setAttribute("tabindex", "-1");
	return true;
}

function addSkipLinkFocusHandler(skipLink, targetElement, documentNode) {
	if (!skipLink || !targetElement || typeof skipLink.addEventListener !== "function") {
		return;
	}

	skipLink.addEventListener("click", (event) => {
		if (typeof targetElement.focus === "function") {
			targetElement.focus();
		}
	});
}

function shouldInjectSkipLink(documentNode) {
	if (!documentNode?.querySelector) {
		return true;
	}

	const existing = documentNode.querySelector('a.skip-link[href^="#"]');
	if (!existing) {
		return true;
	}

	return false;
}

function injectSkipLink(documentNode, targetId) {
	const body = documentNode?.body;
	if (!body || typeof documentNode?.createElement !== "function") {
		return null;
	}

	if (!shouldInjectSkipLink(documentNode)) {
		return null;
	}

	const skipLink = documentNode.createElement("a");
	skipLink.setAttribute("href", `#${targetId}`);
	skipLink.setAttribute("class", "skip-link");
	skipLink.textContent = "Skip to main content";

	// Always inject at absolute top so this remains the first focusable control.
	body.insertBefore(skipLink, body.firstChild ?? null);
	return skipLink;
}

export function runSkipNavigationAlgorithm({ mode, document: documentNode, window: windowObject }) {
	const allAnchors = Array.from(documentNode?.querySelectorAll?.("a") ?? []);
	const analyzedLinks = allAnchors
		.map((anchor) => analyzeSkipLink(anchor, documentNode, windowObject))
		.filter(Boolean);

	const validLinks = analyzedLinks.filter((item) => item.isValid);
	const invalidLinks = analyzedLinks.filter((item) => !item.isValid);

	const issues = [];
	const fixes = [];
	let modificationCount = 0;

	const hasValidSkipLink = validLinks.length > 0;
	const needsFix = !hasValidSkipLink;

	if (analyzedLinks.length === 0) {
		issues.push("Missing skip link");
	}

	if (invalidLinks.length > 0) {
		issues.push("Skip link target missing");
	}

	const bucket = classifyIssue({ isSafeAutoFix: true });
	const shouldApplyAutoFix = shouldApplyFix({ mode, bucket }) && needsFix;

	if (shouldApplyAutoFix) {
		const preferredTargetId =
			String(invalidLinks[0]?.targetId ?? "").trim() || DEFAULT_TARGET_ID;
		const targetResolution = resolveOrCreateTarget(documentNode, preferredTargetId);

		if (targetResolution.assigned) {
			fixes.push("Assigned ID to main container");
			modificationCount += 1;
		}

		if (targetResolution.element && ensureTargetFocusable(targetResolution.element, documentNode)) {
			fixes.push("Made target focusable with tabindex");
			modificationCount += 1;
		}

		if (targetResolution.targetId) {
			if (invalidLinks.length > 0) {
				const linkToRepair = invalidLinks[0].link;
				linkToRepair.setAttribute("href", `#${targetResolution.targetId}`);
				fixes.push("Repaired existing skip link target");
				modificationCount += 1;
			} else {
				const injected = injectSkipLink(documentNode, targetResolution.targetId);
				if (injected) {
					fixes.push("Injected skip link");
					addSkipLinkFocusHandler(injected, targetResolution.element, documentNode);
					modificationCount += 1;
				}
			}
		}
	}

	const elementsAffected = shouldApplyAutoFix ? modificationCount : (needsFix ? 1 : 0);

	return {
		algorithm: ALGORITHM_NAME,
		severity: "High",
		bucket,
		action: elementsAffected > 0 ? (shouldApplyAutoFix ? "applied" : "skipped") : "no issues",
		mode,
		elementsAffected,
		status: elementsAffected > 0 && shouldApplyAutoFix ? "fixed" : "passed",
		issues,
		fixes,
		whatThisMeans:
			"Skip navigation helps keyboard and assistive technology users bypass repetitive content and jump directly to the main section.",
	};
}

const skipNavigationAlgorithm = {
	id: "skipNavigation",
	name: ALGORITHM_NAME,
	execute: runSkipNavigationAlgorithm,
};

export default skipNavigationAlgorithm;
