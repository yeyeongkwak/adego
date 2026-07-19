import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse'
import { createClient } from '@supabase/supabase-js'

const GTFS_DIR = process.env.GTFS_DIR || './google_transit'
const TEST_MODE = !!process.env.TEST_MODE
const BATCH = 2000

let supabase = null
if (!TEST_MODE) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log(url, key)
    if (!url || !key) {
        console.error(
            'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars. (Skip with DRY_RUN=1)'
        )
        process.exit(1)
    }
    supabase = createClient(url, key, { auth: { persistSession: false } })
}

// Helper fuction

const s = (v) => (v === '' || v === null ? null : String(v))
const int = (v) => (v === '' || v === null ? null : parseInt(v, 10))
const flt = (v) => (v === '' || v === null ? null : parseFloat(v))
const b01 = (v) => v === '1' // "1"/"0" → true/false
const ymd = (v) =>
    v && v.length === 8
        ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6.8)}`
        : null

const FILES = [
    [
        'routes.txt',
        'gtfs_routes',
        (r) => ({
            route_id: s(r.route.id),
            agency_id: s(r.agency_id),
            route_short_name: s(r.route_short_name),
            route_long_name: s(r.route_long_name),
            route_type: int(r.route_type), // Adelaide uses extended codes (e.g. 701) beyond 3=bus
            route_color: s(r.route_color),
        }),
    ],
    [
        'stops.txt',
        'gtfs_stops',
        (r) => ({
            stop_id: s(r.stop_id),
            stop_code: s(r.stop_code),
            stop_name: s(r.stop_name),
            stop_lat: flt(r.stop_lat),
            stop_lon: flt(r.stop_lon),
            // geom is filled after load with a one-line SQL (see below)
        }),
    ],
    [
        'calendar.txt',
        'gtfs_calendar',
        (r) => ({
            service_id: s(r.service_id),
            monday: b01(r.monday),
            tuesday: b01(r.tuesday),
            wednesday: b01(r.wednesday),
            thursday: b01(r.thursday),
            friday: b01(r.friday),
            saturday: b01(r.saturday),
            sunday: b01(r.sunday),
            start_date: ymd(r.start_date),
            end_date: ymd(r.end_date),
        }),
    ],
    [
        'calendar_dates.txt',
        'gtfs_calendar_dates',
        (r) => ({
            service_id: s(r.service_id),
            date: ymd(r.date),
            exception_type: int(r.exception_type),
        }),
    ],
    [
        'trips.txt',
        'gtfs_trips',
        (r) => ({
            trip_id: s(r.trip_id),
            route_id: s(r.route_id),
            service_id: s(r.service_id),
            trip_headsign: s(r.trip_headsign),
            direction_id: int(r.direction_id),
            shape_id: s(r.shape_id),
        }),
    ],
    [
        'stop_times.txt',
        'gtfs_stop_times',
        (r) => ({
            trip_id: s(r.trip_id),
            stop_id: s(r.stop_id),
            arrival_time: s(r.arrival_time),
            departure_time: s(r.departure_time),
            stop_sequence: int(r.stop_sequence),
        }),
    ],
]

async function flush(table, rows) {
    if (TEST_MODE || rows.length === 0) return
    const { error } = await supabase.from(table).insert(rows)
    if (error) throw new Error(`${table} insert failed: ${error.message}`)
}

async function loadFile(file, table, mapRow) {
    const filePath = path.join(GTFS_DIR, file)
    if (!fs.existsSync(filePath)) {
        console.log(`  (skipped) ${file} not found`)
        return
    }

    const parser = fs.createReadStream(filePath).pipe(
        parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true,
        })
    )

    let batch = []
    let total = 0
    let sample = null

    for await (const rec of parser) {
        const row = mapRow(rec)
        if (!sample) sample = row
        batch.push(row)
        if (batch.length >= BATCH) {
            await flush(table, batch)
            total += batch.length
            batch = []
            process.stdout.write(
                `\r  ${table}: ${total.toLocaleString()} rows...`
            )
        }
    }

    await flush(table, batch)
    total += batch.length
    console.log(
        `\r  ${table}: ${total.toLocaleString()} rows done ✓            `
    )

    if (TEST_MODE && sample) console.log('     sample:', JSON.stringify(sample))
}

// ============= RUN MAIN ======================

async function main() {
    console.log(
        TEST_MODE
            ? '== TEST_MODE (no insert, parse/map only) ==\n'
            : '== LOADING START ==\n'
    )
    const t0 = Date.now()
    for (const [file, table, mapRow] of FILES) {
        await loadFile(file, table, mapRow)
    }
    const sec = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`\nDone (${sec}s)`)
    if (!DRY_RUN) {
        console.log(`
Final step -- in the Supabase SQL editor, convert stop coords to geom:
  update gtfs_stops
  set geom = st_setsrid(st_makepoint(stop_lon, stop_lat),4326)::geography
  where geom is null;
`)
    }
}

main().catch((e) => {
    console.error('\nError:', e.message)
    process.exit(1)
})

// =====================================================================
// To re-run, truncate first (SQL editor):
//   truncate gtfs_stop_times, gtfs_trips, gtfs_calendar_dates,
//            gtfs_calendar, gtfs_stops, gtfs_routes restart identity cascade;
// =====================================================================
