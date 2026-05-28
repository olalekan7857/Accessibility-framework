const ALGORITHM_NAME = "Heading Structure";
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
// Safety bounds and limits
const MAX_DETAIL_ITEMS = 5; // limit of human-readable detail strings
const MAX_DEBUG_ITEMS = 5; // limit of debug metadata entries
const MAX_HEADINGS_SCANNED = 200; // performance bound for large documents

function isHeadingHidden(element, windowObject = globalThis.window) {
	// Treat missing nodes as hidden for our purposes
	if (!element) {
		return true;
	}

	// Walk up the ancestor chain to detect inherited/collapsed visibility
	let node = element;
	while (node && node.nodeType === 1) {
		// aria-hidden on any ancestor hides the subtree
		const ariaHidden = String(node.getAttribute?.("aria-hidden") ?? "")
			.trim()
			.toLowerCase();
		if (ariaHidden === "true") {
			return true;
		}

		// hidden attribute on any ancestor hides the subtree
		if (node.hasAttribute && node.hasAttribute("hidden")) {
			return true;
		}

		// If computed styles indicate display:none or visibility:hidden on any ancestor,
		// treat as hidden. Avoid relying on opacity alone since that is not a reliable
		// indicator of invisibility for our purposes.
		if (windowObject?.getComputedStyle) {
			try {
				const styles = windowObject.getComputedStyle(node);
				if (styles && (styles.display === "none" || styles.visibility === "hidden")) {
					return true;
				}
			} catch (e) {
				// getComputedStyle can throw in some sandboxed frames; ignore and continue
			}
		}

		node = node.parentElement;
	}

	return false;
}

function getNormalizedHeadingText(node) {
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

	if (tagName === "i" || tagName === "svg") {
		return "";
	}

	const textParts = [];
	const childNodes = elementNode.childNodes ?? [];
	for (let index = 0; index < childNodes.length; index += 1) {
		const childText = getNormalizedHeadingText(childNodes[index]);
		if (childText) {
			textParts.push(childText);
		}
	}

	return textParts.join(" ").trim();
}

function getHeadingLevel(element) {
	if (!element) {
		return null;
	}

	const tagName = String(element.tagName ?? "").toLowerCase();
	if (!/^h[1-6]$/.test(tagName)) {
		return null;
	}

	const level = Number.parseInt(tagName.slice(1), 10);
	return Number.isFinite(level) ? level : null;
}

function buildHeadingDescriptor(element, text) {
	const tag = String(element?.tagName ?? "").toUpperCase();
	const id = String(element?.getAttribute?.("id") ?? "").trim();
	const className = String(element?.getAttribute?.("class") ?? "").trim();
	const classTokens = className ? className.split(/\s+/).slice(0, 3) : [];
	const classSuffix = classTokens.length > 0 ? `.${classTokens.join(".")}` : "";
	const idSuffix = id ? `#${id}` : "";
	const snippet = text ? text.slice(0, 40) : "<empty>";
	return `${tag}${idSuffix}${classSuffix} "${snippet}"`;
}

function getDomPath(element, maxDepth = 5) {
	if (!element || element.nodeType !== 1) return "";
	const parts = [];
	let node = element;
	let depth = 0;
	while (node && node.nodeType === 1 && depth < maxDepth) {
		const tag = String(node.tagName ?? "").toLowerCase();
		const id = node.getAttribute?.("id") ?? "";
		const cls = (node.getAttribute?.("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 2);
		let part = tag;
		if (id) part += `#${id}`;
		else if (cls.length) part += `.${cls.join('.')}`;
		parts.unshift(part);
		node = node.parentElement;
		depth += 1;
	}
	return parts.join(" > ");
}

export function runHeadingStructureAlgorithm({ mode, document: documentNode, window: windowObject, root }) {
	const scope = root || documentNode;
	if (!scope?.querySelectorAll) {
		return {
			algorithm: ALGORITHM_NAME,
			bucket: "two",
			severity: "Medium",
			action: "no issues",
			mode,
			elementsAffected: 0,
			whatThisMeans:
				"Headings provide a structural outline for screen readers and keyboard users. Ensure levels are sequential and headings contain meaningful text.",
		};
	}

	const allHeadings = Array.from(scope.querySelectorAll(HEADING_SELECTOR));
	// Apply a safe scan bound for performance
	const limitedHeadings = allHeadings.slice(0, MAX_HEADINGS_SCANNED);
	const visibleHeadings = limitedHeadings.filter((element) => !isHeadingHidden(element, windowObject));

	const failingHeadings = new Set();
	const skippedLevelDetails = [];
	const emptyHeadingDetails = [];
	const multipleH1Details = [];
	const debugItems = [];

	let previousLevel = null;
	let firstH1Seen = false;

	visibleHeadings.forEach((heading) => {
		const level = getHeadingLevel(heading);
		const text = getNormalizedHeadingText(heading);
		const descriptor = buildHeadingDescriptor(heading, text);

		if (level === 1) {
			if (firstH1Seen) {
				// Advisory only; collect for reporting but do not treat as fatal
				failingHeadings.add(heading);
				if (multipleH1Details.length < MAX_DETAIL_ITEMS) {
					multipleH1Details.push(descriptor);
				}
				if (debugItems.length < MAX_DEBUG_ITEMS) {
					debugItems.push({
						issue: "multiple-h1",
						tag: String(heading.tagName ?? ""),
						snippet: text ? text.slice(0, 60) : "",
						path: getDomPath(heading),
					});
				}
			} else {
				firstH1Seen = true;
			}
		}

		if (!text) {
			failingHeadings.add(heading);
			if (emptyHeadingDetails.length < MAX_DETAIL_ITEMS) {
				emptyHeadingDetails.push(descriptor);
			}
			if (debugItems.length < MAX_DEBUG_ITEMS) {
				debugItems.push({
					issue: "empty-heading",
					tag: String(heading.tagName ?? ""),
					snippet: "",
					path: getDomPath(heading),
				});
			}
		}

		if (Number.isFinite(level) && Number.isFinite(previousLevel)) {
			// Precise skipped-level detection: flag only when current level > previous + 1
			if (level > previousLevel + 1) {
				failingHeadings.add(heading);
				if (skippedLevelDetails.length < MAX_DETAIL_ITEMS) {
					skippedLevelDetails.push(`H${previousLevel} → H${level} at ${descriptor}`);
				}
				if (debugItems.length < MAX_DEBUG_ITEMS) {
					debugItems.push({
						issue: "skipped-level",
						tag: String(heading.tagName ?? ""),
						snippet: text ? text.slice(0, 60) : "",
						path: getDomPath(heading),
					});
				}
			}
		}

		if (Number.isFinite(level)) {
			previousLevel = level;
		}
	});

	const elementsAffected = failingHeadings.size;
	const detailParts = [];

	if (skippedLevelDetails.length > 0) {
		detailParts.push(`Skipped levels: ${skippedLevelDetails.join("; ")}`);
	}
	if (emptyHeadingDetails.length > 0) {
		detailParts.push(`Empty headings: ${emptyHeadingDetails.join("; ")}`);
	}
	if (multipleH1Details.length > 0) {
		detailParts.push(`Multiple H1: ${multipleH1Details.join("; ")}`);
	}

	const baseMessage =
		"Headings provide a structural outline for screen readers and keyboard users. Ensure levels are sequential and headings contain meaningful text.";
	const whatThisMeans =
		detailParts.length > 0
			? `${baseMessage} Issues detected: ${detailParts.join(" | ")}`
			: baseMessage;

	return {
		algorithm: ALGORITHM_NAME,
		bucket: "two",
		severity: "Medium",
		action: elementsAffected > 0 ? "reported" : "no issues",
		mode,
		elementsAffected,
		whatThisMeans,
	};
}

const headingStructureAlgorithm = {
	id: "headingStructure",
	name: ALGORITHM_NAME,
	execute: runHeadingStructureAlgorithm,
};

export default headingStructureAlgorithm;
