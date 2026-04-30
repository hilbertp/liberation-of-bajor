# Regression Suite

## Framework

**Runner:** Node-native test runner (`node --test`)

Test files live under `regression/` and use the `*.test.js` glob pattern.

Invocation:

```bash
node --test regression/**/*.test.js
```

## Test naming convention

Every test name MUST include a `slice-<id>-ac-<index>` substring so the
orchestrator can map failures back to specific acceptance criteria.

Example:

```js
test('slice-42-ac-1 widget renders correctly', () => { /* ... */ });
```

Tests that do not follow this convention will be reported with
`slice_id: "unknown"` and `ac_index: -1` in the `regression-fail` payload,
and a `BASHIR_TEST_NAMING_VIOLATION` register event will be emitted.
