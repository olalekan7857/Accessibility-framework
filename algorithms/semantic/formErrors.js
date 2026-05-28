import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";
import { getAllFormControls } from "../../utils/domUtils.js";

const ALGORITHM_NAME = "Form Error Accessibility";
const MAX_SCAN = 300;
const MAX_DEBUG_ITEMS = 5;
const MAX_ANCESTOR_DEPTH = 2;
const MAX_CANDIDATES = 6;

const CONTROL_SELECTOR = "input, select, textarea";
const ERROR_SELECTOR =
    ".error, .invalid, .field-error, .validation-error, [role='alert'], [aria-live], [data-error]";
const ERROR_CLASS_PATTERNS = [
    /\berror\b/i,
    /\binvalid\b/i,
    /\bfield-error\b/i,
    /\bvalidation-error\b/i,
];

function normalizeTokens(value) {
    if (typeof value !== "string") {
        return [];
    }

    return value
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function hasErrorClass(element) {
    if (!element || !element.className) return false;
    const className = String(element.className || "");
    return ERROR_CLASS_PATTERNS.some((rx) => rx.test(className));
}

function isElementHidden(element, windowObject = globalThis.window) {
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

        if (windowObject?.getComputedStyle) {
            try {
                const styles = windowObject.getComputedStyle(node);
                if (styles && (styles.display === "none" || styles.visibility === "hidden")) {
                    return true;
                }
            } catch (error) {
                // getComputedStyle may fail in some contexts; ignore
            }
        }

        node = node.parentElement;
        depth += 1;
    }

    return false;
}

function isControlHidden(control, windowObject = globalThis.window) {
    if (!control) return true;
    const type = String(control.getAttribute?.("type") ?? "").trim().toLowerCase();
    if (type === "hidden") return true;
    return isElementHidden(control, windowObject);
}

function getControlTokens(control) {
    if (!control) return [];
    const id = String(control.getAttribute?.("id") ?? "").trim();
    const name = String(control.getAttribute?.("name") ?? "").trim();
    return [id, name].filter(Boolean);
}

function elementReferencesControl(element, controlTokens) {
    if (!element || controlTokens.length === 0) return false;

    // Only consider explicit error-referencing attributes (avoid labels).
    const attributesToCheck = [
        "data-error-for",
        "data-for",
        "data-error-id",
        "aria-controls",
    ];

    for (const attr of attributesToCheck) {
        const value = String(element.getAttribute?.(attr) ?? "").trim();
        if (!value) continue;
        const tokens = normalizeTokens(value);
        if (tokens.some((token) => controlTokens.includes(token))) {
            return true;
        }
    }

    return false;
}

function isErrorLikeElement(element) {
    if (!element) return false;
    if (hasErrorClass(element)) return true;

    const role = String(element.getAttribute?.("role") ?? "")
        .trim()
        .toLowerCase();
    if (role === "alert") return true;

    if (element.hasAttribute?.("aria-live")) return true;
    if (element.hasAttribute?.("data-error")) return true;

    return false;
}

function hasMeaningfulText(element) {
    if (!element) return false;
    const text = String(element.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > 0;
}

function findDescribedByErrorElement(control, windowObject, allowNonErrorSemantics) {
    if (!control || !control.ownerDocument) return null;
    const describedBy = String(control.getAttribute?.("aria-describedby") ?? "").trim();
    if (!describedBy) return null;

    const doc = control.ownerDocument;
    const ids = normalizeTokens(describedBy);
    for (const id of ids) {
        const candidate = doc.getElementById(id);
        if (!candidate) continue;
        if (isElementHidden(candidate, windowObject)) continue;
        if (!hasMeaningfulText(candidate)) continue;
        if (isErrorLikeElement(candidate) || allowNonErrorSemantics) {
            return candidate;
        }
    }

    return null;
}

function findSiblingErrorElement(control, windowObject, controlTokens) {
    const siblings = [control.nextElementSibling, control.previousElementSibling];
    for (const sibling of siblings) {
        if (!sibling) continue;
        if (isElementHidden(sibling, windowObject)) continue;
        if (!hasMeaningfulText(sibling)) continue;
        if (isErrorLikeElement(sibling) || elementReferencesControl(sibling, controlTokens)) {
            return sibling;
        }
    }
    return null;
}

function findContainerErrorElement(control, windowObject, controlTokens) {
    let ancestor = control.parentElement;
    let depth = 0;

    while (ancestor && depth < MAX_ANCESTOR_DEPTH) {
        if (!isElementHidden(ancestor, windowObject)) {
            const otherControls = Array.from(
                ancestor.querySelectorAll(CONTROL_SELECTOR)
            ).filter((element) => element !== control);

            const candidates = Array.from(
                ancestor.querySelectorAll(ERROR_SELECTOR)
            ).slice(0, MAX_CANDIDATES);

            for (const candidate of candidates) {
                if (!candidate || candidate.contains(control)) continue;
                if (isElementHidden(candidate, windowObject)) continue;
                if (!hasMeaningfulText(candidate)) continue;

                const explicitMatch = elementReferencesControl(candidate, controlTokens);
                if (otherControls.length > 0 && !explicitMatch) {
                    continue;
                }

                if (isErrorLikeElement(candidate) || explicitMatch) {
                    return candidate;
                }
            }
        }

        ancestor = ancestor.parentElement;
        depth += 1;
    }

    return null;
}

function findNearbyErrorElement(control, windowObject, allowNonErrorSemantics) {
    const controlTokens = getControlTokens(control);
    const describedByError = findDescribedByErrorElement(
        control,
        windowObject,
        allowNonErrorSemantics
    );
    if (describedByError) return describedByError;

    const siblingError = findSiblingErrorElement(control, windowObject, controlTokens);
    if (siblingError) return siblingError;

    return findContainerErrorElement(control, windowObject, controlTokens);
}

function findHiddenErrorSignal(control, windowObject) {
    const controlTokens = getControlTokens(control);

    const siblings = [control.nextElementSibling, control.previousElementSibling];
    for (const sibling of siblings) {
        if (!sibling) continue;
        const hidden = isElementHidden(sibling, windowObject);
        const empty = !hasMeaningfulText(sibling);
        if (!hidden && !empty) continue;
        if (isErrorLikeElement(sibling) || elementReferencesControl(sibling, controlTokens)) {
            return true;
        }
    }

    let ancestor = control.parentElement;
    let depth = 0;
    while (ancestor && depth < MAX_ANCESTOR_DEPTH) {
        if (!isElementHidden(ancestor, windowObject)) {
            const otherControls = Array.from(
                ancestor.querySelectorAll(CONTROL_SELECTOR)
            ).filter((element) => element !== control);

            const candidates = Array.from(
                ancestor.querySelectorAll(ERROR_SELECTOR)
            ).slice(0, MAX_CANDIDATES);

            for (const candidate of candidates) {
                if (!candidate || candidate.contains(control)) continue;
                const hidden = isElementHidden(candidate, windowObject);
                const empty = !hasMeaningfulText(candidate);
                if (!hidden && !empty) continue;

                const explicitMatch = elementReferencesControl(candidate, controlTokens);
                if (otherControls.length > 0 && !explicitMatch) {
                    continue;
                }

                if (isErrorLikeElement(candidate) || explicitMatch) {
                    return true;
                }
            }
        }

        ancestor = ancestor.parentElement;
        depth += 1;
    }

    return false;
}

function ensureErrorId(errorElement, documentNode, control) {
    if (!errorElement || !documentNode) return "";
    const existingId = String(errorElement.getAttribute?.("id") ?? "").trim();
    if (existingId) return existingId;

    const controlId = String(control?.getAttribute?.("id") ?? "").trim();
    const controlName = String(control?.getAttribute?.("name") ?? "").trim();
    const baseRaw =
        controlId ||
        controlName ||
        errorElement.getAttribute?.("data-error-id") ||
        errorElement.getAttribute?.("data-for") ||
        errorElement.className ||
        errorElement.tagName ||
        "error";

    const base = String(baseRaw)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 24) || "error";

    let candidate = `a11y-error-${base}`;
    let counter = 1;
    while (documentNode.getElementById(candidate)) {
        candidate = `a11y-error-${base}-${counter}`;
        counter += 1;
    }

    try {
        errorElement.setAttribute("id", candidate);
    } catch (error) {
        // setting id may fail in some environments; ignore
    }

    return errorElement.id || candidate;
}

function controlHasDescribedBy(control, id) {
    if (!control || !id) return false;
    const tokens = normalizeTokens(control.getAttribute?.("aria-describedby") ?? "");
    return tokens.includes(id);
}

function addDescribedBy(control, id) {
    if (!control || !id) return false;
    const tokens = normalizeTokens(control.getAttribute?.("aria-describedby") ?? "");
    if (tokens.includes(id)) return false;
    tokens.push(id);
    control.setAttribute("aria-describedby", tokens.join(" "));
    return true;
}

function enhanceLiveRegion(errorElement) {
    if (!errorElement || typeof errorElement.getAttribute !== "function") return false;
    const role = String(errorElement.getAttribute("role") ?? "")
        .trim()
        .toLowerCase();
    const hasAriaLive = errorElement.hasAttribute("aria-live");

    if (role === "alert" || hasAriaLive) {
        return false;
    }

    if (role) {
        errorElement.setAttribute("aria-live", "polite");
        return true;
    }

    errorElement.setAttribute("role", "alert");
    return true;
}

function formatControlLabel(item) {
    const tag = String(item?.tag ?? "").trim();
    const id = String(item?.id ?? "").trim();
    const fieldName = String(item?.fieldName ?? "").trim();
    const normalizedTag = tag ? tag.toLowerCase() : "input";
    const baseTag = normalizedTag
        ? `${normalizedTag.charAt(0).toUpperCase()}${normalizedTag.slice(1)}`
        : "Input";

    if (id) {
        return `${baseTag}#${id}`;
    }

    if (fieldName) {
        return `${baseTag}[name="${fieldName}"]`;
    }

    return baseTag;
}

function buildBucketOneMeaning(debugItems, count, didApply) {
    if (count === 0) {
        return "No deterministic form error accessibility fixes required.";
    }

    const summaries = debugItems.slice(0, 2).map((item) => {
        const label = formatControlLabel(item);
        const issueType = String(item?.issueType ?? "");
        const parts = [];
        if (issueType.includes("describedby")) {
            parts.push("linked to error container; aria-describedby added");
        }
        if (issueType.includes("aria-invalid")) {
            parts.push("marked invalid (aria-invalid)");
        }
        if (issueType.includes("live-region")) {
            parts.push("error container announced");
        }

        if (parts.length === 0) {
            return `${label} updated for error accessibility.`;
        }

        return `${label} ${parts.join(", ")}.`;
    });

    const prefix = didApply ? "Applied fixes: " : "Fixes recommended: ";
    const suffix = count > summaries.length ? ` (+${count - summaries.length} more)` : "";
    return `${prefix}${summaries.join(" ")}${suffix}`;
}

function buildBucketTwoMeaning(debugItems, count) {
    if (count === 0) {
        return "No contextual form error issues detected.";
    }

    const summaries = debugItems.slice(0, 2).map((item) => {
        const label = formatControlLabel(item);
        const issueType = String(item?.issueType ?? "");
        if (issueType === "invalid-no-association") {
            return `${label} marked invalid but has no accessible error message association.`;
        }
        if (issueType === "error-signal-no-association") {
            return `${label} shows a visual error but has no accessible error message association.`;
        }
        if (issueType === "hidden-error-no-association") {
            return `${label} has a hidden or empty error message container with no accessible association.`;
        }
        return `${label} has no accessible error message association.`;
    });

    const suffix = count > summaries.length ? ` (+${count - summaries.length} more)` : "";
    return `${summaries.join(" ")}${suffix}`;
}

export function runFormErrorAccessibilityAlgorithm({
    mode,
    document: documentNode,
    window: windowObject,
    root,
}) {
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
                "Form validation feedback should be programmatically associated with fields so screen reader users receive clear information.",
        };
    }

    const allControls = getAllFormControls(scope);
    const controls = allControls.slice(0, MAX_SCAN);

    const bucketOne = classifyIssue({ isSafeAutoFix: true });
    const bucketTwo = "two";
    const shouldApplyBucketOne = shouldApplyFix({ mode, bucket: bucketOne });

    const bucketOneIssues = new Set();
    const bucketTwoIssues = new Set();
    const bucketOneDebug = [];
    const bucketTwoDebug = [];

    for (let i = 0; i < controls.length; i += 1) {
        const control = controls[i];
        if (!control) continue;

        if (control.disabled === true) continue;
        if (isControlHidden(control, windowObject)) continue;

        const hasInvalidAttr =
            String(control.getAttribute?.("aria-invalid") ?? "").toLowerCase() ===
            "true";
        const controlHasErrorClass = hasErrorClass(control);
        const allowNonErrorSemantics = controlHasErrorClass || hasInvalidAttr;
        const associatedError = findNearbyErrorElement(
            control,
            windowObject,
            allowNonErrorSemantics
        );
        const hiddenErrorSignal = !associatedError
            ? findHiddenErrorSignal(control, windowObject)
            : false;

        const hasStrongErrorSignal =
            controlHasErrorClass || hasInvalidAttr || Boolean(associatedError);
        const hasReportSignal = hasStrongErrorSignal || hiddenErrorSignal;

        if (!hasReportSignal) {
            continue;
        }

        if (!hasStrongErrorSignal && hiddenErrorSignal) {
            bucketTwoIssues.add(control);
            if (bucketTwoDebug.length < MAX_DEBUG_ITEMS) {
                bucketTwoDebug.push({
                    tag: control.tagName,
                    id: control.id || "",
                    fieldName: control.name || "",
                    issueType: "hidden-error-no-association",
                    associatedErrorId: "",
                });
            }
            continue;
        }

        const needsAriaInvalid = !hasInvalidAttr;
        let needsAssociation = false;
        let needsLiveRegion = false;
        let associatedErrorId = "";

        if (associatedError) {
            const existingErrorId = String(
                associatedError.getAttribute?.("id") ?? ""
            ).trim();
            associatedErrorId = existingErrorId || "";

            if (!associatedErrorId && shouldApplyBucketOne) {
                associatedErrorId = ensureErrorId(
                    associatedError,
                    control.ownerDocument ?? documentNode,
                    control
                );
            }

            const hasAssociation =
                associatedErrorId && controlHasDescribedBy(control, associatedErrorId);
            needsAssociation = !hasAssociation;

            if (isErrorLikeElement(associatedError)) {
                const role = String(associatedError.getAttribute?.("role") ?? "")
                    .trim()
                    .toLowerCase();
                const hasAriaLive = associatedError.hasAttribute?.("aria-live");
                needsLiveRegion = role !== "alert" && !hasAriaLive;
            }
        } else {
            const issueType = hasInvalidAttr
                ? "invalid-no-association"
                : controlHasErrorClass
                ? "error-signal-no-association"
                : "missing-association";
            bucketTwoIssues.add(control);
            if (bucketTwoDebug.length < MAX_DEBUG_ITEMS) {
                bucketTwoDebug.push({
                    tag: control.tagName,
                    id: control.id || "",
                    fieldName: control.name || "",
                    issueType,
                    associatedErrorId: "",
                });
            }
        }

        const hasBucketOneIssue = needsAriaInvalid || needsAssociation || needsLiveRegion;
        if (hasBucketOneIssue) {
            bucketOneIssues.add(control);
            if (bucketOneDebug.length < MAX_DEBUG_ITEMS) {
                const issueTypes = [];
                if (needsAriaInvalid) issueTypes.push("aria-invalid");
                if (needsAssociation) issueTypes.push("describedby");
                if (needsLiveRegion) issueTypes.push("live-region");
                bucketOneDebug.push({
                    tag: control.tagName,
                    id: control.id || "",
                    fieldName: control.name || "",
                    issueType: issueTypes.join("+") || "error-state",
                    associatedErrorId: associatedErrorId || "",
                });
            }
        }

        if (shouldApplyBucketOne && hasBucketOneIssue) {
            if (needsAriaInvalid) {
                control.setAttribute("aria-invalid", "true");
            }

            if (associatedError) {
                if (!associatedErrorId) {
                    associatedErrorId = ensureErrorId(
                        associatedError,
                        control.ownerDocument ?? documentNode,
                        control
                    );
                }

                if (associatedErrorId && needsAssociation) {
                    addDescribedBy(control, associatedErrorId);
                }

                if (needsLiveRegion) {
                    enhanceLiveRegion(associatedError);
                }
            }
        }
    }

    const bucketOneCount = bucketOneIssues.size;
    const bucketTwoCount = bucketTwoIssues.size;

    const bucketOneResult = {
        algorithm: ALGORITHM_NAME,
        bucket: bucketOne,
        severity: "High",
        action:
            bucketOneCount === 0
                ? "no issues"
                : shouldApplyBucketOne
                ? "applied"
                : "skipped",
        mode,
        elementsAffected: bucketOneCount,
        whatThisMeans: buildBucketOneMeaning(
            bucketOneDebug,
            bucketOneCount,
            shouldApplyBucketOne
        ),
        debug: bucketOneDebug.slice(0, MAX_DEBUG_ITEMS),
    };

    const bucketTwoResult = {
        algorithm: ALGORITHM_NAME,
        bucket: bucketTwo,
        severity: "Medium",
        action: bucketTwoCount > 0 ? "reported" : "no issues",
        mode,
        elementsAffected: bucketTwoCount,
        whatThisMeans: buildBucketTwoMeaning(bucketTwoDebug, bucketTwoCount),
        debug: bucketTwoDebug.slice(0, MAX_DEBUG_ITEMS),
    };

    return [bucketOneResult, bucketTwoResult];
}

const formErrorsAlgorithm = {
    id: "formErrors",
    name: ALGORITHM_NAME,
    execute: runFormErrorAccessibilityAlgorithm,
};

export default formErrorsAlgorithm;
