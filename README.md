# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and
some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react)
  uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in
  [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc)
  uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev
& build performances. To add it, see
[this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the
configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,
      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install
[eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x)
and
[eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom)
for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

# Vault

Supabase vault isn't available locally, so we use placeholder for the secret
key. Replace 'sk_test_placeholder' with your actual Stripe Secret Key.

# BUGS

[ ] - ChatDetail.tsx - doesn't refresh the user connection on mount/navigation
without refresh. If I send a req from U1, U2 accepts it, I navigate to messages
from U1, the UI doesn't update to show the connection. It only updates after a
refresh.

[ ] - The simultaneous connections from U1 and U2 to each other aren't handled
gracefully.

[ ] - On login, website flickers, and shows registration page as well for a
split second. It also takes user back to landing page, and re-navigates back to
/.

[ ] - For SEO optimization, change the / to landing and /discover to /discover,
so that screenshots of the / page don't show loading screens

[ ] - Add alternative / comparitive blog pages for SEO and easy search

[ ] - To ensure that Search Engines can accurately identify the topic of this
webpage, it is important to include the most common keywords in the title tag,
meta description, and heading tags (from
https://seositecheckup.com/seo-audit/fireconnect.me)

[ ] - On Login the app flickers between /, onboarding, landing, and then / [ ] -
On mobile discover card, add gesture to hold and view image in full screen
(until hold) [ ] - On Profile media should show a loading icon if not loaded yet
[ ] - In explore show spy list (4-5 width of screen), with button at the end to
see all and navigate to the spy list page [ ] - Add beta icon on the app logo [
] - Discover card images should show a loading spinner or just text while images
are being fetched [ ] - Fix the navigation buttons in the app, with history
removal of duplicate, and back button should not take user back to sign in page
of Google or otherwise. It should only navigate within the app [ ] - Free
userthat has viewed someone sees loading on the hidden image [ ] - Max users
spylist [ ] - App analytics [ ] - Stripe production release
