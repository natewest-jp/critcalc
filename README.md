# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv create --template minimal --types ts --add prettier eslint --install npm .
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## License

critcalc is split across four sets of terms. [`COPYRIGHT.md`](COPYRIGHT.md) maps each path to its license.

- **Code**: [GNU AGPL-3.0](LICENSE). If you run a modified version as a public website, you must offer its users the source.
- **Curated data and docs** (`src/lib/data/`, `docs/`): [CC BY-SA 4.0](LICENSE-DATA). Credit it as "Data from critcalc (critcalc.app), CC BY-SA 4.0".
- **critcalc's own artwork** (the logo, app icons, social card, scene plates and landing art): all rights reserved.
- **Genshin Impact content**: © HoYoverse. critcalc is a fan project and is not affiliated with or endorsed by HoYoverse.

Third-party code, fonts and data sources are credited in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
