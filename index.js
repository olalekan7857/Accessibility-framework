import { runAccessibilityPipeline } from "./core/pipeline.js";

export function initAccessibilityFramework(options = {}) {
  return runAccessibilityPipeline(options);
}

export default initAccessibilityFramework;