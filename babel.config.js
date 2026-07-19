module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // babel-preset-expo silently skips import.meta on web (valid in ESM, but
      // Metro serves a classic <script> so the browser's parser rejects it).
      // Replace every import.meta reference with a safe plain object so
      // packages like zustand's devtools middleware don't crash web bundling.
      function transformImportMetaForWeb({ types: t }) {
        return {
          name: "transform-import-meta-for-web",
          visitor: {
            MetaProperty(path) {
              if (
                t.isIdentifier(path.node.meta, { name: "import" }) &&
                t.isIdentifier(path.node.property, { name: "meta" })
              ) {
                // Replace import.meta with { env: process.env || {}, url: "" }
                // import.meta.env.MODE => (process.env || {}).MODE => undefined => safe
                path.replaceWith(
                  t.objectExpression([
                    t.objectProperty(
                      t.identifier("env"),
                      t.logicalExpression(
                        "||",
                        t.memberExpression(
                          t.identifier("process"),
                          t.identifier("env")
                        ),
                        t.objectExpression([])
                      )
                    ),
                    t.objectProperty(
                      t.identifier("url"),
                      t.stringLiteral("")
                    ),
                  ])
                );
              }
            },
          },
        };
      },
      "react-native-reanimated/plugin",
    ],
  };
};
