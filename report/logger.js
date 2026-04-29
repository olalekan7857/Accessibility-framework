export function createReportLogger({ mode } = {}) {
	const entries = [];
	const label = "Accessibility Framework Report";
	const bucketMeta = {
		one: {
			label: "Bucket One (Deterministic Issues)",
			description:
				"Issues that can be resolved using predefined rules without contextual understanding. These are automatically corrected and are guaranteed to be safe and non-destructive.",
		},
		two: {
			label: "Bucket Two (Contextual Issues)",
			description:
				"Issues requiring human judgment, typically involving content meaning or design intent. These are reported with guidance but not automatically modified.",
		},
	};

	function getBucketMeta(bucket) {
		return bucketMeta[bucket] ?? {
			label: `Bucket ${String(bucket ?? "unknown")}`,
			description: "No bucket description is available for this issue.",
		};
	}

	function getSeverityLabel(entry) {
		if (typeof entry?.severity === "string" && entry.severity.trim()) {
			return entry.severity.trim();
		}

		if (entry?.bucket === "one") {
			return "High";
		}

		if (entry?.bucket === "two") {
			return "Medium";
		}

		return "Info";
	}

	function getIssueMeaning(entry) {
		if (typeof entry?.whatThisMeans === "string" && entry.whatThisMeans.trim()) {
			return entry.whatThisMeans.trim();
		}

		if (entry?.algorithm === "Focus Visibility") {
			return "Keyboard users may not be able to clearly see which interactive element is currently active.";
		}

		if (entry?.algorithm === "Alt Text") {
			if (entry?.bucket === "one") {
				return "Images without alt text are not accessible to screen reader users and cannot be understood by search engines.";
			}
			if (entry?.bucket === "two") {
				return "Alt text is too generic (e.g., 'image', 'photo') and doesn't describe the image meaningfully.";
			}
		}

		if (entry?.bucket === "one") {
			return "This is a safe rule-based issue that the framework can handle automatically.";
		}

		if (entry?.bucket === "two") {
			return "This issue needs human review because the right fix depends on context or design intent.";
		}

		return "This issue was detected by the framework and should be reviewed.";
	}

	return {
		log(entry) {
			if (!entry || typeof entry !== "object") {
				return;
			}

			entries.push({
				...entry,
				mode: entry.mode ?? mode,
			});
		},

		getReport() {
			return entries.map((entry) => ({ ...entry }));
		},

		print() {
			if (typeof console === "undefined") {
				return;
			}

			if (entries.length === 0) {
				console.info(`${label}: no issues detected (mode: ${mode})`);
				return;
			}

			// Group results by algorithm name
			const groupedResults = {};
			entries.forEach((entry) => {
				if (!groupedResults[entry.algorithm]) {
					groupedResults[entry.algorithm] = [];
				}
				groupedResults[entry.algorithm].push(entry);
			});

			const algorithmNames = Object.keys(groupedResults);

			console.info(`${label} — mode: ${mode}`);
			console.info(
				`${bucketMeta.one.label}: ${bucketMeta.one.description}`
			);
			console.info(
				`${bucketMeta.two.label}: ${bucketMeta.two.description}`
			);

			console.groupCollapsed(
				`${label} — ${entries.length} result(s) (mode: ${mode})`
			);

			// Log each algorithm with its bucket results
			algorithmNames.forEach((algorithmName) => {
				const algorithmResults = groupedResults[algorithmName];
				console.groupCollapsed(algorithmName);

				algorithmResults.forEach((entry) => {
					const severity = getSeverityLabel(entry);
					const bucketLabel = entry.bucket.toUpperCase();
					console.log(
						`Bucket ${bucketLabel} | Severity: ${severity} | Action: ${entry.action} | Elements: ${entry.elementsAffected}`
					);
				});

				console.groupEnd();
			});

			// Summary table
			console.table(
				entries.map((entry) => ({
					algorithm: entry.algorithm,
					severity: getSeverityLabel(entry),
					bucket: entry.bucket,
					bucketLabel: getBucketMeta(entry.bucket).label,
					bucketDescription: getBucketMeta(entry.bucket).description,
					whatThisMeans: getIssueMeaning(entry),
					action: entry.action,
					mode: entry.mode ?? mode,
					elementsAffected: entry.elementsAffected,
				}))
			);
			console.groupEnd();
		},

		clear() {
			entries.length = 0;
		},
	};
}
