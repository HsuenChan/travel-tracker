import { type NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/google-oauth";

// Sheet structure: ID | Name | Start Date | End Date | Countries | Notes | Photo Album ID
const SHEET_RANGE = "A:G";
const TRIPS_HEADERS = ["ID", "Name", "Start Date", "End Date", "Countries", "Notes", "Photo Album ID"];

async function ensureTripsSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string | undefined
) {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "A1:G1" });
    const firstRow = res.data.values?.[0] ?? [];
    if (firstRow.length === 0 || firstRow[0]?.trim() !== "ID") {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "A1:G1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [TRIPS_HEADERS] },
      });
    }
  } catch {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "A1:G1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [TRIPS_HEADERS] },
    });
  }
}

export async function GET() {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  await ensureTripsSheet(sheets, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: SHEET_RANGE,
  });

  const rows = res.data.values ?? [];
  if (rows.length <= 1) {
    return NextResponse.json({ trips: [] });
  }

  const [header, ...data] = rows;
  const trips = data.map((row) =>
    Object.fromEntries(header.map((key: string, i: number) => [key.trim(), row[i] ?? ""]))
  );

  return NextResponse.json({ trips });
}

export async function POST(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { name, startDate, endDate, countries, notes, photoAlbumId } = body;

  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  const id = Date.now().toString();
  const row = [id, name, startDate, endDate, countries, notes, photoAlbumId ?? ""];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  return NextResponse.json({ success: true, id });
}

async function findRowIndex(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string | undefined, id: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A:A",
  });
  const rows = res.data.values ?? [];
  return rows.findIndex((row) => row[0]?.trim() === id);
}

export async function PUT(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, startDate, endDate, countries, notes, photoAlbumId } = body;

  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  const rowIndex = await findRowIndex(sheets, spreadsheetId, id);
  if (rowIndex === -1) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const targetRange = `A${rowIndex + 1}:G${rowIndex + 1}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: targetRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[id, name, startDate, endDate, countries, notes, photoAlbumId ?? ""]],
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await request.json();
  const sheets = google.sheets({ version: "v4", auth: client });
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  const rowIndex = await findRowIndex(sheets, spreadsheetId, id);
  if (rowIndex === -1) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = sheetInfo.data.sheets?.[0].properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return NextResponse.json({ success: true });
}
