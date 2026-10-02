# Revenue Twin assignment site

An original landing page and Vercel-function implementation based on the user's [shared Claude artifact](https://claude.ai/artifact/NaHBwYz6Bq194sAGp8mYx9). The shared artifact is a sample-data prototype. This repository's live feature is a narrowly scoped **rate check for one open night**: the user supplies their current rate, a comparable-home median and a demand label; a deterministic rule suggests a rate; Gemini explains the decision and uncertainty; Supabase stores each completed analysis and supplies a visible read-back count and average suggested change.

## Status

- The page and serverless code are written, and the rate rule has local tests.
- **Gemini, Supabase and Vercel have not been connected in this workspace.** Until environment variables, database schema and deployment are supplied, the page correctly labels itself preview mode. The code does not silently substitute a fake AI response or fake usage count.
- No public GitHub or Vercel URL has been created, and no live test transcripts or database screenshots exist yet.

## Deploy

The uploaded class handout demonstrates a browser-side `signups` table and a photo upload. Revenue Twin instead sends the rate form to `/api/price`, so use **`revenue_twin_requests`** and the server-only secret key. Do not add an anonymous insert policy or paste a Supabase secret into `index.html`.

1. Create a Supabase project and run `supabase.sql` in its SQL editor.
2. Push this folder to a GitHub repository and import it into Vercel.
3. Set `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (the backend secret key) and `RATE_LIMIT_SALT` in Vercel project environment variables. Set `RATE_LIMIT_SALT` to a long random value. Do not commit real values or show them in screenshots. A current Supabase `sb_secret_...` key belongs in the `apikey` header and stays server-side.
4. Deploy, visit `/api/stats`, and submit three rate checks from a browser. The fourth should receive a 429 cap. Check that at least three rows have `status=complete`, inputs and outputs, and token counts. Test a second browser/IP and an invalid input. Verify the visible read-back count matches the database.
5. In the GitHub repository, search for the standard Gemini API-key prefix and verify no key is committed. Capture the live URL, repository URL, hidden-value environment screenshot, five stored rows and two real test transcripts for the assignment.

The rate rule is intentionally inspectable: `comparable median × {quiet: 0.90, normal: 1.00, busy: 1.08}`, limited to 20% below or 25% above the user's current rate and rounded to $5. It is a **prototype heuristic**, not a validated optimisation model or prediction of realised revenue. Event notes inform Gemini's explanation but do not change the numeric rule.

The server stores a salted hash of IP address and browser user-agent for a 24-hour, three-request cap; it does not store a name or email. This is a practical assignment control, not identity-grade anti-abuse protection. Requests are reserved atomically in Postgres before the paid model call, so concurrent submissions share the same cap. Input rates and event notes are saved; users should avoid personal information in that note.

## Local checks

Run `npm test` with Node 20+. A simple static server can preview the landing page, though `/api/*` works only in a Vercel-compatible development or deployment environment.

The code uses Vercel's `/api` Node.js function convention, Gemini's `generateContent` REST API and Supabase's Data REST/RPC API. Source references: [Vercel Functions](https://vercel.com/docs/functions/runtimes/node-js), [Gemini API](https://ai.google.dev/api/generate-content), [Supabase REST](https://supabase.com/docs/guides/api), [Supabase secret key handling](https://supabase.com/docs/guides/getting-started/api-keys).
