import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { googleApiRequest } from "../../auth/googleAuth";

// Sheets Create Spreadsheet Tool
export function createSheetsCreateSpreadsheetTool() {
    return new DynamicStructuredTool({
        name: "sheets_create_spreadsheet",
        description: "Create a new Google Spreadsheet with optional sheet names.",
        schema: z.object({
            title: z.string().describe("Spreadsheet title"),
            sheetTitles: z
                .array(z.string())
                .optional()
                .describe("Names for the sheets (default: single sheet named 'Sheet1')"),
        }),
        func: async ({ title, sheetTitles }) => {
            try {
                const sheets =
                    sheetTitles && sheetTitles.length > 0
                        ? sheetTitles.map((name) => ({
                              properties: { title: name },
                          }))
                        : [{ properties: { title: "Sheet1" } }];

                const spreadsheet = await googleApiRequest<{
                    spreadsheetId: string;
                    properties: { title: string };
                    spreadsheetUrl: string;
                    sheets: Array<{ properties: { title: string; sheetId: number } }>;
                }>("sheets", "/spreadsheets", {
                    method: "POST",
                    body: JSON.stringify({
                        properties: { title },
                        sheets,
                    }),
                });

                return JSON.stringify({
                    status: "success",
                    spreadsheetId: spreadsheet.spreadsheetId,
                    title: spreadsheet.properties.title,
                    url: spreadsheet.spreadsheetUrl,
                    sheets: spreadsheet.sheets.map((s) => ({
                        name: s.properties.title,
                        sheetId: s.properties.sheetId,
                    })),
                    message: `Spreadsheet created: ${spreadsheet.properties.title}`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to create spreadsheet: ${message}` });
            }
        },
    });
}

// Sheets Get Spreadsheet Tool
export function createSheetsGetSpreadsheetTool() {
    return new DynamicStructuredTool({
        name: "sheets_get_spreadsheet",
        description: "Get metadata and cell values from a Google Spreadsheet.",
        schema: z.object({
            spreadsheetId: z.string().describe("The spreadsheet ID"),
            ranges: z
                .array(z.string())
                .optional()
                .describe("A1 notation ranges to retrieve (e.g., ['Sheet1!A1:D10', 'Sheet2!A:B'])"),
        }),
        func: async ({ spreadsheetId, ranges }) => {
            try {
                // Get spreadsheet metadata
                const params = new URLSearchParams();
                if (ranges && ranges.length > 0) {
                    ranges.forEach((r) => params.append("ranges", r));
                    params.set("includeGridData", "true");
                }

                const spreadsheet = await googleApiRequest<{
                    spreadsheetId: string;
                    properties: { title: string };
                    spreadsheetUrl: string;
                    sheets: Array<{
                        properties: { title: string; sheetId: number; gridProperties?: { rowCount: number; columnCount: number } };
                        data?: Array<{
                            rowData?: Array<{
                                values?: Array<{ formattedValue?: string }>;
                            }>;
                        }>;
                    }>;
                }>("sheets", `/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params.toString()}`);

                const sheetsData = spreadsheet.sheets.map((sheet) => {
                    const data: string[][] = [];
                    if (sheet.data) {
                        for (const gridData of sheet.data) {
                            if (gridData.rowData) {
                                for (const row of gridData.rowData) {
                                    const rowValues = (row.values || []).map((cell) => cell.formattedValue || "");
                                    data.push(rowValues);
                                }
                            }
                        }
                    }
                    return {
                        name: sheet.properties.title,
                        sheetId: sheet.properties.sheetId,
                        rowCount: sheet.properties.gridProperties?.rowCount,
                        columnCount: sheet.properties.gridProperties?.columnCount,
                        data: data.length > 0 ? data : undefined,
                    };
                });

                return JSON.stringify({
                    status: "success",
                    spreadsheetId: spreadsheet.spreadsheetId,
                    title: spreadsheet.properties.title,
                    url: spreadsheet.spreadsheetUrl,
                    sheets: sheetsData,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to get spreadsheet: ${message}` });
            }
        },
    });
}

// Sheets Update Cells Tool
export function createSheetsUpdateCellsTool() {
    return new DynamicStructuredTool({
        name: "sheets_update_cells",
        description:
            "Update cell values in a Google Spreadsheet. " +
            "Values should be a JSON string representing a 2D array, e.g., '[[\"A\",\"B\"],[\"C\",\"D\"]]'",
        schema: z.object({
            spreadsheetId: z.string().describe("The spreadsheet ID"),
            range: z.string().describe("A1 notation range (e.g., 'Sheet1!A1:C3')"),
            valuesJson: z
                .string()
                .describe("JSON string of 2D array of values (rows × columns), e.g., '[[\"Name\",\"Age\"],[\"Alice\",30]]'"),
        }),
        func: async ({ spreadsheetId, range, valuesJson }) => {
            try {
                // Parse the JSON string to get the 2D array
                let values: any[][];
                try {
                    values = JSON.parse(valuesJson);
                    if (!Array.isArray(values)) {
                        throw new Error("Values must be an array");
                    }
                } catch (parseError) {
                    return JSON.stringify({
                        status: "error",
                        message: `Invalid valuesJson format: ${parseError instanceof Error ? parseError.message : "Parse error"}`,
                    });
                }

                const response = await googleApiRequest<{
                    updatedRange: string;
                    updatedRows: number;
                    updatedColumns: number;
                    updatedCells: number;
                }>(
                    "sheets",
                    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            range,
                            majorDimension: "ROWS",
                            values,
                        }),
                    }
                );

                return JSON.stringify({
                    status: "success",
                    updatedRange: response.updatedRange,
                    updatedRows: response.updatedRows,
                    updatedColumns: response.updatedColumns,
                    updatedCells: response.updatedCells,
                    message: `Updated ${response.updatedCells} cell(s) in ${response.updatedRange}`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to update cells: ${message}` });
            }
        },
    });
}

// Sheets Append Rows Tool
export function createSheetsAppendRowsTool() {
    return new DynamicStructuredTool({
        name: "sheets_append_rows",
        description:
            "Append rows to the end of a sheet in a Google Spreadsheet. " +
            "Values should be a JSON string representing a 2D array, e.g., '[[\"A\",\"B\"],[\"C\",\"D\"]]'",
        schema: z.object({
            spreadsheetId: z.string().describe("The spreadsheet ID"),
            range: z.string().describe("A1 notation range indicating the sheet (e.g., 'Sheet1' or 'Sheet1!A:D')"),
            valuesJson: z
                .string()
                .describe("JSON string of 2D array of rows to append, e.g., '[[\"Row1Col1\",\"Row1Col2\"],[\"Row2Col1\",\"Row2Col2\"]]'"),
        }),
        func: async ({ spreadsheetId, range, valuesJson }) => {
            try {
                // Parse the JSON string to get the 2D array
                let values: any[][];
                try {
                    values = JSON.parse(valuesJson);
                    if (!Array.isArray(values)) {
                        throw new Error("Values must be an array");
                    }
                } catch (parseError) {
                    return JSON.stringify({
                        status: "error",
                        message: `Invalid valuesJson format: ${parseError instanceof Error ? parseError.message : "Parse error"}`,
                    });
                }

                const response = await googleApiRequest<{
                    updates: {
                        updatedRange: string;
                        updatedRows: number;
                        updatedColumns: number;
                        updatedCells: number;
                    };
                }>(
                    "sheets",
                    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            majorDimension: "ROWS",
                            values,
                        }),
                    }
                );

                return JSON.stringify({
                    status: "success",
                    updatedRange: response.updates.updatedRange,
                    updatedRows: response.updates.updatedRows,
                    updatedCells: response.updates.updatedCells,
                    message: `Appended ${response.updates.updatedRows} row(s) to ${response.updates.updatedRange}`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to append rows: ${message}` });
            }
        },
    });
}

// Export all Sheets tools
export function createAllSheetsTools(): DynamicStructuredTool[] {
    return [
        createSheetsCreateSpreadsheetTool(),
        createSheetsGetSpreadsheetTool(),
        createSheetsUpdateCellsTool(),
        createSheetsAppendRowsTool(),
    ];
}
