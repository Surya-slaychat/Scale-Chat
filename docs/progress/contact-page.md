# Progress — Contact Page (Chat List Home)

| | |
|---|---|
| **Owner** | Surya (founder) |
| **Slice** | 1-on-1 — Contact Page (BRD §3.1, §3.5, §3.7) |
| **Status** | Shipped |
| **Last updated** | 2026-05-24 |
| **Design source** | Figma `JYhOHnaEDgGYNxJShD9WDK`, page `0:1`, frame **"Contact Page"** (variants: Base / 3-dot / Plus / Filter) |
| **BRD** | [`docs/brd/1-on-1.md`](../brd/1-on-1.md) |

---

## Overview

The Contact Page is the post-login home — chat list, search, filter chips, popover menus, bottom tab bar. This doc captures what was shipped to bring it to production quality and what's intentionally deferred. The page now reads from the live NestJS API; mock-mode still works against `EXPO_PUBLIC_USE_MOCKS=true` for offline UI iteration.

A separate concern landed alongside this work: the **self-learning documentation loop** (`my-app/CLAUDE.md` §7). Every behavior-changing commit must keep this doc and the root status snapshot in sync, or include `[skip-claudemd] <reason>` in the message.

---

## Status table

| Affordance (Figma variant) | Frontend | Backend | Notes |
|---|---|---|---|
| Base layout (greeting, search, status row, filter pill, list, tabs) | ✅ | ✅ `GET /chats` | Existing layer; unchanged this slice |
| **Theme toggle pill** | ✅ wired | n/a (on-device only) | MMKV `themeMode` (`system` → `light` → `dark`); `useThemeMode()` layered under `useTheme()` so screens don't change |
| **3-dot menu — Select Chats** | ✅ wired | uses existing per-chat endpoints | Was an `Alert.alert` stub; now enters multi-select mode |
| 3-dot menu — Read All | ✅ existing | ✅ `PATCH /chats/read-all` | Pre-existing; carried forward |
| Plus menu — New Chat | ✅ wired to live API | ✅ `POST /chats/one-on-one`, `GET /contacts?search=` | Was reading `SEED_CONTACTS`; now hits real `/contacts` with debounced search via `useDeferredValue` |
| Plus menu — Create Group / Add Contact / Create Super Group | ✅ existing routes | ✅ existing endpoints | Unchanged this slice |
| Filter menu — preset chips (Super / All / Unread / Group / Favourites) | ✅ existing | ✅ `GET /chats?filter=` | Unchanged |
| **Filter menu — custom chips + "Add"** | ✅ new | ✅ new endpoints | `GET/POST/DELETE /chats/filters`; new `UserChatFilter` Prisma model; criteria evaluated server-side |
| **Edit-filters pill (pencil icon)** | ✅ wired | n/a | Was a no-op `<Pressable>`; now routes to `/edit-filters` modal |
| **Multi-select bulk actions (Mark Read / Favourite / Archive)** | ✅ new `SelectModeBar` | ✅ idempotent setters | `PUT /chats/:id/favourite { value }` + `PUT /chats/:id/archive { value }` — spam-tap safe (the existing PATCH toggles stayed for the per-chat header gesture) |

---

## Files touched

### Frontend (`my-app/`)

- `src/app/(tabs)/index.tsx` — main Contact Page; reducer-backed multi-select state, theme toggle wired, custom filter activation, edit-filters route.
- `src/app/(modals)/new-chat.tsx` — rewritten to consume `useContacts({ search })` instead of `SEED_CONTACTS`; creates chat via `apiClient.post('/chats/one-on-one', …)`.
- `src/app/(modals)/edit-filters.tsx` — NEW. Create / list / delete custom filters with checkbox UI for the 5 criteria toggles.
- `src/features/chat/components/chat-row.tsx` — accepts `selected?` + `onLongPress?` props; renders a leading checkbox in select mode.
- `src/features/chat/components/filter-menu.tsx` — merges presets + custom rows + "Add" entry; `active`, `customFilters`, `activeCustomId` props.
- `src/features/chat/components/select-mode-bar.tsx` — NEW. Header replacement in select mode.
- `src/features/chat/hooks/use-bulk-chat-actions.ts` — NEW. `poolMap(items, 8, fn)` fan-out; `bulkMarkRead`, `bulkFavourite`, `bulkArchive`, etc.
- `src/features/chat/hooks/use-chat-filters.ts` — NEW. MMKV-cached `/chats/filters` list + create/delete helpers.
- `src/features/chat/hooks/use-threads.ts` — accepts optional `{ customFilterId }`; passes through to repository.
- `src/features/chat/data/chat-repository.ts` — `ListThreadsArgs`; interface gained `{ customFilterId? }`.
- `src/features/chat/data/api-chat-repository.ts` — forwards `?customFilterId=` query param.
- `src/features/chat/data/mock-chat-repository.ts` — accepts the arg, ignores it (custom filters need real persistence).
- `src/features/contacts/hooks/use-contacts.ts` — NEW. Mirrors `useThreads` pattern; debounces `search` via React 19 `useDeferredValue`.
- `src/features/contacts/data/contacts-repository.ts` — `list()` signature swapped to `list({ search?, cursor?, limit? })`.
- `src/features/contacts/data/api-contacts-repository.ts` — builds `URLSearchParams` for the three args.
- `src/features/contacts/data/mock-contacts-repository.ts` — in-memory `search` filter.
- `src/hooks/use-theme.ts` — reads `useThemeMode()`, falls back to OS scheme. Public return unchanged.
- `src/hooks/use-theme-mode.ts` — NEW. MMKV-backed `'system'|'light'|'dark'` with cross-component sync via `useMMKVString`.
- `src/lib/mmkv.ts` — added `StorageKeys.themeMode`, `StorageKeys.chatFiltersCache`.
- `src/lib/api-client.ts` — added `apiClient.put()`.

### Shared (`packages/shared/`)

- `src/schemas/contacts.ts` — `ContactsListQuerySchema` extends `CursorQuerySchema` with `search`.
- `src/schemas/chats.ts` — `ChatBooleanSetterSchema` for idempotent PUT bodies; `ChatListQuerySchema` gained `customFilterId?: uuid`.
- `src/schemas/chat-filters.ts` — NEW. `ChatFilterCriteriaSchema` (`.strict()`), `CreateChatFilterSchema`, `ChatFilterSchema`.
- `src/schemas/index.ts` — re-exports `chat-filters`.

### Backend (`apps/api/`)

- `prisma/schema.prisma` — new `UserChatFilter` model with `userId`, `name`, `criteria: Json`, `createdAt`, FK to `User`.
- `prisma/migrations/20260525011359_add_user_chat_filter/` — generated migration applied to local Postgres.
- `src/modules/contacts/contacts.controller.ts` — `Query(ContactsListQuerySchema)` instead of `CursorQuerySchema`.
- `src/modules/contacts/contacts.service.ts` — `list(userId, query)` accepts the new shape; `where.OR: [{ displayName: { contains, mode: 'insensitive' } }, { phoneE164: { contains } }]`.
- `src/modules/chats/chats.controller.ts` — added `Get('filters')`, `Post('filters')`, `Delete('filters/:id')`, `Put(':id/favourite')`, `Put(':id/archive')`.
- `src/modules/chats/chats.service.ts` — added `listFilters`, `createFilter`, `deleteFilter`, `setFavourite`, `setArchive`; extended `list()` to accept `customFilterId` and fold the parsed criteria into `chatWhere`/`memberWhere`.
- `src/modules/messages/messages.gateway.ts` — **sidecar fix**: replaced reserved Socket.IO event name `connect_error` with `chat:auth_error` (the API was crash-looping on every emulator socket reconnect). Unrelated to the Contact Page but blocked all API operation; logged here so the next dev knows why this changed.

---

## API endpoints touched / added

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/contacts?search=&cursor=&limit=` | Added `search` predicate (case-insensitive displayName + phone substring) |
| `POST` | `/chats/one-on-one` | Already existed — newly consumed by `/new-chat` modal |
| `PUT` | `/chats/:id/favourite` | **New.** Idempotent setter `{ value: boolean }` for bulk fan-outs |
| `PUT` | `/chats/:id/archive` | **New.** Same pattern as above |
| `GET` | `/chats/filters` | **New.** List the user's custom filter chips |
| `POST` | `/chats/filters` | **New.** Create — `{ name, criteria }`, criteria validated against `ChatFilterCriteriaSchema.strict()` |
| `DELETE` | `/chats/filters/:id` | **New.** Ownership-checked; 404 if not yours |
| `GET` | `/chats?customFilterId=<uuid>` | Existing endpoint, **new query param** — server loads + validates the row, folds criteria into Prisma `where` |

---

## How to verify (on the running emulator)

```
docker start scalechat-pg scalechat-redis      # if stopped
npm run api:dev                                 # NestJS on :4000
cd my-app && npx expo start --dev-client       # Metro on :8081
```

Then on `emulator-5554` (sign in with phone + OTP `1234` in dev):

1. **Theme**: tap the toggle pill on the gradient header → palette cycles `system → light → dark`. Kill app → relaunch → mode persists.
2. **Search contacts**: Plus menu → New Chat → modal opens with real contacts from Postgres. Type "megha" → list narrows. API logs show `/contacts?search=megha`.
3. **Multi-select**: long-press any chat row → header swaps to the SelectModeBar. Select 3 chats → tap **Favourite** → all 3 favourite badges appear → tap again → no flip (idempotent setter).
4. **Mark Read bulk**: select rows with unread badges → tap **Mark read** → badges clear. API logs show N parallel `PATCH /chats/:id/read` requests.
5. **Custom filter**: Filter menu → **Add** → modal opens. Name "Unread groups", check "Unread only" + "Groups only", **Save filter**. Back on the Contact Page → open Filter menu → new chip appears → tap → list narrows; API logs show `/chats?customFilterId=<uuid>`.
6. **Custom filter delete**: open Edit filters → tap trash icon → confirm → chip disappears from the menu.
7. **Theme rule**: try a commit that edits any `src/` file without touching `CLAUDE.md` — read §7 and either update CLAUDE.md / this file, or add `[skip-claudemd] cosmetic` to the message.

---

## Next-developer pickup notes

Things to know before the next ticket touches the Contact Page:

1. **The `matchesFilter` client-side function still runs** in `(tabs)/index.tsx` (search text + preset filtering). Server-side filter wiring for presets via `?filter=` was NOT added in this slice — only `customFilterId`. If you want server-side preset filtering, extend `useThreads()` to pass `filter` too. Don't simply delete `matchesFilter` — the local `query` text search still depends on it.
2. **No `DELETE /chats/:id` endpoint exists.** "Bulk delete" is intentionally out of scope. If a future BRD adds it, both the `SelectModeBar` and the per-chat options sheet need updates.
3. **`mockChatRepository` ignores `customFilterId`.** The mock store is in-memory and custom filters need real persistence to be useful — the arg is accepted to keep the interface contract identical so the toggle between mock/api stays a one-line `EXPO_PUBLIC_USE_MOCKS` flip.
4. **`chatFiltersCache` MMKV key is versioned** (`chat.filters.cache.v1`). If the criteria shape grows in a future migration, bump to v2 and clear the old key — the existing `chatSnapshot.v2` convention is the model.
5. **The Socket.IO `connect_error` → `chat:auth_error` rename** is a sidecar fix. If you add a client-side listener for auth failures during the socket handshake, point it at the new event name.
6. **The Status row at the top of the page is NOT part of this slice.** It lives in `src/features/stories/` and is its own (deferred) feature. Don't change it here.
7. **The toggle pill's visual position currently jumps** between left / center / right knob positions. Optional polish: animate the knob with `react-native-reanimated`.

---

## Open questions

- Should custom filters be sharable across devices for the same user? Currently yes — they live in Postgres, so any device that logs in with the same JWT sees them. Cache invalidation across devices isn't pushed; the next list-load picks them up.
- Should we add a `mutedExcluded` toggle to the editor UI? The criteria schema supports it but the modal currently only exposes the four most common (`unread`, `favourite`, `archived`, `group`, `super`). Trivial to add; deferred to keep the editor minimal.
- Telemetry: no analytics on filter usage. Worth tracking once Amplitude lands — which presets vs customs are people actually using?
