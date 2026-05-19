# Rolling out subscription plans

Branch: `feature/subscription-plans`

Before merging this to `master` and deploying to Railway, work through the steps below in order. Every existing merchant currently has the equivalent of a "business" tier — this branch changes that, so a careless rollout will silently disable widgets on production storefronts.

## 1. Identify current merchants to grandfather

```sql
SELECT merchant FROM OauthTokens;
```

Note the merchant IDs. Decide whether to grandfather them into Pro or Business (typically Business so nothing changes for them).

## 2. Create paid tiers in Salla Partner Portal

- Log in to <https://salla.partners/>
- Open the Alfa Plus app → Plans / Subscriptions
- Create two paid products. Suggested names (Arabic + English so name-matching is robust):
  - **Pro / احترافي** — 99 SAR / month
  - **Business / أعمال** — 249 SAR / month
- Save and publish.

## 3. Set Railway environment variables

On the Railway service for production:

| Variable | Value | Purpose |
|---|---|---|
| `SALLA_PRO_PLAN_NAMES` | `Pro,احترافي,professional` | Substrings that map a Salla plan name to our Pro tier |
| `SALLA_BUSINESS_PLAN_NAMES` | `Business,أعمال,enterprise` | Same for Business tier |
| `GRANDFATHERED_BUSINESS_MERCHANTS` | `<comma-separated IDs from step 1>` | Pre-existing merchants keep full access |
| `GRANDFATHERED_PRO_MERCHANTS` | *(empty for now)* | Use if you want a softer grandfather |

Do **not** set `DEV_FORCE_PLAN` on production — that overrides plan checks for everyone.

## 4. Test on a preview deployment first

Easiest path: in Railway, duplicate the service and point it at `feature/subscription-plans`. Give it a separate domain. Then:

1. Install the app on a test Salla store.
2. Hit `/api/whoami` → confirm `merchantId` is detected.
3. Hit `/api/my-plan` → confirm it returns `{ plan: "free", source: "default" }` (or whatever you expect).
4. Set `DEV_FORCE_PLAN=business` → confirm widgets render on the storefront, auto-fix-seo endpoint returns 200.
5. Set `DEV_FORCE_PLAN=free` → confirm `/api/widget-config` strips paid widgets and `/api/auto-fix-seo` returns 402.
6. Buy the Pro plan from the Salla side → confirm `/api/my-plan` flips to `{ plan: "pro", source: "salla-api" }` within ~5 minutes (or call `POST /api/plan/refresh` to bust the cache).

## 5. Merge + deploy

Once the preview deploy looks right:

```bash
git checkout master
git merge feature/subscription-plans
git push origin master
```

Railway auto-deploys.

## 6. Watch for issues

In the first 24 hours, watch the logs for:

- `[SallaSubscription] lookup failed` — plan API errors (will fall back to free)
- 402 responses on `/api/auto-fix-seo`, `/api/lead`, `/api/leads/export` — merchants hitting the paywall (expected for new free-tier users, suspicious if a grandfathered ID hits it)

## 7. Rollback plan

If something breaks:

- **Fast rollback** — set `DEV_FORCE_PLAN=business` on Railway. Everyone gets full access again until you fix the issue.
- **Full rollback** — `git revert <merge commit>` and push.

## Where the code lives

- Plan catalog + feature gating: [services/Plans.js](services/Plans.js)
- Plan resolution (Salla API, grandfather, cache): [services/SallaSubscription.js](services/SallaSubscription.js)
- Endpoint guards + view context: [app.js](app.js)
- Pricing page: [views/plans.html](views/plans.html) (served at `/plans`)
