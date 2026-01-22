# SSR Pre-hydration Audit Report

This report identifies which pages in the application are currently utilizing
Server-Side Rendering (SSR) for initial data hydration and which ones rely on
client-side fetching.

## 🟢 Fully SSR Pre-hydrated

These pages have dedicated `loader` functions that fetch the necessary data on
the server, ensuring the UI is complete upon the first paint.

| Page                | Route                | Data Fetched on Server                                           |
| :------------------ | :------------------- | :--------------------------------------------------------------- |
| **Home / Landing**  | `/`                  | User status, Stripe products, AI users.                          |
| **Profile Preview** | `/profile/:id`       | Target user details, images, connection status, message history. |
| **Notifications**   | `/notifications`     | Notification events list.                                        |
| **Chat List**       | `/chat`              | Threads, Participant Info, Online Matches.                       |
| **Chat Detail**     | `/chat/:id`          | Messages, Other User Detail, Connection status, Thread ID.       |
| **Matches**         | `/matches`           | Connection requests and match list.                              |
| **Subscription**    | `/subscription`      | Stripe plans and pricing.                                        |
| **Spy List**        | `/spy-list`          | List of spied-on users.                                          |
| **Policy / Terms**  | `/privacy`, `/terms` | Document content (Privacy/Terms).                                |
| **My Profile**      | `/profile`           | User profile, profile shared images, profile spy counts.         |
| **Settings**        | `/settings`          | User settings, match statistics, member duration.                |
| **Edit Profile**    | `/profile/edit`      | User profile data for form initialization.                       |
| **Random Chat**     | `/random-chat`       | Existing matchmaking pool status.                                |

## 🟡 Partially SSR Pre-hydrated

These pages receive some data from the `root.tsx` loader (via `AuthContext`),
but may still perform additional fetches on the client or lack specific
page-level SSR logic.

| Page | Route | Missing SSR Data |
| :--- | :---- | :--------------- |
| None |       |                  |

## 🔴 Not SSR Pre-hydrated

These pages lack a `loader` function and rely entirely on client-side
`useEffect` or React Query hooks for their primary data. Users will see a
loading spinner or empty state on initial load.

| Page | Route | Critical Content Missing in SSR |
| :--- | :---- | :------------------------------ |
| None |       |                                 |

## 🛠 Suggested Fixes

To achieve full SSR pre-hydration for critical pages, the following steps were
followed:

1. **Move data fetching logic from `useEffect` hooks into `loader` exports**
   within the respective screen files.
2. **Utilize `useLoaderData`** to pass initial data to components.
3. **Initialize React Query cache** on the server if using
   `@tanstack/react-query` to ensure the client resumes from the server-side
   state without re-fetching.
