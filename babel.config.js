// babel.config.js
//
// `drizzle/migrations.js` does `import m0000 from './0000_init.sql'`. A
// `.sql` file is not JavaScript, so without help Babel tries to parse raw
// SQL as JS and fails immediately (exactly the crash you'll see if this
// plugin is ever removed). `inline-import` intercepts any import ending in
// `.sql` and replaces it, at build time, with the file's raw text as a
// JavaScript string — so by the time Babel actually parses anything, there
// is no more SQL for it to choke on. metro.config.js is the other half of
// this: it tells Metro the `.sql` extension is importable at all.
// Source: https://orm.drizzle.team/docs/get-started/expo-new (verify this
// is still current if the Drizzle+Expo integration changes — Section 3.4.3).

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [["inline-import", { extensions: [".sql"] }]],
  };
};
