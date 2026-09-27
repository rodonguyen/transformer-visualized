# Deployment

The app builds to plain static files. There is no server code, and there are no environment variables or API keys.

```bash
npm run build     # writes dist/ (index.html + hashed assets)
npm run preview   # check the build at http://localhost:4173
```

Any host works with these settings: build command `npm run build`, output directory `dist`, Node.js 20.19+ or 22.12+.
Step links such as `/#12` use the URL hash, so no rewrite rules are needed.

## Vercel (current host)

Production: **https://transformer-visualized.vercel.app**

### Deploy from your machine

```bash
npx vercel@latest deploy --prod
```

The first run links the folder to a Vercel project and writes `.vercel/project.json`, which holds the project and account IDs.
That folder is git-ignored; don't commit it.
Use a current CLI (`npx vercel@latest`, or update your global install), because the Vercel API rejects old versions.

### Deploy on every push

Once the code is on GitHub, open the project in the Vercel dashboard, go to **Settings → Git**, and connect the repository.

- Pushes to the production branch deploy to production.
- Other branches and pull requests get their own preview URLs.
- Vercel detects Vite by itself (build `vite build`, output `dist`), so you don't need a `vercel.json`.

The free Hobby plan is for personal, non-commercial use.

## Other free hosts

| Host | Deploy from your machine | Notes |
| --- | --- | --- |
| Cloudflare Pages | `npx wrangler login`, then `npx wrangler pages deploy dist --project-name transformer-visualized` | Generous free plan; commercial use allowed. Can also build from a connected Git repo (framework preset: Vite). |
| Netlify | `npx netlify-cli login`, then `npx netlify-cli deploy --prod --dir dist` | The free plan is credit-based (deploys and bandwidth both use credits). |
| GitHub Pages | See below | Served from a sub-path, so the build needs a base path. |

### GitHub Pages

Project sites are served from `https://<user>.github.io/<repo>/`, so the asset URLs need that prefix:

```bash
npx vite build --base=/transformer-visualized/
```

Publish `dist/` with a GitHub Actions workflow. Vite's guide has a ready-made one: <https://vite.dev/guide/static-deploy#github-pages>.

## Source code

The source is on GitHub at **https://github.com/rodonguyen/transformer-visualized**, under the MIT licence (see [LICENSE](../LICENSE)).

- Pushing to `main` doesn't redeploy the site until Vercel is connected to the repository (see [Deploy on every push](#deploy-on-every-push)). Until then, run `npx vercel@latest deploy --prod` after you push.
- **Keep secrets out of the repo.** Hosting tokens (Vercel, Cloudflare, Netlify) are stored in your user profile, not in the project. If you add CI, put tokens in the repository's *Settings → Secrets and variables*, never in a committed file.
