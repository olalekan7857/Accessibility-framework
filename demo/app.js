// app.js — Updated toggle behavior (Enable/Disable Framework)

(function() {
  'use strict';

  // ==================== FRAMEWORK CORE (UNCHANGED) ====================
  const AccessibilityFramework = {
    config: { mode: 'audit' },
    report: [],

    run(mode = 'audit') {
      this.config.mode = mode;
      console.log(`AccessibilityFramework running in ${mode.toUpperCase()} mode`);
      this.evaluate();
      this.applyMode();
      this.applyVisualSimulation();
      this.generateReport();
    },

    // Apply temporary visual fixes when mode is auto/hybrid
    applyVisualSimulation() {
      const shouldSimulate = (this.config.mode === 'auto' || this.config.mode === 'hybrid');
      if (shouldSimulate) {
        document.body.classList.add('a11y-framework-active');
      } else {
        document.body.classList.remove('a11y-framework-active');
      }
    },

    // Remove visual simulation (called when disabling)
    disable() {
      document.body.classList.remove('a11y-framework-active');
    },

    evaluate() {
      this.report = [];
      this._detectContrastIssues();
      this._detectFixedFontSizes();
      this._detectTightSpacing();
      this._detectNoHighContrastToggle();
      this._detectTabindexMisuse();
      this._detectFocusOutlineRemoved();
      this._detectMissingSkipLink();
      this._detectMotionWithoutQuery();
      this._detectMissingAriaRoles();
      this._detectMissingAltText();
      this._detectFormLabelIssues();
      this._detectMissingLangAttribute();
      this._detectVisualOnlyFormErrors();
      this._detectHeadingOrderIssues();
    },

    applyMode() {
      const shouldAutoFix = (this.config.mode === 'auto' || this.config.mode === 'hybrid');
      this.report = this.report.map(issue => ({
        ...issue,
        status: (shouldAutoFix && issue.bucket === 'bucket1' && issue.canAutoFix)
          ? 'Auto-fix (simulated)'
          : 'Manual review required'
      }));
    },

    generateReport() {
      const panel = document.getElementById('reportContent');
      if (!panel) return;

      if (this.report.length === 0) {
        panel.innerHTML = `<p class="placeholder-text"><i class="fas fa-check-circle"></i> No issues detected.</p>`;
        return;
      }

      const high = this.report.filter(i => i.severity === 'high');
      const medium = this.report.filter(i => i.severity === 'medium');
      const low = this.report.filter(i => i.severity === 'low');

      const renderGroup = (items, severityLabel, iconClass, severityClass) => {
        if (items.length === 0) return '';
        const list = items.map(issue => {
          const statusTag = issue.status === 'Auto-fix (simulated)'
            ? '<span class="status-fixed"><i class="fas fa-wrench"></i> Auto-Fix</span>'
            : '<span class="status-reported"><i class="fas fa-eye"></i> Manual</span>';
          return `<li>${statusTag} <strong>${issue.title}</strong><br><span style="color:#666;">${issue.description}</span></li>`;
        }).join('');
        return `
          <div class="severity-group">
            <div class="severity-header ${severityClass}">
              <i class="fas ${iconClass}"></i> ${severityLabel} (${items.length})
            </div>
            <ul class="report-list">${list}</ul>
          </div>
        `;
      };

      const html = `
        <p style="margin-top:0;"><i class="fas fa-info-circle"></i> <strong>${this.report.length} issues</strong> · ${this.report.filter(i => i.status === 'Auto-fix (simulated)').length} auto-fixable</p>
        ${renderGroup(high, 'High', 'fa-exclamation-circle', 'severity-high')}
        ${renderGroup(medium, 'Medium', 'fa-exclamation-triangle', 'severity-medium')}
        ${renderGroup(low, 'Low', 'fa-info-circle', 'severity-low')}
      `;
      panel.innerHTML = html;
    },

    // ---------- UTILITIES ----------
    _createIssue(id, title, description, elementTag, bucket, canAutoFix, severity) {
      return { id, title, description, element: elementTag, bucket, canAutoFix, severity, status: 'pending' };
    },
    _getLuminance(rgbStr) {
      const rgb = rgbStr.match(/\d+/g); if (!rgb) return 0;
      const [r, g, b] = rgb.map(c => { c = c/255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); });
      return 0.2126*r + 0.7152*g + 0.0722*b;
    },
    _getContrastRatio(l1, l2) { const lighter = Math.max(l1,l2), darker = Math.min(l1,l2); return (lighter+0.05)/(darker+0.05); },

    // ---------- DETECTION (unchanged) ----------
    _detectContrastIssues() {
      const els = document.querySelectorAll('p, span, a, li, h1, h2, h3, h4, h5, h6, button, label, div:not(:empty)');
      let count = 0;
      els.forEach(el => {
        if (!el.innerText?.trim()) return;
        const style = getComputedStyle(el);
        const bg = style.backgroundColor;
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return;
        const ratio = this._getContrastRatio(this._getLuminance(style.color), this._getLuminance(bg));
        if (ratio < 4.5) count++;
      });
      if (count) {
        this.report.push(this._createIssue('contrast', 'Low contrast text',
          `${count} text element(s) have contrast below 4.5:1. May be hard to read. Increase contrast.`,
          '<various>', 'bucket2', false, 'medium'));
      }
    },
    _detectFixedFontSizes() {
      if (getComputedStyle(document.body).fontSize.includes('px')) {
        this.report.push(this._createIssue('fixed-font', 'Fixed font size',
          'Body text uses pixel units, preventing text scaling. Use rem/em.',
          '<body>', 'bucket1', true, 'medium'));
      }
    },
    _detectTightSpacing() {
      const s = getComputedStyle(document.body);
      if (parseFloat(s.lineHeight) < 1.5 || parseFloat(s.letterSpacing) < 0) {
        this.report.push(this._createIssue('tight-spacing', 'Insufficient text spacing',
          'Line-height is tight or letter-spacing negative. Affects readability.',
          '<body>', 'bucket1', true, 'low'));
      }
    },
    _detectNoHighContrastToggle() {
      if (!document.querySelector('[data-high-contrast]')) {
        this.report.push(this._createIssue('no-high-contrast', 'No high contrast option',
          'Site lacks a high contrast toggle. Users with low vision may benefit.',
          'N/A', 'bucket2', false, 'low'));
      }
    },
    _detectTabindexMisuse() {
      if (Array.from(document.querySelectorAll('[tabindex]')).some(el => parseInt(el.getAttribute('tabindex'),10) > 0)) {
        this.report.push(this._createIssue('tabindex-order', 'Positive tabindex values',
          'tabindex > 0 disrupts natural focus order. Remove or set to 0/-1.',
          '<various>', 'bucket1', true, 'high'));
      }
    },
    _detectFocusOutlineRemoved() {
      if (Array.from(document.querySelectorAll('*')).some(el => ['0px','none'].includes(getComputedStyle(el).outline))) {
        this.report.push(this._createIssue('focus-outline', 'Focus indicator removed',
          'CSS outline removed, making keyboard focus invisible. Provide visible focus style.',
          '<global>', 'bucket1', true, 'high'));
      }
    },
    _detectMissingSkipLink() {
      if (!document.querySelector('a[href^="#main"], .skip-link')) {
        this.report.push(this._createIssue('skip-link', 'Missing skip navigation',
          'No "skip to content" link. Keyboard users must tab through all navigation.',
          'N/A', 'bucket1', true, 'medium'));
      }
    },
    _detectMotionWithoutQuery() {
      let hasAnim = false;
      for (let el of document.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        if (s.animationName !== 'none' || s.transitionProperty !== 'all') { hasAnim = true; break; }
      }
      let hasQuery = false;
      try {
        for (let sheet of document.styleSheets) {
          try { for (let rule of (sheet.cssRules || [])) if (rule.conditionText?.includes('prefers-reduced-motion')) { hasQuery = true; break; } }
          catch(e){}
        }
      } catch(e){}
      if (hasAnim && !hasQuery) {
        this.report.push(this._createIssue('motion', 'Animation without reduced-motion support',
          'Animations present but no prefers-reduced-motion query. Add media query.',
          '<various>', 'bucket2', false, 'low'));
      }
    },
    _detectMissingAriaRoles() {
      const clickable = document.querySelectorAll('div[onclick], .hero-cta');
      let miss = 0;
      clickable.forEach(el => { if (!el.hasAttribute('role')) miss++; });
      if (miss) {
        this.report.push(this._createIssue('missing-role', 'Missing ARIA role',
          `${miss} clickable <div> lacks role. Add role="button".`,
          '<div>', 'bucket1', true, 'high'));
      }
    },
    _detectMissingAltText() {
      const imgs = document.querySelectorAll('img');
      let miss = Array.from(imgs).filter(i => !i.hasAttribute('alt') || i.alt.trim()==='').length;
      if (miss) {
        this.report.push(this._createIssue('missing-alt', 'Missing alt text',
          `${miss} image(s) have no alt attribute. Provide descriptive alt text.`,
          '<img>', 'bucket1', true, 'high'));
      }
    },
    _detectFormLabelIssues() {
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"])');
      let miss = 0;
      inputs.forEach(i => { if (!i.id || !document.querySelector(`label[for="${i.id}"]`)) miss++; });
      if (miss) {
        this.report.push(this._createIssue('missing-label', 'Form inputs missing labels',
          `${miss} input(s) lack associated <label>. Use <label for="...">.`,
          '<input>', 'bucket1', true, 'high'));
      }
    },
    _detectMissingLangAttribute() {
      if (!document.documentElement.hasAttribute('lang')) {
        this.report.push(this._createIssue('lang-attribute', 'Missing language attribute',
          '<html> lacks lang attribute, affecting screen reader pronunciation.',
          '<html>', 'bucket1', true, 'medium'));
      }
    },
    _detectVisualOnlyFormErrors() {
      const err = document.getElementById('formErrorDisplay');
      if (err && !err.hasAttribute('aria-live')) {
        this.report.push(this._createIssue('visual-error', 'Form errors not announced',
          'Error messages only visual. Add aria-live="polite".',
          '#formErrorDisplay', 'bucket1', true, 'medium'));
      }
    },
    _detectHeadingOrderIssues() {
      const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      let viol = false;
      for (let i=1; i<heads.length; i++) if (parseInt(heads[i].tagName[1]) > parseInt(heads[i-1].tagName[1])+1) viol = true;
      if (viol || !document.querySelector('h1')) {
        this.report.push(this._createIssue('heading-order', 'Illogical heading structure',
          'Headings skip levels or missing h1. Use logical hierarchy.',
          '<headings>', 'bucket2', false, 'medium'));
      }
    }
  };

  // ==================== UI INTEGRATION (TOGGLE BEHAVIOR) ====================
  const panel = document.getElementById('reportPanel');
  const closeBtn = document.getElementById('closeReportBtn');
  const reopenBtn = document.getElementById('reopenReportBtn');
  const enableBtn = document.getElementById('enableFrameworkBtn');

  let frameworkActive = false;

  function closePanel() {
    panel.classList.add('hidden');
    reopenBtn.classList.remove('hidden');
  }
  function openPanel() {
    panel.classList.remove('hidden');
    reopenBtn.classList.add('hidden');
  }

  function enableFramework() {
    AccessibilityFramework.run('hybrid');
    frameworkActive = true;
    enableBtn.innerHTML = '<i class="fas fa-stop"></i> Disable Framework';
    openPanel(); // show report panel
  }

  function disableFramework() {
    AccessibilityFramework.disable();
    frameworkActive = false;
    enableBtn.innerHTML = '<i class="fas fa-play"></i> Enable Framework';
    closePanel(); // hide report panel, show reopen button
    // Optionally clear report content?
    // We'll leave report content as is, but panel hidden.
  }

  if (enableBtn) {
    enableBtn.addEventListener('click', () => {
      if (frameworkActive) {
        disableFramework();
      } else {
        enableFramework();
      }
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  if (reopenBtn) reopenBtn.addEventListener('click', openPanel);

  // Intentionally bad form validation (unchanged)
  const form = document.getElementById('newsletterForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('email');
      const err = document.getElementById('formErrorDisplay');
      if (!email.value.includes('@')) err.textContent = '❌ Please enter a valid email address.';
      else { err.textContent = '✓ Subscribed! (demo)'; setTimeout(() => err.textContent = '', 2000); form.reset(); }
    });
  }

  window.AccessibilityFramework = AccessibilityFramework;
  console.log('A11y Framework Demo — toggle enable/disable ready.');
})();