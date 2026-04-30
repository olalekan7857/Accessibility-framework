  // Optional debug mode
  const DEBUG = false;

// demo/app.js — thin demo bridge to the real framework

(function() {
  'use strict';

  const panel = document.getElementById('reportPanel');
  const closeBtn = document.getElementById('closeReportBtn');
  const reopenBtn = document.getElementById('reopenReportBtn');
  const enableBtn = document.getElementById('enableFrameworkBtn');

  let frameworkActive = false;
  let frameworkModulePromise = null;

  const placeholderHtml = '<p class="placeholder-text"><i class="fas fa-info-circle"></i> Click "Enable Framework" to run analysis.</p>';

  function closePanel() {
    panel.classList.add('hidden');
    reopenBtn.classList.remove('hidden');
  }
  function openPanel() {
    panel.classList.remove('hidden');
    reopenBtn.classList.add('hidden');
  }

  function resetReportPanel() {
    const reportContent = document.getElementById('reportContent');
    if (reportContent) {
      reportContent.innerHTML = placeholderHtml;
    }
  }

  async function loadFramework() {
    if (!frameworkModulePromise) {
      frameworkModulePromise = import('../index.js');
    }

    return frameworkModulePromise;
  }

  function renderFrameworkReport(result) {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent) return;

    const entries = Array.isArray(result?.report) ? result.report : [];

    if (entries.length === 0) {
      reportContent.innerHTML = '<p class="placeholder-text"><i class="fas fa-check-circle"></i> No issues detected.</p>';
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

    const cards = algorithmNames.map((algorithmName) => {
      const bucketResults = groupedResults[algorithmName];
      
      const bucketHTML = bucketResults.map((entry) => {
        const statusClass = entry.action === 'applied' ? 'status-fixed' : 'status-reported';
        const statusLabel = entry.action === 'applied' ? 'Auto-Fix' : 'Reported';
        const bucketLabel = entry.bucket === 'one' ? 'Missing Alt' : entry.bucket === 'two' ? 'Weak Alt' : `Bucket ${entry.bucket}`;

        return `
          <li>
            <span class="${statusClass}"><i class="fas fa-eye"></i> ${statusLabel}</span> — ${bucketLabel}<br>
            <strong>Elements:</strong> ${entry.elementsAffected} | <strong>Mode:</strong> ${entry.mode}
          </li>
        `;
      }).join('');

      return `
        <div class="severity-group">
          <div class="severity-header severity-high">
            <i class="fas fa-bullseye"></i> ${algorithmName}
          </div>
          <ul class="report-list">
            ${bucketHTML}
          </ul>
        </div>
      `;
    }).join('');

    reportContent.innerHTML = `
      <p style="margin-top:0;"><i class="fas fa-info-circle"></i> <strong>${algorithmNames.length} algorithm(s) with ${entries.length} result(s)</strong></p>
      ${cards}
    `;
  }

  async function enableFramework() {
    try {
      const { initAccessibilityFramework } = await loadFramework();
      const result = initAccessibilityFramework({
        mode: 'hybrid',
        document,
        window,
      });

      window.__accessibilityFrameworkResult = result;

      frameworkActive = true;
      enableBtn.innerHTML = '<i class="fas fa-stop"></i> Disable Framework';
      renderFrameworkReport(result);
      openPanel();
    } catch (error) {
      console.error('Failed to run accessibility framework:', error);
      resetReportPanel();
    }
  }

  function disableFramework() {
    document.body.classList.remove('a11y-framework-active');
    frameworkActive = true;
    enableBtn.innerHTML = '<i class="fas fa-play"></i> Enable Framework';
    resetReportPanel();
    closePanel();
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

  resetReportPanel();
  if (DEBUG) {
    console.log('A11y Framework Demo — now connected to the real framework.');
  }
})();