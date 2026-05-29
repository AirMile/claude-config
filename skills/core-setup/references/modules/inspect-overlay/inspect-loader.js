// Webpack dev loader: adds data-inspector-* attrs to JSX intrinsic elements.
// Runs babel-plugin-inspector as a pre-pass so SWC remains the actual compiler.
// next/font and other SWC-only features keep working.
const babel = require("@babel/core");
const inspectorPlugin = require("./babel-plugin-inspector");

module.exports = function inspectLoader(source) {
  const callback = this.async();
  this.cacheable?.();

  babel.transform(
    source,
    {
      filename: this.resourcePath,
      cwd: this.rootContext,
      plugins: [inspectorPlugin],
      babelrc: false,
      configFile: false,
      sourceType: "module",
      parserOpts: { plugins: ["jsx", "typescript"] },
      generatorOpts: { retainLines: true },
    },
    (err, result) => {
      if (err || !result?.code) return callback(null, source);
      callback(null, result.code);
    }
  );
};
