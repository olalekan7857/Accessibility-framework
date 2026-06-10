# A11yCore - Accessibility Enhancement Framework

A modular, rule-based accessibility enhancement framework for web applications. This framework automatically detects and remediates common accessibility issues using deterministic algorithms without requiring AI or machine learning.

## Author

**Ademola Ibrahim Olalekan**

Final Year Project - Accessibility Enhancement Framework

## Overview

A11yCore is a JavaScript-based accessibility framework designed to improve web accessibility through automated detection and remediation of common accessibility violations. The framework operates on a rule-based, deterministic approach, ensuring safe and predictable enhancements without relying on AI or machine learning technologies.

### Key Features

- **Modular Architecture**: 14 algorithms organized across three functional modules
- **Two-Layer Design**: Algorithm Layer for detection/remediation, Interface Layer for integration
- **Multiple Operational Modes**: Auto, Audit, and Hybrid modes for different use cases
- **Issue Classification**: Bucket One (deterministic, auto-remediated) and Bucket Two (contextual, reporting only)
- **Zero Dependencies**: Pure JavaScript implementation with no external libraries
- **Browser-Native**: Works directly in the browser without build tools or runtime environments
- **Comprehensive Reporting**: Structured console output grouped by algorithm and severity

## Architecture

### Two-Layer Architecture

The framework implements a two-layer architecture:

1. **Algorithm Layer**: Contains all accessibility detection and remediation logic organized into three modules
2. **Interface Layer**: Provides integration points for web applications and demo interface

### Processing Pipeline

The framework executes a six-stage processing pipeline:

1. **Input and Configuration**: Resolves operational mode and validates environment
2. **Element Extraction**: Queries DOM for relevant elements
3. **Rule Evaluation**: Applies deterministic rules to detect issues
4. **Issue Classification**: Assigns issues to Bucket One or Bucket Two
5. **Mode-Based Execution**: Applies fixes based on operational mode
6. **Output Generation**: Generates structured accessibility reports

## Modules and Algorithms

### Visual Accessibility Module (4 Algorithms)

| Algorithm | Description | Bucket |
|-----------|-------------|--------|
| Text Scaling | Converts fixed pixel font sizes to scalable rem units | One |
| Text Spacing | Adjusts line height, letter spacing, word spacing, and paragraph spacing | One |
| High Contrast Mode | Applies high contrast color theme for improved readability | One |
| Contrast Evaluation | Evaluates color contrast ratios against WCAG guidelines | Two |

### Navigation and Interaction Module (4 Algorithms)

| Algorithm | Description | Bucket |
|-----------|-------------|--------|
| Navigation Ordering | Resets positive tabindex values to restore natural keyboard navigation | One/Two |
| Focus Visibility | Injects CSS to ensure visible focus indicators on interactive elements | One |
| Skip Navigation | Injects "Skip to main content" link at document top | One |
| Motion Reduction | Reduces animation and transition duration for users preferring reduced motion | One/Two |

### Semantic and Structural Validation Module (6 Algorithms)

| Algorithm | Description | Bucket |
|-----------|-------------|--------|
| Role & Label Validation | Validates accessible names and role assignments | One/Two |
| Alt Text Audit | Detects missing and weak alt text on images | One/Two |
| Form Label Association | Ensures form controls have accessible labels | One |
| Language Declaration | Validates and sets HTML lang attribute | One/Two |
| Form Error Accessibility | Associates error messages with form controls using ARIA attributes | One/Two |
| Heading Structure | Validates heading hierarchy and detects skipped levels | Two |

## Operational Modes

### Auto Mode

- Applies all Bucket One fixes automatically
- Does not generate prioritized reports for contextual issues
- Best suited for production environments where automatic enhancement is prioritized

### Audit Mode

- Detects and classifies all issues without applying any fixes
- Generates comprehensive reports for both Bucket One and Bucket Two issues
- Best suited for development and testing environments

### Hybrid Mode (Default)

- Applies Bucket One fixes automatically
- Reports Bucket Two issues for manual review
- Provides balanced behavior for most use cases

## Issue Classification

### Bucket One (Deterministic Issues)

Issues that can be resolved using predefined rules without contextual understanding. These are automatically corrected and are guaranteed to be safe and non-destructive.

**Examples**: Missing alt text, missing language attribute, lack of focus indicators, fixed pixel font sizes

### Bucket Two (Contextual Issues)

Issues requiring human judgment, typically involving content meaning or design intent. These are reported with guidance but not automatically modified.

**Examples**: Weak alt text, invalid role assignments, heading structure violations, color contrast failures

## Installation

### Clone the Repository

```bash
git clone https://github.com/your-username/accessibility-framework.git
cd accessibility-framework
```

### Using the Framework

#### Basic Integration

```javascript
import { initAccessibilityFramework } from './index.js';

const result = initAccessibilityFramework({
  mode: 'hybrid', // 'auto', 'audit', or 'hybrid'
  document: window.document,
  window: window,
});

console.log(result.report);
```

#### Configuration Options

```javascript
const config = {
  mode: 'hybrid',          // Operational mode: 'auto', 'audit', 'hybrid'
  document: window.document, // Document object
  window: window,            // Window object
  root: null,               // Optional: Root element for scoped analysis
  motion: true,             // Optional: Force motion reduction
  highContrast: true        // Optional: Force high contrast mode
};
```

## Demo Interface

A prototype demo interface is included in the `demo` directory to demonstrate framework capabilities.

### Running the Demo

1. Serve the project using a local web server
2. Navigate to the demo directory
3. Open `index.html` in a browser
4. Click "Enable Framework" to run the accessibility analysis
5. View the accessibility report in the floating panel

### Demo Features

- Baseline interface with intentional accessibility violations
- Interactive framework enable/disable controls
- Real-time accessibility report generation
- Visual demonstration of applied enhancements
- Console output with detailed algorithm results

## Project Structure

```
accessibility-framework/
├── algorithms/
│   ├── visual/          # Visual accessibility algorithms
│   ├── navigation/     # Navigation and interaction algorithms
│   └── semantic/        # Semantic and structural validation algorithms
├── core/
│   ├── config.js        # Configuration management
│   ├── pipeline.js      # Processing pipeline orchestration
│   ├── registry.js      # Algorithm registration
│   └── classifier.js    # Issue classification logic
├── report/
│   └── logger.js        # Report generation and logging
├── utils/
│   └── domUtils.js      # DOM manipulation utilities
├── demo/
│   ├── index.html       # Demo interface
│   ├── app.js           # Demo bridge logic
│   └── styles.css       # Demo styling
├── types/               # Type definitions
├── index.js             # Framework entry point
└── README.md            # This file
```

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

Requires ES6+ support and modern browser APIs.

## Technology Stack

- **JavaScript** (ES6+)
- **HTML5**
- **CSS3**
- No external dependencies or build tools required

## Design Principles

1. **Rule-Based**: All detection and remediation uses deterministic rules
2. **No AI/ML**: Framework operates without artificial intelligence or machine learning
3. **Safe by Default**: Bucket One fixes are guaranteed to be non-destructive
4. **Modular**: Algorithms are organized by functional module
5. **Configurable**: Supports multiple operational modes and configuration options
6. **Browser-Native**: Works directly in the browser without runtime environments

## License

This project is part of a Final Year Project by Ademola Ibrahim Olalekan.

## Contributing

This framework is developed as part of academic research. For questions or suggestions, please contact the author.

## Acknowledgments

This framework implements accessibility guidelines based on WCAG 2.1 standards and aims to promote web accessibility through automated enhancement tools.

---

**Author**: Ademola Ibrahim Olalekan  
**Project**: Final Year Project - Accessibility Enhancement Framework  
**Year**: 2026
