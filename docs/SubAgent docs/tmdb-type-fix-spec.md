# Spec: Fix TS2322 in `src/api/tmdb/index.ts`

## Context
- Repo: `rodrinac/cinemaclub`
- File: `src/api/tmdb/index.ts`
- Related types: `node_modules/smart-request-balancer/dist/index.d.ts`
- Relevant runtime behavior: `node_modules/smart-request-balancer/dist/index.js`
- TypeScript config: root `tsconfig.json`
- Verification command: `npx tsc --noEmit`

## Current error
Running TypeScript typecheck currently fails with:

```text
src/api/tmdb/index.ts(41,3): error TS2322: Type 'Promise<void | T>' is not assignable to type 'Promise<T>'.
  Type 'void | T' is not assignable to type 'T'.
    'T' could be instantiated with an arbitrary type which could be unrelated to 'void | T'.
```

The error is reported on `getQueued`:

```ts
const getQueued = <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return queue.request(async (retry) => {
    try {
      const response = await api.get<T>(url, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        return retry(error.response.data?.parameters?.retry_after ?? 1);
      }
      throw error;
    }
  }, "default");
};
```

## Why TypeScript infers `Promise<void | T>`
There are two return paths inside the async callback passed to `queue.request(...)`:

1. success path: `return response.data;` → type `T`
2. retry path: `return retry(...);` → type `void`

Because that callback is `async`, TypeScript wraps the union of its branch return types in `Promise<...>`, so the callback is inferred as:

```ts
(retry) => Promise<T | void>
```

That union then flows outward, so `queue.request(...)` is inferred as `Promise<T | void>`, which conflicts with the explicit `getQueued(...): Promise<T>` annotation.

## Root cause
The immediate root cause is the `retry(...)` branch.

`smart-request-balancer` declares:

```ts
type RetryFunction = (delay?: number) => void;
type QueueRequest<R> = (RetryFunction: RetryFunction) => Promise<R>;
request<R>(fn: QueueRequest<R>, key?: string, rule?: string): Promise<R>;
```

So the library type definitions say:
- `retry(...)` returns `void`
- the request handler must return `Promise<R>`

But the library's own README and runtime behavior expect the retry branch to resolve without producing a final value. In `dist/index.js`, `retryFn(...)` only flips internal retry state; after the handler promise resolves, the queue checks that state and re-enqueues the request instead of resolving the caller with data. So runtime behavior supports the current logic, but TypeScript still sees a `void`-returning branch and infers `Promise<void | T>`.

In short:
- runtime semantics are "schedule retry, do not produce final `T` yet"
- type semantics are "this branch returned `void`"
- that mismatch triggers `TS2322`

## Related repository facts
- `tsconfig.json` has `strict: true` and `noEmit: true`, so this generic return-type mismatch is enforced during typecheck.
- `skipLibCheck: true` does **not** suppress this error because the failure is in app code consuming the library types, not inside the dependency declaration file itself.
- There are no dedicated TMDB client tests in `tests/`; existing tests cover the proxy server and database code. For this change, TypeScript typecheck is the primary verification.

## Proposed fix
Keep the implementation local to `src/api/tmdb/index.ts` and make the retry branch explicit as a non-value branch for TypeScript, while preserving the existing runtime behavior.

Recommended change:

```ts
const getQueued = <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return queue.request<T>(async (retry): Promise<T> => {
    try {
      const response = await api.get<T>(url, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        return retry(error.response.data?.parameters?.retry_after ?? 1) as never;
      }

      throw error;
    }
  }, "default");
};
```

### Why this fix matches the repo and the actual behavior
- It is surgical: one local change in the file already producing the error.
- It preserves the current queue/retry runtime semantics.
- It keeps the current coding style: 2-space indentation and existing export structure.
- It does not require broader dependency patching or declaration overrides for a single call site.
- No new types are required. If a helper type is later introduced for the error payload, follow repository convention and use a `type` alias, not an `interface`.

### Alternative, broader fix (not recommended as the first choice)
A repo-local declaration override for `smart-request-balancer` could widen the callback return type to `Promise<R | void>`. That would align more closely with the library runtime/README mismatch, but it is a broader typing change and less surgical than fixing the only current call site.

## Verification
Run:

```bash
npx tsc --noEmit
```

### Expected result after the fix
- Exit code `0`
- No `TS2322` reported from `src/api/tmdb/index.ts`

### Verification run for this analysis task
I ran the verification command **before** any production changes. Current outcome:
- Exit code: `2`
- Reported error: the single `TS2322` error above in `src/api/tmdb/index.ts`

## Implementation notes for the next subagent
1. Edit only `src/api/tmdb/index.ts` for the production fix.
2. Preserve unrelated working-tree changes.
3. Keep 2-space indentation.
4. If additional typing cleanup is done, prefer `type` over `interface`.
5. Re-run `npx tsc --noEmit` and confirm it succeeds.
