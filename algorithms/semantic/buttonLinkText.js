import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";

const ALGORITHM_NAME = "Role & Label Validation";
const MAX_SCAN = 250;

const INTERACTIVE_SELECTOR =
	"button, a[href], input, textarea, select, summary, details, [role], [tabindex]";
const LANDMARK_SELECTOR = "header, nav, main, aside, footer, section, article, form";

const VALID_ROLES = new Set([
	"button",
	"link",
	"navigation",
	"main",
	"complementary",
	"banner",
	"contentinfo",
	"search",
	"form",
	"region",
	"article",
	"aside",
	"footer",
	"header",
	"section",
	"dialog",
	"alert",
	"alertdialog",
	"status",
	"progressbar",
	"tooltip",
	"menu",
	"menubar",
	"menuitem",
	"checkbox",
	"radio",
	"switch",
	"slider",
	"textbox",
	"combobox",
	"listbox",
	"grid",
	"gridcell",
	"row",
	"rowheader",
	"columnheader",
	"tab",
	"tabpanel",
	"tablist",
]);

const GENERIC_LANDMARK_LABELS = new Set(["section", "content", "navigation"]);

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

function formatElementLabel(element) {
	const tag = String(element?.tagName ?? "").toUpperCase();
	const id = String(element?.getAttribute?.("id") ?? "").trim();
	const className = String(element?.getAttribute?.("class") ?? "").trim();
	const classToken = className ? className.split(/\s+/)[0] : "";
	const idSuffix = id ? `#${id}` : "";
	const classSuffix = classToken ? `.${classToken}` : "";
	return `${tag}${idSuffix}${classSuffix}`;
}

function getAllTargetElements(root = globalThis.document) {
	if (!root?.querySelectorAll) {
		return [];
	}

	return Array.from(root.querySelectorAll(INTERACTIVE_SELECTOR)).slice(0, MAX_SCAN);
}

function getAllLandmarkElements(root = globalThis.document) {
	if (!root?.querySelectorAll) {
		return [];
	}

	return Array.from(root.querySelectorAll(LANDMARK_SELECTOR)).slice(0, MAX_SCAN);
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
	if (typeof ariaLabel !== "string") {
		return false;
	}

	const trimmed = ariaLabel.trim();
	if (trimmed.length === 0) {
		return false;
	}

	if (GENERIC_LANDMARK_LABELS.has(trimmed.toLowerCase())) {
		return false;
	}

	return true;
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

function hasAssociatedLabel(element) {
	if (!element || !element.id) {
		return false;
	}

	const documentNode = element.ownerDocument ?? globalThis.document;
	if (!documentNode?.querySelector) {
		return false;
	}

	const label = documentNode.querySelector(`label[for="${element.id}"]`);
	if (!label) {
		return false;
	}

	const labelText = getVisibleTextContent(label);
	return labelText.length > 0;
}

function isValidRole(role) {
	if (typeof role !== "string") {
		return false;
	}

	const normalized = role.trim().toLowerCase();
	if (!normalized) {
		return false;
	}

	return VALID_ROLES.has(normalized);
}

function isClickableDivOrSpan(element) {
	if (!element) {
		return false;
	}

	const tag = String(element.tagName ?? "").toLowerCase();
	if (tag !== "div" && tag !== "span") {
		return false;
	}

	if (element.hasAttribute?.("onclick")) {
		return true;
	}

	const tabindex = element.getAttribute?.("tabindex");
	if (tabindex !== null && tabindex !== "") {
		return true;
	}

	return false;
}

function getHeadingText(element) {
	if (!element?.querySelector) {
		return null;
	}

	const heading = element.querySelector("h1, h2, h3, h4, h5, h6");
	if (!heading) {
		return null;
	}

	const text = getVisibleTextContent(heading);
	return text.length > 0 ? text : null;
}

function isEmptyAriaLabel(element) {
	if (!element || typeof element.getAttribute !== "function") {
		return false;
	}

	const ariaLabel = element.getAttribute("aria-label");
	if (typeof ariaLabel !== "string") {
		return false;
	}

	const trimmed = ariaLabel.trim();
	return trimmed.length === 0;
}

function applyClickableDivRole(element) {
	if (!element || typeof element.setAttribute !== "function") {
		return;
	}

	const existingRole = element.getAttribute("role");
	if (existingRole) {
		return;
	}

	element.setAttribute("role", "button");
}

function applyLandmarkLabel(element, labelText) {
	if (!element || typeof element.setAttribute !== "function") {
		return;
	}

	if (!labelText || labelText.length === 0) {
		return;
	}

	element.setAttribute("aria-label", labelText);
}

function cleanupEmptyAriaLabel(element) {
	if (!element || typeof element.removeAttribute !== "function") {
		return;
	}

	element.removeAttribute("aria-label");
}

function collectBucketOneFixes(scope, windowObject) {
	const interactiveElements = getAllTargetElements(scope);
	const landmarkElements = getAllLandmarkElements(scope);
	const fixes = [];
	const seenElements = new WeakSet();

	// Fix 1: Clickable DIV/SPAN with missing role
	for (let i = 0; i < interactiveElements.length; i++) {
		const element = interactiveElements[i];
		if (seenElements.has(element)) {
			continue;
		}
		if (isElementHidden(element, windowObject)) {
			continue;
		}
		if (isClickableDivOrSpan(element)) {
			const existingRole = element.getAttribute?.("role");
			if (!existingRole) {
				seenElements.add(element);
				fixes.push({
					element,
					type: "clickableDivRole",
					label: formatElementLabel(element),
				});
			}
		}
	}

	// Fix 2: Empty aria-label cleanup
	for (let i = 0; i < interactiveElements.length; i++) {
		const element = interactiveElements[i];
		if (seenElements.has(element)) {
			continue;
		}
		if (isElementHidden(element, windowObject)) {
			continue;
		}
		if (isEmptyAriaLabel(element)) {
			seenElements.add(element);
			fixes.push({
				element,
				type: "emptyAriaLabel",
				label: formatElementLabel(element),
			});
		}
	}

	// Fix 3: Landmark labelling for multiple landmarks of same type
	const landmarkGroups = {};
	for (let i = 0; i < landmarkElements.length; i++) {
		const element = landmarkElements[i];
		if (isElementHidden(element, windowObject)) {
			continue;
		}
		const tag = String(element.tagName ?? "").toLowerCase();
		if (!landmarkGroups[tag]) {
			landmarkGroups[tag] = [];
		}
		landmarkGroups[tag].push(element);
	}

	for (const tag in landmarkGroups) {
		const landmarks = landmarkGroups[tag];
		if (landmarks.length > 1) {
			for (let i = 0; i < landmarks.length; i++) {
				const element = landmarks[i];
				if (seenElements.has(element)) {
					continue;
				}
				const existingLabel = element.getAttribute?.("aria-label");
				if (existingLabel) {
					continue;
				}
				const headingText = getHeadingText(element);
				if (headingText) {
					seenElements.add(element);
					fixes.push({
						element,
						type: "landmarkLabel",
						label: formatElementLabel(element),
						landmarkText: headingText,
					});
				}
			}
		}
	}

	return fixes;
}

function collectBucketTwoIssues(scope, windowObject) {
	const interactiveElements = getAllTargetElements(scope);
	const landmarkElements = getAllLandmarkElements(scope);
	const issues = [];
	const seenElements = new WeakSet();

	const issueTypes = {
		missingAccessibleName: [],
		invalidRole: [],
		genericLandmarkLabel: [],
		duplicateLandmark: [],
		inputWithoutLabel: [],
	};

	// Issue 1: Interactive elements with no accessible name
	for (let i = 0; i < interactiveElements.length; i++) {
		const element = interactiveElements[i];
		if (seenElements.has(element)) {
			continue;
		}
		if (isElementHidden(element, windowObject)) {
			continue;
		}
		const tag = String(element.tagName ?? "").toLowerCase();
		if (tag === "input" || tag === "textarea" || tag === "select") {
			if (!hasAssociatedLabel(element) && !hasValidAriaLabel(element) && !hasValidAriaLabelledBy(element)) {
				seenElements.add(element);
				issues.push({
					element,
					type: "inputWithoutLabel",
					label: formatElementLabel(element),
				});
				issueTypes.inputWithoutLabel.push(element);
			}
			continue;
		}
		if (tag === "button" || tag === "a") {
			if (!hasValidAccessibleName(element)) {
				seenElements.add(element);
				issues.push({
					element,
					type: "missingAccessibleName",
					label: formatElementLabel(element),
				});
				issueTypes.missingAccessibleName.push(element);
			}
		}
	}

	// Issue 2: Invalid role assignments
	for (let i = 0; i < interactiveElements.length; i++) {
		const element = interactiveElements[i];
		if (seenElements.has(element)) {
			continue;
		}
		if (isElementHidden(element, windowObject)) {
			continue;
		}
		const role = element.getAttribute?.("role");
		if (role && !isValidRole(role)) {
			seenElements.add(element);
			issues.push({
				element,
				type: "invalidRole",
				label: formatElementLabel(element),
				role,
			});
			issueTypes.invalidRole.push(element);
		}
	}

	// Issue 3: Generic landmark labels
	for (let i = 0; i < landmarkElements.length; i++) {
		const element = landmarkElements[i];
		if (seenElements.has(element)) {
			continue;
		}
		if (isElementHidden(element, windowObject)) {
			continue;
		}
		const ariaLabel = element.getAttribute?.("aria-label");
		if (ariaLabel && GENERIC_LANDMARK_LABELS.has(ariaLabel.trim().toLowerCase())) {
			seenElements.add(element);
			issues.push({
				element,
				type: "genericLandmarkLabel",
				label: formatElementLabel(element),
				ariaLabel,
			});
			issueTypes.genericLandmarkLabel.push(element);
		}
	}

	// Issue 4: Multiple landmarks lacking unique names
	const landmarkGroups = {};
	for (let i = 0; i < landmarkElements.length; i++) {
		const element = landmarkElements[i];
		if (isElementHidden(element, windowObject)) {
			continue;
		}
		const tag = String(element.tagName ?? "").toLowerCase();
		if (!landmarkGroups[tag]) {
			landmarkGroups[tag] = [];
		}
		landmarkGroups[tag].push(element);
	}

	for (const tag in landmarkGroups) {
		const landmarks = landmarkGroups[tag];
		if (landmarks.length > 1) {
			const unlabeledLandmarks = landmarks.filter((el) => {
				const label = el.getAttribute?.("aria-label");
				return !label || label.trim().length === 0;
			});
			if (unlabeledLandmarks.length > 1) {
				for (let i = 0; i < unlabeledLandmarks.length; i++) {
					const element = unlabeledLandmarks[i];
					if (seenElements.has(element)) {
						continue;
					}
					seenElements.add(element);
					issues.push({
						element,
						type: "duplicateLandmark",
						label: formatElementLabel(element),
					});
					issueTypes.duplicateLandmark.push(element);
				}
			}
		}
	}

	return { issues, issueTypes };
}

export function runButtonLinkTextAlgorithm({ mode, document: documentNode, window: windowObject, root }) {
	const scope = root || documentNode;
	const bucketOne = classifyIssue({ isSafeAutoFix: true });
	const bucketTwo = classifyIssue({ isSafeAutoFix: false });

	if (!scope?.querySelectorAll) {
		return {
			algorithm: ALGORITHM_NAME,
			bucket: bucketOne,
			severity: "Info",
			action: "no issues",
			mode,
			elementsAffected: 0,
			whatThisMeans:
				"No interactive or landmark elements were available for role and label validation in this document.",
		};
	}

	const bucketOneFixes = collectBucketOneFixes(scope, windowObject);
	const shouldApplyBucketOne = shouldApplyFix({ mode, bucket: bucketOne });

	let bucketOneAction = "no issues";
	let bucketOneElementsAffected = 0;
	let bucketOneWhatThisMeans = "No safe semantic corrections detected.";
	let bucketOneExamples = [];

	if (bucketOneFixes.length > 0) {
		bucketOneElementsAffected = bucketOneFixes.length;

		if (shouldApplyBucketOne) {
			bucketOneFixes.forEach((fix) => {
				if (fix.type === "clickableDivRole") {
					applyClickableDivRole(fix.element);
				} else if (fix.type === "emptyAriaLabel") {
					cleanupEmptyAriaLabel(fix.element);
				} else if (fix.type === "landmarkLabel") {
					applyLandmarkLabel(fix.element, fix.landmarkText);
				}
			});
			bucketOneAction = "applied";
			bucketOneWhatThisMeans = `Applied ${bucketOneFixes.length} safe semantic corrections to improve accessibility.`;
		} else {
			bucketOneAction = "reported";
			bucketOneWhatThisMeans = `Detected ${bucketOneFixes.length} safe semantic corrections that could be applied. Corrections not applied in audit mode.`;
		}

		bucketOneExamples = bucketOneFixes.slice(0, 5).map((fix) => {
			if (fix.type === "clickableDivRole") {
				return `${fix.label} (added role="button")`;
			} else if (fix.type === "emptyAriaLabel") {
				return `${fix.label} (removed empty aria-label)`;
			} else if (fix.type === "landmarkLabel") {
				return `${fix.label} (added aria-label="${fix.landmarkText}")`;
			}
			return fix.label;
		});
	}

	const { issues: bucketTwoIssues, issueTypes } = collectBucketTwoIssues(scope, windowObject);
	const totalBucketTwoIssues = bucketTwoIssues.length;

	let bucketTwoWhatThisMeans = "No contextual accessibility issues detected.";
	let bucketTwoExamples = [];

	if (totalBucketTwoIssues > 0) {
		const issueCounts = {
			missingAccessibleName: issueTypes.missingAccessibleName.length,
			invalidRole: issueTypes.invalidRole.length,
			genericLandmarkLabel: issueTypes.genericLandmarkLabel.length,
			duplicateLandmark: issueTypes.duplicateLandmark.length,
			inputWithoutLabel: issueTypes.inputWithoutLabel.length,
		};

		const issueDescriptions = [];
		if (issueCounts.missingAccessibleName > 0) {
			issueDescriptions.push(`${issueCounts.missingAccessibleName} elements missing accessible names`);
		}
		if (issueCounts.invalidRole > 0) {
			issueDescriptions.push(`${issueCounts.invalidRole} invalid role assignments`);
		}
		if (issueCounts.genericLandmarkLabel > 0) {
			issueDescriptions.push(`${issueCounts.genericLandmarkLabel} generic landmark labels`);
		}
		if (issueCounts.duplicateLandmark > 0) {
			issueDescriptions.push(`${issueCounts.duplicateLandmark} duplicate landmarks without unique names`);
		}
		if (issueCounts.inputWithoutLabel > 0) {
			issueDescriptions.push(`${issueCounts.inputWithoutLabel} inputs without accessible names`);
		}

		bucketTwoWhatThisMeans = `Detected ${totalBucketTwoIssues} contextual accessibility issues requiring developer review: ${issueDescriptions.join(", ")}. These issues require semantic interpretation and should be reviewed manually.`;

		bucketTwoExamples = bucketTwoIssues.slice(0, 5).map((issue) => {
			if (issue.type === "missingAccessibleName") {
				return `${issue.label} (missing accessible name)`;
			} else if (issue.type === "invalidRole") {
				return `${issue.label} role="${issue.role}" (invalid role)`;
			} else if (issue.type === "genericLandmarkLabel") {
				return `${issue.label} aria-label="${issue.ariaLabel}" (generic label)`;
			} else if (issue.type === "duplicateLandmark") {
				return `${issue.label} (duplicate landmark)`;
			} else if (issue.type === "inputWithoutLabel") {
				return `${issue.label} (missing label)`;
			}
			return issue.label;
		});
	}

	const totalElementsAffected = bucketOneElementsAffected + totalBucketTwoIssues;
	const overallSeverity = bucketOneElementsAffected > 0 ? "Medium" : totalBucketTwoIssues > 0 ? "High" : "Info";
	const overallAction = bucketOneAction === "applied" ? "applied" : bucketOneElementsAffected > 0 ? "reported" : totalBucketTwoIssues > 0 ? "reported" : "no issues";

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
				elementsAffected: totalBucketTwoIssues,
				description: bucketTwoWhatThisMeans,
				examples: bucketTwoExamples,
			},
		},
	};
}

const buttonLinkTextAlgorithm = {
	id: "buttonLinkText",
	name: ALGORITHM_NAME,
	execute: runButtonLinkTextAlgorithm,
};

export default buttonLinkTextAlgorithm;
