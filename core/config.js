export const FRAMEWORK_MODES = Object.freeze({
	AUTO: "auto",
	AUDIT: "audit",
	HYBRID: "hybrid",
});

const SUPPORTED_MODES = new Set(Object.values(FRAMEWORK_MODES));

export const DEFAULT_MODE = FRAMEWORK_MODES.HYBRID;

export function normalizeMode(mode) {
	if (typeof mode !== "string") {
		return DEFAULT_MODE;
	}

	const normalizedMode = mode.toLowerCase();
	return SUPPORTED_MODES.has(normalizedMode) ? normalizedMode : DEFAULT_MODE;
}

export function resolveFrameworkConfig(options = {}) {
	const mode = normalizeMode(options.mode);
	const documentNode = options.document ?? globalThis.document;
	const windowObject = options.window ?? globalThis.window;
	const root = options.root ?? null;
	const motion = options.motion ?? "auto";

	if (!documentNode || !windowObject) {
		throw new Error(
			"Accessibility framework requires both window and document objects."
		);
	}

	return {
		mode,
		document: documentNode,
		window: windowObject,
		root,
		motion,
	};
}
