/**
 * Babel plugin that injects data-inspector-* attributes on JSX DOM elements.
 * Only active in development (configured via .babelrc env.development).
 * Enables the inspect overlay to show file:line references instead of CSS classes.
 */
module.exports = function inspectPlugin({ types: t }) {
  return {
    visitor: {
      JSXOpeningElement(path, state) {
        const name = path.node.name;
        // Only intrinsic elements (lowercase HTML tags like div, span, button)
        if (!t.isJSXIdentifier(name) || /^[A-Z]/.test(name.name)) return;

        const { filename } = state;
        if (!filename || !path.node.loc) return;

        const { line, column } = path.node.loc.start;
        const cwd = state.cwd || process.cwd();
        const relative = filename.startsWith(cwd)
          ? filename.slice(cwd.length + 1)
          : filename;

        path.node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier("data-inspector-relative-path"),
            t.stringLiteral(relative),
          ),
          t.jsxAttribute(
            t.jsxIdentifier("data-inspector-line"),
            t.stringLiteral(String(line)),
          ),
          t.jsxAttribute(
            t.jsxIdentifier("data-inspector-column"),
            t.stringLiteral(String(column)),
          ),
        );
      },
    },
  };
};
