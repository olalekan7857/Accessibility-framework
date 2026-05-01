// Algorithm: Role & Label Validation (Partial Implementation)
// Sub-check: Interactive Element Naming (Buttons & Links)
// Scope: Ensures <button> and <a href> elements have valid accessible names
const ALGORITHM_NAME = "Role & Label Validation";

function getAllTargetElements(root = globalThis.document) {
	if (!root?.querySelectorAll) {
		return [];
	}

	return Array.from(root.querySelectorAll("button, a[href]"));
}

function hasValidAriaLabelledBy(element) {
	if (!element || typeof element.getAttribute !== "function") {
		return false;
	}

	const ariaLabelledBy = String(element.getAttribute("aria-labelledby") ?? "").trim();
	if (!ariaLabelledBy) {
		return false;
	}

	const documentNode = element.ownerDocument ?? globalThis.document;
	if (!documentNode?.getElementById) {
		return false;
	}

	const labelIds = ariaLabelledBy.split(/\s+/).filter(Boolean);
	if (labelIds.length === 0) {
		return false;
	}

	let atLeastOneReferencedElementExists = false;
	let atLeastOneReferencedElementHasText = false;

	labelIds.forEach((id) => {
		const referencedElement = documentNode.getElementById(id);
		if (!referencedElement) {
			return;
		}

		const isAriaHidden =
			String(referencedElement.getAttribute?.("aria-hidden") ?? "").toLowerCase() ===
			"true";
		if (isAriaHidden) {
			return;
		}

		atLeastOneReferencedElementExists = true;

		const referencedText = String(referencedElement.textContent ?? "").trim();
		if (referencedText.length > 0) {
			atLeastOneReferencedElementHasText = true;
		}
	});

	return atLeastOneReferencedElementExists && atLeastOneReferencedElementHasText;
}

function hasValidAriaLabel(element) {
	if (!element || typeof element.getAttribute !== "function") {
		return false;
	}

	const ariaLabel = element.getAttribute("aria-label");
	return typeof ariaLabel === "string" && ariaLabel.trim().length > 0;
}

function collectVisibleTextParts(node, parts) {
	if (!node) {
		return;
	}

	// TEXT_NODE
	if (node.nodeType === 3) {
		const text = String(node.textContent ?? "").trim();
		if (text.length > 0) {
			parts.push(text);
		}
		return;
	}

	// ELEMENT_NODE
	if (node.nodeType !== 1) {
		return;
	}

	const elementNode = node;
	const tagName = String(elementNode.tagName ?? "").toLowerCase();
	const ariaHidden = String(elementNode.getAttribute?.("aria-hidden") ?? "").toLowerCase();

	if (ariaHidden === "true") {
		return;
	}

	const role = String(elementNode.getAttribute?.("role") ?? "").toLowerCase();
	if (role === "presentation") {
		return;
	}

	// Ignore icon-only/decorative nodes for text extraction
	if (tagName === "i" || tagName === "svg") {
		return;
	}

	// Keep image alt handling in step 4 only
	if (tagName === "img") {
		return;
	}

	const childNodes = elementNode.childNodes ?? [];
	for (let index = 0; index < childNodes.length; index += 1) {
		collectVisibleTextParts(childNodes[index], parts);
	}
}

function getVisibleTextContent(element) {
	const parts = [];
	collectVisibleTextParts(element, parts);
	return parts.join(" ").trim();
}

function hasAnyImageWithValidAlt(element) {
	if (!element?.querySelectorAll) {
		return false;
	}

	const images = Array.from(element.querySelectorAll("img"));
	if (images.length === 0) {
		return false;
	}

	return images.some((image) => {
		if (!image.hasAttribute("alt")) {
			return false;
		}

		const alt = image.getAttribute("alt");
		return typeof alt === "string" && alt.trim().length > 0;
	});
}

function hasValidAccessibleName(element) {
	// Step 1: aria-labelledby
	if (hasValidAriaLabelledBy(element)) {
		return true;
	}

	// Step 2: aria-label
	if (hasValidAriaLabel(element)) {
		return true;
	}

	// Step 3: visible text content (icons/hidden ignored)
	const visibleText = getVisibleTextContent(element);
	if (visibleText.length > 0) {
		return true;
	}

	// Step 4: image alt fallback case only
	return hasAnyImageWithValidAlt(element);
}

function applyFallbackLabel(element) {
	if (!element || typeof element.setAttribute !== "function") {
		return;
	}

	const tagName = String(element.tagName ?? "").toLowerCase();
	if (tagName === "button") {
		element.setAttribute("aria-label", "Button");
		return;
	}

	if (tagName === "a") {
		element.setAttribute("aria-label", "Link");
	}
}

export function runButtonLinkTextAlgorithm({ mode, document: documentNode, root }) {
	const scope = root || documentNode;
	const targetElements = getAllTargetElements(scope);

	const failingElements = targetElements.filter(
		(element) => !hasValidAccessibleName(element)
	);

	failingElements.forEach((element) => {
		applyFallbackLabel(element);
	});

	const elementsAffected = failingElements.length;

	return {
		algorithm: ALGORITHM_NAME,
		severity: "High",
		bucket: "one",
		action: elementsAffected > 0 ? "applied" : "no issues",
		mode,
		elementsAffected,
		whatThisMeans:
			"Buttons and links without meaningful accessible names are not understandable to screen reader users and can block navigation.",
	};
}

const buttonLinkTextAlgorithm = {
	id: "buttonLinkText",
	name: ALGORITHM_NAME,
	execute: runButtonLinkTextAlgorithm,
};

export default buttonLinkTextAlgorithm;
