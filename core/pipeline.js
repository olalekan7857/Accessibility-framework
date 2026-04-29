import { resolveFrameworkConfig } from "./config.js";
import { getRegisteredAlgorithms } from "./registry.js";
import { createReportLogger } from "../report/logger.js";

export function runAccessibilityPipeline(options = {}) {
	const config = resolveFrameworkConfig(options);
	const logger = createReportLogger({ mode: config.mode });
	const algorithms = getRegisteredAlgorithms();

	for (const algorithm of algorithms) {
		if (!algorithm || typeof algorithm.execute !== "function") {
			continue;
		}

		const result = algorithm.execute(config);

		// Handle both single results and arrays of results
		if (Array.isArray(result)) {
			result.forEach((item) => logger.log(item));
		} else {
			logger.log(result);
		}
	}

	logger.print();

	return {
		mode: config.mode,
		report: logger.getReport(),
		updatedDom: config.document,
	};
}
