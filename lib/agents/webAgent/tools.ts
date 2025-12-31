import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import * as cheerio from "cheerio";

// User agent to look like a real browser
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Timeout for fetch requests (10 seconds)
const FETCH_TIMEOUT = 10000;

/**
 * Fetch HTML from a URL with proper headers
 */
async function fetchHTML(url: string): Promise<string> {
    console.log("[WebScraperAgent] Fetching URL:", url);

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
        console.log(`[WebScraperAgent] Fetched ${html.length} bytes`);
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

// =============================================================================
// WEB SCRAPER TOOLS
// =============================================================================

/**
 * fetch_url - Fetch raw HTML from URL
 */
export function createFetchUrlTool() {
    return new DynamicStructuredTool({
        name: "fetch_url",
        description: "Fetch the raw HTML content from a URL. Returns the complete HTML source.",
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
 * scrape_text - Extract readable text from URL
 */
export function createScrapeTextTool() {
    return new DynamicStructuredTool({
        name: "scrape_text",
        description: "Extract readable text content from a webpage, removing HTML tags, scripts, and styles.",
        schema: z.object({
            url: z.string().url().describe("The URL to scrape text from"),
        }),
        func: async ({ url }) => {
            try {
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
export function createExtractLinksTool() {
    return new DynamicStructuredTool({
        name: "extract_links",
        description: "Extract all links from a webpage. Returns a list of URLs with their anchor text.",
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
export function createExtractMetadataTool() {
    return new DynamicStructuredTool({
        name: "extract_metadata",
        description: "Extract metadata from a webpage including title, description, Open Graph tags, and other meta information.",
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

/**
 * Create all Web tools
 */
export function createAllWebAgentTools(): DynamicStructuredTool[] {
    return [
        createFetchUrlTool(),
        createScrapeTextTool(),
        createExtractLinksTool(),
        createExtractMetadataTool(),
    ];
}
