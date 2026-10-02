// Evaluated in the page by `browse eval` after axe-core has been injected
// (see docs/plans/editorial-admin/local-demo.md). Reports WCAG 2.1 A/AA
// violations as compact JSON; an empty array means no violations.
(async () => {
  const results = await window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    resultTypes: ["violations"],
  });
  return JSON.stringify(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 6).map((node) => ({
        target: node.target.join(" "),
        summary: (node.failureSummary || "").slice(0, 240),
      })),
    })),
  );
})();
