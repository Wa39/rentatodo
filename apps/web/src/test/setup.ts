import '@testing-library/jest-dom/vitest'

// Compatibility shim: react-router's data router (createBrowserRouter) builds
// a real `Request` on every navigation via @remix-run/router's
// createClientSideRequest, even with zero loaders/actions defined. Under
// vitest's jsdom environment, jsdom installs its own AbortController /
// AbortSignal / Headers classes on globalThis (see vitest's populateGlobal
// in vitest/dist/chunks: AbortController/AbortSignal/Headers are in its
// overridden KEYS list; Request/Response/fetch are not, because jsdom
// itself doesn't implement them, so those three stay whatever they were
// before jsdom ran). Node's native Request validates `init.signal` via a
// webidl converter that captured its expected `AbortSignal` class at the
// undici module's *own* load time — not whatever currently sits on
// `globalThis.AbortSignal` — so a signal produced by jsdom's
// `new AbortController()` fails an `instanceof` check with:
//   "RequestInit: Expected signal (\"AbortSignal {}\") to be an instance of
//   AbortSignal."
// This breaks any test that mounts a real `createBrowserRouter`/
// `RouterProvider` under jsdom (App.test.tsx is the only one — every other
// route test uses the plain <MemoryRouter>, which never builds a Request).
//
// Fix: source Request/Response/Headers/fetch from the `undici` package
// (added as a devDependency) instead of the mismatched natives, and let
// that same import evaluate *after* jsdom has installed its own
// AbortController/AbortSignal for this test file, so undici's internal
// webidl check captures jsdom's AbortSignal as its reference class instead
// of Node's. undici does not export AbortController/AbortSignal itself
// (it expects the platform global to already provide them), so those two
// stay as jsdom's — which is what we want, since that's what `new
// AbortController()` inside react-router will produce.
import { fetch, Headers, Request, Response } from 'undici'

Object.assign(globalThis, { fetch, Headers, Request, Response })
