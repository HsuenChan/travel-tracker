import { type NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/google-oauth";

// Segment columns: ID | Trip ID | Order | From | From IATA | To | To IATA | Type | Date | Time | Flight No | Aircraft
const SEGMENT_RANGE = "Segments!A:L";
const SEGMENT_HEADERS = ["ID", "Trip ID", "Order", "From", "From IATA", "To", "To IATA", "Type", "Date", "Time", "Flight No", "Aircraft"];

async function ensureSegmentsSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string | undefined
) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = spreadsheet.data.sheets?.some(
    (s) => s.properties?.title === "Segments"
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: "Segments" } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Segments!A1:L1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [SEGMENT_HEADERS] },
    });
  }
}

export async function GET(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get("tripId");

  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  await ensureSegmentsSheet(sheets, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: SEGMENT_RANGE });
  const rows = res.data.values ?? [];
  if (rows.length <= 1) return NextResponse.json({ segments: [] });

  const [header, ...data] = rows;
  let segments = data.map((row) =>
    Object.fromEntries(header.map((key: string, i: number) => [key.trim(), row[i] ?? ""]))
  );

  if (tripId) {
    segments = segments.filter((s) => s["Trip ID"] === tripId);
  }

  segments.sort((a, b) => parseInt(a.Order || "0") - parseInt(b.Order || "0"));
  return NextResponse.json({ segments });
}

export async function POST(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { tripId, order, from, fromIata, to, toIata, type, date, time, flightNo, aircraft } = body;

  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  await ensureSegmentsSheet(sheets, spreadsheetId);

  const id = Date.now().toString();
  const row = [id, tripId, order, from, fromIata ?? "", to, toIata ?? "", type, date ?? "", time ?? "", flightNo ?? "", aircraft ?? ""];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: SEGMENT_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  return NextResponse.json({ success: true, id });
}

export async function PUT(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, from, fromIata, to, toIata, type, date, time, flightNo, aircraft } = body;

  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Segments!A:A" });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r) => r[0]?.trim() === id);
  if (rowIndex === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Preserve Trip ID and Order from existing row
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Segments!A${rowIndex + 1}:L${rowIndex + 1}`,
  });
  const existing = existingRes.data.values?.[0] ?? [];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Segments!A${rowIndex + 1}:L${rowIndex + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        id,
        existing[1] ?? "",  // Trip ID
        existing[2] ?? "",  // Order
        from, fromIata ?? "", to, toIata ?? "", type,
        date ?? "", time ?? "", flightNo ?? "", aircraft ?? "",
      ]],
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await request.json();
  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Segments!A:A" });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((r) => r[0]?.trim() === id);
  if (rowIndex === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = sheetInfo.data.sheets?.find((s) => s.properties?.title === "Segments")?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } }],
    },
  });

  return NextResponse.json({ success: true });
}
