# Baby Steps — Fieldnote, line by line

Every meaningful piece of code in the project, explained one symbol at a time, assuming zero prior programming knowledge. Real code only, copied from the actual files — never a made-up example. This is a living document: as more code gets written, more of it gets explained here. If you (Muhammad) ever read a line in this project you can't follow, that line is missing from this file — add it before moving on (see the project's documentation protocol).

---

## `src/lib/id.ts` — making a unique ID

```ts
import { randomUUID } from "expo-crypto";

export function newId(): string {
  return randomUUID();
}
```

**`import { randomUUID } from "expo-crypto";`**
`import` pulls in code someone else wrote. The curly braces `{ randomUUID }` mean "specifically, give me the thing named `randomUUID` out of that package" — as opposed to grabbing everything in the package. `"expo-crypto"` is the package name; it lives in `node_modules` because it was installed with `npx expo install expo-crypto`.

**`export function newId(): string {`**

- `export` — other files are allowed to `import` this. Without it, `newId` would be trapped in this one file.
- `function newId()` — defines a machine named `newId` that takes nothing in (empty parentheses) and does something when called.
- `: string` — a promise to TypeScript: "whatever this function gives back will always be text." If the body ever tried to return a number instead, TypeScript would refuse to compile.
- `{` — opens the function's body; everything until the matching `}` is what happens when `newId()` is called.

**`return randomUUID();`**
`return` hands a value back to whoever called the function. `randomUUID()` — the imported function — is called (the `()` at the end means "run it now"), and whatever it produces (a long random string like `"3fa2c1e0-..."`) becomes `newId()`'s answer.

**`}`**
Closes the function body.

---

## `src/lib/time.ts` — "now," as a plain number

```ts
export function now(): number {
  return Date.now();
}
```

`Date` is a built-in JavaScript tool for working with time. `Date.now()` — note the dot, meaning "call the `now` function that lives on `Date`" — returns the current moment as a single number: the count of milliseconds since 1 January 1970 (an arbitrary but universally agreed starting line, called "the epoch"). `: number` tells TypeScript this function always returns a number, never text, never nothing.

We wrap it in our own `now()` instead of calling `Date.now()` everywhere so that every timestamp in the app goes through one door — if the strategy ever needed to change, there'd be one line to edit, not dozens.

---

## `src/db/schema.ts` — the shared columns

```ts
function commonColumns() {
  return {
    id: text("id").primaryKey(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
    syncStatus: text("sync_status").notNull().default("local"),
  };
}
```

**`function commonColumns() {`**
A function with no `export` — it's only used inside this one file, so it doesn't need to be shared.

**`return { ... };`**
Returns an **object** — a bag of labelled things, written between curly braces `{ }`. Each label (like `id:`) names one column; what follows the colon `:` describes that column.

**`id: text("id").primaryKey(),`**

- `id:` — the label. In every table that uses `commonColumns()`, this becomes the `id` column.
- `text("id")` — a function from Drizzle that builds a text (string) column. The `"id"` inside its parentheses is the column's real name _inside the SQLite database_ — it happens to match the label here, but doesn't have to (see `projectId` further down, which becomes `project_id` in the database).
- `.primaryKey()` — the dot means "and then also do this to the thing just built." Marking a column `primaryKey()` means: this column is the row's unique name-tag, and no two rows in the table may ever share the same value here.
- The trailing comma `,` separates this entry from the next one in the object, the same job a comma does in a shopping list.

**`createdAt: integer("created_at").notNull(),`**
`integer(...)` builds a whole-number column instead of a text one — this is where the epoch-millisecond timestamps from `now()` (above) get stored. `.notNull()` means SQLite will refuse to save a row where this column was left empty — every row must have a `createdAt`.

**`deletedAt: integer("deleted_at"),`**
No `.notNull()` here — on purpose. This column is _allowed_ to be empty, and "empty" (SQLite calls it `NULL`) is exactly what "this row hasn't been deleted" means. The moment something _is_ deleted, this column gets filled in with a timestamp instead of being erased — see `docs/UNDERSTANDING.md`, "Why deleting doesn't really delete."

**`syncStatus: text("sync_status").notNull().default("local"),`**
`.default("local")` means: if nothing else says otherwise when a row is inserted, SQLite fills this column in with the text `"local"` on its own. Every row starts as `"local"` because Phase 1 has no server to talk to yet — Phase 3's sync engine is what will ever move this to `"pending"`, `"synced"`, and so on.

**`};`** then **`}`**
The first `}` closes the object (the bag of columns). The `;` ends the `return` instruction, like a full stop ending a sentence. The second `}` closes the function itself. Inner things close before outer things — the same way you'd close a box before closing the drawer you put it in.

### Using it: the `projects` table

```ts
export const projects = sqliteTable("projects", {
  ...commonColumns(),
  name: text("name").notNull(),
  clientName: text("client_name"),
  address: text("address"),
  latitude: integer("latitude", { mode: "number" }),
  longitude: integer("longitude", { mode: "number" }),
});
```

**`export const projects = sqliteTable("projects", { ... });`**

- `export const projects =` — makes a permanently-assigned box named `projects` (`const` means it can never later be pointed at something different), and lets other files import it.
- `sqliteTable(...)` — a Drizzle function that builds a table description from two things: the table's real name in the database (`"projects"`, first argument) and an object describing its columns (second argument, the `{ ... }`).

**`...commonColumns(),`**
The three dots `...` are the **spread operator**. It means "call `commonColumns()`, and instead of putting its whole returned object in as one item, dump every one of _its_ labelled entries directly into _this_ object" — so `projects` ends up with `id`, `createdAt`, `updatedAt`, `deletedAt` and `syncStatus`, exactly as if they'd been typed out by hand here, plus whatever comes after.

**`latitude: integer("latitude", { mode: "number" }),`**
SQLite itself doesn't have a dedicated decimal/float column type the way some databases do. `{ mode: "number" }` is Drizzle-specific: it tells Drizzle "when you read this integer column back out, hand it to TypeScript as a plain JavaScript `number`," which is what lets `latitude`/`longitude` hold values like `40.7128` rather than being forced to whole numbers.

### The inferred types

```ts
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
```

`typeof projects` — not the everyday JavaScript `typeof` (which checks a value's type at runtime) — here, in a `type` position, it asks TypeScript "what is the _shape_ of the `projects` value I just defined above?" `.$inferSelect` is a special property Drizzle attaches to every table: TypeScript reads the whole column list and builds an exact type describing one row as it comes back from a `SELECT`. `.$inferInsert` does the same for what a row needs to look like going _in_ (some columns, like `id`, are still required; others, like `clientName`, are optional because they can be left empty). Because these types are _derived_ from the table definition, they can never drift out of sync with it — there's nothing to hand-maintain.

---

## `src/db/client.ts` — opening the one database file

```ts
export const expoDb = openDatabaseSync("fieldnote.db", { enableChangeListener: true });
export const db = drizzle(expoDb, { schema });
```

**`openDatabaseSync("fieldnote.db", { enableChangeListener: true })`**
A function from `expo-sqlite`. `"fieldnote.db"` is the filename it creates on first launch, inside a folder the app fully controls on the phone — it's created if missing, and simply reopened (with everything still inside it) on every later launch. That single fact is the entire reason an inspection you created yesterday is still there today, and after a force-quit: it's a real file sitting on the phone's storage, not something held only in memory that disappears when the app closes. `enableChangeListener: true` turns on a feature other parts of Drizzle can use to react live to database changes.

**`drizzle(expoDb, { schema })`**
Wraps the raw, low-level `expoDb` connection with Drizzle's typed query layer. Passing `{ schema }` (short for `{ schema: schema }` — when a label and the variable you're assigning it share the same name, JavaScript lets you skip repeating it) is what lets every repository write `db.select().from(inspections)` and get back results whose shape TypeScript already knows, instead of an untyped blob.

---

## `src/repositories/outbox.ts` — appending a note to the tray

```ts
export async function appendOutboxEntry(
  tx: Tx,
  args: {
    entityType: "project" | "inspection" | "template" | "answer" | "attachment";
    entityId: string;
    operation: OutboxOperation;
    payload: unknown;
  },
): Promise<void> {
  await tx.insert(outbox).values({
    id: newId(),
    entityType: args.entityType,
    entityId: args.entityId,
    operation: args.operation,
    payloadJson: JSON.stringify(args.payload),
    attempts: 0,
    nextAttemptAt: now(),
    createdAt: now(),
  });
}
```

**`export async function appendOutboxEntry(tx: Tx, args: { ... }): Promise<void> {`**

- `async` — marks this function as one that does something that takes time (writing to a database) and might need to be waited for. Any function using `async` is allowed to use `await` inside it.
- `tx: Tx` — the first thing this function needs: a transaction handle, typed `Tx` (a type built a few lines above using Drizzle's own types, so it stays correct even if Drizzle's internals change shape later). This is _not_ the same as `db` — it must be the specific transaction the caller is already inside of, so this write becomes part of that same all-or-nothing group (see "Section 5.2" logic explained below).
- `args: { entityType: ...; entityId: string; ...}` — the second thing it needs, itself an object with several labelled fields.
- `entityType: "project" | "inspection" | ...` — the `|` symbol means "must be exactly one of these exact pieces of text, nothing else." TypeScript will refuse to compile code that tries to pass, say, `"projct"` (a typo) or `"user"` (not one of the allowed values).
- `: Promise<void>` — this function eventually finishes, but hands nothing back (`void`) when it does. A `Promise` is JavaScript's wrapper for "a value that isn't ready yet, but will be" — `async` functions always return one.

**`await tx.insert(outbox).values({ ... });`**

- `await` — pause here until this database write actually finishes, before running the next line.
- `tx.insert(outbox)` — start an INSERT into the `outbox` table, as part of transaction `tx`.
- `.values({ ... })` — the actual row to insert, as a labelled object — one entry per column.

**`payloadJson: JSON.stringify(args.payload),`**
`args.payload` can be _any_ shape of data (its type is `unknown` — deliberately: an inserted project looks nothing like an updated inspection). SQLite columns only hold text and numbers, not arbitrary JavaScript objects, so `JSON.stringify(...)` turns whatever object it is into one long piece of text that can be stored — and, later, `JSON.parse(...)` (used by Phase 3, not yet by anything in Phase 1) turns that text back into an object.

**`attempts: 0,`**
A plain number, not a function call — this outbox row has been retried zero times so far. Phase 3's sync engine will increase this each time a send attempt fails.

---

## `src/repositories/inspections.ts` — the transaction pattern

```ts
await db.transaction(async (tx) => {
  await tx.insert(inspections).values(row);
  await appendOutboxEntry(tx, {
    entityType: "inspection",
    entityId: row.id,
    operation: "insert",
    payload: row,
  });
});
```

**`db.transaction(async (tx) => { ... });`**
`db.transaction(...)` takes one argument: a function to run _as_ the transaction. `async (tx) => { ... }` is that function, written in **arrow function** shorthand — `(tx) =>` means "a function that takes one input, `tx`, and does the following." Drizzle calls this function itself and hands it a live transaction handle as `tx`; every database call made using `tx` inside these braces either _all_ succeed together, or — if anything throws an error partway through — _all_ get rolled back together, as if none of them had ever run.

**Why this matters here specifically:** the row insert and the outbox-note insert are two separate database writes. If the app crashed (power loss, force-quit, anything) _between_ those two writes with no transaction wrapping them, you could end up with an inspection that exists on the phone but whose outbox note was never written — a change that will silently never make it to the server, because nothing recorded that it needed to go. Wrapping both in one `db.transaction(...)` makes that specific failure impossible: either both writes land, or neither does.

---

## `src/db/schema.ts` and `drizzle/0001_add_project_notes.sql` — the second migration

```ts
export const projects = sqliteTable("projects", {
  ...commonColumns(),
  name: text("name").notNull(),
  clientName: text("client_name"),
  address: text("address"),
  latitude: integer("latitude", { mode: "number" }),
  longitude: integer("longitude", { mode: "number" }),
  notes: text("notes"),
});
```

One new line — `notes: text("notes"),` — added to a table definition that already existed, no different in shape from `clientName` or `address` right above it (Section 4.1 of the Phase 1 plan is where the pattern for a text column is first explained). No `.notNull()` here, which matters more than usual this time: leaving it out is exactly what keeps every row seeded _before_ this line was added valid — an old row simply has `notes` come back as `null` when read, rather than the database refusing to accept it for having no value in a column it never knew about.

```sql
ALTER TABLE `projects` ADD `notes` text;
```

This is the entire generated migration file, and worth reading as a sentence: `ALTER TABLE` — change the shape of a table that already exists (as opposed to `CREATE TABLE`, which built one from nothing in `0000_init.sql`). `` `projects` `` — which table. `ADD` `` `notes` text `` — add one new column, named `notes`, holding text. Nothing here touches the rows that already exist in the table; it only changes what shape _new_ writes are allowed to have, and gives existing rows `NULL` in the new column by default.

**How this file came to exist:** running `npm run db:generate` after editing `schema.ts` is what produced it — nobody hand-wrote this SQL. Drizzle compared the previous schema snapshot (`drizzle/meta/0000_snapshot.json`) against the new one and worked out, on its own, that the only difference was one added column, which is exactly the diffing Section 2.7 of the Phase 1 plan describes as the reason migrations exist at all instead of just deleting and recreating the database on every schema change.

---

## `src/theme/ThemeProvider.tsx` — reading the phone's light/dark setting

```tsx
const rawScheme = useColorScheme();
const scheme: ColorScheme = rawScheme === "dark" ? "dark" : "light";
```

**`useColorScheme()`**
A **hook** — a special React function, always starting with `use`, that gives a component some capability tied to the running app rather than something you could compute yourself. This one asks the operating system "is the phone currently set to light or dark mode?" and keeps returning the current answer even if the user flips the setting while the app is open.

**`rawScheme === "dark" ? "dark" : "light"`**
This is a **ternary** — a compact if/else written as one expression. Read as: "if `rawScheme` is exactly equal to `"dark"` (`===` checks both the value _and_ the type, which is the comparison to prefer over the looser `==`), the result is `"dark"`; otherwise, the result is `"light"`." It exists because `useColorScheme()` can actually return more values than just `"light"` or `"dark"` — `"unspecified"` on some Android setups, or `null` — and the rest of the app should only ever have to think about two possibilities, not four.

---

## `src/components/Button.tsx` — style as a function of press state

```tsx
style={({ pressed }) => [
  styles.base,
  {
    backgroundColor: backgroundFor[variant],
    opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
  },
]}
```

**`style={({ pressed }) => [ ... ]}`**
On a `Pressable` (React Native's tappable-area component), the `style` prop can be given a _function_ instead of a plain style object. React Native calls that function itself, every time the press state changes, and passes it an object describing the current state — `{ pressed }` here uses **destructuring** to reach straight in and pull out just the `pressed` field (`true` while a finger is actually down on the button, `false` otherwise), instead of naming the whole object and writing `state.pressed` every time.

**`[styles.base, { ... }]`**
React Native styles can be an _array_ of style objects, not just one — they're merged in order, left to right, with later entries winning if the same property appears twice. `styles.base` (defined elsewhere in the file with `StyleSheet.create`) holds the button's fixed layout; the `{ ... }` object next to it holds values that change depending on props and state.

**`opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,`**
Two ternaries chained: read outside-in. If `isDisabled` is true, the opacity is `0.5` (visibly faded, whether it's being pressed or not). Otherwise, check `pressed` — if the finger is currently down, `0.8` (a slight dim, so tapping _feels_ like it did something); otherwise, fully opaque, `1`.

---

## `src/app/_layout.tsx` — blocking the app until the database is ready

```tsx
const { success, error } = useMigrations(db, migrations);
```

**`useMigrations(db, migrations)`**
A hook from Drizzle specifically for Expo SQLite. Given the open database connection (`db`, from `src/db/client.ts`) and the bundle of generated migration files (`migrations`, imported from `drizzle/migrations.js`), it runs every migration that hasn't been applied to _this_ device yet, in order — tracking which ones already ran inside a small bookkeeping table Drizzle manages on its own, so re-opening the app a second time doesn't try to run them all again.

**`const { success, error } = useMigrations(...)`**
`useMigrations` returns an object with (among other things) a `success` field and an `error` field. The curly braces on the left are **destructuring** again — instead of writing `const result = useMigrations(...)` and then `result.success` everywhere after, this pulls `success` and `error` straight out into their own named boxes immediately.

**How the three states are used below this line:** while migrations are still running, `success` is `false` and `error` is `undefined` — the screen shows a spinner. If something goes wrong, `error` becomes a real error object — the screen shows a (deliberately plain, minimally-coded) fallback instead of possibly-broken navigation. Only once `success` is `true` does the actual app (`<Stack>` and every screen inside it) get allowed to render at all — which is exactly the loading gate Section 3.4.3 of the Phase 1 plan requires, so no screen can ever query a table that doesn't exist yet.

---

## `src/db/seed.ts` — splitting a big insert into safe-sized chunks

```ts
function chunk<T>(list: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}
```

**`function chunk<T>(list: T[], size: number): T[][] {`**
`<T>` introduces a **generic** — a placeholder for "whatever type of thing is in this list," decided fresh each time `chunk` is called, rather than this function being locked to one specific type forever. `list: T[]` means "an array of that type"; `T[][]` (the return type) means "an array of arrays of that type" — a list, chopped into smaller lists.

**`for (let i = 0; i < list.length; i += size) {`**
A classic counting loop. `let i = 0` — start a counter at zero (`let`, not `const`, because this one _does_ need to change). `i < list.length` — keep looping as long as that's true. `i += size` — after each pass through the loop body, add `size` to `i` (so with `size = 50`, `i` goes 0, 50, 100, 150…).

**`chunks.push(list.slice(i, i + size));`**
`list.slice(i, i + size)` copies out a portion of `list`: starting at index `i`, up to (but not including) index `i + size`. `chunks.push(...)` adds that portion onto the end of the `chunks` array being built up.

**Why this function exists at all:** SQLite limits how many values a single INSERT statement can bind at once. Five hundred inspection rows, each with about fifteen columns, would be roughly 7,500 values in one statement — over that limit. `chunk(seededInspections, 50)` breaks that one giant insert into 10 inserts of 50 rows each, safely under any reasonable limit, and each chunk is still inserted inside the same transaction so the "all or nothing" guarantee isn't lost.

---

## `babel.config.js` and `metro.config.js` — how a `.sql` file becomes importable

```js
// metro.config.js
config.resolver.sourceExts.push("sql");
```

`config.resolver.sourceExts` is the list of file extensions Metro (the bundler that packages every file into the app) is willing to treat as a source file it can `import`, at all. `.push("sql")` adds one more extension — `sql` — onto that list, the same way `.push()` adds an item onto the end of any array.

```js
// babel.config.js
plugins: [["inline-import", { extensions: [".sql"] }]],
```

Once Metro is willing to _look at_ a `.sql` file, something still has to decide _what an import of one actually becomes_ — and by default, Babel (the tool that translates modern/TypeScript code into something a phone can run) assumes anything it's asked to process is JavaScript, and tries to parse raw SQL text as if it were code, which fails immediately. The `inline-import` Babel plugin intercepts specifically imports ending in `.sql` (`extensions: [".sql"]`) and replaces them, before Babel ever tries to parse them as JS, with the file's exact raw text turned into a plain JavaScript string. That's the difference between `import m0000 from './0000_init.sql'` crashing the bundler and `m0000` simply being a string holding the whole `CREATE TABLE ...` statement, ready for Drizzle's migrator to run.

---

## `scripts/dev-web-coi-proxy.js` — a reverse proxy, piece by piece

This file is dev tooling only (D-008 in `docs/DESIGN.md`) — it exists purely to make `npm run web:coi` preview the database correctly in browsers that support it. Nothing here ships in the real app.

```js
const metro = spawn("npx", ["expo", "start", "--web", "--port", String(METRO_PORT)], {
  stdio: "inherit",
  shell: true,
});
```

**`spawn(...)`** — a Node.js function (from the built-in `child_process` module) that starts a completely separate program running alongside this script, rather than calling a function inside the same process. The first argument, `"npx"`, is the program to run; the array after it is the list of arguments to hand it — the same command you'd type by hand as `npx expo start --web --port 8081`, just split into pieces because that's the shape `spawn` expects.

**`{ stdio: "inherit", shell: true }`** — an **options object**, the second argument. `stdio: "inherit"` means "don't capture this program's output — let it print straight to the same terminal this script is running in," which is why you still see Metro's normal bundling logs when running `npm run web:coi`. `shell: true` runs the command through the operating system's own command shell instead of launching `npx` as a program directly — needed here because on Windows, `npx` is actually a small shell script (`npx.cmd`), not a real `.exe`, and asking Node to launch it directly (without a shell in between to interpret it) fails outright.

```js
const proxy = httpProxy.createProxyServer({
  target: `http://localhost:${METRO_PORT}`,
  ws: true,
});
```

`httpProxy.createProxyServer({ ... })` — from the `http-proxy` package — builds a reusable object whose job is "take a request aimed at me, and forward it somewhere else instead." `target` is that "somewhere else": Metro's real dev server, running on its own port. `ws: true` tells it to also forward WebSocket connections, not just plain HTTP requests — Metro uses a WebSocket to push live-reload updates to the browser, and without this, editing a file while `web:coi` is running would need a manual refresh every time instead of updating itself.

```js
proxy.on("proxyRes", (proxyRes) => {
  proxyRes.headers["Cross-Origin-Opener-Policy"] = "same-origin";
  proxyRes.headers["Cross-Origin-Embedder-Policy"] = "require-corp";
});
```

**`proxy.on("proxyRes", (proxyRes) => { ... })`** — registers a callback to run every time the proxy receives a response back from Metro, just before passing it along to the browser. `"proxyRes"` is the name of this specific event; different tools name their events differently, but the shape — "run this function whenever that thing happens" — is the same idea as `onPress` on a `Button` or `onChangeText` on an `Input` elsewhere in this project.

**`proxyRes.headers["Cross-Origin-Opener-Policy"] = "same-origin";`** — `proxyRes.headers` is a plain object, one property per HTTP response header; setting a new property on it adds that header (or overwrites it, if Metro already sent one by that name) before the response continues on to the browser. This is the entire fix: every single response passing through this proxy — the HTML document, every JS bundle, everything — leaves with these two headers attached, regardless of what generated it on the other side. That "regardless of what generated it" is exactly why this works where trying to add the same headers from inside `metro.config.js` didn't (see D-008): the proxy sits outside Expo's own server entirely, so it can't be skipped by whichever internal handler happens to answer a given request.

```js
const server = http.createServer((req, res) => {
  proxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});
```

`http.createServer((req, res) => { ... })` — Node's built-in way to create an actual HTTP server: give it a function, and that function runs once for every incoming request, with `req` (what the browser asked for) and `res` (what to send back) as its two inputs. Here, the function does nothing itself except immediately hand both off to `proxy.web(...)`, which is what actually talks to Metro and streams its response back.

Plain HTTP requests and the WebSocket upgrade that starts a live-reload connection arrive as two _different_ kinds of events in Node's HTTP server — a normal request triggers the function passed to `createServer`, but a WebSocket handshake triggers a separate `"upgrade"` event instead, which is why forwarding it needs its own line (`proxy.ws(...)`) rather than being handled automatically inside the first function.

## `patches/expo-sqlite+57.0.1.patch` — changing someone else's code without forking it

This isn't hand-written like everything else in this file — it's _generated_, by a tool called `patch-package`, from an edit made directly inside `node_modules/expo-sqlite`. Worth understanding what it actually is and why it's safe to commit.

**The problem it solves:** `node_modules/` is never committed to git (see `.gitignore`) — every teammate, and every CI machine, regenerates it fresh from `package.json` by running `npm install`. If you hand-edit a file inside `node_modules` and just leave it there, that edit vanishes the moment anyone (including you, later) reinstalls dependencies.

**What `patch-package` actually does:** running `npx patch-package expo-sqlite` compares the edited files inside `node_modules/expo-sqlite` against a freshly-downloaded, untouched copy of the same package, and writes out _only the difference_ as a plain text `.patch` file (the same diff format `git diff` produces) — small, human-readable, and safe to commit because it contains no copy of the package itself, only the lines that changed.

```json
"scripts": {
  "postinstall": "patch-package"
}
```

**`"postinstall"`** is one of several special script names npm recognizes and runs automatically — this one fires every time `npm install` finishes. Its job here is to immediately reapply every `.patch` file found in `patches/` to the just-installed, unpatched `node_modules`, so the edit is back in place within seconds of any fresh install, with nobody needing to remember to redo it by hand.

**What happens if `expo-sqlite` is later upgraded and the patch no longer fits:** `patch-package` fails loudly — the `npm install` itself errors out, rather than silently dropping the fix. That's deliberate: a patch that quietly stopped applying would be far worse than one that makes noise about needing attention.
