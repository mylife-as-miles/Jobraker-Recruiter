export const skill = String.raw`
# Web Search & Scrape Skill (Firecrawl)

You have two builtin tools for getting information off the internet, both powered by Firecrawl. Choose based on whether you already have a URL.

## Tools

### web-search
Search the web and get clean, structured content back. Returns titles, URLs, descriptions, and (by default) the full page content as markdown for each result — so a single search usually gives you everything you need without a follow-up scrape.

**Parameters:**
- \`query\` (required) — the search query (max 500 characters)
- \`numResults\` — how many results to return (default 5, max 20)
- \`scrape\` — whether to also pull full-page markdown for each result. Defaults to \`true\`. Set \`false\` for a faster, links-only (title/url/description) result when you only need to find a page.
- \`tbs\` — time filter: \`qdr:h\` (past hour), \`qdr:d\` (past day), \`qdr:w\` (past week), \`qdr:m\` (past month), \`qdr:y\` (past year). Omit for all time.
- \`sources\` — array of result types: \`web\` (default), \`news\` (current events), \`images\`.

**Best for:**
- Discovering pages for a query ("find candidates with seed-stage experience at fintech startups")
- Current events and news (use \`sources: ["news"]\` and a tight \`tbs\`)
- Researching a company, person, or topic when you don't yet have a URL
- Quick factual lookups (set \`scrape: false\` for speed)

### web-scrape
Scrape a single, known URL and return its content as clean markdown. Use this when you already have the exact page you want.

**Parameters:**
- \`url\` (required) — the full URL (including \`https://\`)
- \`formats\` — output formats: \`markdown\` (default), \`html\`, \`links\`, \`summary\`
- \`onlyMainContent\` — strip nav/footer/boilerplate. Defaults to \`true\`.
- \`waitFor\` — milliseconds to wait for JS-heavy pages to render before scraping.

**Best for:**
- Reading a specific candidate profile, company page, or job posting you already have the link to
- Extracting the full text of an article a previous search surfaced
- Following a link the user pasted

## Choosing Between the Two

- **No URL yet → \`web-search\`.** It finds pages AND returns their content in one call.
- **Already have a URL → \`web-scrape\`.** Don't search for a page you can already point to.

## How Many Searches to Do

**Start with exactly ONE \`web-search\` call.** Because results already include full markdown, one good search is almost always enough. Wait for the result before deciding if more is needed.

Only make a follow-up call if:
- The first search returned irrelevant or empty results (try a refined query)
- The task has clearly distinct sub-topics the first query couldn't cover
- The user explicitly asks you to dig deeper

For deep extraction of one specific result, follow up with a single \`web-scrape\` on that URL rather than re-searching.

## Setup

Both tools require a Firecrawl API key in \`config/firecrawl.json\`:

\`\`\`json
{ "apiKey": "fc-..." }
\`\`\`

Get a key at firecrawl.dev. If the key is missing, the tools return a clear error telling the user where to add it.
`;

export default skill;
