/**
 * Maid Bridge — Supabase Primary Storage
 * ALL data stored in Supabase ONLY. No localStorage, no IndexedDB.
 */
(function () {
  const cfg = window.__MB_SUPABASE__ || {};
  const supabaseUrl = cfg.url;
  const supabaseAnonKey = cfg.anonKey;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[MB] Supabase credentials missing!");
    return;
  }

  const createClient = window.supabase?.createClient;
  if (!createClient) {
    console.error("[MB] Supabase JS not loaded!");
    return;
  }

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  });

  window.__sb = sb;

  async function upsertTable(tableName, rows) {
    if (!rows?.length) return;
    const payload = rows.map((r) => ({ id: r.id, data: r }));
    const { error } = await sb.from(tableName).upsert(payload, { onConflict: "id" });
    if (error) console.error("[MB] upsert error", tableName, error);
  }

  async function deleteFromTable(tableName, id) {
    const { error } = await sb.from(tableName).delete().eq("id", id);
    if (error) console.error("[MB] delete error", tableName, error);
  }

  async function fetchTable(tableName) {
    const { data, error } = await sb.from(tableName).select("data");
    if (error) {
      console.error("[MB] fetch error", tableName, error);
      return [];
    }
    return data?.map((d) => d.data) || [];
  }

  // REPLACE saveAll - Supabase ONLY
  window.saveAll = async function () {
    console.log("[MB] Saving to Supabase...");
    await upsertTable("addresses", window.A || []);
    await upsertTable("zones", window.Z || []);
    await upsertTable("schedules", window.SC || []);
    await upsertTable("customers", window.CUST || []);
    await upsertTable("logs", (window.LOGS || []).slice(0, 500));
    await upsertTable("dnd", window.DND || []);
    if (window.idc) {
      await sb.from("config").upsert([{ id: "idc", data: window.idc }], { onConflict: "id" });
    }
    console.log("[MB] Saved to Supabase");
  };

  // REPLACE loadAll - Supabase ONLY
  window.loadAll = async function () {
    console.log("[MB] Loading from Supabase...");
    const [addresses, zones, schedules, customers, logs, dnd, idcRow] = await Promise.all([
      fetchTable("addresses"),
      fetchTable("zones"),
      fetchTable("schedules"),
      fetchTable("customers"),
      fetchTable("logs"),
      fetchTable("dnd"),
      sb.from("config").select("data").eq("id", "idc").maybeSingle(),
    ]);

    window.A = addresses || [];
    window.Z = zones || [];
    window.SC = schedules || [];
    window.CUST = customers || [];
    window.LOGS = logs || [];
    window.DND = dnd || [];
    window.idc = idcRow?.data || { a: 0, z: 0, s: 0 };

    // Hydrate map
    window.A.forEach((a) => { if (typeof window.mkMk === "function") window.mkMk(a); });
    window.Z.forEach((z) => {
      if (z.bounds && window.drawnZ) {
        const p = window.L.polygon(z.bounds, {
          color: "#007AFF", fillOpacity: 0.12, weight: 1.5, dashArray: "5,4", fillColor: "#007AFF",
        }).addTo(window.drawnZ);
        p.zid = z.id;
        p.bindTooltip(z.name, { permanent: true, direction: "center" });
      }
    });

    console.log("[MB] Loaded from Supabase", { addresses: window.A.length, zones: window.Z.length });
  };

  // DELETE operations
  window.deleteAddressDB = async function (id) {
    await deleteFromTable("addresses", id);
  };
  window.deleteZoneDB = async function (id) {
    await deleteFromTable("zones", id);
  };

  // Realtime subscriptions
  const tables = ["addresses", "zones", "schedules", "customers", "logs", "dnd"];
  const globalMap = { addresses: "A", zones: "Z", schedules: "SC", customers: "CUST", logs: "LOGS", dnd: "DND" };

  tables.forEach((t) => {
    sb.channel(`mb_${t}`)
      .on("postgres_changes", { event: "*", schema: "public", table: t }, async () => {
        const rows = await fetchTable(t);
        window[globalMap[t]] = rows;
        if (typeof window.upStats === "function") window.upStats();
        if (typeof window.render === "function") window.render();
      })
      .subscribe();
  });

  console.log("[MB] Supabase primary storage ready");
})();
