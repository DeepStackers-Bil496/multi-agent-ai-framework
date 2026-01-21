import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import * as DDG from "duck-duck-scrape";
import * as cheerio from "cheerio";

// User agent to look like a real browser
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Timeout for fetch requests (10 seconds)
const FETCH_TIMEOUT = 10000;

// =============================================================================
// WEB SEARCH (DuckDuckGo)
// =============================================================================

interface WebSearchResult {
    title: string;
    url: string;
    description: string;
}

/**
 * web_search - Search the web using DuckDuckGo
 */
export function createWebSearchTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "web_search",
        description: "Search the web using DuckDuckGo. Returns relevant web pages with titles, URLs, and descriptions. Use for general queries, how-to questions, product searches, and current information.",
        schema: z.object({
            query: z.string().describe("The search query"),
            numResults: z.number().optional().describe("Number of results to return (default 10, max 25)"),
            region: z.string().optional().describe("Region code for localized results (e.g., 'us-en', 'uk-en', 'de-de')"),
        }),
        func: async ({ query, numResults = 10, region }) => {
            try {
                const searchOptions: DDG.SearchOptions = {
                    safeSearch: DDG.SafeSearchType.MODERATE,
                };

                if (region) {
                    // DDG uses region codes like 'us-en', 'uk-en', etc.
                    searchOptions.locale = region;
                }

                const results = await DDG.search(query, searchOptions);

                if (!results.results || results.results.length === 0) {
                    return `No results found for "${query}". Try different search terms.`;
                }

                const limitedResults = results.results.slice(0, Math.min(numResults, 25));

                const formattedResults: WebSearchResult[] = limitedResults.map((r: DDG.SearchResult) => ({
                    title: r.title,
                    url: r.url,
                    description: r.description,
                }));

                const output = formattedResults.map((r, i) =>
                    `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.description}`
                ).join("\n\n");

                return `**Web Search Results for "${query}":**\n\n${output}`;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                return `Error performing web search: ${errorMessage}`;
            }
        },
    });
}

// =============================================================================
// NEWS SEARCH (DuckDuckGo)
// =============================================================================

/**
 * news_search - Search for recent news using DuckDuckGo
 */
export function createNewsSearchTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "news_search",
        description: "Search for recent news articles using DuckDuckGo. Returns news with titles, URLs, sources, and publication dates. Use for current events, breaking news, and recent developments.",
        schema: z.object({
            query: z.string().describe("The news search query"),
            numResults: z.number().optional().describe("Number of results to return (default 10, max 25)"),
        }),
        func: async ({ query, numResults = 10 }) => {
            try {
                const results = await DDG.searchNews(query, {
                    safeSearch: DDG.SafeSearchType.MODERATE,
                });

                if (!results.results || results.results.length === 0) {
                    return `No news found for "${query}". Try different search terms.`;
                }

                const limitedResults = results.results.slice(0, Math.min(numResults, 25));

                const output = limitedResults.map((r: DDG.NewsResult, i: number) => {
                    const dateStr = r.relativeTime ? ` (${r.relativeTime})` : "";
                    const source = r.syndicate ? ` - ${r.syndicate}` : "";
                    return `${i + 1}. **${r.title}**${dateStr}${source}\n   URL: ${r.url}\n   ${r.excerpt || ""}`;
                }).join("\n\n");

                return `**News Search Results for "${query}":**\n\n${output}`;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                return `Error performing news search: ${errorMessage}`;
            }
        },
    });
}

// =============================================================================
// ACADEMIC SEARCH (arXiv + Semantic Scholar)
// =============================================================================

interface ArxivPaper {
    title: string;
    authors: string[];
    summary: string;
    published: string;
    arxivId: string;
    url: string;
    categories: string[];
}

interface SemanticScholarPaper {
    title: string;
    authors: string[];
    year: number | null;
    abstract: string | null;
    url: string | null;
    citationCount: number;
    venue: string | null;
    paperId: string;
}

/**
 * Search arXiv for academic papers
 */
async function searchArxiv(query: string, maxResults: number = 10): Promise<ArxivPaper[]> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

    const response = await fetch(url, {
        headers: { "User-Agent": "SearchAgent/1.0" },
    });

    if (!response.ok) {
        throw new Error(`arXiv API error: ${response.status}`);
    }

    const xmlText = await response.text();
    const papers: ArxivPaper[] = [];

    // Simple XML parsing for arXiv Atom feed
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xmlText)) !== null) {
        const entry = match[1];

        const getTagContent = (tag: string): string => {
            const tagMatch = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
            return tagMatch ? tagMatch[1].trim() : "";
        };

        const title = getTagContent("title").replace(/\s+/g, " ");
        const summary = getTagContent("summary").replace(/\s+/g, " ");
        const published = getTagContent("published").split("T")[0];

        // Get arxiv ID from id tag
        const idMatch = entry.match(/<id>([^<]+)<\/id>/);
        const fullId = idMatch ? idMatch[1] : "";
        const arxivId = fullId.split("/abs/").pop() || "";

        // Get authors
        const authorRegex = /<author>\s*<name>([^<]+)<\/name>/g;
        const authors: string[] = [];
        let authorMatch;
        while ((authorMatch = authorRegex.exec(entry)) !== null) {
            authors.push(authorMatch[1].trim());
        }

        // Get categories
        const categoryRegex = /<category[^>]*term="([^"]+)"/g;
        const categories: string[] = [];
        let catMatch;
        while ((catMatch = categoryRegex.exec(entry)) !== null) {
            categories.push(catMatch[1]);
        }

        papers.push({
            title,
            authors,
            summary: summary.length > 500 ? summary.substring(0, 500) + "..." : summary,
            published,
            arxivId,
            url: `https://arxiv.org/abs/${arxivId}`,
            categories,
        });
    }

    return papers;
}

/**
 * Search Semantic Scholar for academic papers
 */
async function searchSemanticScholar(query: string, maxResults: number = 10): Promise<SemanticScholarPaper[]> {
    const encodedQuery = encodeURIComponent(query);
    const fields = "title,authors,year,abstract,url,citationCount,venue,paperId";
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=${maxResults}&fields=${fields}`;

    const response = await fetch(url, {
        headers: {
            "User-Agent": "SearchAgent/1.0",
        },
    });

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error("Rate limited by Semantic Scholar. Please try again later.");
        }
        throw new Error(`Semantic Scholar API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        return [];
    }

    return data.data.map((paper: {
        title?: string;
        authors?: Array<{ name?: string }>;
        year?: number;
        abstract?: string;
        url?: string;
        citationCount?: number;
        venue?: string;
        paperId?: string;
    }) => ({
        title: paper.title || "Untitled",
        authors: paper.authors?.map((a) => a.name || "Unknown") || [],
        year: paper.year || null,
        abstract: paper.abstract ? (paper.abstract.length > 400 ? paper.abstract.substring(0, 400) + "..." : paper.abstract) : null,
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        citationCount: paper.citationCount || 0,
        venue: paper.venue || null,
        paperId: paper.paperId || "",
    }));
}

/**
 * academic_search - Search academic papers across multiple sources
 */
export function createAcademicSearchTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "academic_search",
        description: "Search for academic papers and research across arXiv and Semantic Scholar. Returns papers with titles, authors, abstracts, and links. Use for scientific research, technical papers, and academic topics.",
        schema: z.object({
            query: z.string().describe("The academic search query (e.g., 'transformer neural networks', 'climate change effects')"),
            source: z.enum(["all", "arxiv", "semantic_scholar"]).optional().describe("Search source: 'all' (default), 'arxiv' (preprints), or 'semantic_scholar' (peer-reviewed + preprints)"),
            numResults: z.number().optional().describe("Number of results per source (default 5, max 10)"),
        }),
        func: async ({ query, source = "all", numResults = 5 }) => {
            try {
                const maxPerSource = Math.min(numResults, 10);
                const results: string[] = [];

                // Search arXiv
                if (source === "all" || source === "arxiv") {
                    try {
                        const arxivPapers = await searchArxiv(query, maxPerSource);
                        if (arxivPapers.length > 0) {
                            const arxivOutput = arxivPapers.map((p, i) => {
                                const authorsStr = p.authors.slice(0, 3).join(", ") + (p.authors.length > 3 ? " et al." : "");
                                return `${i + 1}. **${p.title}** (${p.published})\n   Authors: ${authorsStr}\n   arXiv: ${p.arxivId} | Categories: ${p.categories.slice(0, 3).join(", ")}\n   URL: ${p.url}\n   ${p.summary}`;
                            }).join("\n\n");
                            results.push(`**arXiv Results:**\n\n${arxivOutput}`);
                        } else {
                            results.push("**arXiv:** No results found.");
                        }
                    } catch (arxivError) {
                        const msg = arxivError instanceof Error ? arxivError.message : "Unknown error";
                        results.push(`**arXiv:** Error - ${msg}`);
                    }
                }

                // Search Semantic Scholar
                if (source === "all" || source === "semantic_scholar") {
                    try {
                        const ssPapers = await searchSemanticScholar(query, maxPerSource);
                        if (ssPapers.length > 0) {
                            const ssOutput = ssPapers.map((p, i) => {
                                const authorsStr = p.authors.slice(0, 3).join(", ") + (p.authors.length > 3 ? " et al." : "");
                                const yearStr = p.year ? ` (${p.year})` : "";
                                const venueStr = p.venue ? ` | ${p.venue}` : "";
                                const citationsStr = p.citationCount > 0 ? ` | ${p.citationCount} citations` : "";
                                const abstractStr = p.abstract ? `\n   ${p.abstract}` : "";
                                return `${i + 1}. **${p.title}**${yearStr}\n   Authors: ${authorsStr}${venueStr}${citationsStr}\n   URL: ${p.url}${abstractStr}`;
                            }).join("\n\n");
                            results.push(`**Semantic Scholar Results:**\n\n${ssOutput}`);
                        } else {
                            results.push("**Semantic Scholar:** No results found.");
                        }
                    } catch (ssError) {
                        const msg = ssError instanceof Error ? ssError.message : "Unknown error";
                        results.push(`**Semantic Scholar:** Error - ${msg}`);
                    }
                }

                if (results.length === 0) {
                    return `No academic papers found for "${query}". Try different search terms or a broader topic.`;
                }

                return `**Academic Search Results for "${query}":**\n\n${results.join("\n\n---\n\n")}`;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                return `Error performing academic search: ${errorMessage}`;
            }
        },
    });
}

// =============================================================================
// WEB SCRAPING TOOLS
// =============================================================================

/**
 * Fetch HTML from a URL with proper headers
 */
async function fetchHTML(url: string): Promise<string> {
    console.log("[SearchAgent] Fetching URL:", url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        console.log(`[SearchAgent] Fetched ${html.length} bytes`);
        return html;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Clean text by removing excess whitespace
 */
function cleanText(text: string): string {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
}

/**
 * fetch_url - Fetch raw HTML from URL
 */
export function createFetchUrlTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "fetch_url",
        description: "Fetch the raw HTML content from a URL. Returns the complete HTML source. Use this when you need to inspect the raw structure of a page.",
        schema: z.object({
            url: z.string().url().describe("The URL to fetch"),
        }),
        func: async ({ url }) => {
            try {
                const html = await fetchHTML(url);

                // Truncate if too long
                const maxLength = 50000;
                if (html.length > maxLength) {
                    return `**HTML Content** (truncated to ${maxLength} chars):\n\`\`\`html\n${html.substring(0, maxLength)}\n...[truncated]\n\`\`\``;
                }

                return `**HTML Content** (${html.length} chars):\n\`\`\`html\n${html}\n\`\`\``;
            } catch (error) {
                return `**Error fetching URL:** ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * Fetch content using Jina AI Reader (handles JavaScript-rendered pages)
 */
async function fetchWithJina(url: string): Promise<string> {
    const jinaUrl = `https://r.jina.ai/${url}`;
    console.log("[SearchAgent] Fetching with Jina Reader:", url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout for Jina

    try {
        const response = await fetch(jinaUrl, {
            headers: {
                "Accept": "text/markdown",
                "User-Agent": USER_AGENT,
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`Jina API error: ${response.status}`);
        }

        const text = await response.text();
        console.log(`[SearchAgent] Jina returned ${text.length} chars`);
        return text;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * scrape_text - Extract readable text from URL (with Jina fallback for JS-rendered sites)
 */
export function createScrapeTextTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "scrape_text",
        description: "Extract readable text content from a webpage. Handles JavaScript-rendered pages (news sites, SPAs) using Jina AI Reader. Use this to read articles, blog posts, or any webpage content.",
        schema: z.object({
            url: z.string().url().describe("The URL to scrape text from"),
            useJina: z.boolean().optional().describe("Use Jina AI Reader for JS-rendered sites (default: true). Set to false for simple HTML pages."),
        }),
        func: async ({ url, useJina = true }) => {
            try {
                // Try Jina first for better results on modern sites
                if (useJina) {
                    try {
                        const content = await fetchWithJina(url);
                        if (content && content.length > 100) {
                            // Truncate if too long
                            const maxLength = 15000;
                            const truncated = content.length > maxLength
                                ? content.substring(0, maxLength) + "\n\n...[truncated]"
                                : content;
                            return `**Content from ${url}:**\n\n${truncated}`;
                        }
                    } catch (jinaError) {
                        console.log("[SearchAgent] Jina failed, falling back to direct fetch:", jinaError);
                    }
                }

                // Fallback to direct HTML scraping
                const html = await fetchHTML(url);
                const $ = cheerio.load(html);

                // Remove scripts, styles, and other non-content elements
                $('script, style, noscript, nav, footer, header, aside, iframe').remove();

                // Get main content (try common containers first)
                let text = '';
                const mainSelectors = ['main', 'article', '.content', '#content', '.post', '.article'];

                for (const selector of mainSelectors) {
                    const content = $(selector).text();
                    if (content && content.length > 100) {
                        text = content;
                        break;
                    }
                }

                // Fallback to body if no main content found
                if (!text) {
                    text = $('body').text();
                }

                text = cleanText(text);

                // Truncate if too long
                const maxLength = 10000;
                if (text.length > maxLength) {
                    text = text.substring(0, maxLength) + "\n...[truncated]";
                }

                if (!text || text.length < 50) {
                    return `**Could not extract meaningful content from ${url}**\n\nThe page may require JavaScript to render, use authentication, or block scrapers. Try accessing it directly in your browser.`;
                }

                return `**Extracted Text from ${url}:**\n\n${text}`;
            } catch (error) {
                return `**Error scraping text:** ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * extract_links - Get all links from page
 */
export function createExtractLinksTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "extract_links",
        description: "Extract all links from a webpage. Returns a list of URLs with their anchor text. Use this to discover related pages or resources.",
        schema: z.object({
            url: z.string().url().describe("The URL to extract links from"),
            limit: z.number().optional().default(50).describe("Maximum number of links to return (default 50)"),
        }),
        func: async ({ url, limit }) => {
            try {
                const html = await fetchHTML(url);
                const $ = cheerio.load(html);

                const links: { href: string; text: string }[] = [];
                const baseUrl = new URL(url);

                $('a[href]').each((_, element) => {
                    if (links.length >= (limit || 50)) return false;

                    let href = $(element).attr('href') || '';
                    const text = cleanText($(element).text()).substring(0, 100);

                    // Skip empty, javascript:, and anchor-only links
                    if (!href || href.startsWith('javascript:') || href === '#') return;

                    // Convert relative URLs to absolute
                    try {
                        if (href.startsWith('/')) {
                            href = baseUrl.origin + href;
                        } else if (!href.startsWith('http')) {
                            href = new URL(href, url).href;
                        }
                    } catch {
                        return; // Skip invalid URLs
                    }

                    links.push({ href, text: text || '(no text)' });
                });

                if (links.length === 0) {
                    return `**No links found** on ${url}`;
                }

                const formatted = links
                    .map((link, i) => `${i + 1}. [${link.text}](${link.href})`)
                    .join('\n');

                return `**Found ${links.length} links on ${url}:**\n\n${formatted}`;
            } catch (error) {
                return `**Error extracting links:** ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * extract_metadata - Get title, description, and meta tags
 */
export function createExtractMetadataTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "extract_metadata",
        description: "Extract metadata from a webpage including title, description, Open Graph tags, and other meta information. Use this to get an overview of a page without reading all content.",
        schema: z.object({
            url: z.string().url().describe("The URL to extract metadata from"),
        }),
        func: async ({ url }) => {
            try {
                const html = await fetchHTML(url);
                const $ = cheerio.load(html);

                const metadata: Record<string, string> = {};

                // Title
                metadata['title'] = $('title').text().trim() || '';

                // Meta description
                metadata['description'] = $('meta[name="description"]').attr('content') || '';

                // Open Graph tags
                metadata['og:title'] = $('meta[property="og:title"]').attr('content') || '';
                metadata['og:description'] = $('meta[property="og:description"]').attr('content') || '';
                metadata['og:image'] = $('meta[property="og:image"]').attr('content') || '';
                metadata['og:url'] = $('meta[property="og:url"]').attr('content') || '';
                metadata['og:type'] = $('meta[property="og:type"]').attr('content') || '';

                // Twitter card
                metadata['twitter:card'] = $('meta[name="twitter:card"]').attr('content') || '';
                metadata['twitter:title'] = $('meta[name="twitter:title"]').attr('content') || '';

                // Keywords
                metadata['keywords'] = $('meta[name="keywords"]').attr('content') || '';

                // Author
                metadata['author'] = $('meta[name="author"]').attr('content') || '';

                // Canonical URL
                metadata['canonical'] = $('link[rel="canonical"]').attr('href') || '';

                // Format output
                const lines = Object.entries(metadata)
                    .filter(([, value]) => value) // Only non-empty values
                    .map(([key, value]) => `- **${key}**: ${value}`);

                if (lines.length === 0) {
                    return `**No metadata found** on ${url}`;
                }

                return `**Metadata for ${url}:**\n\n${lines.join('\n')}`;
            } catch (error) {
                return `**Error extracting metadata:** ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

// =============================================================================
// EXPORT ALL TOOLS
// =============================================================================

/**
 * Create all Search Agent tools (search + web scraping)
 */
export function createAllSearchAgentTools(): DynamicStructuredTool[] {
    return [
        // Search tools
        createWebSearchTool(),
        createNewsSearchTool(),
        createAcademicSearchTool(),
        // Web scraping tools
        createFetchUrlTool(),
        createScrapeTextTool(),
        createExtractLinksTool(),
        createExtractMetadataTool(),
    ];
}
