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

## `src/theme/tokens.ts` — one file, two palettes

```ts
export const palettes = {
  light: {
    bg: "#FFFFFF",
    // ...
  },
  dark: {
    bg: "#0B1220",
    // ...
  },
} as const;

export type ColorScheme = keyof typeof palettes;
export type Palette = (typeof palettes)[ColorScheme];
```

**`export const palettes = { light: {...}, dark: {...} } as const;`**
One object, two labelled entries, each itself an object of colour names to hex strings. `as const` — seen before on `spacing`/`radius` — locks every value to its exact literal type (`"#FFFFFF"`, not just `string`), which is what makes the two type lines below possible.

**`export type ColorScheme = keyof typeof palettes;`**
`typeof palettes` — in a _type_ position (not a value position, where `typeof` means something else in plain JavaScript) — asks TypeScript "what is the shape of this object?" `keyof` then asks "what are its label names?" The result: `ColorScheme` becomes the type `"light" | "dark"` — automatically, from the object itself, rather than someone typing that union out by hand and risking it drifting out of sync if a third palette were ever added.

**`export type Palette = (typeof palettes)[ColorScheme];`**
Reading one property's type out of another type, the same way `palettes.light` would read one property's _value_ out of an object — except this happens at the type level, before the app ever runs. Because `ColorScheme` is `"light" | "dark"`, this indexes with _both_ at once, producing "the shape a palette has" as its own reusable type, used by `ThemeProvider.tsx`'s `Theme` type so `theme.colors.primary` is checked against the real palette shape, not typed as `any`.

## `src/components/Screen.tsx` — the wrapper every screen uses

```tsx
export function Screen({ style, padded = true, children, ...rest }: ScreenProps) {
```

**`{ style, padded = true, children, ...rest }`**
**Destructuring** with a **default value**: pull `style`, `padded` and `children` out of the props object by name, and — new here — `padded = true` means "if the caller didn't pass `padded` at all, use `true` instead of `undefined`." Every screen in the app gets padding for free unless it explicitly opts out. `...rest` gathers up whatever other props were passed (Section on `Button`/`Card` uses the same pattern) so they can be forwarded on without naming each one.

```tsx
<SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.bg }]} edges={["top"]}>
```

**`SafeAreaView`** (from `react-native-safe-area-context`, not React Native's own built-in one, which is iOS-only and considered legacy) — a component that adds padding matching the phone's own unsafe zones: the notch, the status bar, the home-indicator bar. **`edges={["top"]}`** — only pad the _top_ edge, not all four; the bottom is deliberately left to the tab bar (rendered outside this component) to handle its own spacing, so the two don't double up padding.

```tsx
padded && { padding: theme.spacing.md },
```

Inside the style array: `&&` here isn't a comparison, it's a shortcut. JavaScript evaluates the left side first — if `padded` is `false`, the whole expression evaluates to `false`, and React Native's style array simply skips a `false` entry (same as `null`) when merging styles. If `padded` is `true`, the expression evaluates to the object on the right, which _does_ get merged in. One line doing the job an `if` statement would otherwise need.

## `src/components/Card.tsx` — one component, two different things it can become

```tsx
if (onPress) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...cardStyle, { opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

return (
  <View style={cardStyle} {...rest}>
    {children}
  </View>
);
```

A component is allowed to `return` different JSX depending on a condition, same as any other function returning different values down different code paths. Here: if the caller passed an `onPress` function, a `Card` becomes a tappable `Pressable` (Section on `Button` explains the `({ pressed }) => [...]` style-function pattern); if not, it's a plain, non-interactive `View`. Every list row in the Projects and Inspections screens passes `onPress`; nothing else in the app currently needs the plain form, but the option exists rather than forcing every `Card` to be tappable whether that makes sense or not.

**`[...cardStyle, { opacity: ... }]`**
The spread operator again, this time spreading an _array_ (`cardStyle`, built a few lines above from the theme) into a new array, with one more style object appended after it. Same idea as spreading an object's properties (`...commonColumns()` in `schema.ts`) — "take everything already in here, then add this."

## `src/components/Input.tsx` and `EmptyState.tsx` — the `? ... : null` pattern, used everywhere

```tsx
{
  label ? (
    <Text variant="label" muted>
      {label}
    </Text>
  ) : null;
}
```

This exact shape — a ternary whose "otherwise" branch is `null` — is how JSX says "show this, or show nothing at all." `null` is one of a small handful of values React treats as "render nothing here" (others: `undefined`, `false`, an empty string) — it does _not_ mean "show an empty `<View>`," it means the whole conditional block leaves no trace in the rendered output. `Input`'s label and error message, and `EmptyState`'s optional `message`, all use this to appear only when there's actually something to show.

## `src/components/Badge.tsx` — a lookup table instead of an `if`/`else` chain

```tsx
const colorFor: Record<InspectionStatus, string> = {
  draft: theme.colors.textMuted,
  in_progress: theme.colors.warning,
  completed: theme.colors.success,
  submitted: theme.colors.primary,
};

const color = colorFor[status];
```

**`Record<InspectionStatus, string>`** — a TypeScript **utility type**: "an object whose keys are exactly the members of `InspectionStatus` (`"draft" | "in_progress" | "completed" | "submitted"`, from `schema.ts`) and whose values are all `string`." Because the key type is that specific union rather than plain `string`, TypeScript checks this object has _every_ status accounted for — miss one, like forgetting `submitted`, and this line itself fails to compile, long before anyone notices a badge rendering with no colour. Reading `colorFor[status]` afterwards is then a plain lookup, not a chain of `if (status === "draft") ... else if (status === "in_progress") ...` that would need to be extended by hand every time a new status was ever added.

**`backgroundColor: color + "22"`**
String concatenation — not addition, since `color` is text like `"#2563EB"`. Hex colours can carry an optional two extra digits for opacity (**alpha**); appending `"22"` (roughly 13% opacity in that encoding) turns a solid colour into a soft, tinted background for the pill, reusing the exact same colour as the text on top of it instead of picking a separate, unrelated background shade.

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

---

# The preview-mode fallback (D-013)

## `src/db/client.ts` — catching a failure that used to crash the whole app

```ts
export let db: DrizzleDb | null = null;
export let dbInitError: Error | null = null;

try {
  expoDb = openDatabaseSync("fieldnote.db", { enableChangeListener: true });
  db = drizzle(expoDb, { schema });
} catch (e) {
  dbInitError = e instanceof Error ? e : new Error(String(e));
  console.warn(/* ... */);
}
```

**`export let db: DrizzleDb | null = null;`**
Previously this was `export const db = drizzle(...)` — a `const` that was _always_ a working database, because if `drizzle(...)` (or the `openDatabaseSync(...)` before it) ever threw, the whole app crashed immediately, before this line ever finished. `let ... | null` says something different: "this box starts empty, and might end up holding a real database, or might not" — TypeScript now forces every piece of code that reads `db` to consider the possibility it's `null`, rather than trusting a promise that no longer always holds.

**`try { ... } catch (e) { ... }`**
The exact same shape used elsewhere in this project (`parseTemplateSchema`, Day 1 of Phase 2) — run the risky code, and if it throws, land in `catch` instead of taking the whole app down with it.

**`dbInitError = e instanceof Error ? e : new Error(String(e));`**
JavaScript allows `throw` to be given literally anything — a string, a number, not just a proper `Error` object. `e instanceof Error` checks which kind this particular one is; if it already is one, use it as-is; if not (rare, but possible), wrap whatever it was in a real `Error` so the rest of the app can rely on `dbInitError` always having the shape an `Error` has (a `.message`, a `.stack`), never guessing.

## `src/db/client.ts` — the two functions repositories actually call

```ts
export function isDbAvailable(): boolean {
  return db !== null;
}

export function requireDb(): DrizzleDb {
  if (!db) {
    throw new Error(
      "requireDb() called while the database is unavailable — check isDbAvailable() first.",
    );
  }
  return db;
}
```

**Why two functions instead of just checking `db` directly everywhere:** `isDbAvailable()` is what every repository function asks _first_, before doing anything else — plain, readable, no cast needed. `requireDb()` exists for the moment right after that check has already passed: `db` is `DrizzleDb | null` as far as TypeScript is concerned everywhere else, but inside a repository function that has already returned early when `!isDbAvailable()`, we _know_ it's real. `requireDb()` is the one, single place that turns "I know this is fine" into an actual non-null value TypeScript agrees with — instead of every repository function individually writing `db!` (a manual, unchecked promise to the compiler) and hoping it's true.

## `src/repositories/inspections.ts` — the shape every repository function now follows

```ts
export async function listInspections(filter?: InspectionFilter): Promise<Inspection[]> {
  if (!isDbAvailable()) return mock.listInspections(filter);
  const db = requireDb();
  // ...real Drizzle query...
}
```

Read as a sentence: "if there's no real database, hand back whatever the mock store says instead — otherwise, get a guaranteed-real `db` and continue exactly as before." The line `const db = requireDb();` **shadows** the `db` imported from `@/db/client` — inside this function, from this line down, `db` refers to the guaranteed-non-null local constant, not the possibly-null module export of the same name. This is deliberate, not an accident: every line below reads exactly as it did before this feature existed, because it's now working with a local `db` TypeScript is satisfied is real.

## `src/repositories/projects.ts` — building an input type out of pieces of another type

`projects.ts` follows the exact same shape as `inspections.ts` just above — same `isDbAvailable()` early-return, same `requireDb()` shadowing, same one-transaction-plus-outbox-entry pattern for every write. The one genuinely new idea in this file is its input type:

```ts
export type NewProjectInput = Pick<NewProject, "name" | "clientName" | "address"> &
  Partial<Pick<NewProject, "latitude" | "longitude" | "notes">>;
```

`NewProject` (from `schema.ts`) is the _full_ shape of a row ready to insert — every column, including ones like `id`, `createdAt`, and `syncStatus` that `createProject` fills in itself and should never be handed in from the outside by a screen. `NewProjectInput` is a smaller, purpose-built type describing only what a screen is actually allowed to supply.

- **`Pick<NewProject, "name" | "clientName" | "address">`** — another TypeScript utility type (`Record<K,V>` was the first one, back in `Badge.tsx`): "take the `NewProject` type, and keep only these three named fields, with the exact same types they have there." These three are required — a screen must supply a `name`, `clientName`, and `address` (even if `clientName`/`address` are individually allowed to be `null` inside `NewProject` itself).
- **`Partial<Pick<NewProject, "latitude" | "longitude" | "notes">>`** — `Pick` first narrows down to just `latitude`, `longitude`, and `notes`; `Partial<...>` wrapped around that then makes all three of _those_ **optional**, meaning a caller can leave any or all of them out entirely (as opposed to `null`, which is a value — `Partial` is about the key not being present at all).
- **`&`** — TypeScript's **intersection** operator: "a value of this type must satisfy the left side _and_ the right side at once." The result is a single object type with three required fields and three optional ones.

**Why not just reuse `NewProject` directly as the input type:** if `createProject`'s parameter were typed as plain `NewProject`, nothing would stop a screen from passing in its own `id`, or a fake `createdAt`, or a `syncStatus` other than `"local"` — all things this function is supposed to decide for itself, seen a few lines below where `row` is actually built. Building a smaller, deliberately-restricted input type makes those mistakes impossible to even attempt — the compiler rejects the call before the code ever runs, rather than a bug slipping through because the type was too permissive.

## `src/db/mockStore.ts` — module-level `let`, on purpose

```ts
let projectsStore: Project[] = seedProjects();
let inspectionsStore: Inspection[] = seedInspections(projectsStore, templatesStore);
```

Every other piece of state in this project lives inside SQLite, a component's `useState`, or a repository's function scope — this is the one place holding onto data in a plain **module-level `let`**, meaning it exists for as long as this file stays loaded in memory and is shared by anything that imports it. It intentionally does _not_ survive a page reload — reloading the page re-runs this file from scratch, calling `seedProjects()`/`seedInspections()` again and throwing away whatever changes were made, which is exactly the "changes aren't saved" behavior the preview-mode banner warns about.

## `src/app/(tabs)/inspections.tsx` — the filterable inspections list

This is the busiest screen in Phase 1, so it's worth going slowly.

```ts
type StatusFilter = "all" | InspectionStatus;
```

`InspectionStatus` (from `schema.ts`) is already a union like `"draft" | "in_progress" | "completed" | "submitted"` — every real status a row can have. But the filter chip row also needs an "All statuses" option that isn't a real status at all. Rather than making `"all"` secretly mean "no filter" inside a variable typed `InspectionStatus` (which would be a lie to the type checker), a _new_, slightly bigger union is declared that's every real status **plus** the literal string `"all"`. Now the variable holding the current filter can honestly hold either kind of value, and TypeScript will complain if it's ever set to anything else — a typo like `"stauts"` would be caught immediately.

```ts
const [inspectionList, setInspectionList] = useState<Inspection[]>([]);
const [projectList, setProjectList] = useState<Project[]>([]);
const [projectFilter, setProjectFilter] = useState<string | "all">("all");
const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
const [loading, setLoading] = useState(true);
```

Five independent pieces of state: the rows currently on screen, the full project list (needed just to build the project filter chips and to translate a project id into a readable name), which filter chip is selected in each of the two rows, and whether a load is in flight right now.

```ts
const load = useCallback(() => {
  setLoading(true);
  return Promise.all([
    listInspections({
      projectId: projectFilter === "all" ? undefined : projectFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    listProjects(),
  ])
    .then(([rows, projects]) => {
      setInspectionList(rows);
      setProjectList(projects);
    })
    .finally(() => setLoading(false));
}, [projectFilter, statusFilter]);
```

`load` asks the repository layer for two different things **at the same time** rather than one after another — `Promise.all([a, b])` starts both `listInspections(...)` and `listProjects()` immediately and waits for whichever finishes last, instead of waiting for the inspections to fully finish before even starting the projects request. That's strictly faster when the two requests don't depend on each other, which they don't here.

The ternaries inside the object passed to `listInspections` are the actual filtering logic: "if the currently-selected project filter is the special `'all'` value, don't pass a `projectId` to the repository at all (`undefined` means 'no filter' to `listInspections`); otherwise pass the real id." Same idea for `status`.

`.then(([rows, projects]) => {...})` is **array destructuring** on the result of `Promise.all` — it resolves to a two-item array `[inspectionsResult, projectsResult]` in the same order the promises were listed, and destructuring immediately unpacks that into two clearly-named variables instead of writing `result[0]` and `result[1]`.

`.finally(() => setLoading(false))` runs whether the promise chain above it succeeded or threw — this is what guarantees the loading spinner state always gets turned off, even if one of the two repository calls fails.

`useCallback(..., [projectFilter, statusFilter])` means: rebuild this `load` function only when either filter actually changes. If it were rebuilt on every render, the `useFocusEffect` below (which depends on `load`) would think its dependency changed on every render too, and would refetch constantly for no reason.

```ts
useFocusEffect(
  useCallback(() => {
    let cancelled = false;
    load().catch((e) => {
      if (!cancelled) console.error(e);
    });
    return () => {
      cancelled = true;
    };
  }, [load]),
);
```

`useFocusEffect` (from Expo Router, not React itself) runs its callback every time this screen becomes the visible tab — including navigating back to it, not just the very first mount. That matters here: if you create a new inspection on the "New Inspection" screen and tap back, this list needs to refetch so the new row actually shows up, not just on first app launch.

The `cancelled` flag is the standard fix for a subtle race: if you flip tabs away _before_ `load()` finishes, and then the promise resolves late, calling `setInspectionList` on a screen that's no longer focused/mounted would be wasted work (and in stricter setups, a warning). The `return () => { cancelled = true }` is React's **cleanup function** — it runs automatically right before this effect runs again (e.g. leaving the screen), and setting the flag means the `.catch` handler checks `cancelled` before logging, so a stale error from an abandoned request is silently ignored rather than logged as if it were current.

```ts
const projectNameById = useMemo(() => {
  const map = new Map<string, string>();
  for (const p of projectList) map.set(p.id, p.name);
  return map;
}, [projectList]);
```

Each inspection row only stores a `projectId`, not the project's name — that's normal database design (don't duplicate the name in every inspection row; look it up). But looking up a name by scanning the whole `projectList` array _for every single inspection row_ while rendering a long list would be slow. `useMemo` builds a `Map` — `id → name` — exactly once whenever `projectList` changes, so that later, rendering each row can do an instant `projectNameById.get(item.projectId)` lookup instead of an array scan.

```ts
function FilterRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { key: T; label: string }[];
  selected: T;
  onSelect: (key: T) => void;
}) {
```

This is a **generic component** — `<T extends string>` means "this component works with any string-based type `T`, and TypeScript should figure out which one from how it's actually used." The project filter row is called with `options` whose `key` is a project id (`string`) or `"all"`; the status filter row is called with `options` whose `key` is an `InspectionStatus` or `"all"`. Writing `FilterRow` once, generically, means both filter rows share one component and one set of styling/scroll behavior, while `onSelect` still gets called with the _correctly narrowed_ type each time (a status filter's `onSelect` receives a `StatusFilter`, not a bare `string`) — TypeScript checks this even though the component's code is written only once.

```ts
backgroundColor: active ? theme.colors.primary + "22" : theme.colors.surface,
```

Same "append two hex digits for opacity" trick already explained for `Badge.tsx` — `"22"` here means roughly 13% opacity, a much fainter tint than the more visible one used on badges, appropriate for a background wash behind a chip rather than a solid badge fill.

## `src/app/(tabs)/settings.tsx` — dev tools and a database-reset confirmation

```ts
const [counts, setCounts] = useState({ projects: 0, inspections: 0, outbox: 0 });
```

One object holding three numbers, rather than three separate `useState` calls — a reasonable choice when the three values are always read and written together (they're both set at once inside `refreshCounts`, never independently).

```ts
const refreshCounts = useCallback(async () => {
  const [projects, inspections, outboxTotal] = await Promise.all([
    listProjects(),
    listInspections(),
    countOutboxEntries(),
  ]);
  setCounts({ projects: projects.length, inspections: inspections.length, outbox: outboxTotal });
}, []);
```

Same `Promise.all` + array-destructuring pattern as `inspections.tsx`'s `load`, just with three requests instead of two, and this function is declared `async` so `await` can be used directly instead of chaining `.then(...)`. `useFocusEffect` below calls this every time the Settings tab becomes visible, so the counts shown are always fresh — including right after a reseed, or after creating/deleting an inspection on another tab.

```ts
const handleReseed = () => {
  Alert.alert(
    "Reset & reseed database?",
    "This deletes every project, template and inspection...",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset & Reseed",
        style: "destructive",
        onPress: async () => { ... },
      },
    ],
  );
};
```

`Alert.alert(title, message, buttons)` is React Native's built-in native confirmation dialog — no custom modal component needed. The third argument is an array of button descriptors: a plain `"Cancel"` button that just dismisses (`style: "cancel"` only affects how it looks on iOS — it doesn't run any code), and a second button whose `style: "destructive"` renders it in a warning color (red on iOS) as a visual signal that this action deletes data, whose `onPress` is where the actual reseed happens. This is exactly why the button only _offers_ the action — nothing destructive runs until the user explicitly taps the second, clearly-labeled button in the native dialog, one extra deliberate step past the initial screen tap.

Inside `onPress`, a standard try/catch/finally: `setReseeding(true)` before starting (so the button can show a loading spinner and presumably disable itself while the reseed is in progress — see `Button`'s `loading` prop, covered above), the real work (`resetAndReseed()` then `refreshCounts()`) inside `try`, a friendly `Alert.alert("Done", ...)` on success, an equally friendly `Alert.alert("Reseed failed", ...)` if something throws, and `setReseeding(false)` in `finally` so the loading state always clears — succeed or fail — the same "finally always runs" guarantee explained for `load` above.

---

## Phase 2 additions (new files and concepts)

The Phase 2 work adds a small set of files to make templates render into data-driven forms, to store answers and attachments, and to perform runtime validation before marking an inspection complete. Each of the new symbols below is explained so a complete beginner can follow.

### `src/components/FormRenderer.tsx` — render a JSON template into fields

- This component reads a template's `schemaJson`, parses it, and turns every `section.fields` array into visual inputs using a `.map()` over the array. Each `field` has a `key`, `type` and `label`. The renderer keeps a local `answersMap` (an object whose keys are `fieldKey` and values are the current field value) and updates it immediately on change.
- Autosave: a small debounce per-field waits 500ms after the last keystroke before calling the repository `saveAnswer(...)`. This is implemented with `setTimeout` and a `Map` of timers so typing a long note doesn't write the database on every character.
- Field types implemented pragmatically: `text`, `longtext`, `number`, `select`, `multiselect` (as comma-separated), `boolean` (simple toggle), and placeholders for `photo` and `gps` that integrate with the attachments repository. Photo/GPS call sites are intentionally small and documented — the real native camera/GPS implementation requires device testing and is left in a clearly-marked placeholder state so Phase 2 can be iterated safely.

Why a component like this?

- It demonstrates data-driven rendering (Section 2.1): the same renderer works for any template JSON you seed into `templates.schema_json`, which is the whole point of the exercise. The `key` prop used on the `.map()` entries keeps React from confusing one field for another when the list changes.

### `src/repositories/answers.ts` — where field answers are stored

- Exposes `getAnswers(inspectionId)` and `saveAnswer(inspectionId, fieldKey, value)`.
- `saveAnswer` follows the project's repository rules: one transaction, set `updated_at`, insert-or-update the `answers` row, and append an `outbox` entry.
- Autosave de-duplication: when updating an existing answer we delete any existing `outbox` rows for that answer and append a fresh `update` outbox entry. This keeps the outbox compact (no 200 rows for a 200-character note) while ensuring Phase 3 still has the latest state to send.

Why the delete-then-insert approach?

- It's simple, runs inside the same transaction, and ensures the outbox contains only the most recent pending state for that answer. Phase 3 could instead deduplicate when draining the queue; both approaches are acceptable — one must be chosen and documented (done here in `docs/DESIGN.md`).

### `src/repositories/attachments.ts` — adding and removing photo/signature rows

- Exposes `listAttachmentsForInspection(inspectionId)`, `createAttachment(...)` and `deleteAttachment(id)`.
- `createAttachment` is designed to be called after the UI has written the compressed file to disk: it records `localUri`, `mimeType`, `byteSize`, dimensions, and appends an outbox `insert` entry inside the same transaction so Phase 3 can later upload the file and set `remote_url`.
- `deleteAttachment` sets `deleted_at` (soft-delete) and appends an outbox `delete` note.

Why files are created by the UI and only paths are stored in the DB

- Storing bytes in SQLite is slow and memory-hungry. The file system is the right place for binary files; the DB stores the path and small metadata only.

### `src/lib/validation.ts` — lightweight runtime schema checks

- Phase 2 requires runtime validation derived from the template JSON. Rather than add a whole new dependency here (Zod), this Phase 2 work ships a small, explicit validator that understands `required`, `min`, `max`, `maxLength`, and `select` option membership.
- `buildValidator(schema)` returns a `validate(answers)` function that returns an `errors` object mapping `fieldKey` to a short human-readable message. `inspections/[id].tsx` calls this before allowing the status to change to `completed` so visible validation errors block completion with a clear `Alert`.

Trade-off: Zod vs small custom validator

- Zod is a powerful, well-tested library and the plan explicitly recommends it. For safety in this environment (avoiding risky native dependency changes) a minimal validator here covers the Phase 2 acceptance criteria while keeping the repo install-free. If you prefer Zod, it's straightforward to replace `buildValidator` with a runtime Zod generator later; the code locations are small and well-documented.

---

End of Phase 2 BABY additions. Add more line-by-line explanations here as new small helper functions and components are introduced in the phase.

### New symbols added in this session (media & signature)

- src/lib/media.ts — takePhotoAndCompress, getLocationWithTimeout
  - takePhotoAndCompress(inspectionId, fieldKey): opens the system camera (via expo-image-picker), resizes and compresses the captured image using expo-image-manipulator (target long edge ~1600px, quality ~0.7), writes the compressed file and a 200px thumbnail into documentDirectory/attachments/{inspectionId}/ and returns an object { localUri, mimeType, byteSize, width, height, thumbLocalUri }.
  - getLocationWithTimeout(timeoutMs): requests foreground location permission (expo-location), races a getCurrentPositionAsync call against a timeout (default 10s), and returns { latitude, longitude, accuracy } or { error: "permission-denied" | "timeout" | "no-native" } so the app can degrade gracefully.
  - Why dynamic imports: these helpers use dynamic import(...) so the web preview and CI do not crash when native expo packages are not installed. The code checks for permission-denied and missing-native-package cases and returns small error objects for the UI to handle.

- src/components/SignaturePad.tsx — a guarded signature modal
  - Presents a full-screen modal that dynamically imports react-native-signature-canvas and returns a base64 PNG when the user saves. When the package is not available the component shows a simple message so the caller can fallback to a placeholder behavior.
  - The signature base64 is written to a PNG file under documentDirectory/attachments/{inspectionId}/signature-{fieldKey}-{id}.png when expo-file-system is available, then an attachment row is created in the DB via createAttachment(...).

- src/components/FormRenderer.tsx (updates)
  - FieldComponent: extracted and memoized so individual fields skip re-render when unrelated fields change. This is important for large (60-field) forms to stay smooth.
  - scheduleSave and immediateSave are stabilized with React.useCallback so the memoized FieldComponent receives stable handler references and memoization actually works.
  - Photo field now calls takePhotoAndCompress and persists the compressed file metadata through the attachments repository; when native packages or permissions are missing it falls back to the previous placeholder attachment behavior so web preview remains useful.
  - GPS field calls getLocationWithTimeout and stores the returned { latitude, longitude, accuracy } as a JSON answer; on permission denial or missing native modules it falls back to a dummy value but does not block completion.
  - Signature field opens SignaturePad; saved base64 is written to disk (if FileSystem available) and persisted as an attachment row. If native signature support is missing, the flow falls back to creating a placeholder attachment row.

All of the new code is documented in docs/BABY-PHASE-2-MEDIA.md with beginner-friendly explanations and testing tips. Remember: when you change code, update this file with every new symbol so a reader with no experience can follow along — this is the teaching contract for the project.

---

## Fixing the Phase 2 merge (2026-09-13) — new symbols and patterns

The Phase 2 code above was merged from outside this project's usual sessions and, on actually running `npm run typecheck`/`npm run lint` (see `docs/DESIGN.md` D-016), didn't pass. Fixing it introduced a few new ideas worth explaining.

### `expo-file-system`'s new class-based API

```ts
const { Directory, File, Paths } = await import("expo-file-system");
const folder = new Directory(Paths.document, "attachments", inspectionId);
folder.create({ intermediates: true, idempotent: true });
const dest = new File(folder, `${fieldKey}-${id}.jpg`);
await new File(manipResult.uri).copy(dest);
```

Older versions of `expo-file-system` worked with plain path strings and standalone functions (`FileSystem.documentDirectory`, `FileSystem.writeAsStringAsync(path, ...)`). The version this project actually has installed replaced that with **objects that represent a file or folder** — `new Directory(...)` and `new File(...)` — and methods that live _on_ those objects instead of taking a path string as an argument. `Paths.document` is a ready-made `Directory` object pointing at the app's private document storage; passing it as the first argument to `new Directory(Paths.document, "attachments", inspectionId)` means "a subfolder of the document directory, named `attachments/<that inspection's id>`" — the constructor joins the pieces for you. `folder.create({ intermediates: true, idempotent: true })` makes that folder exist: `intermediates` means "create parent folders too if they're missing," and `idempotent` means "don't throw an error if the folder is already there" — both matter because this code runs every time a photo is taken, not just the first time. `new File(folder, "name.jpg")` builds a reference to a file _inside_ that folder, and `.copy(destination)` copies one file's contents to another file's location — here, moving the temporary compressed image the image-manipulation library produced into this app's own permanent folder.

**Why this matters beyond just fixing an error:** `AGENTS.md` at the top of this project says, in effect, "check the exact current docs before writing Expo code, because APIs change between SDK versions." This is the concrete example of why: the exact same _idea_ ("save this file, in this folder") is expressed in a structurally different way a few SDK versions later, and code written against the old shape doesn't just work slightly differently — it fails to even compile, because the old function names no longer exist at all.

### `isFieldVisible()` — the fix for a field that rendered when it should have been hidden

```ts
function isFieldVisible(field: any, answers: Record<string, any>): boolean {
  if (!field.visibleIf) return true;
  const other = answers[field.visibleIf.field];
  return Boolean(other) && Boolean(field.visibleIf.in?.includes(other));
}
```

A template field can carry a `visibleIf` rule — for example, "only show `damage_photos` when `roof_condition` is `fair` or `poor`." `src/lib/validation.ts` already had a version of this check, but only for validation (skip a hidden field when deciding if the form is complete) — nothing was using the same rule to actually decide what to _draw on screen_, so a hidden field wasn't hidden at all, it just wasn't required.

Reading it line by line: `if (!field.visibleIf) return true` — a field with no rule at all is always visible, the common case. `answers[field.visibleIf.field]` looks up the _other_ field's current answer (e.g. whatever `roof_condition` is currently set to). `field.visibleIf.in?.includes(other)` checks whether that current value is in the rule's allowed list — the `?.` (optional chaining) guards against a rule that doesn't have an `in` list at all, so this doesn't crash on other `visibleIf` shapes the type technically allows. Wrapping both checks in `Boolean(...)` guarantees the function always returns a real `true`/`false`, never `undefined` from a missing lookup — useful because this return value feeds straight into an array's `.filter(...)`, which expects a boolean back, not "something falsy."

This function is then used as: `section.fields.filter((field) => isFieldVisible(field, answersMap)).map(...)` — filtering the list of fields _before_ turning them into components, so a hidden field genuinely never renders, rather than rendering and somehow being invisible.

### Why the autosave timers moved from `useMemo` to `useRef`

```ts
const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
```

The autosave code needs one small piece of state that isn't really _data the screen displays_ — it's bookkeeping: "is there already a pending save for this field, and if so, what's its timer ID so I can cancel it?" The original code built this `Map` with `useMemo(() => new Map(), [])`, then called `.set(...)`/`.delete(...)` on it directly from inside event handlers.

The problem: `useMemo` is meant for values React treats as **read-only snapshots** — computed once, then left alone until a dependency changes and it's computed fresh. Reaching in and mutating that snapshot's contents (`.set`, `.delete`) works today, but it's exactly the kind of thing a newer ESLint rule (`react-hooks/immutability`) is specifically built to catch, because it can misbehave under upcoming React optimizations that assume `useMemo` values are never touched after creation.

`useRef` is the hook built for precisely this need: "give me a mutable box that survives re-renders, but changing what's inside it should never itself cause a re-render." `useRef(new Map())` creates that box once; `timersRef.current` is the actual `Map` inside it, and mutating _that_ — `timersRef.current.set(fieldKey, id)` — is exactly what refs are documented and expected to be used for. Nothing about the autosave behavior changed; only which hook is doing the holding.

---

## Phase 3, Day 1 — logging in

### `src/lib/supabase.ts` — the one client, and a platform-conditional adapter

```ts
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ...");
}
```

`process.env.EXPO_PUBLIC_SUPABASE_URL` — Expo's build tooling reads `.env` at build/start time and makes any variable whose name starts with `EXPO_PUBLIC_` available here, baked into the JS bundle. The `EXPO_PUBLIC_` prefix is not decoration — it's the one signal Expo looks for to know "yes, it's safe and intended for this value to end up inside the app that ships to a phone," as opposed to a secret that should only ever exist on a server. That's exactly why only the URL and the anon/publishable key get this prefix — never the database password.

Throwing immediately when either is missing, right at import time, is deliberate: without it, the app would boot, and the _first_ attempt to actually talk to Supabase (e.g. signing in) would fail with a confusing network error deep inside a library, far from the real cause. Failing loudly, immediately, at the one place the mistake actually happened, is easier to debug than failing quietly somewhere else later.

```ts
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
```

Supabase's client doesn't know what `expo-secure-store` is — it only knows how to talk to _any_ object with a `getItem`/`setItem`/`removeItem` shape (this pattern, wrapping one library's API to match the shape a different library expects, is called an **adapter**). `expo-secure-store`'s real functions are named `getItemAsync`/`setItemAsync`/`deleteItemAsync` — this object is a thin translation layer, renaming and re-wiring three function calls so Supabase can use them without knowing anything about SecureStore specifically.

```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === "web" ? webStorageAdapter : secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

`Platform.OS` is React Native's built-in way of asking "what am I actually running on right now?" — it's `"ios"`, `"android"`, or `"web"`, decided at runtime, not at build time, so the exact same compiled JavaScript can make a different choice on different devices. `Platform.OS === "web" ? webStorageAdapter : secureStoreAdapter` reads as "use the web-safe adapter only on web; every real phone uses the real encrypted one" — a ternary picking between two objects, not two different app builds.

`autoRefreshToken: true` and `persistSession: true` are Supabase's own settings, not this app's code — they mean "when the short-lived access token is about to expire, quietly fetch a new one in the background," and "remember the session across restarts by writing it to whichever `storage` was configured above." `detectSessionInUrl: false` turns off a web-only feature (reading a session out of the page's own URL, used for magic-link/OAuth redirects) this app doesn't use, so it isn't left half-configured and unused.

### `src/auth/AuthProvider.tsx` — the pattern, once more, applied to a new kind of state

If `ThemeProvider` (theming) and `isDbAvailable()`/`requireDb()` (the database) both felt familiar, that's deliberate — this file is the exact same idea a third time: **one piece of shared state, owned by exactly one file, read everywhere else through one hook.**

```ts
const AuthContext = createContext<AuthState | null>(null);
```

`createContext` is a React feature for sharing a value with every component _underneath_ a `<Provider>` in the tree, without having to manually pass it down as a prop through every single component in between (imagine `Screen` → `Stack` → `Tab` → `SettingsScreen`, each one having to accept and forward a `session` prop it never actually uses itself — `Context` skips all of that). The `| null` starting value is what makes `useAuth()`'s safety check below possible — see next.

```ts
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() was called outside <AuthProvider> — check src/app/_layout.tsx");
  }
  return ctx;
}
```

`useContext(AuthContext)` reads whatever value the nearest `<AuthContext.Provider>` above this component in the tree is currently holding. If nothing rendered a `<AuthProvider>` at all (a mistake, not a normal runtime state), `useContext` would just return the context's original `null` default — the `if (!ctx) throw` turns that silent `null` into a loud, specific error naming the exact fix, the moment it happens, rather than a mysterious "cannot read property of null" three function calls later inside whatever tried to use `ctx.session`.

```ts
useEffect(() => {
  let cancelled = false;

  supabase.auth.getSession().then(({ data }) => {
    if (!cancelled) {
      setSession(data.session);
      setLoading(false);
    }
  });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
    setSession(newSession);
  });

  return () => {
    cancelled = true;
    listener.subscription.unsubscribe();
  };
}, []);
```

Two separate things are set up here, and it matters that both exist. `getSession()` is a one-time check, run once when the app starts: "was there already a session saved from last time?" — this is the entire mechanism behind "force-quit and reopen: still logged in" (TC-03); nothing else in this file does anything special to make that true. `onAuthStateChange(...)` is different — it's a standing subscription that keeps firing for as long as the app runs, every time something _changes_: a sign-in, a sign-out, and critically, a silent background token refresh. Without this second part, `session` in this file's state would go stale the moment a token refreshed, even though the _real_, working session had already moved on.

The `cancelled` flag and the `return () => { ... }` cleanup function are the same pattern already explained for `inspections.tsx`'s `load()` — guard against a slow response landing after this component isn't the current one anymore, and always tear down a subscription when it's no longer needed, so the app doesn't quietly accumulate listeners every time this provider happens to re-mount.

### `src/app/_layout.tsx` — a third gate stacked on top of the first two

```tsx
function AuthGate() {
  const { session, loading } = useAuth();
  const theme = useTheme();

  if (loading) {
    /* spinner */
  }
  if (!session) {
    return <LoginScreen />;
  }
  return dbInitError ? <PreviewModeApp /> : <MigrationGate />;
}
```

This is the exact same idea as `MigrationGate`/`PreviewModeApp` (explained earlier in this file) — a component that renders one of several possible things depending on a piece of state, checked in order. Here there are three states to consider, checked top to bottom: still checking for a saved session (`loading`) → definitely no session (`!session`, show the login screen) → there is a session, so fall through to the exact same `dbInitError` check every earlier phase already used. Login is checked _first_, outside and above everything else, so no other screen in the app — not even the preview-mode fallback — can ever accidentally render before we know who (if anyone) is signed in.

### `src/app/(tabs)/settings.tsx` — reading the signed-in user's own email

```tsx
const { session, signOut } = useAuth();
...
<Text style={{ marginTop: theme.spacing.sm }}>{session?.user.email}</Text>
```

`session` here is exactly the same object `AuthProvider` stores — a Supabase `Session`, which carries a `user` object with the account's own `email` on it. `session?.user.email` — the `?.` (optional chaining, already explained elsewhere in this file) guards against `session` briefly being `null` during a render that happens to slip in between sign-out and the screen actually being unmounted, so this line reads "the signed-in user's email, or nothing at all, never a crash."

---

## Phase 3, Day 2 — pushing the outbox

### `src/lib/syncApi.ts` — the one function that talks to the push endpoint

```ts
export type PushResult =
  { ok: true; duplicate: boolean } | { ok: false; retryable: boolean; error: string };
```

This is a **discriminated union**, the same pattern Phase 2's `Field` type used — `ok` is the tag: when it's `true`, TypeScript knows a `duplicate` property exists; when it's `false`, it knows `retryable` and `error` exist instead. Code that receives a `PushResult` and checks `if (result.ok)` gets the right shape narrowed automatically, with no separate type check needed.

```ts
const { data, error } = await supabase.rpc("sync_push", {
  p_idempotency_key: entry.id,
  ...
});
```

`supabase.rpc(name, args)` calls a Postgres function (an **RPC** — "remote procedure call": asking a distant computer to run a named function and give you back its answer, as opposed to asking it to fetch or store a row directly) that was created server-side by a migration, not by anything in this app's own TypeScript. The object of `p_`-prefixed keys matches that function's own parameter names exactly (`supabase/migrations/20260913000003_sync_push.sql`) — get a name wrong here and the call fails with "function does not exist," a mismatch between two files in two different languages that nothing in either language alone can catch for you.

```ts
function isRetryable(error: { code?: string; message: string }): boolean {
  const permanentCodes = new Set(["42501", "22023", "28000"]);
  if (error.code && permanentCodes.has(error.code)) return false;
  return true;
}
```

A `Set` here works exactly like the array-based lookups seen elsewhere in this project, but built specifically for "is this one value a member of this collection?" — checking `.has(x)` on a `Set` doesn't have to scan every element the way `array.includes(x)` conceptually does, though for three short strings the difference is invisible; the real reason to reach for a `Set` here is that "a collection of codes I check membership against" is exactly what a `Set` is _for_, semantically, not just how it happens to perform. Every error code not in that short list defaults to `true` (retryable) — deliberately: guessing "retryable" for an error this code doesn't specifically recognize costs one wasted attempt later, while guessing "permanent" for something that was actually temporary would silently abandon a real, still-pending change.

### `src/lib/syncEngine.ts` — the drain loop

```ts
const markSyncedByEntityType: Partial<
  Record<OutboxEntry["entityType"], (id: string) => Promise<void>>
> = {
  project: markProjectSynced,
  inspection: markInspectionSynced,
  answer: markAnswerSynced,
};
```

`OutboxEntry["entityType"]` is an **indexed access type** (already used elsewhere in this project, e.g. `Variant` lookups) — "whatever type the `entityType` property actually has on `OutboxEntry`," read directly from the real type instead of retyped by hand, so if that union ever gains or loses a member, this line's own key type updates automatically instead of silently going stale. `Record<K, V>` says "an object whose keys are exactly the members of `K`" (also already used, for `Badge.tsx`'s status colors) — but wrapped in `Partial<...>` here specifically, because unlike that earlier case, this object is allowed to be missing an entry (`template` has no corresponding function, since templates are never created by this app in the first place) without that being a type error.

```ts
for (const entry of pending) {
  const outcome = await pushOne(entry);
  ...
}
```

A plain `for...of` loop with an `await` inside it, not a `.map()` with `Promise.all(...)` — deliberately sequential, one push finishing completely before the next one starts. `Promise.all` (used elsewhere in this project for genuinely independent requests, like `inspections.tsx` fetching inspections and projects at once) is for work that doesn't care what order it finishes in; pushing outbox rows very much does — a project must actually finish arriving before the inspection queued right after it is sent, which sequential `await`-in-a-loop guarantees and running everything at once would not.

### `src/repositories/projects.ts#markProjectSynced` (and its inspection/answer twins)

```ts
export async function markProjectSynced(id: string): Promise<void> {
  if (!isDbAvailable()) return;
  const db = requireDb();
  await db.update(projects).set({ syncStatus: "synced" }).where(eq(projects.id, id));
}
```

Every other write in this file runs inside `db.transaction(...)` and calls `appendOutboxEntry(...)` — because every other write represents something a person just did, which still needs to reach the server eventually. This function runs the moment the server confirms it already _has_ that change; writing another outbox entry here would queue up a pointless echo of a trip that already succeeded, which is exactly why this one function in the whole repository skips both the transaction and the outbox call. It isn't a shortcut — it's the one case where those two things genuinely don't apply.

---

## Phase 3, Day 3 — retry, backoff, and knowing when to give up

### `src/lib/backoff.ts` — the formula, one line at a time

```ts
export function computeBackoffDelayMs(attempts: number): number {
  const raw = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
  const jittered = raw * (0.5 + Math.random() * 0.5);
  return Math.round(jittered);
}
```

`Math.pow(2, attempts)` — 2 raised to the power of `attempts`: `2^0 = 1`, `2^1 = 2`, `2^2 = 4`, `2^3 = 8`... this is what makes the delay **double** each time, rather than just growing by a fixed amount. `BASE_DELAY_MS * Math.pow(2, attempts)` turns that doubling sequence of plain numbers (1, 2, 4, 8...) into actual milliseconds (1000, 2000, 4000, 8000...). `Math.min(raw, MAX_DELAY_MS)` — "whichever of these two numbers is smaller" — is the cap: once the doubling would produce something bigger than five minutes, this line always hands back five minutes instead, no matter how large `attempts` gets.

`Math.random()` returns a random decimal between 0 (inclusive) and 1 (exclusive) — a different one every time it's called, with no way to predict it in advance. `0.5 + Math.random() * 0.5` takes that "somewhere between 0 and 1" and reshapes it into "somewhere between 0.5 and 1" instead: `Math.random() * 0.5` alone gives a random amount between 0 and 0.5, and adding the fixed `0.5` shifts that whole range up. Multiplying the capped delay by this number — the **jitter** — means the actual wait is always somewhere between 50% and 100% of the "ideal" doubling value, different every single time this function is called, even with the exact same `attempts` number going in.

`Math.round(...)` rounds to the nearest whole number, because a delay of `1414.7182818...` milliseconds isn't a meaningful improvement over `1415` — the function's caller just needs whole milliseconds to hand to a timer.

### `src/lib/syncEngine.ts#isDeadLettered` — one function, so two different callers can't disagree

```ts
function isDeadLettered(entry: OutboxEntry): boolean {
  return entry.nextAttemptAt !== null && entry.nextAttemptAt > now() + MAX_DELAY_MS;
}
```

This reads as: "this row counts as dead-lettered if it has a `nextAttemptAt` at all, **and** that time is further away than the longest delay a real backoff calculation could ever produce." Anything scheduled sooner than that is a normal, still-alive retry waiting its turn; anything scheduled further out than any real formula could produce must be the special "come back in about a year" value `pushOne` writes on purpose when it gives up on a row. Both `getOutboxSummary()` (the Settings screen's "N failed" count) and `retryDeadLetters()` (the "Retry Failed" button) call this exact same function rather than each writing their own version of the same check — the earlier draft of this code didn't do that (see `docs/DESIGN.md` D-020 for the bug that caused, and why sharing one function is the actual fix, not just a tidiness preference).

### `src/lib/syncEngine.ts#pushOne` — the three-way branch a failed push takes

```ts
const attemptsAfterThis = entry.attempts + 1;
const isDead = !pushResult.retryable || attemptsAfterThis >= MAX_ATTEMPTS;
const nextAttemptAt = isDead
  ? DEAD_LETTER_NEXT_ATTEMPT()
  : now() + computeBackoffDelayMs(entry.attempts);
```

`!pushResult.retryable` — the `!` (logical NOT) flips a boolean; this reads as "the result says this failure is _not_ worth retrying." `||` is logical OR — the whole expression is true if _either_ side is true, so a row is treated as dead exactly when the failure is permanent by its own nature, **or** when this failure would be its `MAX_ATTEMPTS`-th, whichever happens first. The ternary (`condition ? a : b`, already explained elsewhere in this project) then picks between the two possible outcomes: the far-future sentinel for a dead row, or a genuinely computed backoff delay — using `entry.attempts` (the count _before_ this failure), since `computeBackoffDelayMs` is asking "how long should the wait be, given how many times this has already failed."

### `src/lib/syncTriggers.ts` — listening for "you're back," two different ways

```ts
const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
  const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
  if (isConnected && wasConnected === false) {
    void triggerSync("reconnected");
  }
  wasConnected = isConnected;
});
```

`NetInfo.addEventListener(callback)` registers a function that runs every time the device's network state changes, and returns an "unsubscribe" function to stop listening later — the same shape as `supabase.auth.onAuthStateChange` in `AuthProvider.tsx`. `state.isInternetReachable !== false` reads oddly on purpose: this value can be `true`, `false`, **or** `null` (meaning "still checking, don't know yet"). Treating only a confirmed `false` as "not connected" — rather than requiring a confirmed `true` — means a `null` (unknown) state doesn't get mistaken for being offline.

`wasConnected === false` (not simply `!wasConnected`) matters here for a subtle reason: `wasConnected` starts as `null` ("we haven't observed a state yet"), and `!null` is `true` — so without the explicit `=== false` comparison, the very first network event the app ever observes could look like a reconnection even though the app was never actually known to be disconnected before. Comparing against the literal `false` means only a real, previously-observed "was disconnected" counts.

`void triggerSync("reconnected")` — `triggerSync` is an `async` function, meaning calling it returns a Promise; `void` is TypeScript/JavaScript's explicit way of saying "yes, I know this returns a Promise, and I am deliberately not awaiting or storing it" — silencing what would otherwise be a linter warning about an ignored Promise, since this callback itself isn't `async` and has nowhere to `await` it.

### `src/components/SyncStatusDot.tsx` — a second small badge, deliberately not the first one reused

This component looks almost identical to `Badge.tsx` (a colour looked up from a `Record`, a small pill of text) — and that's fine, because it's answering a genuinely different question. `Badge` shows an inspection's own **workflow** status — draft, in progress, completed, submitted — something about the inspection's content. `SyncStatusDot` shows whether that same row has actually reached the server yet — completely independent of how finished the inspection itself is. A `"Completed"` inspection can very reasonably also be `"pending"` (finished, just not synced yet) — two labels about two different things, which is exactly why they're two small components instead of one component trying to describe both at once.

---

## Phase 3, Day 4 — pulling changes down

### `src/db/schema.ts` — `syncState`, a table with no `commonColumns()`

```ts
export const syncState = sqliteTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
```

Two plain columns, `key` and `value` — this is the **key/value** pattern: instead of one column per fact this table needs to remember (which would mean a schema change every time a new fact needs storing), it stores an arbitrary number of `"name" -> "value"` pairs as rows, and adding a new fact later just means writing a new row with a new key, no migration required. Right now exactly one row ever exists (`key: "lastSyncedAt"`), but the shape scales to more without changing the table. Like `outbox`, this table deliberately doesn't spread in `commonColumns()` (`id`/`createdAt`/`updatedAt`/`deletedAt`/`syncStatus`) — a cursor is never itself synced, edited by a person, or soft-deleted, so those columns would just be dead weight here, the same reasoning `docs/DESIGN.md` D-005 already gave for `outbox`.

### `src/repositories/syncState.ts#setLastSyncedAt` — `onConflictDoUpdate`, explained

```ts
await db
  .insert(syncState)
  .values({ key: CURSOR_KEY, value })
  .onConflictDoUpdate({ target: syncState.key, set: { value } });
```

This is an **upsert** — "insert, but if a row with this same key already exists, update it instead of failing." Reading it as a sentence: "try to insert this row; if that would conflict on the `key` column (because a row with this key is already there), then instead run this update." `target: syncState.key` names which column's clash counts as "already exists" — here, the primary key. Without this, saving the cursor a second time would either throw a duplicate-primary-key error, or require writing `SELECT` first (does a row exist?) and `INSERT` or `UPDATE` afterwards by hand, in two separate statements with a gap between them where another read could interleave. `onConflictDoUpdate` does both possibilities in the one atomic statement.

### `src/lib/syncPull.ts#pullTable` — one generic function shared by three different tables

```ts
async function pullTable<Row extends { id: string; server_updated_at: string }>(
  table: "projects" | "inspections" | "answers",
  cursor: string,
  applyRow: (row: Row) => Promise<void>,
): Promise<{ maxServerUpdatedAt: string; pulled: number; merged: number; skipped: number }> {
```

`<Row extends { id: string; server_updated_at: string }>` is a **generic constraint**: this function works with _any_ row shape, as long as that shape has at least an `id` and a `server_updated_at` — the two fields this function's own logic actually needs to touch, regardless of which table the row came from. `applyRow: (row: Row) => Promise<void>` is a function passed in _as an argument_ (already familiar from `FieldComponent`'s `onScheduleSave` prop, or `Array.prototype.map`'s own callback) — `pullTable` handles everything every table's pull has in common (running the query, tracking the newest timestamp seen, checking for a pending local change, counting merged vs skipped), and lets each caller supply only the one thing that's actually different per table: how to turn _this_ table's raw row into a call to _that_ table's own `applyPulledX` function.

```ts
if (row.server_updated_at > maxServerUpdatedAt) {
  maxServerUpdatedAt = row.server_updated_at;
}
```

`server_updated_at` here is a plain string (an ISO-8601 timestamp, e.g. `"2026-09-14T10:23:45.123456+00:00"`), and `>` is being used to compare two strings, not two numbers. This works correctly specifically because ISO-8601 timestamps, written consistently (same timezone offset, same field widths, most-significant part first — year, then month, then day...), sort into the same order alphabetically as they do chronologically. It's the same property that lets filenames like `2026-09-01-notes.txt` and `2026-09-14-notes.txt` list in date order in an ordinary file browser with no special date-parsing at all.

### `src/repositories/projects.ts#applyPulledProject` — the pull-side twin of `setProjectSyncStatus`

```ts
export async function applyPulledProject(row: Omit<NewProject, "syncStatus">): Promise<void> {
  const values: NewProject = { ...row, syncStatus: "synced" };
  await db.insert(projects).values(values).onConflictDoUpdate({ target: projects.id, set: values });
}
```

`Omit<NewProject, "syncStatus">` (an already-familiar utility type, alongside `Pick`/`Partial` used elsewhere in this project) means "every field `NewProject` has, except `syncStatus`" — this function's caller (`syncPull.ts`) supplies every real column from the server, but never gets to decide the sync status of a row it's handing over, because that's not the caller's decision to make: a row that just arrived _from_ the server is `"synced"` by definition, every single time, with no other value ever making sense here. Building that fact into the parameter type — rather than just trusting every call site to pass the right thing — means a future call site that forgot `syncStatus` (impossible, `Omit` removed it) or supplied the wrong one (impossible, this function decides it) simply cannot happen, instead of relying on every future caller remembering the rule.

### `src/lib/sync.ts#runSync` — one door for "just sync," so an ordering rule only has to be written once

```ts
export async function runSync(): Promise<SyncResult> {
  const push = await drainOutbox();
  const pull = await pullChanges();
  return { push, pull };
}
```

Nothing complicated syntactically — two `await`s in a row, one after the other finishes — but the _reason_ it's its own tiny file matters: both the manual "Sync Now" button and the automatic connectivity/foreground triggers need "push, then pull," in exactly that order, every time. Without this file, that ordering would have to be remembered and re-typed correctly at every place that ever wants to trigger a sync — and the moment one of those places got the order backwards (or forgot the pull entirely), it would be a bug that's easy to introduce and hard to notice, since both push and pull would still work fine individually. One function, called from everywhere, means the rule can only be right or wrong in one place.

---

## Phase 3, Day 5 — resolving conflicts

### `src/lib/conflict.ts#resolveConflict` — a pure decision function, and the two bugs testing it found

```ts
export type FieldResolution =
  | { field: string; action: "take-server"; value: unknown }
  | { field: string; action: "keep-local" }
  | { field: string; action: "manual"; localValue: unknown; serverValue: unknown };
```

This is the same **discriminated union** pattern seen throughout this project (Phase 2's `Field` type, `PushResult` in `syncApi.ts`) — `action` is the tag. Reading `FieldResolution[]` as a sentence: "a list of instructions, one per field, each saying exactly one of: take the server's value, keep what's already local, or hand this one to a person."

```ts
if (!localEmpty && serverEmpty) {
  resolutions.push({ field, action: "keep-local" });
  continue;
}
if (localEmpty && serverEmpty) {
  resolutions.push({ field, action: "keep-local" });
  continue;
}
```

This looks almost redundant with the branch just above it (`localEmpty && !serverEmpty`) — and that's exactly the point. Before this fix, the second condition was written as one combined check, `!localEmpty || serverEmpty` — using `||` (**or**) instead of `&&` (**and**). With `||`, the moment `!localEmpty` was `true` (meaning: "local isn't empty" — true for almost every real edit), the _whole_ condition became `true` regardless of what `serverEmpty` was — which meant this branch fired for **every** case where local had a real value, including the one case it was never supposed to catch: two genuinely different real values on both sides. That's a live demonstration of why `&&` and `||` aren't interchangeable "combine two conditions" operators — `&&` requires both sides true, `||` only needs one, and picking the wrong one here didn't crash anything or produce a type error; it just quietly made a whole rule (R7, "ask a person") unreachable. Writing out each real case as its own explicit, separate `if` — even though two of them do the same thing (`"keep-local"`) — makes each one individually obviously correct, instead of relying on one cleverly-combined boolean expression to secretly cover three different situations correctly.

```ts
const serverPredatesLocalEdit = args.serverUpdatedAtMs < args.localPendingChangedAt;
```

This line is the fix for the _second_ bug the same test run found — not a typo this time, a genuine gap in the reasoning. Without it: the moment this device makes a local edit, the very next pull (which asks the server "what's changed?") would see this device's OWN new edit as "different from the server," purely because the server hasn't heard about it yet — nothing to do with anyone else touching anything. `serverUpdatedAtMs < localPendingChangedAt` — comparing two plain numbers (milliseconds) — answers a very specific question: "does the row I just pulled predate my own edit?" If yes, any field difference is expected and meaningless as a conflict signal; the code short-circuits straight to `"keep-local"` for that field, skipping the closer, more expensive same-field-conflict logic entirely.

### `src/repositories/conflicts.ts#recordConflict` — checking for a duplicate before inserting

```ts
const existing = await db
  .select()
  .from(conflicts)
  .where(
    and(
      eq(conflicts.entityType, args.entityType),
      eq(conflicts.entityId, args.entityId),
      eq(conflicts.fieldKey, args.fieldKey),
    ),
  );
if (existing.length > 0) return;
```

A **read-then-write** pattern: check whether a row matching all three of these columns already exists, and if it does, do nothing rather than inserting a second one. This matters because `pullChanges()` can run repeatedly (the manual button, the automatic triggers) before a person has gotten around to resolving a conflict already sitting there — without this check, each additional pull before the conflict is resolved would pile up a fresh duplicate row asking the exact same already-asked question.

### `src/lib/conflictResolutionActions.ts#resolveConflictChoice` — turning a person's tap into a normal edit

```ts
if (choice === "local") {
  await deleteConflict(conflict.id);
  return;
}
const value = JSON.parse(conflict.serverValueJson);
if (conflict.entityType === "project") {
  await updateProject(conflict.entityId, { [conflict.fieldKey]: value } as Record<string, unknown>);
}
```

`{ [conflict.fieldKey]: value }` is a **computed property name** — the square brackets around `conflict.fieldKey` mean "use the _value_ of this variable as the object's key," not the literal text `"conflict.fieldKey"`. Since `conflict.fieldKey` might be `"title"` this time and `"notes"` next time, this one line can build `{ title: value }` or `{ notes: value }` depending on which conflict is actually being resolved, without a separate `if` for every possible field name. Choosing "theirs" calls `updateProject`/`updateInspection`/`saveAnswer` — the exact same functions a real screen calls when a person types into a field — which is what makes the choice "sync onward like a normal edit" (plan Section 3.5.3): it appends a fresh outbox entry the same way any other edit would, with nothing about the sync engine needing to know this particular edit came from a conflict screen rather than a text box.

## Phase 3, Day 6 — uploading the actual file

### `src/lib/syncApi.ts#pushRowOnly` — pulling the RPC call out from under `pushOutboxEntry`

```ts
export async function pushRowOnly(
  idempotencyKey: string,
  entityType: OutboxEntry["entityType"],
  entityId: string,
  operation: OutboxEntry["operation"],
  payload: unknown,
): Promise<PushResult> { /* the same supabase.rpc("sync_push", ...) call Day 2 already had */ }

export async function pushOutboxEntry(entry: OutboxEntry): Promise<PushResult> {
  let payload: unknown;
  try { payload = JSON.parse(entry.payloadJson); } catch (e) { /* ... */ }
  return pushRowOnly(entry.id, entry.entityType, entry.entityId, entry.operation, payload);
}
```

This is a small, deliberate **refactor**, not new behavior: Day 2's `pushOutboxEntry` always assumed there was exactly one real `OutboxEntry` row to push. Day 6 needs to call `sync_push` a SECOND time for the same attachment — the "the file landed, here's `remote_url`" follow-up — and that second call has no `OutboxEntry` to read; it's a value this function itself computes (a storage path). Rather than inventing a fake `OutboxEntry` object just to satisfy `pushOutboxEntry`'s signature, the actual RPC call was pulled out into its own function, `pushRowOnly`, taking its four arguments directly. `pushOutboxEntry` now does one thing — unwrap a real outbox row into those same four arguments — and both it and `src/lib/attachmentUpload.ts` call the shared `pushRowOnly` underneath. The "one function is the only thing that calls `supabase.rpc(...)`" rule (this file's Day 2 section) still holds; there's just one now, not two, that do slightly different jobs on top of it.

### `src/lib/attachmentUpload.ts#pushAndUploadAttachment` — three awaits, three ways to fail, one return value

```ts
const rowResult = await pushRowOnly(entry.id, "attachment", entry.entityId, "insert", payload);
if (!rowResult.ok) return rowResult;
```

The **guard clause** pattern used throughout this codebase (`if (!x.ok) return x`), here chained three times in a row — once after the row push, once after reading the file, once after the upload, once after the follow-up push. Each guard means "if this step failed, stop right here and hand that exact failure back unchanged" — the caller (`syncEngine.ts#pushOne`) can't tell, and doesn't need to tell, which of the three steps actually failed; it only needs to know whether to keep the outbox entry around for a retry (`retryable`) or give up on it (dead-letter). This is what makes the whole three-step sequence behave like one operation from the outside, even though it's built from three separate `await`s internally.

```ts
const { File } = await import("expo-file-system");
const file = new File(payload.localUri);
if (!file.exists) {
  return { ok: false, retryable: false, error: `Local file missing, can't upload: ${payload.localUri}` };
}
bytes = await file.bytes();
```

`await import("expo-file-system")` is a **dynamic import** — same pattern `src/lib/media.ts` already uses, and for the same reason: this module must not crash to even LOAD in the web preview, where this native package has no real file-reading implementation. `new File(payload.localUri)` and `.bytes()` are the Phase 2-cleanup, class-based `expo-file-system` API (not the older `getInfoAsync`/`readAsStringAsync` function style) — `.bytes()` specifically returns a `Uint8Array`, the raw binary shape Supabase Storage's `.upload()` wants, with no base64 text encoding/decoding step in between (base64 would both waste ~33% more bandwidth and be pure unnecessary work for something that's already binary).

```ts
const path = `${userData.user.id}/${entry.entityId}${extensionFromMimeType(payload.mimeType)}`;
```

**Template literal** building a Storage object path. `userData.user.id` — this device's own signed-in account id — is the first path segment on purpose: it's what turns a plain file path into an ownership claim the server's Storage policies can actually check (`supabase/migrations/20260914000002_attachment_storage.sql`'s `storage.foldername(name)[1] = auth.uid()::text`), the exact same idea as every table's `owner_id` column, just spelled as a folder name instead of a database column because Storage objects don't have their own extra columns to add one to.

```ts
const { error: uploadError } = await supabase.storage
  .from(ATTACHMENTS_BUCKET)
  .upload(path, bytes, { contentType: payload.mimeType ?? "application/octet-stream", upsert: true });
```

`supabase.storage.from(bucketName)` is Storage's equivalent of `supabase.from(tableName)` — a handle to one bucket, with its own `.upload()`/`.download()`/`.createSignedUrl()` methods. `upsert: true` is the single option doing the most work in this whole file: without it, uploading to a path that already has something there fails outright, which would make a retried (killed-mid-upload, tried-again) upload permanently stuck. With it, re-uploading identical bytes to the same path just quietly overwrites — turning "retry" into "safe to just do again," the same idempotent shape every other step in this sequence already has.

### `src/lib/backgroundSync.ts` — a task the operating system calls, not this app

```ts
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const result = await runSync();
    const changedAnything = result.push.synced > 0 || result.pull.merged > 0;
    return changedAnything
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
```

`TaskManager.defineTask(name, fn)` is unusual compared to everything else in this codebase: it doesn't run `fn` right now — it registers `fn` under `name` in a table the native side of Expo keeps, so that later, whenever the OPERATING SYSTEM decides to wake the app up in the background, it can look up `name` and call this function, with no user tapping anything and often no screen even visible. This line has to run once, early, every time the app's JavaScript starts up at all (which is why it's written directly at the top of the file, not inside a function) — if this line hasn't run yet when the OS tries to wake the app for its scheduled background task, there's nothing registered under that name to call. The return value (`NewData`/`NoData`/`Failed`) is the app's way of telling the OS how that wake-up went, which the OS can use to help decide how eager to be about granting the next one.

```ts
export async function registerBackgroundSync(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  if (isRegistered) return;
  await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
```

This is the separate, second step: `defineTask` above only teaches the app WHAT to do if woken up; `registerTaskAsync` is what actually asks the operating system to start waking it up at all. `isTaskRegisteredAsync` first is a plain **idempotency check by hand** — calling `registerTaskAsync` twice isn't harmful, but there's no reason to ask the OS twice for the same thing either.

### `src/app/_layout.tsx` — a dynamic `import()` used specifically so a module never loads on web

```ts
useEffect(() => {
  if (!session || Platform.OS === "web") return;
  let cancelled = false;
  import("@/lib/backgroundSync")
    .then((m) => { if (!cancelled) return m.registerBackgroundSync(); })
    .catch((e) => console.error("[backgroundSync] registration failed", e));
  return () => { cancelled = true; };
}, [Boolean(session)]);
```

Every other conditional import in this app so far (`src/lib/media.ts`) is `await import(...)` used because the awaited call itself might fail on an unsupported platform. This one is different, and worth noticing why: `src/lib/backgroundSync.ts` runs `TaskManager.defineTask(...)` the moment it's loaded — not when some function inside it is called. A **static** `import backgroundSync from "@/lib/backgroundSync"` at the top of `_layout.tsx` would load (and therefore run) that file's top-level code on EVERY platform this app renders on, web included, the instant `_layout.tsx` itself loads — before the `Platform.OS === "web"` check below ever gets a chance to run. Writing `import("@/lib/backgroundSync")` as a function call, inside the `if` that already excludes web, means the whole module — and its risky top-level `defineTask` call — is never even fetched, let alone executed, on a platform this project doesn't trust it to behave correctly on (see `docs/DESIGN.md` D-024, and D-018's `expo-secure-store` story for why that distrust is earned, not paranoid).

## Phase 3, Day 7 — pulling attachments down, and the one column that must NOT just get overwritten

### `src/repositories/attachments.ts#applyPulledAttachment` — excluding one column from an upsert on purpose

```ts
const insertValues: NewAttachment = { ...row, localUri: null, syncStatus: "synced" };
const { localUri: _localUriExcluded, ...updateOnConflict } = insertValues;
await db
  .insert(attachments)
  .values(insertValues)
  .onConflictDoUpdate({ target: attachments.id, set: updateOnConflict });
```

`const { localUri: _localUriExcluded, ...updateOnConflict } = insertValues;` is **object destructuring with a rest pattern**, used here for what it REMOVES rather than what it keeps: `localUri` is pulled out into its own (unused, underscore-prefixed by convention) variable, and `updateOnConflict` becomes a new object with every OTHER key from `insertValues`. `.values(insertValues)` — the full object, `localUri: null` included — is what SQLite writes if this row doesn't exist yet: a genuinely new attachment, correctly recorded as having no local file. `.onConflictDoUpdate({ set: updateOnConflict })` — the object with `localUri` missing — is what runs INSTEAD if a row with this `id` already exists: SQL's `ON CONFLICT DO UPDATE SET col1 = x, col2 = y, ...` only touches the columns actually named in the `SET` list, so leaving `localUri` out of it means an existing row's own `local_uri` survives completely untouched, whatever it already was. This is the one place in the whole sync system that needed an upsert to intentionally NOT copy one particular column from the server — every other `applyPulledX` function (Days 4-6) copies every field, because every other column genuinely does have one shared, correct value the server holds. `local_uri` doesn't; it names a path on whichever ONE device happens to have the actual file, and pull code that doesn't know that would happily overwrite a device's own correct value with someone else's meaningless one.

### `src/lib/syncPull.ts` — reusing `pullTable` for a fourth entity, unmodified

Adding attachments to `pullChanges()` needed zero changes to `pullTable` itself — only a fourth `AttachmentRow` type and a fourth `EntityHandlers` object (`attachmentHandlers`), passed to the exact same generic function already pulling the other three. This is the payoff of `pullTable` being written generically (`<Row extends { id: string; server_updated_at: string }>`, `EntityHandlers<Row>`) back on Day 4, rather than as four copy-pasted functions: a new entity type with a genuinely different conflict story (attachments structurally never conflict at all — see `docs/DESIGN.md` D-025) still fits through the same shape, because the "does this row have a pending local edit?" check `pullTable` already does naturally comes back empty for every attachment, every time — nothing about `pullTable` needed to know that in advance for it to already be true.

## Phase 4, Day 1 — `src/lib/report.ts`, `src/lib/reportImages.ts`, `src/lib/reportHtml.ts`

### `src/lib/report.ts` — gathering the data, before any HTML exists

`buildReportData(inspectionId)` is an `async function` that returns a `Promise<ReportData>` — it does several database reads in sequence, each one `await`ed, and hands back one plain JavaScript object with everything a report needs already resolved. Nothing in this file imports React or writes HTML — it only answers "what does this inspection's report say?", so the trickier layout work in `reportHtml.ts` never has to also worry about where the data comes from.

`isFieldVisible(field, answers)` is copied, line for line, from the same function already in `FormRenderer.tsx`. `field.visibleIf` is an object like `{ field: "roof_condition", in: ["fair", "poor"] }` — "only show this field if `roof_condition`'s answer is one of these values." `answers[field.visibleIf.field]` looks up that other field's current answer; `.in?.includes(...)` checks whether it's in the allowed list. The `?.` ("optional chaining") means: if `visibleIf.in` doesn't exist, don't crash — just treat it as "not included." This has to match `FormRenderer.tsx` exactly, or the report could show a field the user never actually saw on screen.

`formatValue(field, value)` is a `switch (field.type)` — for each field type, it decides how the raw stored value becomes readable text. The `select` case does something `FormRenderer.tsx` never had to: `field.options?.find((o) => o.value === value)?.label` — `options` is an array like `[{ value: "fair", label: "Fair" }, ...]`; `.find(...)` walks the array looking for the one whose `value` matches what's stored, then `?.label` reads its human-readable label off it. If nothing matches (or `options` doesn't exist), `?? String(value)` falls back to just showing the raw stored value instead of crashing.

`NOT_RECORDED` is a `const` holding the literal string `"Not recorded"` — used any time a field has no answer at all. The Phase 4 plan is explicit that a report should never show a blank for an unanswered field, because a blank reads as "the report is broken," not "the inspector chose not to answer this."

`buildAnswersMap(answers)` turns the list of raw `Answer` database rows into a `{ fieldKey: value }` lookup object — the exact same three-column decode (`valueText`, then `valueNumber`, then `JSON.parse(valueJson)`) `FormRenderer.tsx` already does inline, pulled out into its own function here since this file needs it too.

Inside `buildReportData`, photos and signatures are handled differently from every other field type: instead of reading their "value" from the `answers` table, the function looks them up from the separate `attachments` list, grouped by `fieldKey` using a `Map` (`attachmentsByField`). A `Map` here works like a dictionary that maps one field's key to an array of every attachment captured for it — built once with a `for` loop, then read back per field.

### `src/lib/reportImages.ts` — turning a photo file into text a web page can embed

`BASE64_CHARS` is the fixed 64-character alphabet every base64 encoder in the world uses — the same idea as Morse code: a fixed, agreed-upon way to turn one kind of data (raw bytes) into another (plain text) that's safe to embed inside a text file like HTML.

`bytesToBase64(bytes)` is the encoder itself. It reads a photo's raw bytes three at a time (`for (let i = 0; i < bytes.length; i += 3)`) and turns each group of 3 bytes (24 bits) into 4 base64 characters (4 × 6 bits = 24 bits) — the bit-shifting (`>> 2`, `<< 4`, `& 0x03`, etc.) is just slicing those 24 bits into four 6-bit chunks and looking each one up in `BASE64_CHARS`. The `=` padding at the end handles the case where the very last group has only 1 or 2 bytes left over, not a full 3.

`localUriToDataUrl(localUri, mimeType)` ties it together: opens the file with `expo-file-system`'s `File` class (the exact same class `src/lib/media.ts` and `attachmentUpload.ts` already use), checks `.exists` first (never assume a file is still there), reads its bytes with `.bytes()`, and returns a string like `data:image/jpeg;base64,/9j/4AAQ...` — a `data:` URI is a way of putting a whole file's contents directly inside a URL instead of pointing at one; an `<img src="...">` given one of these shows the image with no separate file request at all, which matters here since `expo-print`'s renderer can't go fetch a `file://` path itself. If anything goes wrong reading the file, the function returns `null` instead of throwing — one missing photo shouldn't take down the whole report.

`MAX_INLINE_IMAGES` is a plain `const = 20` — the hard cap on how many photos (plus the signature) get embedded in one report, so a 200-photo inspection can't exhaust the phone's memory generating one PDF.

### `src/lib/reportHtml.ts` — assembling one HTML string

`buildReportHtml(data)` is a template-string builder: it takes the `ReportData` object and stitches together one big HTML string, using JavaScript's backtick template literals (`` `...${expression}...` ``) to drop in real values wherever the report needs them.

`esc(value)` ("escape") replaces the characters `&`, `<`, `>`, and `"` with their safe HTML equivalents (`&amp;`, `&lt;`, etc.) before any real, user-typed text (a project name, an inspector's name) goes into the HTML string. Without this, someone whose name happened to contain a `<` character could accidentally break the page's structure — this file builds HTML by hand, unlike a React component, so nothing else here would catch that automatically.

`STYLE` is one long CSS string, kept as a single `<style>` block in the page's `<head>` — the plan requires this (no separate stylesheet file, since `expo-print`'s renderer can't fetch one). `page-break-inside: avoid` on a rule tells the printing engine "never split this element across two pages" — used on every section and photo block so a heading doesn't end up alone at the bottom of one page with its content starting on the next.

The function does its image work with `Promise.all(...)` — `photoRefsToInline.map(ref => localUriToDataUrl(...))` creates one Promise per photo, and `Promise.all` waits for every one of them to finish before continuing, instead of reading each photo file one at a time. `.flatMap(...)` (used to build `allPhotoRefs`) is like `.map()` but flattens one extra level of nesting — each photo *group* becomes several individual photo *entries* in one flat list.

The final return statement is one big HTML document string — `<html>`, a `<head>` with the inline `<style>`, and a `<body>` built from several smaller template strings (`sectionsHtml`, `photosHtml`, `locationHtml`, `signatureHtml`) that each only get included if they have something to show (`data.gps ? ... : ""`), so an inspection with no photos simply doesn't get an empty "Photos" heading.

### `src/app/inspections/[id].tsx` — the "Generate Report" button

`handleGenerateReport` is an `async` function wired to a new `Button`. It calls `buildReportData`, then `buildReportHtml`, then dynamically imports `expo-print` (`await import("expo-print")` — the same pattern every other native-package call in this codebase uses, so this screen doesn't crash to even *load* on web, where the native module isn't available at all). `Print.printToFileAsync({ html })` renders the HTML string into an actual PDF file on disk and returns its `uri`; `Print.printAsync({ uri })` then opens the OS's own print/preview dialog on that file, which is enough to prove today that the PDF is real and laid out correctly — a proper "share this file" button is Day 2's job, not today's.

## Phase 4, Day 1 audit — `src/repositories/attachments.ts`'s missing filter

`listAttachmentsForInspection` used to read `db.select().from(attachments).where(eq(attachments.inspectionId, inspectionId))` — one condition, "belongs to this inspection." Now it reads `.where(and(eq(attachments.inspectionId, inspectionId), isNull(attachments.deletedAt)))` — two conditions joined by `and(...)`.

`isNull(attachments.deletedAt)` means "this row's `deleted_at` column is empty" — since a soft-deleted row gets a real timestamp written into `deleted_at` (see `deleteAttachment` a little further down the same file), a row that's still `null` there hasn't been deleted. Without this second condition, a photo or signature the user had deleted would still come back in the list — it would just silently reappear anywhere this function's result gets shown, including in a printed PDF report. Every other `list`/`get` function in this codebase already had this same `isNull(...deletedAt)` check; this was the one place it had been left out.

## Phase 4, Day 2 — sharing, and pulling real theme colors into the report

### `src/app/inspections/[id].tsx` — sharing instead of just printing

`const Sharing = await import("expo-sharing");` — same dynamic-import pattern already used for `expo-print` right above it, and for `expo-file-system` throughout this codebase: a module that touches native code shouldn't crash the whole screen just by being *imported* on a platform (web) where that native code doesn't exist.

`await Sharing.isAvailableAsync()` — asks the OS "can you actually show a share sheet right now?" before trying. Returns a plain `true`/`false`, no permission dialog involved (sharing a file isn't a sensitive permission the way camera/location are).

`await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: inspection.title })` — hands the just-created PDF file's path to the OS's native share UI (the same sheet a "Share" button in any app opens — Mail, Messages, Save to Files, etc.). `mimeType` tells the receiving apps what kind of file this is, so they know how to handle it. `dialogTitle` is just the heading text on the share sheet itself.

The `if (canShare) { ... } else { Alert.alert(...) }` — an `if`/`else`: if sharing genuinely isn't available (this codebase never assumes a native feature just works), fall back to telling the user where the file ended up instead of the button silently doing nothing.

### `src/lib/reportHtml.ts` — importing plain constants, not a React hook

`import { palettes, fontSize, fontWeight } from "@/theme/tokens";` — a completely ordinary import, no different from importing a function. `tokens.ts` exports plain objects (`export const palettes = {...}`), not a React hook like `useTheme()` — a hook can only be called from inside a component during a render, and `reportHtml.ts` isn't a component at all, just a function that builds a string. Plain constants can be imported and read from anywhere.

`const theme = palettes.light;` — picks out just the light-mode half of the two-palette object once, at the top of the file, and reuses it everywhere below. Written as `palettes.light` deliberately, not `palettes[currentScheme]` — a PDF report is a fixed document, not a live screen, so it always renders the same way regardless of whether the phone that opens it later is in dark mode.

Inside the `STYLE` template string, spots that used to say a literal `#2b5fa8` now say `${theme.primary}` — a **template literal expression**: anything inside `${...}` is real JavaScript, evaluated once when the string is built, and its result (here, the string `"#2563EB"`) is spliced into the final CSS text. The browser/print-engine reading the finished HTML never sees `${theme.primary}` at all — only the real hex code it evaluated to.

## Phase 4, Day 4 — Reanimated, Gesture Handler, ErrorBoundary, and every screen's states

### `src/components/ErrorBoundary.tsx` — the one class component in this app

`export class ErrorBoundary extends Component<Props, State>` — every other component in this app is a plain function; this one has to be a **class** because React only gives error-catching superpowers to class components (`getDerivedStateFromError`/`componentDidCatch`), never to a function component or a hook — there is genuinely no other way to write this in current React.

`static getDerivedStateFromError(error: Error): State` — `static` means this method belongs to the CLASS itself, not to any one instance of it — React calls it automatically, the instant something below this component throws while rendering. Whatever object it returns becomes this component's new `state`.

`componentDidCatch(error, info)` — called right after `getDerivedStateFromError`, but for a different job: `getDerivedStateFromError` computes new state (React requires this to have no side effects — no logging, no network calls); `componentDidCatch` is where side effects like `console.error(...)` actually belong.

`this.setState({ error: null })` inside `reset` — the fallback screen's "Try again" button calls this, which clears the error and makes React attempt to render `this.props.children` (whatever crashed) again from scratch, without restarting the whole app.

`render()`'s `if (this.state.error) { ... } return this.props.children;` — an ordinary `if`/`return`: show the fallback UI while an error is stored, otherwise render whatever this component was wrapping, completely normally.

### `src/components/SyncStatusDot.tsx` — an animation driven by a "shared value"

`const pop = useSharedValue(1)` — a Reanimated **shared value**: a box holding a number that both the normal JS side of the app AND the UI-drawing side can read and write, kept in sync automatically. Ordinary React `useState` can only be read/written from JS — Reanimated's whole point is animations that don't have to wait on the JS thread at all.

`useEffect(() => { pop.value = withSequence(withTiming(1.6, ...), withTiming(1, ...)) }, [status])` — every time `status` changes, this runs: `withTiming(1.6, { duration: 120 })` means "animate smoothly to 1.6 over 120ms"; `withSequence(a, b)` means "play `a`, then when it finishes, play `b`" — so the dot grows to 1.6x its size, then shrinks back to its normal size, over roughly a third of a second total.

`useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }))` — this function is a **worklet** (Reanimated's babel plugin, configured today in `babel.config.js`, is what makes this possible): instead of running in ordinary JavaScript, it's compiled to also run directly on the UI thread, so the dot keeps animating smoothly even if the JS thread is busy doing something else (like a sync running).

`<Animated.View style={[...]}>` instead of a plain `<View>` — `Animated.View` (from `react-native-reanimated`, not the RN core one) is the one View variant that actually reads a worklet-produced style and updates it every frame; a plain `View` would just ignore `dotStyle` entirely.

### `src/components/PhotoViewer.tsx` — two gestures happening at once

`Gesture.Pinch().onUpdate((e) => { scale.value = ... }).onEnd(() => { ... })` — `Gesture.Pinch()` builds a description of "a two-finger pinch gesture"; `.onUpdate` runs continuously while it's happening (`e.scale` is how much bigger/smaller the fingers have moved apart since the pinch started), `.onEnd` runs once, when the fingers lift.

`Gesture.Simultaneous(pinch, pan)` — normally, only one gesture "wins" at a time. `Simultaneous` says "let both of these be recognized together" — so someone can pinch-zoom and drag in one continuous motion, the way a real photo app works.

`<GestureDetector gesture={composedGesture}>` — the component that actually listens for the combined gesture and drives the shared values above; it needs a `GestureHandlerRootView` somewhere above it in the tree to work at all — added today in `src/app/_layout.tsx`, once, for the whole app.

### `src/app/_layout.tsx` — one wrapper, once, for every gesture the app will ever have

`<GestureHandlerRootView style={{ flex: 1 }}>` — Gesture Handler needs to intercept touches before React Native's own default touch system does; this component is what makes that possible, and it only ever needs to exist ONCE, wrapping everything — not once per screen that happens to use a gesture.

### `src/app/(tabs)/inspections.tsx` — `Swipeable`

`<Swipeable renderRightActions={() => (...)}>` — wraps one row. `renderRightActions` is called by `Swipeable` itself while the user is dragging the row leftward, revealing whatever this function returns (here, a red "Delete" button) from behind the row.

### Every data screen — the loading/error pattern, repeated four times

`{loading && list.length === 0 ? <ActivityIndicator /> : error ? <EmptyState>...</EmptyState> : <FlashList ... />}` — a chain of two `? :` ("ternary") checks read top to bottom: "if genuinely still loading with nothing to show yet, show a spinner; otherwise, if the last load failed, show the error message; otherwise, show the real list." Only one of the three ever renders at once.

## Phase 4, Day 5 — automated tests, Jest, and mocking a database

### `jest.config.js` — teaching Jest the same shortcuts the app already has

`preset` isn't used at all here — most Expo projects would use `jest-expo`, but this one doesn't (see `docs/DESIGN.md` D-031 for the real reason: a genuine upstream version mismatch, not a preference). `testEnvironment: "node"` tells Jest to run tests in a plain Node.js environment rather than pretending to be a browser or a phone — correct here since nothing in this test suite draws to a screen.

`transform: { "^.+\.[jt]sx?$": "babel-jest" }` — a **regular expression** matching any file ending in `.js`, `.jsx`, `.ts`, or `.tsx` (`[jt]` means "either the letter j or the letter t", `sx?` means "an s, then an optional x"), telling Jest to run every one of those files through `babel-jest` before executing it — which itself reads this project's own `babel.config.js`, the same one Metro uses for the real app.

`moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" }` — another regular expression: `^@/` matches the start of an import path being exactly `@/`, `(.*)`  captures everything after it. `<rootDir>/src/$1` is the replacement — `$1` refers back to whatever `(.*)` captured. So `import x from "@/lib/id"` becomes, as far as Jest's resolver is concerned, `<rootDir>/src/lib/id` — teaching Jest the exact same alias `tsconfig.json` already set up for the real app.

### `src/lib/visibility.ts` — one function, three importers

Nothing new syntactically here — it's the same function that used to live inside three other files, moved to its own file and `export`ed so a test (and the other two files) can `import` it.

### `src/lib/conflict.test.ts`, `backoff.test.ts`, `validation.test.ts` — the shape of a test

`test("a plain-English description", () => { ... })` — `test` is a **global function** Jest adds automatically to every test file (no import needed) — the first argument is a description a human reads in the output, the second is a function containing the actual check.

`expect(actualValue).toBe(expectedValue)` — `expect(...)` wraps a real value your code produced; `.toBe(...)` is a **matcher** — one of many functions Jest provides for comparing it to what you expected. `.toBe` checks exact equality (`===`); `.toEqual` (used for comparing whole objects) checks that two objects have the same *contents*, even if they're not literally the same object in memory; `.toBeLessThan`/`.toBeGreaterThanOrEqual` compare numbers.

`baseArgs()` in `conflict.test.ts` — an ordinary function returning a fresh object every time it's called, used at the start of most tests as `{ ...baseArgs(), someField: "override" }`. The spread (`...`) copies every property from `baseArgs()`'s result into a new object, then the properties written after it overwrite just the ones that changed — so each test only has to spell out what makes IT different, not repeat every field seven times.

### `src/repositories/projects.integration.test.ts` — replacing one whole file, for one test file only

`jest.mock("@/db/client", () => ({ isDbAvailable: () => true, requireDb: () => mockDb }))` — this is Jest **module mocking**: whenever any code THIS TEST FILE imports (directly or indirectly) tries to `import ... from "@/db/client"`, Jest hands it this fake object instead of running the real file at all. `src/repositories/projects.ts` itself never knows the difference — it calls `requireDb()` exactly like always, and gets back a real (if temporary, in-memory) database instead of crashing on a missing native module.

`jest.mock(...)` calls are **hoisted** — Jest's own babel transform physically moves every `jest.mock(...)` call in a file to the very top, before any `import` statement, even if you typed it further down. That's *why* the closed-over variables inside a mock's factory function have to be named starting with `mock` — otherwise you'd be referencing a variable that, at the point this code actually runs, doesn't exist yet.

`beforeAll(async () => { await migrate(mockDb, { migrationsFolder: "./drizzle" }); })` — `beforeAll` is another Jest global: the function inside runs once, before any `test(...)` in this file, instead of running again before every individual test (that would be `beforeEach`). `migrate(...)` reads this project's real, already-generated migration files from the `drizzle/` folder and applies them to the in-memory test database — the exact same schema the real app would end up with.

## Phase 4, Day 6 — GitHub Actions, and gating a service on whether it's actually configured

### `.github/workflows/ci.yml` — this project's first YAML workflow

`name: CI` — just a label, shown in GitHub's own UI for this workflow.

`on: push: pull_request:` — **triggers**: this whole file only runs when one of these things happens. Listing both means it runs on every push to any branch, AND separately whenever a pull request is opened or updated.

`jobs: check: runs-on: ubuntu-latest` — a **job** is one machine's worth of work; `runs-on` picks which kind of machine GitHub spins up fresh for it — here, a clean Ubuntu Linux virtual machine, thrown away after the job finishes.

`steps:` — an ordered list; each one runs after the previous one finishes, and if any step fails, the whole job stops there and is marked failed.

`uses: actions/checkout@v4` — a **step that runs someone else's pre-built code** (an "action") instead of a shell command — this one's job is simply "clone this repository's code onto the machine," the first thing almost every workflow needs.

`uses: actions/setup-node@v4` with `with: node-version: "24"` — another pre-built action, this one installs Node.js itself onto the fresh machine, at the exact version this project actually uses. `with:` is how you pass options into an action, the same idea as props into a component.

`run: npm ci` — unlike `uses:`, `run:` executes a literal shell command. `npm ci` (not `npm install`) is the version meant for exactly this situation: it installs precisely what `package-lock.json` says, and fails outright if that file and `package.json` disagree — faster and stricter than `npm install`, which is why CI always uses it and a developer's own machine usually doesn't.

### `src/lib/sentry.ts` — a service that's either fully on or fully off

`const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;` — reads an environment variable once, at the top of the file. `EXPO_PUBLIC_` is a naming convention Expo itself looks for — anything prefixed that way gets baked into the app bundle at build time (the same reasoning `.env.example`'s Supabase keys already explain).

`if (!dsn) return;` at the top of both `initSentry()` and `reportError()` — an **early return**: if there's no DSN, stop the function immediately, before doing anything else. This is the entire mechanism that makes Sentry "gated" — no `if/else` branching logic elsewhere in the app ever has to ask "is Sentry configured?" — the two functions themselves already know, and simply do nothing when it isn't.

---

## Real-device fixes (first run on a Samsung A51) — D-033 to D-037

### `src/components/FormRenderer.tsx` — `select` is now tappable choices
`case "select":` — a `switch` branch: this block runs when a field's `type` is `"select"`. It used to draw a text box; now it draws one small rounded button per option.
`(field.options ?? []).map((o) => ...)` — loop over the template's list of options (`??` means "or an empty list if there are none"). Each `o` is `{ value: "poor", label: "Poor" }`: `value` is what gets stored, `label` is what a person reads.
`const active = v === o.value;` — is this option the currently stored answer? `===` means "exactly equal, including capital letters" — which is the whole reason this change exists: a text box let the phone turn "poor" into "Poor", which is *not* equal, so the dependent photo field never appeared.
`onScheduleSave(field.key, o.value); void onImmediateSave(field.key, o.value);` — tell the form the new answer, and also save it to the database right now. `void` says "I'm deliberately not waiting for this to finish."
`accessibilityRole="button"` / `accessibilityState={{ selected: active }}` — what a screen reader announces: "Poor, button, selected".

### `src/lib/media.ts` — resize the LONG edge
`const isPortrait = asset?.width && asset?.height ? asset.height > asset.width : false;` — `asset` is what the camera returned. `?.` means "if it exists". A photo is portrait if it's taller than wide.
`resize: isPortrait ? { height: 1600 } : { width: 1600 }` — a `condition ? a : b` picks one of two options. The old code always used `{ width: 1600 }`: for an upright photo that keeps the shape, so the height became 2844. Now whichever side is longer becomes 1600.

### `FormRenderer.tsx` (GPS) — an error is shown, never disguised as data
Before: any failure other than "permission denied" saved `{ latitude: 12.34, longitude: 56.78 }`. Now: `Alert.alert("Couldn't get your location", ...)` then `return;` — show a message and stop. `return;` inside the handler is what guarantees nothing is saved after it.

### `src/components/SignaturePad.tsx` — our own buttons
`const padRef = React.useRef<any>(null);` — a `ref` is a handle to a component you rendered, so you can call its methods later. `useSafeAreaInsets()` gives the sizes of the phone's notch and gesture bar so buttons aren't hidden behind them.
`ref={padRef}` — attach the handle to the signature drawing area.
`padRef.current?.clearSignature()` / `padRef.current?.readSignature()` — call the library's own "wipe the canvas" and "give me the picture" methods. `readSignature()` triggers the library's `onOK` callback with the image, which is what saves the file.
`webStyle={... display: none ...}` — the library draws its own Clear/Save buttons inside a hidden web page; on the real phone they didn't appear, so they're hidden on purpose and replaced by our three real buttons (Cancel / Clear / Save).

### `FormRenderer.tsx` (signature save) — no fake files
`} catch (writeErr) { ... Alert.alert(...); return; }` — if writing the file fails, tell the person and stop. Before, an empty `catch` let the code carry on and record a picture at a path that didn't exist.

### `src/app/(tabs)/settings.tsx` — scrolling
`<ScrollView contentContainerStyle={...}>` replaces a plain `<View>`. A `View` is a fixed box: anything taller than the screen is just cut off. A `ScrollView` lets you swipe.

### `eas.json`, `app.json` — getting the app onto a phone
`"buildType": "apk"` — an APK is a file you can install straight from a cable; the default type (AAB) can only be given to the Play Store. `"package": "com.ibrahiem17.fieldnote"` — the app's permanent unique name on Android. `"SENTRY_DISABLE_AUTO_UPLOAD": "true"` — skip a step that needs an account we don't have yet.

### `src/db/templateDefs.ts` — `dbId` (D-038)
`dbId: string;` — a new field on every template: its permanent database identity, a UUID (a long random-looking code like `dfc5b06c-4463-…` that is guaranteed unique). The old `id: "roof-inspection-v1"` is a readable nickname; a database column that expects a UUID rejects a nickname outright, which is exactly the error the phone showed.
`id: t.dbId,` (in `seed.ts`) — when the app puts a template into the local database, use the UUID, not the nickname. `mockStore.ts` does the same so the web preview behaves like the real thing.

### `supabase/migrations/20260920000001_seed_templates.sql`
`insert into public.templates (...) values (...)` — put a row in the server's templates table. `$tmpl$ ... $tmpl$` — a "dollar quote": lets the JSON text contain quote marks without escaping each one. `on conflict (id) do nothing` — if that UUID is already there, skip it; so running it twice does no harm.

### `src/db/templateDefs.test.ts`
`expect(t.dbId).toMatch(UUID)` — assert the id looks like a UUID (`UUID` is a pattern of 8-4-4-4-12 hex characters). `expect(migration).toContain(...)` — read the SQL file as text and assert it contains each template's id and exact JSON, so the app and the server can't quietly disagree again.

### `FormRenderer.tsx` (photo)
`if (!res) return;` — `null` means "the person backed out of the camera": do nothing. `if (res.error) { Alert.alert(...); return; }` — a real failure: say so, save nothing. The old code made a pretend photo in both cases.

### `src/app/(tabs)/settings.tsx` — the dev "Create test project" button (D-039)
`const { createProject } = await import("@/repositories/projects");` — load the repository function only when the button is pressed (`import(...)` as a function = "fetch this file now", the same trick used for the camera and location code).
`await createProject({ name: ..., clientName: "Device Test", address: "1 Test Street" })` — the same function a real "new project" screen would call. It saves the project AND adds a note to the outbox (the to-send list) in one step, which is what makes it sync.
`new Date().toLocaleTimeString()` — the current time as text, put in the name so each test project is easy to tell apart.
`${TEMPLATE_DEFS.length} templates` — a backtick string (`` ` ``) lets `${...}` drop a live value into text; the dialog used to say a hard-coded "3" while only 2 templates existed.

### `src/lib/reportHtml.test.ts`
`function makeData(overrides = {})` — builds a fake report with sensible defaults; each test overrides only what it cares about (`...overrides` copies extra fields over the defaults). `expect(html).toContain("Not recorded")` — assert the text appears in the output. `expect(html).not.toContain("<script>alert")` — assert dangerous text does NOT appear raw. `toMatch(/class="field-value not-recorded">Not recorded</)` — assert against a pattern (a regular expression) rather than an exact string.

### `src/app/projects/new.tsx` — the New Project screen (D-039)
`export default function NewProjectScreen()` — a screen is just a function that returns what to draw; Expo Router turns the file's path (`projects/new.tsx`) into the address `/projects/new` automatically.
`const [name, setName] = useState("");` — a piece of memory the screen keeps: `name` is the current text, `setName` replaces it (and redraws the screen). Three of these hold what's typed; `nameError` holds a message or nothing (`undefined`); `saving` is true while the save runs so the button shows a spinner.
`if (name.trim().length === 0) { setNameError("Name is required."); return; }` — `trim()` chops spaces off both ends, so a name of just spaces counts as empty; the message is shown and the function stops (`return`), so nothing is saved.
`clientName: clientName.trim() || null` — `||` means "or": if the trimmed text is empty (falsy), use `null` (nothing) instead of an empty string, so the database holds "no client" rather than a blank one.
`await createProject({...})` — the same function everything else uses; it saves the project and adds a note to the outbox in one step. `router.replace(`/projects/${project.id}`)` — go to the new project's page, *replacing* this form in the back-history so "back" doesn't return to an empty form.
`try { ... } catch (e) { Alert.alert("Couldn't save", ...) } finally { setSaving(false); }` — if saving fails, tell the person (never pretend it worked); `finally` always runs, so the spinner stops either way.
`keyboardShouldPersistTaps="handled"` — lets you tap the Create button while the keyboard is open without the first tap only closing the keyboard.

### `src/app/_layout.tsx` and `(tabs)/index.tsx`
`<Stack.Screen name="projects/new" options={{ ..., presentation: "modal" }} />` — declares the route and makes it slide up like a sheet. The Projects tab's new `<Button label="New Project" onPress={() => router.push("/projects/new")} />` opens it (`push` adds it on top of the current screen).

### `src/repositories/templates.ts` — `ensureBuiltInTemplates` (D-040)
`export async function ensureBuiltInTemplates(): Promise<void>` — `Promise<void>` means "an async function that gives back nothing, just finishes". Its whole job: make sure the app's built-in templates are in the phone's database.
`if (!isDbAvailable()) return;` — in the web preview there's no real database (the app uses a pretend one that already has templates), so do nothing.
`for (const def of TEMPLATE_DEFS) { ... }` — loop over every built-in template, one at a time, handing each to `def`.
`db.insert(templates).values({...})` — try to add the row. `.onConflictDoUpdate({ target: templates.id, set: {...}, setWhere: lt(templates.version, def.version) })` — "if a row with this id already exists, then instead of failing, update it — but only where the stored `version` is *less than* (`lt`) the app's". That last clause is what makes it safe to run on every startup: same version → nothing changes; a newer version stored → left alone.
`syncStatus: "synced"` — the server already has these rows (a migration put them there), so they're honestly "synced". No outbox note is written: this isn't something a person did.

### `src/app/_layout.tsx` — waiting for templates
`const [templatesReady, setTemplatesReady] = useState(false);` — a yes/no memory: have the templates been checked yet?
`useEffect(() => { if (!success) return; ensureBuiltInTemplates().catch(...).finally(() => setTemplatesReady(true)); }, [success]);` — once migrations finish (`success`), run the check; `.catch` reports a failure without crashing; `.finally` always flips the flag so the app opens either way. `if (!success || !templatesReady)` shows the spinner until both are done.

### `src/db/templateDefs.test.ts` (new parts)
`readdirSync(migrationsDir).filter((f) => f.includes("seed_") ...)` — list the files in the migrations folder and keep the template-seeding ones. `renderer.matchAll(/case "([a-z]+)":/g)` — scan the renderer's source text for every `case "something":` and collect the names: that's the list of field types it can draw. `new Set(keys).size` — a Set holds each value once, so if its size is smaller than the list's length, the list had duplicates.

### `src/repositories/answers.ts` — folding edits into an unsent insert (D-041)
`const pending = await tx.select().from(outbox).where(eq(outbox.entityId, existingRow.id));` — read the to-send list entries (the "outbox") for this one answer. `tx` is the database transaction: everything inside succeeds together or not at all.
`const pendingInsert = pending.find((o) => o.operation === "insert");` — `.find` returns the first entry that matches, or nothing. Is there still an "insert" waiting to be sent?
`{ ...existingRow, ...patch }` — the `...` spreads an object's fields into a new object; later ones win. So this is "the whole answer row, with the new values laid over the old". `JSON.stringify(...)` turns it into text for storage.
`await tx.update(outbox).set({ payloadJson: ... }).where(eq(outbox.id, pendingInsert.id)); return ...;` — rewrite the waiting insert with the latest values and stop (`return`). Without this, the old code threw the insert away and queued an "update" — but the server can't update a row it has never been given, so the answer was lost.

### `src/lib/numberInput.ts`
`/^-?\d*\.?\d*$/.test(normalised)` — a regular expression (a pattern for text): optional `-`, any digits, optional `.`, any digits. `/\d/.test(...)` — and at least one real digit, so a lone "-" or "." doesn't count. `Number.isFinite(n)` — reject anything that isn't an ordinary number. The three return shapes (`empty` / `number` / `partial`) are a "discriminated union": a `kind` label says which shape you have, and TypeScript then knows which fields exist.

### `src/components/FormRenderer.tsx` — `NumberField`
`const [draft, setDraft] = useState<string | null>(null);` — `draft` is what the person is typing right now, or `null` when they're not editing. `value={draft ?? numberToText(value)}` — `??` means "if the left is null, use the right": show the draft while editing, otherwise the saved value. `onBlur` (leaving the box) commits: it turns the draft into a number (or "no answer") and passes it up, then `setDraft(null)` goes back to showing the saved value. `void onCommit(...)` — start the save and don't wait for it.

### `src/lib/dates.ts`
`raw.replace(/\D/g, "")` — delete everything that isn't a digit (`\D` = non-digit, `g` = everywhere). `.slice(0, 8)` — keep at most 8. Then hyphens are inserted after the 4th and 6th digit. `new Date(Date.UTC(year, month, 0)).getUTCDate()` — a trick: day 0 of the *next* month is the last day of this one, so this gives "how many days does this month have", including leap years. `isValidIsoDate` compares the typed day against it.

### `src/lib/visibility.ts`
`rule.in !== undefined && !(Boolean(other) && rule.in.includes(other))` — if the rule has an `in` list, and the answer is NOT (non-empty AND in the list), the field is hidden (`return false`). `equals` uses `!==` — "not strictly equal", so `1` and `"1"` differ. `isEmpty` treats `undefined`, `null`, `""` and `[]` as "nothing typed", but `0` counts as a real answer.

### `src/lib/syncApi.ts` — telling "no answer" from "no" (D-042)
`unreachable?: boolean;` — the `?` makes it optional: a failure result may or may not carry this flag. `export function isUnreachable(error: { code?: string | null }): boolean { return !error.code; }` — `!` means "not": true when there's no error code (missing, `null`, or an empty string). Errors that come *from the server* always have a code; one that never got an answer (no signal) doesn't.

### `src/lib/syncEngine.ts` — not spending attempts when offline
`if (!pushResult.ok && pushResult.unreachable) { ... return { ok: false, ..., unreachable: true }; }` — `&&` means "and": if the push failed AND the reason was "couldn't reach the server", put the row back to "pending" and return early, *before* the code below that counts an attempt and schedules a delay. Returning early is what saves the attempt.
`if (outcome.unreachable) { result.offline = true; break; }` — `break` leaves the `for` loop immediately: with no signal, trying the remaining entries would only fail the same way.
`offline?: boolean` on `DrainResult` — an optional yes/no on the result object so callers can tell "stopped because there's no signal" from "finished".

### `src/lib/attachmentUpload.ts`
`const { data: sessionData } = await supabase.auth.getSession(); const userId = sessionData.session?.user.id;` — read who's signed in from what the phone already stored (no internet needed). `?.` means "if `session` exists, take its `user`, otherwise give `undefined`". The old `getUser()` phoned the server to check, which failed exactly when the signal was poor.
`unreachable: status === undefined` — `===` is strict equality; a storage error with no HTTP status number never reached the server.

### `src/lib/syncEngine.integration.test.ts`
`jest.fn()` / `mockPush.mockResolvedValue(...)` — a "mock function" is a stand-in you control: here it plays the network, returning whatever result each test needs. `mockReset()` clears what it has recorded. `expect(mockPush).toHaveBeenCalledTimes(1)` — assert it was called exactly once (proving the second entry wasn't even tried). `for (let i = 0; i < MAX_ATTEMPTS * 3; i++) await drainOutbox();` — run 24 sync attempts back to back to prove none of them dead-letters anything while offline.
