/**
 * Splits a workbook into one CSV per sheet, so the whole spreadsheet travels as
 * a single download instead of eleven.
 *
 *   npx tsx prisma/xlsx-to-csv.ts ~/Downloads/prebuilt-pc-list.xlsx
 *
 * Output goes to prisma/data, which is what prisma/import.ts reads. Existing
 * files with the same name are replaced; anything else already in there is left
 * alone and reported, since a stale CSV would otherwise be imported silently.
 */

import ExcelJS from "exceljs"
import { readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "data")

const source = process.argv[2]
if (!source) {
    throw new Error("Usage: tsx prisma/xlsx-to-csv.ts <workbook.xlsx>")
}

const notes: string[] = []

// A cell is not always a string. Formulas carry a result, linked text carries a
// target, and a date carries a Date. Each case is spelled out rather than
// stringified blindly, because a wrong guess here is a wrong row in the
// database.
function cellText(value: ExcelJS.CellValue, where: string): string {
    if (value === null || value === undefined) {
        return ""
    }
    if (typeof value === "string") {
        return value
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value)
    }
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10)
    }
    if (typeof value === "object") {
        if ("richText" in value) {
            return value.richText.map((part) => part.text).join("")
        }
        if ("hyperlink" in value) {
            // Sheets autolinks pasted URLs, so the display text is normally the
            // URL itself. Prefer it, fall back to the target, and say so when
            // the two disagree.
            const text = typeof value.text === "string" ? value.text : ""
            if (text === "") {
                return value.hyperlink ?? ""
            }
            if (value.hyperlink && value.hyperlink !== text) {
                notes.push(`${where}: shows ${JSON.stringify(text)} but links to ${JSON.stringify(value.hyperlink)} — kept the shown text`)
            }
            return text
        }
        if ("formula" in value || "sharedFormula" in value) {
            const result = (value as ExcelJS.CellFormulaValue).result
            if (result === null || result === undefined) {
                notes.push(`${where}: formula has no cached result — left blank`)
                return ""
            }
            if (typeof result === "object" && "error" in result) {
                notes.push(`${where}: formula evaluates to ${result.error} — left blank`)
                return ""
            }
            return cellText(result as ExcelJS.CellValue, where)
        }
        if ("error" in value) {
            notes.push(`${where}: cell is ${value.error} — left blank`)
            return ""
        }
        // Unreachable per exceljs's types, but a workbook can still carry a
        // shape they do not describe, and text is better than a dropped cell.
        const loose = value as { text?: unknown }
        if (typeof loose.text === "string") {
            return loose.text
        }
    }
    notes.push(`${where}: unrecognised cell type — left blank`)
    return ""
}

function csvField(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

const workbook = new ExcelJS.Workbook()
await workbook.xlsx.readFile(source)

const existing = new Set(readdirSync(DATA_DIR).filter((entry) => entry.toLowerCase().endsWith(".csv")))
const written: string[] = []

for (const sheet of workbook.worksheets) {
    const grid: string[][] = []
    let width = 0

    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const cells: string[] = []
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cells[colNumber - 1] = cellText(cell.value, `${sheet.name}!${cell.address}`)
        })
        for (let i = 0; i < cells.length; i += 1) {
            cells[i] = cells[i] ?? ""
        }
        width = Math.max(width, cells.length)
        grid[rowNumber - 1] = cells
    })

    for (let i = 0; i < grid.length; i += 1) {
        grid[i] = grid[i] ?? []
    }

    // Sheets pads a worksheet well past its content. Drop trailing rows and
    // columns that hold nothing at all.
    while (width > 0 && grid.every((row) => (row[width - 1] ?? "").trim() === "")) {
        width -= 1
    }
    const rows = grid
        .map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ""))
        .filter((row, index) => index === 0 || row.some((cell) => cell.trim() !== ""))

    if (width === 0 || rows.length < 2) {
        notes.push(`sheet ${JSON.stringify(sheet.name)} has no data rows — skipped`)
        continue
    }

    const name = `${sheet.name.replace(/[\\/]/g, "-")}.csv`
    writeFileSync(path.join(DATA_DIR, name), rows.map((row) => row.map(csvField).join(",")).join("\n") + "\n")
    existing.delete(name)
    written.push(`${name.padEnd(28)} ${rows.length - 1} rows x ${width} cols`)
}

console.log(`Wrote ${written.length} file(s) to ${DATA_DIR}`)
for (const line of written) {
    console.log(`  ${line}`)
}

if (existing.size > 0) {
    console.log(`\n  ${existing.size} CSV(s) already in that directory were not written by this workbook:`)
    for (const leftover of existing) {
        console.log(`    ? ${leftover}   <- stale? the importer will still read it`)
    }
}

if (notes.length > 0) {
    console.log(`\n  ${notes.length} note(s):`)
    for (const note of notes) {
        console.log(`    ! ${note}`)
    }
}
