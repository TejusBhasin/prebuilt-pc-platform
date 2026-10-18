/**
 * Imports the prebuilt-pc-list spreadsheet, creating only what is missing.
 *
 *   npx tsx --env-file=.env prisma/import.ts --dry-run
 *   npx tsx --env-file=.env prisma/import.ts
 *
 * Export every tab with File > Download > CSV and drop the files in
 * prisma/data. Names like "prebuilt-pc-list - system cpus.csv" are matched by
 * their trailing tab name, so the exports can go in untouched.
 *
 * Nothing is ever updated or deleted. A row that already exists is counted and
 * skipped. The run validates the whole spreadsheet with no writes first, and
 * only then opens a transaction, so a bad row on page nine cannot leave a
 * half-finished import behind.
 */

import { PrismaClient, Prisma } from "../src/generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const DRY_RUN = process.argv.includes("--dry-run")
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "data")

type Category = "laptop" | "desktop" | "workstation" | "mini_pc"
type OsType = "windows" | "macos" | "linux"
type Database = Prisma.TransactionClient

const TAB_KEYS = [
    "manufacturers",
    "cpus",
    "gpus",
    "ram_configs",
    "storage_configs",
    "systems",
    "system_cpus",
    "system_gpus",
    "system_ram",
    "system_storage",
    "system_images",
] as const

type TabKey = (typeof TAB_KEYS)[number]

// ------------------------------------------------------------------- csv files

function normalizeFileName(name: string): string {
    return name
        .replace(/\.csv$/i, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
}

function resolveCsvFiles(): Map<TabKey, string> {
    let entries: string[]
    try {
        entries = readdirSync(DATA_DIR).filter((entry) => entry.toLowerCase().endsWith(".csv"))
    } catch {
        throw new Error(`${DATA_DIR} does not exist. Export each tab of the sheet as CSV and put the files there.`)
    }

    const unclaimed = new Set(entries)
    const resolved = new Map<TabKey, string>()

    // Longest key first. A Sheets export is named "<sheet> - <tab>.csv", so the
    // system_cpus file also ends in "cpus" and the shorter key would steal it.
    const keys = [...TAB_KEYS].sort((a, b) => b.length - a.length)
    for (const key of keys) {
        for (const entry of unclaimed) {
            const normalized = normalizeFileName(entry)
            if (normalized === key || normalized.endsWith(`_${key}`)) {
                resolved.set(key, path.join(DATA_DIR, entry))
                unclaimed.delete(entry)
                break
            }
        }
    }

    const missing = TAB_KEYS.filter((key) => !resolved.has(key))
    if (missing.length > 0) {
        throw new Error(`No CSV found in ${DATA_DIR} for: ${missing.join(", ")}`)
    }
    return resolved
}

// Resolved at load so a missing tab is reported before anything connects to the
// database. A stack trace would only bury the list of what is missing.
let csvFiles: Map<TabKey, string>
try {
    csvFiles = resolveCsvFiles()
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
}

// ----------------------------------------------------------------- csv parsing

function splitCsv(text: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let field = ""
    let quoted = false

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i]
        if (quoted) {
            if (char !== '"') {
                field += char
                continue
            }
            if (text[i + 1] === '"') {
                field += '"'
                i += 1
                continue
            }
            quoted = false
            continue
        }
        if (char === '"') {
            quoted = true
            continue
        }
        if (char === ",") {
            row.push(field)
            field = ""
            continue
        }
        if (char === "\r") {
            continue
        }
        if (char === "\n") {
            row.push(field)
            rows.push(row)
            row = []
            field = ""
            continue
        }
        field += char
    }

    row.push(field)
    rows.push(row)
    return rows
}

type Row = { lineNo: number; cells: Record<string, string> }

function readCsv(tab: TabKey): Row[] {
    const file = csvFiles.get(tab)
    if (!file) {
        throw new Error(`No CSV for the ${tab} tab`)
    }

    // Sheets prefixes exports with a byte order mark, which would otherwise end
    // up glued to the first column name.
    const text = readFileSync(file, "utf8").replace(/^﻿/, "")
    const [header, ...body] = splitCsv(text)
    if (!header || header.every((cell) => cell.trim() === "")) {
        throw new Error(`${file} has no header row`)
    }

    const columns = header.map((cell) => cell.trim())
    const rows: Row[] = []
    body.forEach((cells, index) => {
        if (cells.every((cell) => cell.trim() === "")) {
            return
        }
        const record: Record<string, string> = {}
        columns.forEach((column, position) => {
            record[column] = (cells[position] ?? "").trim()
        })
        rows.push({ lineNo: index + 2, cells: record })
    })
    return rows
}

// ------------------------------------------------------------------- coercion

const TRUE_WORDS = new Set(["true", "t", "yes", "y", "1"])
const FALSE_WORDS = new Set(["false", "f", "no", "n", "0"])

const CATEGORIES = new Map<string, Category>([
    ["laptop", "laptop"],
    ["desktop", "desktop"],
    ["workstation", "workstation"],
    ["minipc", "mini_pc"],
])

// Every distribution in this dataset collapses to one enum member, so the
// prefixes below are the whole of the mapping. An unlisted OS is a problem
// rather than a guess.
const LINUX_PREFIXES = [
    "linux", "fedora", "ubuntu", "debian", "arch", "mint", "pop", "nixos",
    "manjaro", "opensuse", "suse", "bazzite", "steamos", "chimeraos",
    "rhel", "red hat", "centos", "rocky", "alma", "gentoo", "elementary",
]

type Fields = ReturnType<typeof fields>

function fields(tab: TabKey, row: Row) {
    function has(column: string): boolean {
        return column in row.cells
    }

    function at(column: string): string {
        if (!(column in row.cells)) {
            throw new Error(`${tab} row ${row.lineNo}: there is no "${column}" column`)
        }
        return row.cells[column]
    }

    function fail(column: string, why: string): never {
        throw new Error(`${tab} row ${row.lineNo}: "${column}" ${why} (${JSON.stringify(at(column))})`)
    }

    function text(column: string): string {
        const value = at(column)
        if (value === "") {
            fail(column, "is required and blank")
        }
        return value
    }

    function optionalText(column: string): string | null {
        const value = at(column)
        return value === "" ? null : value
    }

    // Currency and thousands formatting survives a CSV export, so "$7,449.00"
    // has to read as a number. A comma is only treated as a thousands
    // separator when it is positioned like one: blanket comma stripping turns
    // the decimal comma in "2,1" into 21, which no later check would catch.
    function toNumber(column: string, whole: boolean): number {
        const raw = at(column).replace(/[$\s]/g, "")
        if (raw.includes(",")) {
            if (!/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
                fail(column, "has a comma that is not a thousands separator — write the decimal point as a period")
            }
        }
        const value = raw.replace(/,/g, "")
        if (value === "") {
            fail(column, "is required and blank")
        }
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) {
            fail(column, "is not a number")
        }
        if (whole && !Number.isInteger(parsed)) {
            fail(column, "must be a whole number")
        }
        return parsed
    }

    function integer(column: string): number {
        return toNumber(column, true)
    }

    function optionalInteger(column: string): number | null {
        return at(column) === "" ? null : toNumber(column, true)
    }

    function decimal(column: string): number {
        return toNumber(column, false)
    }

    function optionalDecimal(column: string): number | null {
        return at(column) === "" ? null : toNumber(column, false)
    }

    function flag(column: string, fallback: boolean): boolean {
        const value = at(column).toLowerCase()
        if (value === "") {
            return fallback
        }
        if (TRUE_WORDS.has(value)) {
            return true
        }
        if (FALSE_WORDS.has(value)) {
            return false
        }
        fail(column, "is not a yes or no value")
    }

    function category(column: string): Category {
        const value = text(column).toLowerCase().replace(/[^a-z]/g, "")
        const mapped = CATEGORIES.get(value)
        if (!mapped) {
            fail(column, "is not one of laptop, desktop, workstation, mini pc")
        }
        return mapped
    }

    function os(column: string): OsType {
        const raw = text(column)
        const value = raw.toLowerCase()
        const mapped =
            value.startsWith("mac") || value.startsWith("os x") ? "macos" as const
            : value.startsWith("windows") ? "windows" as const
            : LINUX_PREFIXES.some((prefix) => value.startsWith(prefix)) ? "linux" as const
            : null
        if (mapped === null) {
            fail(column, "is not an operating system this importer recognises")
        }
        // The enum has three members and the sheet names editions and distros,
        // so record what each spelling became. The detail is lost on purpose.
        osCollapses.set(raw, mapped)
        return mapped
    }

    return { has, at, text, optionalText, integer, optionalInteger, decimal, optionalDecimal, flag, category, os }
}

// --------------------------------------------------------------------- report

let problems: string[] = []
let warnings: string[] = []
let creates: Map<string, string[]> = new Map()
let present: Map<string, number> = new Map()
let osCollapses: Map<string, OsType> = new Map()
let nextPlannedId = -1

function resetReport(): void {
    problems = []
    warnings = []
    creates = new Map()
    present = new Map()
    osCollapses = new Map()
    nextPlannedId = -1
}

function planCreate(entity: string, label: string): void {
    const labels = creates.get(entity) ?? []
    labels.push(label)
    creates.set(entity, labels)
}

function notePresent(entity: string): void {
    present.set(entity, (present.get(entity) ?? 0) + 1)
}

function plannedId(): number {
    const id = nextPlannedId
    nextPlannedId -= 1
    return id
}

// ------------------------------------------------------------------- matching

// Natural keys are compared on this form so that punctuation and casing cannot
// turn one machine into two rows: MacBook Air M4 13" and MacBook Air M4 13 both
// reduce to macbookairm413.
function loose(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

type NameIndex = {
    exact: Map<string, number>
    loose: Map<string, { id: number; name: string }>
}

function nameIndex(): NameIndex {
    return { exact: new Map(), loose: new Map() }
}

function addName(index: NameIndex, scope: number | null, name: string, id: number): void {
    const prefix = scope === null ? "" : `${scope}\u0000`
    index.exact.set(`${prefix}${name}`, id)
    index.loose.set(`${prefix}${loose(name)}`, { id, name })
}

function findName(index: NameIndex, scope: number | null, name: string, kind: string, where: string): number | null {
    const prefix = scope === null ? "" : `${scope}\u0000`
    const exact = index.exact.get(`${prefix}${name}`)
    if (exact !== undefined) {
        return exact
    }
    const near = index.loose.get(`${prefix}${loose(name)}`)
    if (near) {
        warnings.push(
            `${where}: the sheet says ${JSON.stringify(name)} but the ${kind} on record is ` +
            `${JSON.stringify(near.name)}. Treated as the same row, nothing created. Make the spellings match.`
        )
        return near.id
    }
    return null
}

// The join tabs name a cpu, gpu or system without saying which manufacturer it
// belongs to, so those lookups go through a separate unscoped index that knows
// when a name is not specific enough to act on.
type GlobalIndex = Map<string, { id: number; name: string }[]>

function addGlobal(index: GlobalIndex, key: string, name: string, id: number): void {
    const hits = index.get(key) ?? []
    hits.push({ id, name })
    index.set(key, hits)
}

function findGlobal(index: GlobalIndex, key: string, shown: string, kind: string, where: string): number | null {
    const hits = index.get(key) ?? []
    if (hits.length === 0) {
        problems.push(`${where}: no ${kind} named ${JSON.stringify(shown)}`)
        return null
    }
    if (hits.length > 1) {
        problems.push(
            `${where}: ${JSON.stringify(shown)} matches ${hits.length} ${kind} rows ` +
            `(${hits.map((hit) => hit.name).join(", ")}). The tab needs another column to tell them apart.`
        )
        return null
    }
    if (hits[0].name !== shown) {
        warnings.push(`${where}: the sheet says ${JSON.stringify(shown)}, matched ${kind} ${JSON.stringify(hits[0].name)}.`)
    }
    return hits[0].id
}

function keyOf(...parts: (string | number | boolean)[]): string {
    return parts.map((part) => String(part)).join("\u0000")
}

// ---------------------------------------------------------------------- import

async function eachRow(tab: TabKey, handle: (field: Fields, row: Row) => Promise<void>): Promise<void> {
    for (const row of readCsv(tab)) {
        try {
            await handle(fields(tab, row), row)
        } catch (error) {
            problems.push(error instanceof Error ? error.message : String(error))
        }
    }
}

async function importAll(db: Database, write: boolean): Promise<void> {
    resetReport()

    // ---- manufacturers
    const manufacturers = nameIndex()
    for (const record of await db.manufacturer.findMany()) {
        addName(manufacturers, null, record.name, record.id)
    }

    await eachRow("manufacturers", async (field, row) => {
        const name = field.text("name")
        const website = field.optionalText("website")
        const where = `manufacturers row ${row.lineNo}`

        if (findName(manufacturers, null, name, "manufacturer", where) !== null) {
            notePresent("manufacturers")
            return
        }
        const id = write
            ? (await db.manufacturer.create({ data: { name, website } })).id
            : plannedId()
        addName(manufacturers, null, name, id)
        planCreate("manufacturers", name)
    })

    function manufacturerFor(field: Fields, where: string): number | null {
        const name = field.text("manufacturer")
        const id = findName(manufacturers, null, name, "manufacturer", where)
        if (id === null) {
            problems.push(`${where}: no manufacturer named ${JSON.stringify(name)}`)
        }
        return id
    }

    // ---- cpus
    const cpus = nameIndex()
    const cpusByName: GlobalIndex = new Map()
    for (const record of await db.cpu.findMany()) {
        addName(cpus, record.manufacturerId, record.name, record.id)
        addGlobal(cpusByName, loose(record.name), record.name, record.id)
    }

    await eachRow("cpus", async (field, row) => {
        const where = `cpus row ${row.lineNo}`
        const manufacturerId = manufacturerFor(field, where)
        if (manufacturerId === null) {
            return
        }
        const name = field.text("name")

        if (findName(cpus, manufacturerId, name, "cpu", where) !== null) {
            notePresent("cpus")
            return
        }
        const data = {
            manufacturerId,
            name,
            baseClockGhz: field.decimal("baseClockGhz"),
            boostClockGhz: field.optionalDecimal("boostClockGhz"),
            passmarkScore: field.optionalInteger("passmarkScore"),
            eccSupport: field.flag("eccSupport", false),
            integratedGraphics: field.flag("integratedGraphics", false),
            tdpWatts: field.optionalInteger("tdpWatts"),
        }
        const id = write ? (await db.cpu.create({ data })).id : plannedId()
        addName(cpus, manufacturerId, name, id)
        addGlobal(cpusByName, loose(name), name, id)
        planCreate("cpus", name)
    })

    // ---- gpus
    // The sheet lists the same chip at several memory sizes, so vram is part of
    // the key that decides whether a gpu row is new.
    const gpus = nameIndex()
    const gpusByName: GlobalIndex = new Map()
    const gpusByNameAndVram: GlobalIndex = new Map()
    function indexGpu(name: string, vramGb: number, id: number): void {
        addGlobal(gpusByName, loose(name), name, id)
        addGlobal(gpusByNameAndVram, keyOf(loose(name), vramGb), `${name} (${vramGb}GB)`, id)
    }
    for (const record of await db.gpu.findMany()) {
        addName(gpus, record.manufacturerId, `${record.name} ${record.vramGb}GB`, record.id)
        indexGpu(record.name, record.vramGb, record.id)
    }

    await eachRow("gpus", async (field, row) => {
        const where = `gpus row ${row.lineNo}`
        const manufacturerId = manufacturerFor(field, where)
        if (manufacturerId === null) {
            return
        }
        const name = field.text("name")
        const vramGb = field.integer("vramGb")

        if (findName(gpus, manufacturerId, `${name} ${vramGb}GB`, "gpu", where) !== null) {
            notePresent("gpus")
            return
        }
        const data = {
            manufacturerId,
            name,
            vramGb,
            passmarkScore: field.optionalInteger("passmarkScore"),
            tdpWatts: field.optionalInteger("tdpWatts"),
            isIntegrated: field.flag("isIntegrated", false),
        }
        const id = write ? (await db.gpu.create({ data })).id : plannedId()
        addName(gpus, manufacturerId, `${name} ${vramGb}GB`, id)
        indexGpu(name, vramGb, id)
        planCreate("gpus", `${name} (${vramGb}GB)`)
    })

    // ---- ram configs
    const ramConfigs = new Map<string, number>()
    for (const record of await db.ramConfig.findMany()) {
        ramConfigs.set(keyOf(record.capacityGb, loose(record.type), record.eccSupport), record.id)
    }

    async function ramConfigFor(capacityGb: number, type: string, eccSupport: boolean, write: boolean): Promise<number> {
        const key = keyOf(capacityGb, loose(type), eccSupport)
        const found = ramConfigs.get(key)
        if (found !== undefined) {
            return found
        }
        const id = write
            ? (await db.ramConfig.create({ data: { capacityGb, type, eccSupport } })).id
            : plannedId()
        ramConfigs.set(key, id)
        planCreate("ram configs", `${capacityGb}GB ${type}${eccSupport ? " ECC" : ""}`)
        return id
    }

    await eachRow("ram_configs", async (field, row) => {
        const capacityGb = field.integer("capacityGb")
        const type = field.text("type")
        const eccSupport = field.flag("eccSupport", false)
        if (ramConfigs.has(keyOf(capacityGb, loose(type), eccSupport))) {
            notePresent("ram configs")
            return
        }
        await ramConfigFor(capacityGb, type, eccSupport, write)
    })

    // ---- storage configs
    const storageConfigs = new Map<string, number>()
    for (const record of await db.storageConfig.findMany()) {
        storageConfigs.set(keyOf(record.capacityGb, loose(record.type)), record.id)
    }

    async function storageConfigFor(capacityGb: number, type: string, write: boolean): Promise<number> {
        const key = keyOf(capacityGb, loose(type))
        const found = storageConfigs.get(key)
        if (found !== undefined) {
            return found
        }
        const id = write
            ? (await db.storageConfig.create({ data: { capacityGb, type } })).id
            : plannedId()
        storageConfigs.set(key, id)
        planCreate("storage configs", `${capacityGb}GB ${type}`)
        return id
    }

    await eachRow("storage_configs", async (field, row) => {
        const capacityGb = field.integer("capacityGb")
        const type = field.text("type")
        if (storageConfigs.has(keyOf(capacityGb, loose(type)))) {
            notePresent("storage configs")
            return
        }
        await storageConfigFor(capacityGb, type, write)
    })

    // ---- systems
    const systems = nameIndex()
    const systemsByName: GlobalIndex = new Map()
    const systemPrices = new Map<number, { name: string; priceUsd: number; active: boolean }>()
    for (const record of await db.system.findMany()) {
        addName(systems, record.manufacturerId, record.name, record.id)
        addGlobal(systemsByName, loose(record.name), record.name, record.id)
        systemPrices.set(record.id, { name: record.name, priceUsd: record.priceUsd, active: record.active })
    }

    await eachRow("systems", async (field, row) => {
        const where = `systems row ${row.lineNo}`
        const manufacturerId = manufacturerFor(field, where)
        if (manufacturerId === null) {
            return
        }
        const name = field.text("name")
        const priceUsd = field.decimal("priceUsd")
        const active = field.flag("active", true)

        const found = findName(systems, manufacturerId, name, "system", where)
        if (found !== null) {
            notePresent("systems")
            // Prices move. Nothing is written for a system already on record,
            // but a changed price is worth knowing about.
            const known = systemPrices.get(found)
            if (known && known.priceUsd !== priceUsd) {
                warnings.push(`${where}: ${known.name} is $${known.priceUsd} on record, $${priceUsd} in the sheet. Left unchanged.`)
            }
            if (known && known.active !== active) {
                warnings.push(`${where}: ${known.name} is active=${known.active} on record, ${active} in the sheet. Left unchanged.`)
            }
            return
        }

        const data = {
            manufacturerId,
            name,
            category: field.category("category"),
            os: field.os("os"),
            priceUsd,
            releaseYear: field.optionalInteger("releaseYear"),
            url: field.optionalText("url"),
            active,
            weightKg: field.optionalDecimal("weightKg"),
            lengthMm: field.optionalInteger("lengthMm"),
            widthMm: field.optionalInteger("widthMm"),
            depthMm: field.optionalInteger("depthMm"),
            screenResolutionX: field.optionalInteger("screenResolutionX"),
            screenResolutionY: field.optionalInteger("screenResolutionY"),
        }
        const id = write ? (await db.system.create({ data })).id : plannedId()
        addName(systems, manufacturerId, name, id)
        addGlobal(systemsByName, loose(name), name, id)
        planCreate("systems", name)
    })

    // ---- system cpus
    const systemCpus = new Set<string>()
    for (const record of await db.systemCpu.findMany()) {
        systemCpus.add(keyOf(record.systemId, record.cpuId))
    }

    await eachRow("system_cpus", async (field, row) => {
        const where = `system_cpus row ${row.lineNo}`
        const systemId = findGlobal(systemsByName, loose(field.text("system")), field.text("system"), "system", where)
        const cpuId = findGlobal(cpusByName, loose(field.text("cpu")), field.text("cpu"), "cpu", where)
        if (systemId === null || cpuId === null) {
            return
        }
        const key = keyOf(systemId, cpuId)
        if (systemCpus.has(key)) {
            notePresent("system cpus")
            return
        }
        if (write) {
            await db.systemCpu.create({ data: { systemId, cpuId } })
        }
        systemCpus.add(key)
        planCreate("system cpus", `${field.text("system")} -> ${field.text("cpu")}`)
    })

    // ---- system gpus
    const systemGpus = new Set<string>()
    for (const record of await db.systemGpu.findMany()) {
        systemGpus.add(keyOf(record.systemId, record.gpuId))
    }

    await eachRow("system_gpus", async (field, row) => {
        const where = `system_gpus row ${row.lineNo}`
        const systemId = findGlobal(systemsByName, loose(field.text("system")), field.text("system"), "system", where)

        // The sheet lists one chip at several memory sizes, so the gpu name
        // alone does not say which row a system points at. A vramGb column
        // settles it; without one this falls back to the name and reports the
        // ambiguity rather than picking a variant.
        const gpuName = field.text("gpu")
        const gpuLabel = field.has("vramGb") ? `${gpuName} (${field.integer("vramGb")}GB)` : gpuName
        const gpuId = field.has("vramGb")
            ? findGlobal(gpusByNameAndVram, keyOf(loose(gpuName), field.integer("vramGb")), gpuLabel, "gpu", where)
            : findGlobal(gpusByName, loose(gpuName), gpuName, "gpu", where)
        if (systemId === null || gpuId === null) {
            return
        }
        const key = keyOf(systemId, gpuId)
        if (systemGpus.has(key)) {
            notePresent("system gpus")
            return
        }
        if (write) {
            await db.systemGpu.create({ data: { systemId, gpuId } })
        }
        systemGpus.add(key)
        planCreate("system gpus", `${field.text("system")} -> ${gpuLabel}`)
    })

    // ---- system ram
    const systemRam = new Set<string>()
    for (const record of await db.systemRam.findMany()) {
        systemRam.add(keyOf(record.systemId, record.ramConfigId))
    }

    await eachRow("system_ram", async (field, row) => {
        const where = `system_ram row ${row.lineNo}`
        const systemId = findGlobal(systemsByName, loose(field.text("system")), field.text("system"), "system", where)
        if (systemId === null) {
            return
        }
        const ramConfigId = await ramConfigFor(
            field.integer("capacityGb"),
            field.text("type"),
            field.flag("eccSupport", false),
            write,
        )
        const key = keyOf(systemId, ramConfigId)
        if (systemRam.has(key)) {
            notePresent("system ram")
            return
        }
        if (write) {
            await db.systemRam.create({ data: { systemId, ramConfigId } })
        }
        systemRam.add(key)
        planCreate("system ram", `${field.text("system")} -> ${field.integer("capacityGb")}GB ${field.text("type")}`)
    })

    // ---- system storage
    const systemStorage = new Set<string>()
    for (const record of await db.systemStorage.findMany()) {
        systemStorage.add(keyOf(record.systemId, record.storageConfigId))
    }

    await eachRow("system_storage", async (field, row) => {
        const where = `system_storage row ${row.lineNo}`
        const systemId = findGlobal(systemsByName, loose(field.text("system")), field.text("system"), "system", where)
        if (systemId === null) {
            return
        }
        const storageConfigId = await storageConfigFor(field.integer("capacityGb"), field.text("type"), write)
        const key = keyOf(systemId, storageConfigId)
        if (systemStorage.has(key)) {
            notePresent("system storage")
            return
        }
        if (write) {
            await db.systemStorage.create({ data: { systemId, storageConfigId } })
        }
        systemStorage.add(key)
        planCreate("system storage", `${field.text("system")} -> ${field.integer("capacityGb")}GB ${field.text("type")}`)
    })

    // ---- system images
    // displayOrder is the position within a system's images, so it continues
    // from whatever that system already has rather than restarting at zero.
    const systemImages = new Set<string>()
    const imageCounts = new Map<number, number>()
    for (const record of await db.systemImage.findMany()) {
        systemImages.add(keyOf(record.systemId, loose(record.url)))
        imageCounts.set(record.systemId, (imageCounts.get(record.systemId) ?? 0) + 1)
    }

    await eachRow("system_images", async (field, row) => {
        const where = `system_images row ${row.lineNo}`
        const systemId = findGlobal(systemsByName, loose(field.text("system")), field.text("system"), "system", where)
        if (systemId === null) {
            return
        }
        const url = field.text("imageUrl")
        const key = keyOf(systemId, loose(url))
        if (systemImages.has(key)) {
            notePresent("system images")
            return
        }
        const displayOrder = imageCounts.get(systemId) ?? 0
        const data = {
            systemId,
            url,
            altText: field.text("altText"),
            sourceUrl: field.text("pageUrl"),
            sourceName: field.text("sourceName"),
            displayOrder,
        }
        if (write) {
            await db.systemImage.create({ data })
        }
        systemImages.add(key)
        imageCounts.set(systemId, displayOrder + 1)
        planCreate("system images", `${field.text("system")} #${displayOrder}`)
    })
}

// --------------------------------------------------------------------- output

function report(heading: string): void {
    console.log(`\n${heading}`)
    console.log("=".repeat(heading.length))

    const entities = new Set([...creates.keys(), ...present.keys()])
    for (const entity of entities) {
        const made = creates.get(entity)?.length ?? 0
        const skipped = present.get(entity) ?? 0
        console.log(`  ${entity.padEnd(18)} ${String(made).padStart(4)} new   ${String(skipped).padStart(4)} already present`)
    }

    for (const [entity, labels] of creates) {
        console.log(`\n  ${entity}:`)
        for (const label of labels) {
            console.log(`    + ${label}`)
        }
    }

    if (osCollapses.size > 0) {
        console.log("\n  os values collapsed to the enum:")
        for (const [raw, mapped] of osCollapses) {
            console.log(`    ${raw} -> ${mapped}`)
        }
    }

    if (warnings.length > 0) {
        console.log(`\n  ${warnings.length} warning(s):`)
        for (const warning of warnings) {
            console.log(`    ! ${warning}`)
        }
    }

    if (problems.length > 0) {
        console.log(`\n  ${problems.length} problem(s):`)
        for (const problem of problems) {
            console.log(`    x ${problem}`)
        }
    }
}

// ----------------------------------------------------------------------- main

const url = process.env.DATABASE_URL
if (!url) {
    throw new Error("DATABASE_URL is not set")
}

const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

async function main(): Promise<void> {
    await importAll(prisma, false)

    if (DRY_RUN) {
        report("Dry run - nothing was written")
        return
    }

    if (problems.length > 0) {
        report("Refusing to import")
        console.log("\nFix the problems above and run again. Nothing was written.")
        process.exitCode = 1
        return
    }

    // One transaction, so a failure halfway through rolls the whole import back.
    await prisma.$transaction((tx) => importAll(tx, true), { maxWait: 15_000, timeout: 180_000 })

    if (problems.length > 0) {
        throw new Error(`The import hit ${problems.length} problem(s) while writing:\n${problems.join("\n")}`)
    }
    report("Imported")
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
