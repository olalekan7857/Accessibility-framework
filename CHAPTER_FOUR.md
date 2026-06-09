# CHAPTER FOUR
# IMPLEMENTATION AND SYSTEM DEMONSTRATION

## 4.1 Introduction

This chapter presents the implementation of the proposed accessibility enhancement framework, including the technologies used, framework architecture implementation, operational modes, algorithm implementation, and demonstration of framework outputs using the prototype interface.

## 4.2 Development Environment

### 4.2.1 Programming Language

JavaScript, HTML, and CSS were selected as the primary development languages for the framework implementation. JavaScript provides browser-native capabilities without external dependencies, making it suitable for DOM analysis and manipulation. HTML serves as the markup language for the demo interface, while CSS enables styling and visual enhancements. This combination allows for easy framework integration into existing web applications and ensures compatibility across modern browsers without requiring build tools or runtime environments.

[Insert Figure 4.1: Placeholder for Screenshot of Framework project opened in VS Code]

### 4.2.2 Software Requirements

| Software | Purpose |
| --- | --- |
| Visual Studio Code | Development |
| Google Chrome | Testing |
| Git | Version Control |
| Local Web Server | Execution |

[Insert Figure 4.2: Placeholder for Screenshot of Development environment]

### 4.2.3 Hardware Requirements

| Component | Specification |
| --- | --- |
| Processor | Intel Core i5 or equivalent |
| RAM | 8GB minimum |
| Storage | 256GB SSD |
| Display | 1920x1080 resolution |

## 4.3 Framework Implementation

### 4.3.1 Project Structure

The framework is organized into a modular directory structure that separates concerns across core functionality, algorithm implementations, reporting utilities, and demonstration interface. The `core` directory contains the pipeline orchestration, configuration management, algorithm registry, and issue classification logic. The `algorithms` directory is subdivided into three modules: `visual`, `navigation`, and `semantic`, each containing specific algorithm implementations. The `report` directory handles logging and output generation, while the `utils` directory provides reusable DOM manipulation and helper functions. The `demo` directory contains the prototype interface demonstrating framework operation, and the `types` directory defines TypeScript-style type definitions for algorithm and report structures.

[Insert Figure 4.3: Placeholder for Figure 4.1: Framework Folder Structure (Screenshot of VS Code explorer)]

### 4.3.2 Two-Layer Architecture Implementation

The framework implements the Two-Layer Architecture as specified in the design. The Algorithm Layer consists of the `algorithms` directory containing all 14 accessibility algorithms organized by module (visual, navigation, semantic). Each algorithm exports a standard interface with an `execute` function that accepts configuration parameters and returns structured results. The registry in `core/registry.js` imports and registers all algorithms for pipeline execution. The Interface Layer is implemented in the `demo` directory, containing `index.html` as the baseline test page and `app.js` as the bridge that invokes the framework. The demo interface provides controls to enable/disable the framework, select operational modes, and display accessibility reports through a floating panel. This separation ensures algorithm logic remains independent from the presentation layer, enabling the framework to be integrated into any web application.

[Insert Figure 4.4: Placeholder for Architecture diagram]

## 4.4 Framework Processing Pipeline Implementation

The six-stage processing pipeline is implemented in `core/pipeline.js`. Stage 1 (Input and Configuration) is handled by `resolveFrameworkConfig()` in `core/config.js`, which normalizes the operational mode (auto, audit, hybrid) and validates document and window objects. Stage 2 (Element Extraction) occurs within individual algorithms, where each algorithm queries the DOM using `querySelectorAll` to retrieve relevant elements. Stage 3 (Rule Evaluation) is performed by algorithm-specific logic that applies deterministic rules to detect accessibility issues. Stage 4 (Issue Classification) uses `classifyIssue()` in `core/classifier.js`, which assigns issues to Bucket One (deterministic) or Bucket Two (contextual) based on the `isSafeAutoFix` parameter. Stage 5 (Mode-Based Execution) is controlled by `shouldApplyFix()` in `core/classifier.js`, which determines whether fixes should be applied based on the operational mode and bucket classification. Stage 6 (Output Generation) is handled by `createReportLogger()` in `report/logger.js`, which aggregates results and prints structured console output grouped by algorithm. The pipeline iterates through all registered algorithms, executes each with the configuration, logs results, and returns a comprehensive report.

[Insert Figure 4.5: Placeholder for Pipeline execution screenshot]

## 4.5 Operational Modes Implementation

### 4.5.1 Auto Mode

Auto mode is implemented in `core/config.js` as the `FRAMEWORK_MODES.AUTO` constant. When this mode is selected, the `shouldApplyFix()` function in `core/classifier.js` returns `true` for all Bucket One issues, enabling automatic remediation. Algorithms check this condition before applying fixes. For example, in `algorithms/visual/textScaling.js`, the code checks `shouldApplyFix({ mode, bucket: bucketOne })` before converting fixed pixel font sizes to rem units. Auto mode prioritizes enhancement over reporting, applying all safe deterministic fixes without generating a prioritized report for contextual issues.

[Insert Figure 4.6: Placeholder for Auto mode output screenshot]

### 4.5.2 Audit Mode

Audit mode is defined as `FRAMEWORK_MODES.AUDIT` in `core/config.js`. In this mode, `shouldApplyFix()` returns `false` for all buckets, preventing any DOM modifications. Algorithms still execute detection and classification logic but skip remediation steps. For instance, in `algorithms/navigation/focusVisibility.js`, the algorithm detects elements lacking visible focus indicators but does not inject the focus style CSS when audit mode is active. Audit mode generates a full structured report for both Bucket One and Bucket Two issues, providing comprehensive detection without applying changes.

[Insert Figure 4.7: Placeholder for Audit mode output screenshot]

### 4.5.3 Hybrid Mode

Hybrid mode is the default mode (`DEFAULT_MODE` in `core/config.js`) and provides balanced behavior. The `shouldApplyFix()` function returns `true` for Bucket One issues and `false` for Bucket Two issues. This enables automatic remediation of deterministic issues while reporting contextual issues for manual review. For example, in `algorithms/semantic/language.js`, missing language attributes (Bucket One) are automatically fixed by setting `lang="en"`, while invalid or placeholder language values (Bucket Two) are reported without modification. Hybrid mode applies safe enhancements while flagging issues requiring human judgment.

[Insert Figure 4.8: Placeholder for Hybrid mode output screenshot]

## 4.6 Accessibility Algorithms Implementation

### 4.6.1 Visual Accessibility Module

The Visual Accessibility Module implements four algorithms: Text Scaling, Text Spacing, High Contrast Mode, and Contrast Evaluation. Text Scaling (`algorithms/visual/textScaling.js`) scans for fixed pixel font sizes using `getComputedStyle()` and converts them to scalable rem units through `element.style.setProperty()`. Text Spacing (`algorithms/visual/textSpacing.js`) evaluates line height, letter spacing, word spacing, and paragraph spacing against WCAG guidelines, injecting CSS classes to improve readability. High Contrast Mode (`algorithms/visual/highContrast.js`) applies a deterministic color theme by adding classes to text, links, buttons, and containers, with brand protection logic to preserve logos. Contrast Evaluation (`algorithms/visual/contrast.js`) calculates luminance ratios using the WCAG formula and reports failures without modification, as color adjustments require contextual design decisions.

[Insert Figure 4.9: Placeholder for Visual module execution screenshot]

### 4.6.2 Navigation and Interaction Module

The Navigation and Interaction Module implements four algorithms: Navigation Ordering, Focus Visibility, Skip Navigation, and Motion Reduction. Navigation Ordering (`algorithms/navigation/navigationOrder.js`) detects elements with positive `tabindex` values and resets native interactive elements to `tabindex="0"` to restore natural keyboard navigation order. Focus Visibility (`algorithms/navigation/focusVisibility.js`) checks for visible focus indicators using `getComputedStyle()` and injects a global CSS rule to ensure all interactive elements have visible outlines. Skip Navigation (`algorithms/navigation/skipNav.js`) injects a "Skip to main content" link at the top of the document and ensures the target element has a valid ID and is focusable. Motion Reduction (`algorithms/navigation/motionReduction.js`) detects animations and transitions, then applies CSS to reduce motion duration when the user prefers reduced motion or when forced by configuration.

[Insert Figure 4.10: Placeholder for Navigation module execution screenshot]

### 4.6.3 Semantic and Structural Validation Module

The Semantic and Structural Validation Module implements six algorithms: Role & Label Validation, Alt Text Audit, Form Label Association, Language Declaration, Form Error Accessibility, and Heading Structure. Role & Label Validation (`algorithms/semantic/buttonLinkText.js`) checks interactive elements for accessible names using `aria-labelledby`, `aria-label`, or visible text, and adds `role="button"` to clickable divs. Alt Text Audit (`algorithms/semantic/altText.js`) detects missing alt attributes (Bucket One) and weak alt text like "image" (Bucket Two), applying fallback alt text from filenames for missing cases. Form Label Association (`algorithms/semantic/formLabels.js`) identifies form controls without labels and adds `aria-label` attributes with fallback text. Language Declaration (`algorithms/semantic/language.js`) checks for missing or invalid `lang` attributes on the HTML element, automatically adding `lang="en"` when missing. Form Error Accessibility (`algorithms/semantic/formErrors.js`) associates error messages with form controls using `aria-describedby` and adds `role="alert"` to error containers. Heading Structure (`algorithms/semantic/headings.js`) validates heading hierarchy, detecting skipped levels and empty headings for reporting.

[Insert Figure 4.11: Placeholder for Semantic module execution screenshot]

## 4.7 Framework Demonstration

### 4.7.1 Baseline Interface Before Framework Execution

The baseline demo interface (`demo/index.html`) contains intentional accessibility violations to demonstrate framework capabilities. These include a missing `lang` attribute on the HTML element, no skip navigation link, a div acting as a button without a role attribute, images missing alt text, form inputs without labels, low contrast text, and improper heading hierarchy. The interface includes a floating "Enable Framework" button and a report panel that displays a placeholder message before framework execution.

[Insert Figure 4.12: Placeholder for Baseline demo page before enabling framework]

### 4.7.2 Framework Execution

Framework execution is triggered by clicking the "Enable Framework" button in `demo/app.js`. The `enableFramework()` function dynamically imports the framework using `import('../index.js')`, calls `initAccessibilityFramework()` with hybrid mode configuration, and stores the result in `window.__accessibilityFrameworkResult`. The framework pipeline executes all 14 algorithms, applies Bucket One fixes, and generates a structured report. The button text changes to "Disable Framework" and the report panel opens to display results.

[Insert Figure 4.13: Placeholder for Screenshot of clicking Enable Framework]

### 4.7.3 Accessibility Report Generation

The accessibility report is generated by `report/logger.js` and displayed in the demo interface report panel. The report groups results by algorithm name, showing bucket classification, severity, action taken (applied or reported), and number of elements affected. The console output displays a collapsible group titled "Accessibility Framework Report — 14 algorithm(s)" with detailed results for each algorithm. The demo panel renders this data visually with status indicators (Auto-Fix for applied fixes, Reported for contextual issues).

[Insert Figure 4.14: Placeholder for Console report showing "Accessibility Framework Report — 14 algorithm(s)" and bucket outputs]

## 4.8 Sample Accessibility Enhancements

### 4.8.1 Focus Visibility Enhancement

Before framework execution, interactive elements in the demo interface lack visible focus indicators, making keyboard navigation difficult for users. The Focus Visibility algorithm detects this by checking `outlineStyle`, `outlineWidth`, and `outlineColor` using `getComputedStyle()`. After framework execution in auto or hybrid mode, a global CSS rule is injected:

```css
:focus {
  outline: 2px solid black !important;
  outline-offset: 2px !important;
}
```

This ensures all buttons, links, and form controls display a clear black outline when focused.

[Insert Figure 4.15: Placeholder for Focus Visibility Before screenshot]
[Insert Figure 4.16: Placeholder for Focus Visibility After screenshot]

### 4.8.2 Skip Navigation Injection

Before framework execution, the demo interface lacks a skip navigation link, forcing keyboard users to tab through all navigation elements before reaching main content. The Skip Navigation algorithm detects this absence and injects a skip link at the top of the document body:

```javascript
const skipLink = documentNode.createElement("a");
skipLink.setAttribute("href", `#${targetId}`);
skipLink.setAttribute("class", "skip-link");
skipLink.textContent = "Skip to main content";
body.insertBefore(skipLink, body.firstChild ?? null);
```

The algorithm also ensures the target element (typically `<main>`) has a valid ID and is focusable with `tabindex="-1"`.

[Insert Figure 4.17: Placeholder for Skip Navigation Before screenshot]
[Insert Figure 4.18: Placeholder for Skip Navigation After screenshot]

### 4.8.3 Language Declaration Enhancement

Before framework execution, the HTML element lacks a `lang` attribute:

```html
<html>
```

The Language Declaration algorithm detects this missing attribute and automatically adds it in Bucket One:

```html
<html lang="en">
```

This enhancement is implemented in `algorithms/semantic/language.js` with the code:

```javascript
if (shouldApplyAutoFix && htmlElement) {
  htmlElement.setAttribute("lang", "en");
}
```

Invalid or placeholder values like `lang="unknown"` are reported in Bucket Two without modification.

### 4.8.4 Form Error Accessibility Enhancement

Before framework execution, form error messages in the demo interface are visually displayed but not programmatically associated with their corresponding form controls. The Form Error Accessibility algorithm detects error containers near invalid controls and establishes associations using ARIA attributes. For controls marked with `aria-invalid="true"`, the algorithm adds `aria-describedby` referencing the error element ID:

```javascript
if (associatedErrorId && needsAssociation) {
  addDescribedBy(control, associatedErrorId);
}
```

It also enhances error containers with live region semantics:

```javascript
if (needsLiveRegion) {
  enhanceLiveRegion(associatedError);
}
```

This ensures screen readers announce error messages when validation fails.

[Insert Figure 4.19: Placeholder for Form Error Before screenshot]
[Insert Figure 4.20: Placeholder for Form Error After screenshot]

## 4.9 Framework Output Summary

| Module | Algorithms |
| --- | --- |
| Visual | 4 |
| Navigation | 4 |
| Semantic | 6 |
| Total | 14 |

| Bucket | Behaviour |
| --- | --- |
| Bucket One | Automatic Enhancement |
| Bucket Two | Reporting Only |

## 4.10 Chapter Summary

The accessibility enhancement framework was successfully implemented with 14 algorithms across three modules (Visual, Navigation, and Semantic), three operational modes (Auto, Audit, and Hybrid), and a structured reporting system. The framework demonstrates rule-based, deterministic detection and remediation of accessibility issues without using AI or ML, successfully applying Bucket One enhancements automatically while reporting Bucket Two contextual issues for manual review.
