# Revenue Twin

Revenue Twin is a short-stay host product concept. The homepage introduces a demand-first workflow using a permitted sample listing in Barog. Its interactive demand scenario uses hypothetical inputs; a transparent weighted score changes with the sliders, and `/api/demand` asks Gemini to interpret the scenario. The response is saved in Supabase with token counts and a visible completed-analysis read-back.

**The scenario is not a validated demand forecast.** Revenue Twin does not currently receive MakeMyTrip, Booking.com, Agoda, Airbnb, or Google search and booking feeds. The working one-night Gemini rate check remains available at `/pilot.html#try`; it uses host-entered USD sample inputs and does not claim live market access.

## Live deployment

GitHub: <https://github.com/gupta0109/GenAI_project/tree/main/revenue-twin-site>
Vercel: <https://genaiproject-revenue-twin-site.vercel.app>

The Vercel project was imported from the repository with `revenue-twin-site` as its **Root Directory**. Push changes to that folder on `main` to trigger a production deployment. If a push does not trigger one, inspect the project's Git connection and deployment status in Vercel. Do not create a second Vercel project.

Files to update together:

- `index.html` — new landing page and sample demand workspace.
- `assets/*.avif` — five user-permitted Barog listing photos.
- `api/demand.js` — Gemini interpretation of illustrative signals, stored in Supabase.
- `pilot.html` — preserves the original working Gemini rate check.
- `README.md` and `api/demand.test.js` — documentation and focused checks.

Keep the existing `api/_lib.js`, `api/price.js`, `api/stats.js`, `main.js`, `styles.css`, `supabase.sql`, `package.json`, and `vercel.json`. The new endpoint reuses the existing Supabase table, atomic three-analyses-per-24-hours cap, `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `RATE_LIMIT_SALT`. No new environment variable or SQL migration is required.

After deployment, open the homepage, choose **Explore your AI demand outlook**, select **AI demand forecast**, change one slider, and click **Ask Gemini to explain this scenario**. The result should contain an AI explanation and a completed-analysis count. `/pilot.html#try` should still run the existing rate check. The local `file://` preview displays the weighted scenario but cannot call `/api/demand`.

## Checks and limits

Run `node --test` with Node 20+. The server checks that each input is a whole number from 0 to 100, limits input size, caps paid calls per visitor, keeps keys server-side, and stores the Gemini output and token counts. The model is instructed not to invent access to OTA data or promise a price or earnings uplift.

For a genuine forecast, obtain consented host history and licensed or approved demand feeds, match comparable homes by property type and booking date, train and backtest a model against future bookings, then display calibrated uncertainty and source freshness. Hotel search activity can be a supporting proxy for a villa, not a substitute for comparable-home bookings. References: [Booking.com Demand API](https://developers.booking.com/demand/docs/getting-started/overview), [Agoda Demand API](https://developer.agoda.com/demand/docs/getting-started), [Google Travel Analytics](https://support.google.com/travelanalytics/answer/11204014?hl=en).
