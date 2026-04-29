import { classifyIssue, shouldApplyFix } from "../../core/classifier.js";
import {
	getAllImages,
	hasMissingAlt,
	hasWeakAltText,
	generateFallbackAlt,
} from "../../utils/domUtils.js";

const ALGORITHM_NAME = "Alt Text";

export function runAltTextAlgorithm({ mode, document: documentNode, window: windowObject, root }) {
	const scope = root || documentNode;
	const allImages = getAllImages(scope);

	// Classify images into buckets
	const missingAltImages = allImages.filter((img) => hasMissingAlt(img));
	const weakAltImages = allImages.filter((img) => hasWeakAltText(img) && !hasMissingAlt(img));

	// Bucket One: Missing alt (deterministic, safe to fix)
	const bucketOneBucket = classifyIssue({ isSafeAutoFix: true });
	const bucketOneShouldApplyFix =
		shouldApplyFix({ mode, bucket: bucketOneBucket }) && missingAltImages.length > 0;

	if (bucketOneShouldApplyFix) {
		missingAltImages.forEach((img) => {
			const fallbackAlt = generateFallbackAlt(img);
			img.setAttribute("alt", fallbackAlt);
		});
	}

	const bucketOneResult = {
		algorithm: ALGORITHM_NAME,
		bucket: bucketOneBucket,
		severity: "High",
		action:
			missingAltImages.length === 0
				? "skipped"
				: bucketOneShouldApplyFix
					? "applied"
					: "skipped",
		mode,
		elementsAffected: missingAltImages.length,
		whatThisMeans: "Images without alt text are not accessible to screen reader users and cannot be understood by search engines.",
	};

	// Bucket Two: Weak alt (contextual, report only)
	const bucketTwoBucket = "two";
	const bucketTwoResult = {
		algorithm: ALGORITHM_NAME,
		bucket: bucketTwoBucket,
		severity: "Medium",
		action: weakAltImages.length === 0 ? "skipped" : "reported",
		mode,
		elementsAffected: weakAltImages.length,
		whatThisMeans: "Alt text is too generic (e.g., 'image', 'photo') and doesn't describe the image meaningfully. Replace with descriptive text.",
	};

	return [bucketOneResult, bucketTwoResult];
}

const altTextAlgorithm = {
	id: "altText",
	name: ALGORITHM_NAME,
	execute: runAltTextAlgorithm,
};

export default altTextAlgorithm;
