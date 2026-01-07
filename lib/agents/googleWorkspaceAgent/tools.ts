import { DynamicStructuredTool } from "@langchain/core/tools";

// Gmail tools
import { createAllGmailTools } from "./services/gmail/gmailTools";

// Calendar tools
import { createAllCalendarTools } from "./services/calendar/calendarTools";

// Drive tools
import { createAllDriveTools } from "./services/drive/driveTools";

// Docs tools
import { createAllDocsTools } from "./services/docs/docsTools";

// Sheets tools
import { createAllSheetsTools } from "./services/sheets/sheetsTools";

// Slides tools
import { createAllSlidesTools } from "./services/slides/slidesTools";

/**
 * Creates all Google Workspace Agent tools.
 * Total: 27 tools across 6 services
 * - Gmail: 6 tools
 * - Calendar: 5 tools
 * - Drive: 7 tools
 * - Docs: 3 tools
 * - Sheets: 4 tools
 * - Slides: 2 tools
 */
export function createAllGoogleWorkspaceAgentTools(): DynamicStructuredTool[] {
    return [
        // Gmail (6 tools)
        ...createAllGmailTools(),

        // Calendar (5 tools)
        ...createAllCalendarTools(),

        // Drive (7 tools)
        ...createAllDriveTools(),

        // Docs (3 tools)
        ...createAllDocsTools(),

        // Sheets (4 tools)
        ...createAllSheetsTools(),

        // Slides (2 tools)
        ...createAllSlidesTools(),
    ];
}
