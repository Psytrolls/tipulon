import { db } from '../db.js';

const DATA_GOV_RESOURCE_ID = '91d298ed-a260-4f93-9d50-d5e3c5b82ce1';
const DATA_GOV_API_URL = 'https://data.gov.il/api/3/action/datastore_search';

/**
 * Synchronizes the bus fleet registry from the Israeli Ministry of Transport (data.gov.il)
 */
export async function syncFleetFromGov() {
  console.log('🔄 [FleetSync] Starting fleet synchronization from data.gov.il...');
  const operators = [
    { query: 'דן באר שבע', canonicalName: 'דן באר שבע' },
    { query: 'דן בדרום', canonicalName: 'דן בדרום' }
  ];

  let totalAdded = 0;
  let totalUpdated = 0;
  const results = {};

  const upsertStmt = db.prepare(`
    INSERT INTO buses (
      bus_number,
      operator,
      cluster,
      bus_type,
      production_year,
      short_number,
      status,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'טרם טופל', datetime('now'))
    ON CONFLICT(bus_number) DO UPDATE SET
      operator = excluded.operator,
      cluster = excluded.cluster,
      bus_type = excluded.bus_type,
      production_year = excluded.production_year,
      short_number = COALESCE(buses.short_number, excluded.short_number),
      updated_at = datetime('now')
  `);

  for (const op of operators) {
    try {
      const url = `${DATA_GOV_API_URL}?resource_id=${DATA_GOV_RESOURCE_ID}&q=${encodeURIComponent(op.query)}&limit=1500`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (!data.success || !data.result || !Array.isArray(data.result.records)) {
        throw new Error('Invalid response structure from data.gov.il');
      }

      const records = data.result.records;
      let opCount = 0;

      db.exec('BEGIN TRANSACTION');
      try {
        for (const record of records) {
          const rawId = record.bus_license_id;
          if (!rawId) continue;

          const busNumber = String(rawId).trim();
          // Skip non-numeric or abnormal entries
          if (!/^\d{7,8}$/.test(busNumber)) continue;

          // Determine canonical operator name
          const operatorName = (record.operator_nm && record.operator_nm.includes('באר שבע'))
            ? 'דן באר שבע'
            : op.canonicalName;

          const cluster = record.cluster_nm || '';
          const busType = record.BusType_nm || '';
          const prodYear = Number(record.production_year) || null;

          // Default short number: last 4 digits (e.g. 14945702 -> 5702)
          const shortNumber = busNumber.slice(-4);

          // Check if bus exists
          const existing = db.prepare('SELECT bus_number, status FROM buses WHERE bus_number = ?').get(busNumber);
          if (existing) {
            totalUpdated++;
          } else {
            totalAdded++;
          }

          upsertStmt.run(
            busNumber,
            operatorName,
            cluster,
            busType,
            prodYear,
            shortNumber
          );
          opCount++;
        }
        db.exec('COMMIT');
        results[op.canonicalName] = opCount;
        console.log(`✅ [FleetSync] Synced ${opCount} buses for ${op.canonicalName}`);
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    } catch (err) {
      console.error(`❌ [FleetSync] Failed syncing for ${op.canonicalName}:`, err.message);
      results[op.canonicalName] = { error: err.message };
    }
  }

  const totalBuses = db.prepare('SELECT COUNT(*) as count FROM buses').get().count;
  console.log(`🚌 [FleetSync] Sync complete. Total buses in database now: ${totalBuses} (Added: ${totalAdded}, Updated: ${totalUpdated})`);

  // Asynchronously harvest real short numbers from Dan Ops API in background
  setTimeout(() => {
    harvestShortNumbersFromOps().catch(err => console.warn('Harvest notice:', err.message));
  }, 1000);

  return {
    success: true,
    totalBusesInDb: totalBuses,
    totalAdded,
    totalUpdated,
    details: results
  };
}

/**
 * Automatically harvests real internal short numbers and locations from the Dan Ops API
 */
export async function harvestShortNumbersFromOps() {
  console.log('🔍 [FleetSync] Harvesting real short numbers and locations from Dan Ops API...');
  const buses = db.prepare('SELECT bus_number, operator FROM buses').all();
  let updatedCount = 0;

  const updateStmt = db.prepare(`
    UPDATE buses 
    SET short_number = ?, 
        last_known_location = COALESCE(?, last_known_location),
        updated_at = datetime('now')
    WHERE bus_number = ?
  `);

  // Batch process in chunks of 10
  for (let i = 0; i < buses.length; i += 10) {
    const chunk = buses.slice(i, i + 10);
    await Promise.all(chunk.map(async (b) => {
      const opId = b.operator === 'דן בדרום' ? 31 : 32;
      try {
        const url = `https://ops.dandarom.co.il/src/symcotech/ws_work.php?operatorId=${opId}&car_number=${b.bus_number}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && data[0].car_Short_number) {
            const short = String(data[0].car_Short_number).trim();
            const loc = data[0].acc_name || null;
            updateStmt.run(short, loc, b.bus_number);
            updatedCount++;
          }
        }
      } catch (e) {}
    }));
  }

  console.log(`✅ [FleetSync] Successfully harvested real short numbers for ${updatedCount} buses from Dan live system.`);
  return updatedCount;
}

/**
 * Starts automated weekly fleet synchronization schedule
 * Runs every Sunday at 03:00 AM
 */
export function startWeeklyFleetSyncCron() {
  console.log('⏰ [FleetSync] Initialized weekly fleet synchronization scheduler.');

  // Run automatically on first launch
  setTimeout(async () => {
    try {
      const busCount = db.prepare('SELECT COUNT(*) as count FROM buses').get().count;
      if (busCount < 200) {
        console.log(`🚌 [FleetSync] Initial database has only ${busCount} buses. Running initial full fleet import from data.gov.il...`);
        await syncFleetFromGov();
      } else {
        console.log(`🚌 [FleetSync] Database has ${busCount} buses. Refreshing live short numbers from Dan Ops API...`);
        await harvestShortNumbersFromOps();
      }
    } catch (e) {
      console.warn('Initial fleet sync notice:', e.message);
    }
  }, 4000);

  // Check every hour: if Sunday (0) at 03:00 AM, sync
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const now = new Date();
      // 0 = Sunday, 3 = 03:00 AM
      if (now.getDay() === 0 && now.getHours() === 3) {
        console.log('⏰ [FleetSync] Sunday 03:00 AM triggered: Running weekly fleet sync...');
        await syncFleetFromGov();
      }
    } catch (e) {
      console.error('Weekly fleet sync error:', e);
    }
  }, ONE_HOUR);
}
