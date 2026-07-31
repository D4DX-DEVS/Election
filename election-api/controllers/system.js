const os = require("os");
const { getSupabase } = require("../config/supabase");

async function checkDatabase() {
  const start = Date.now();
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("franchises").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw error;
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { connected: false, latencyMs: Date.now() - start, message: err.message || String(err) };
  }
}

exports.getSystemHealth = async (req, res) => {
  try {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const [loadAvg1, loadAvg5, loadAvg15] = os.loadavg();
    const cpuCount = os.cpus()?.length || 1;

    const database = await checkDatabase();

    res.status(200).json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        memory: {
          usedMB: Math.round(usedMemBytes / (1024 * 1024)),
          totalMB: Math.round(totalMemBytes / (1024 * 1024)),
          percentUsed: Math.round((usedMemBytes / totalMemBytes) * 100),
        },
        cpu: {
          cores: cpuCount,
          loadAvg1: Number(loadAvg1.toFixed(2)),
          loadAvg5: Number(loadAvg5.toFixed(2)),
          loadAvg15: Number(loadAvg15.toFixed(2)),
          // Rough load-per-core percentage (Unix loadavg only — always 0 on Windows).
          loadPercent: Math.round((loadAvg1 / cpuCount) * 100),
        },
        database,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};
