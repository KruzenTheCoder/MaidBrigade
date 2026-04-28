/**
 * Maid Bridge — Enhanced Features
 * Mobile responsiveness, marketing intelligence, enhanced routing, touch gestures
 */
(function () {
  "use strict";

  var $ = function (s) {
    return document.getElementById(s.replace("#", ""));
  };

  // Fallback constants in case maidbridge.js globals aren't on window yet
  var FALLBACK_COL = {pending:'#8E8E93',scheduled:'#007AFF',visited:'#FF9F0A',interested:'#30D158',converted:'#BF5AF2',declined:'#FF453A','not-home':'rgba(255,255,255,0.3)',callback:'#64D2FF'};
  var FALLBACK_HQ = {lat:29.6986,lng:-95.1280,name:'Maid Bridge HQ',addr:'Deer Park, TX 77536'};
  function getCOL() { return window.COL || FALLBACK_COL; }
  function getHQ() { return window.HQ || FALLBACK_HQ; }
  function getA() { return window.A || []; }
  function getZ() { return window.Z || []; }

  // ═══ MOBILE BOTTOM NAVIGATION ═══
  function injectMobileNav() {
    if (document.querySelector(".mobile-nav")) return;
    var nav = document.createElement("div");
    nav.className = "mobile-nav";
    nav.innerHTML =
      '<div class="mobile-nav-inner">' +
      '<button class="mnav-btn on" data-view="map" onclick="mbNav(\'map\',this)"><i class="fas fa-map"></i><span>Map</span></button>' +
      '<button class="mnav-btn" data-view="list" onclick="mbNav(\'list\',this)"><i class="fas fa-list"></i><span>Leads</span></button>' +
      '<button class="mnav-btn" data-view="route" onclick="mbNav(\'route\',this)"><i class="fas fa-route"></i><span>Route</span></button>' +
      '<button class="mnav-btn" data-view="intel" onclick="mbNav(\'intel\',this)"><i class="fas fa-brain"></i><span>Intel</span></button>' +
      '<button class="mnav-btn" data-view="more" onclick="mbNav(\'more\',this)"><i class="fas fa-ellipsis-h"></i><span>More</span></button>' +
      "</div>";
    document.body.appendChild(nav);

    var overlay = document.createElement("div");
    overlay.className = "side-overlay";
    overlay.id = "sideOverlay";
    overlay.onclick = function () {
      closeMobileSide();
    };
    document.body.appendChild(overlay);
  }

  window.mbNav = function (view, btn) {
    document.querySelectorAll(".mnav-btn").forEach(function (b) {
      b.classList.remove("on");
    });
    btn.classList.add("on");

    switch (view) {
      case "map":
        closeMobileSide();
        break;
      case "list":
        openMobileSide();
        var addrTab = document.querySelector(".st");
        if (addrTab && typeof window.sTab === "function")
          window.sTab("addr", addrTab);
        break;
      case "route":
        closeMobileSide();
        if (typeof window.openRouteBuilder === "function")
          window.openRouteBuilder();
        break;
      case "intel":
        openMobileSide();
        showIntelPanel();
        break;
      case "more":
        openMobileSide();
        showMorePanel();
        break;
    }
  };

  function openMobileSide() {
    var side = $("side");
    if (side) {
      side.classList.add("mobile-open");
      side.classList.remove("shut");
    }
    var overlay = $("sideOverlay");
    if (overlay) overlay.style.display = "block";
  }

  function closeMobileSide() {
    var side = $("side");
    if (side) side.classList.remove("mobile-open");
    var overlay = $("sideOverlay");
    if (overlay) overlay.style.display = "none";
  }
  window.closeMobileSide = closeMobileSide;
  window.openMobileSide = openMobileSide;

  // Override toggleSide for mobile
  var origToggleSide = window.toggleSide;
  window.toggleSide = function () {
    if (window.innerWidth <= 768) {
      var side = $("side");
      if (side && side.classList.contains("mobile-open")) closeMobileSide();
      else openMobileSide();
    } else {
      if (origToggleSide) origToggleSide();
    }
  };

  // ═══ MARKETING INTELLIGENCE ═══
  function showIntelPanel() {
    var sBody = $("sBody");
    if (!sBody) return;

    [
      "cards",
      "filEl",
      "blocksP",
      "todayP",
      "custP",
      "logsP",
      "dndP",
      "funnelP",
      "moreP",
    ].forEach(function (h) {
      var e = $(h);
      if (e) e.classList.add("hidden");
    });
    var statsEl = $('statsEl');
    if (statsEl) statsEl.classList.remove('hidden');

    var intelP = $('intelP');
    if (!intelP) {
      intelP = document.createElement("div");
      intelP.id = "intelP";
      sBody.appendChild(intelP);
    }
    intelP.classList.remove("hidden");
    renderIntel();
  }

  function renderIntel() {
    var el = $('intelP');
    if (!el) return;

    var A = getA();
    var total = A.length;
    var COL = getCOL();
    var score = calcAreaScore();
    var scoreClass =
      score >= 80 ? "a" : score >= 60 ? "b" : score >= 40 ? "c" : score >= 20 ? "d" : "f";
    var scoreLetter =
      score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F";

    var valueMap = { $: 50, $$: 150, $$$: 350, $$$$: 600 };
    var pipeline = total
      ? A.reduce(function (sum, a) {
          return sum + (valueMap[a.value] || 0);
        }, 0)
      : 0;
    var wonAmt = total
      ? A.filter(function (a) {
          return a.status === "converted";
        }).reduce(function (sum, a) {
          return sum + (valueMap[a.value] || 0);
        }, 0)
      : 0;

    var withComp = total
      ? A.filter(function (a) {
          return a.competitor;
        }).length
      : 0;
    var competitors = [];
    var compSet = {};
    if (total) {
      A.forEach(function (a) {
        if (a.competitor && !compSet[a.competitor]) {
          compSet[a.competitor] = true;
          competitors.push(a.competitor);
        }
      });
    }

    var zones = getZ();

    // 7-day trend
    var trend = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var ds = d.toISOString().split("T")[0];
      var count = total
        ? A.filter(function (a) {
            return (
              (a.createdAt && a.createdAt.startsWith(ds)) ||
              (a.updatedAt && a.updatedAt.startsWith(ds))
            );
          }).length
        : 0;
      trend.push(count);
    }
    var maxTrend = Math.max.apply(null, trend.concat([1]));

    var days = ["S", "M", "T", "W", "T", "F", "S"];

    var trendHtml = trend
      .map(function (v, idx) {
        var h = Math.max((v / maxTrend) * 100, 4);
        var dt = new Date();
        dt.setDate(dt.getDate() - (6 - idx));
        return (
          '<div style="flex:1;text-align:center"><div style="height:24px;display:flex;align-items:flex-end"><div class="trend-bar" style="height:' +
          h +
          "%;width:100%;opacity:" +
          (idx === 6 ? 1 : 0.5) +
          '"></div></div><div style="font:500 6px var(--f);color:var(--t3);margin-top:2px">' +
          days[dt.getDay()] +
          "</div></div>"
        );
      })
      .join("");

    var compHtml = competitors.length
      ? competitors
          .map(function (c) {
            var cnt = window.A.filter(function (a) {
              return a.competitor === c;
            }).length;
            return (
              '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--t4)"><span style="font:600 10px var(--f)">' +
              c +
              '</span><span style="font:700 10px var(--f);color:var(--o)">' +
              cnt +
              "</span></div>"
            );
          })
          .join("")
      : '<div style="text-align:center;padding:8px;color:var(--t3);font:400 9px var(--f)">No competitors tracked yet</div>';

    var zoneHtml = "";
    if (zones.length) {
      zoneHtml =
        '<div class="intel-section animate-in" style="animation-delay:.2s"><div class="intel-header"><h4><i class="fas fa-map" style="color:var(--v)"></i> Zone Coverage</h4></div>';
      zones.forEach(function (z) {
        if (!z.bounds) return;
        var inZone = A.filter(function (a) {
          return a.lat && a.lng && pip([a.lat, a.lng], z.bounds);
        }).length;
        var visitedZ = A.filter(function (a) {
          return (
            a.lat && a.lng &&
            pip([a.lat, a.lng], z.bounds) &&
            ["visited", "interested", "converted", "declined", "not-home"].includes(a.status)
          );
        }).length;
        var pct = inZone ? Math.round((visitedZ / inZone) * 100) : 0;
        zoneHtml +=
          '<div class="hood-card" onclick="map.fitBounds(' +
          JSON.stringify(z.bounds) +
          ",{padding:[30,30]});closeMobileSide()\">" +
          '<div style="position:relative;width:40px;height:40px">' +
          '<svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--s2)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="var(--p)" stroke-width="3" stroke-dasharray="' +
          pct * 1.07 +
          ' 107" stroke-linecap="round" transform="rotate(-90 20 20)"/></svg>' +
          '<div style="position:absolute;inset:0;display:grid;place-items:center;font:700 9px var(--f)">' +
          pct +
          "%</div></div>" +
          '<div style="flex:1;min-width:0"><div style="font:700 10px var(--f)">' +
          z.name +
          '</div><div style="font:400 8px var(--f);color:var(--t3)">' +
          inZone +
          " addr · " +
          visitedZ +
          " visited</div></div></div>";
      });
      zoneHtml += "</div>";
    }

    var insightsHtml = getInsights()
      .map(function (ins) {
        return (
          '<div style="padding:6px 8px;background:var(--s2);border-radius:8px;font:400 9px var(--f);color:var(--t2);display:flex;align-items:center;gap:6px"><i class="fas ' +
          ins.icon +
          '" style="color:' +
          ins.color +
          ';width:14px;text-align:center"></i>' +
          ins.text +
          "</div>"
        );
      })
      .join("");

    var scoreMsg =
      score >= 80
        ? "Hot Market"
        : score >= 60
        ? "Strong Potential"
        : score >= 40
        ? "Moderate Activity"
        : score >= 20
        ? "Needs Work"
        : "Cold Territory";

    el.innerHTML =
      '<div class="sec-h"><span>Marketing Intelligence</span></div>' +
      // Area Score
      '<div class="intel-section animate-in">' +
      '<div class="intel-header"><h4><i class="fas fa-brain" style="color:var(--p)"></i> Area Score</h4>' +
      '<div class="score-badge score-' +
      scoreClass +
      '">' +
      scoreLetter +
      "</div></div>" +
      '<div class="intel-grid">' +
      '<div class="intel-stat"><div class="iv" style="color:var(--p)">' +
      (total ? ((A.filter(function (a) {
          return a.status === "converted";
        }).length / total) * 100).toFixed(1) : 0) +
      '%</div><div class="il">Convert</div></div>' +
      '<div class="intel-stat"><div class="iv" style="color:var(--o)">' +
      (total ? ((A.filter(function (a) {
          return a.status === "interested";
        }).length / total) * 100).toFixed(1) : 0) +
      '%</div><div class="il">Interest</div></div>' +
      '<div class="intel-stat"><div class="iv" style="color:var(--g)">' +
      (total ? ((A.filter(function (a) {
          return ["visited", "interested", "converted", "declined", "not-home"].includes(a.status);
        }).length / total) * 100).toFixed(1) : 0) +
      '%</div><div class="il">Visited</div></div></div>' +
      '<div style="font:400 8px var(--f);color:var(--t3);text-align:center">Score: ' +
      score +
      "/100 — " +
      scoreMsg +
      "</div></div>" +
      // Revenue Pipeline
      '<div class="intel-section animate-in" style="animation-delay:.05s">' +
      '<div class="intel-header"><h4><i class="fas fa-dollar-sign" style="color:var(--g)"></i> Revenue Pipeline</h4></div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
      '<div><div style="font:900 18px var(--f);color:var(--g)">$' +
      wonAmt.toLocaleString() +
      '</div><div style="font:500 7px var(--f);color:var(--t3);text-transform:uppercase">Won</div></div>' +
      '<div style="text-align:right"><div style="font:900 18px var(--f);color:var(--t2)">$' +
      pipeline.toLocaleString() +
      '</div><div style="font:500 7px var(--f);color:var(--t3);text-transform:uppercase">Pipeline</div></div></div>' +
      '<div class="pipeline-track"><div class="pipeline-fill" style="width:' +
      (pipeline ? (wonAmt / pipeline) * 100 : 0) +
      '%;background:linear-gradient(90deg,var(--g),var(--p))"></div></div></div>' +
      // 7-Day Activity
      '<div class="intel-section animate-in" style="animation-delay:.1s">' +
      '<div class="intel-header"><h4><i class="fas fa-chart-bar" style="color:var(--c)"></i> 7-Day Activity</h4>' +
      '<span style="font:700 10px var(--f);color:var(--p)">' +
      trend.reduce(function (a, b) {
        return a + b;
      }, 0) +
      "</span></div>" +
      '<div class="trend-row">' +
      trendHtml +
      "</div></div>" +
      // Competitor Intel
      '<div class="intel-section animate-in" style="animation-delay:.15s">' +
      '<div class="intel-header"><h4><i class="fas fa-users" style="color:var(--o)"></i> Competitor Intel</h4>' +
      '<span class="badge">' +
      withComp +
      "</span></div>" +
      compHtml +
      "</div>" +
      // Zone Coverage
      zoneHtml +
      // Quick Insights
      '<div class="intel-section animate-in" style="animation-delay:.25s">' +
      '<div class="intel-header"><h4><i class="fas fa-lightbulb" style="color:var(--o)"></i> Quick Insights</h4></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      insightsHtml +
      "</div></div>";
  }
  window.renderIntel = renderIntel;

  function calcAreaScore() {
    var A = getA();
    var total = A.length;
    if (!total) return 0;
    var converted = A.filter(function (a) {
      return a.status === "converted";
    }).length;
    var interested = A.filter(function (a) {
      return a.status === "interested";
    }).length;
    var visited = A.filter(function (a) {
      return ["visited", "interested", "converted", "declined", "not-home"].includes(a.status);
    }).length;
    var callback = A.filter(function (a) {
      return a.status === "callback";
    }).length;

    var convScore = Math.min((converted / total) * 200, 40);
    var intScore = Math.min((interested / total) * 150, 25);
    var visitScore = Math.min((visited / total) * 100, 20);
    var cbScore = Math.min((callback / total) * 100, 15);

    return Math.round(convScore + intScore + visitScore + cbScore);
  }

  function getInsights() {
    var insights = [];
    var A = getA();
    var total = A.length;
    if (!total) {
      insights.push({
        icon: "fa-plus-circle",
        color: "var(--p)",
        text: "Add addresses to start building market intelligence",
      });
      return insights;
    }
    var pending = A.filter(function (a) {
      return a.status === "pending";
    }).length;
    var intrstd = A.filter(function (a) {
      return a.status === "interested";
    }).length;
    var callbacks = A.filter(function (a) {
      return a.status === "callback";
    }).length;
    var notHome = A.filter(function (a) {
      return a.status === "not-home";
    }).length;
    var conv = A.filter(function (a) {
      return a.status === "converted";
    }).length;

    if (pending > total * 0.5)
      insights.push({
        icon: "fa-exclamation-triangle",
        color: "var(--o)",
        text: pending + " addresses pending — time to canvass!",
      });
    if (intrstd > 0)
      insights.push({
        icon: "fa-star",
        color: "var(--g)",
        text: intrstd + " interested leads — follow up for conversion",
      });
    if (callbacks > 0)
      insights.push({
        icon: "fa-phone",
        color: "var(--c)",
        text: callbacks + " callbacks waiting — don't miss these!",
      });
    if (notHome > 3)
      insights.push({
        icon: "fa-clock",
        color: "var(--t3)",
        text: notHome + " not-home — try different times",
      });
    if (conv > 0)
      insights.push({
        icon: "fa-trophy",
        color: "var(--v)",
        text:
          conv +
          " conversions! " +
          ((conv / total) * 100).toFixed(0) +
          "% rate",
      });
    if (total > 10 && conv === 0)
      insights.push({
        icon: "fa-bullseye",
        color: "var(--r)",
        text: "No conversions yet — refine your pitch",
      });

    return insights.slice(0, 5);
  }

  // ═══ MORE PANEL (Mobile) ═══
  function showMorePanel() {
    var sBody = $("sBody");
    if (!sBody) return;

    [
      "cards",
      "filEl",
      "blocksP",
      "todayP",
      "custP",
      "logsP",
      "dndP",
      "funnelP",
      "intelP",
    ].forEach(function (h) {
      var e = $(h);
      if (e) e.classList.add("hidden");
    });
    var statsEl2 = $('statsEl');
    if (statsEl2) statsEl2.classList.remove('hidden');

    var moreP = $('moreP');
    if (!moreP) {
      moreP = document.createElement("div");
      moreP.id = "moreP";
      sBody.appendChild(moreP);
    }
    moreP.classList.remove("hidden");

    moreP.innerHTML =
      '<div class="sec-h"><span>Actions</span></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">' +
      '<div class="eo" onclick="openSchedMdl();closeMobileSide()"><i class="fas fa-calendar-plus"></i><h5>Schedule</h5><p>Plan routes</p></div>' +
      '<div class="eo" onclick="openExpMdl();closeMobileSide()"><i class="fas fa-file-export"></i><h5>Export</h5><p>Download data</p></div>' +
      '<div class="eo" onclick="openDispMdl();closeMobileSide()"><i class="fas fa-paper-plane"></i><h5>Dispatch</h5><p>Send teams</p></div>' +
      '<div class="eo" onclick="openStats();closeMobileSide()"><i class="fas fa-chart-pie"></i><h5>Analytics</h5><p>View stats</p></div>' +
      '<div class="eo" onclick="backupToFile()"><i class="fas fa-database"></i><h5>Backup</h5><p>Save data</p></div>' +
      '<div class="eo" onclick="document.getElementById(\'restoreF\').click()"><i class="fas fa-upload"></i><h5>Restore</h5><p>Load backup</p></div>' +
      '<div class="eo" onclick="toggleHeat();closeMobileSide()"><i class="fas fa-fire"></i><h5>Heatmap</h5><p>Visual density</p></div>' +
      '<div class="eo" onclick="loadDemo()"><i class="fas fa-magic"></i><h5>Demo</h5><p>Sample data</p></div></div>' +
      '<div class="sec-h"><span>View</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<button class="btn btn-g btn-w" onclick="mbShowTab(\'blocks\')"><i class="fas fa-draw-polygon"></i> Blocks</button>' +
      '<button class="btn btn-g btn-w" onclick="mbShowTab(\'today\')"><i class="fas fa-calendar-day"></i> Today</button>' +
      '<button class="btn btn-g btn-w" onclick="mbShowTab(\'cust\')"><i class="fas fa-users"></i> Leads CRM</button>' +
      '<button class="btn btn-g btn-w" onclick="mbShowTab(\'logs\')"><i class="fas fa-history"></i> Activity Log</button>' +
      '<button class="btn btn-g btn-w" onclick="mbShowTab(\'dnd\')"><i class="fas fa-ban"></i> Do Not Visit</button>' +
      '<button class="btn btn-g btn-w" onclick="mbShowTab(\'funnel\')"><i class="fas fa-filter"></i> Conversion Funnel</button>' +
      '<button class="btn btn-g btn-w" onclick="openOv(\'smsOv\');closeMobileSide()"><i class="fas fa-sms"></i> SMS Templates</button></div>';
  }

  window.mbShowTab = function (tab) {
    var tabBtns = document.querySelectorAll(".st");
    tabBtns.forEach(function (b) {
      if (b.textContent.toLowerCase().indexOf(tab.substring(0, 3)) >= 0) {
        window.sTab(tab, b);
      }
    });
  };

  // ═══ MOBILE ROUTE PANEL COLLAPSE ═══
  function injectCollapseBtn(panel) {
    if (panel.querySelector(".rte-collapse-btn")) return;
    var head = panel.querySelector(".rte-head");
    if (!head) return;

    var btn = document.createElement("button");
    btn.className = "rte-collapse-btn";
    btn.innerHTML = '<i class="fas fa-chevron-down"></i>';
    btn.title = "Collapse / Expand";
    btn.onclick = function (e) {
      e.stopPropagation();
      panel.classList.toggle("collapsed");
    };

    // Insert before the close button if present, otherwise append
    var closeBtn = head.querySelector(".xb");
    if (closeBtn) {
      head.insertBefore(btn, closeBtn);
    } else {
      head.appendChild(btn);
    }
  }

  window.toggleRoutePanel = function () {
    var panel = $("rtePanel");
    if (panel) panel.classList.toggle("collapsed");
  };

  // ═══ ENHANCED ROUTE BUILDER ═══
  var origBuildRoute = window.buildRoute;
  window.buildRoute = function (pts) {
    if (origBuildRoute) origBuildRoute(pts);

    setTimeout(function () {
      var panel = $("rtePanel");
      if (!panel || !panel.classList.contains("vis")) return;

      // Inject collapse toggle on mobile
      if (window.innerWidth <= 768) {
        injectCollapseBtn(panel);
        // Start collapsed so user sees the map pins
        panel.classList.add("collapsed");
      }

      if (!panel.querySelector(".rte-nav-btn")) {
        var navBtn = document.createElement("button");
        navBtn.className = "rte-nav-btn";
        navBtn.innerHTML =
          '<i class="fas fa-directions"></i> Open in Google Maps';
        navBtn.onclick = function () {
          openGoogleMapsRoute();
        };

        var exportBtn = panel.querySelector('[onclick="exportRoute()"]');
        if (exportBtn) {
          exportBtn.parentNode.insertBefore(navBtn, exportBtn);
        } else {
          panel.appendChild(navBtn);
        }
      }

      enhanceRouteStops();
    }, 150);
  };

  function openGoogleMapsRoute() {
    var stops = [];
    var origin = window.routeOrigin || getHQ();

    var rteStops = $("rteStops");
    if (!rteStops) return;

    var stopEls = rteStops.querySelectorAll(".rte-stop");
    stopEls.forEach(function (el) {
      var name = el.querySelector(".sn");
      if (name) {
        var addr = getA().find(function (a) {
          return a.street === name.textContent;
        });
        if (addr) stops.push(addr);
      }
    });

    if (!stops.length) return;

    var url =
      "https://www.google.com/maps/dir/" +
      origin.lat +
      "," +
      origin.lng +
      "/";
    stops.forEach(function (w) {
      url += w.lat + "," + w.lng + "/";
    });

    window.open(url, "_blank");
  }
  window.openGoogleMapsRoute = openGoogleMapsRoute;

  // ═══ ENHANCED ROUTE EXPORT (Google Maps style) ═══
  window.exportRoute = function () {
    var A = getA();
    var origin = window.routeOrigin || getHQ();
    var rteStops = $("rteStops");
    if (!rteStops) return;

    // Gather ordered stops with full address data
    var stops = [];
    var stopEls = rteStops.querySelectorAll(".rte-stop");
    stopEls.forEach(function (el) {
      var nameEl = el.querySelector(".sn");
      if (!nameEl) return;
      var addr = A.find(function (a) {
        return a.street === nameEl.textContent;
      });
      if (addr) stops.push(addr);
    });

    if (!stops.length) {
      if (window.msg) window.msg("warning", "Export", "No stops to export");
      return;
    }

    // Compute leg distances & times
    var legs = [];
    var totalDist = 0;
    var totalTime = 0;
    var prevLat = origin.lat;
    var prevLng = origin.lng;

    stops.forEach(function (s, i) {
      var dist = havMi(prevLat, prevLng, s.lat, s.lng);
      var driveMin = Math.max(1, Math.round(dist / 0.4)); // ~24mph avg neighborhood
      var walkMin = Math.max(1, Math.round(dist / 0.05));
      totalDist += dist;
      totalTime += driveMin;
      legs.push({
        stop: i + 1,
        street: s.street || "",
        city: s.city || "",
        status: s.status || "pending",
        value: s.value || "",
        notes: (s.notes || "").replace(/"/g, "'"),
        lat: s.lat,
        lng: s.lng,
        legDist: dist,
        legDrive: driveMin,
        legWalk: walkMin,
        cumDist: totalDist,
        cumTime: totalTime,
        competitor: s.competitor || ""
      });
      prevLat = s.lat;
      prevLng = s.lng;
    });

    // Build Google Maps multi-stop URL
    var gmUrl = "https://www.google.com/maps/dir/" + origin.lat + "," + origin.lng;
    stops.forEach(function (s) {
      gmUrl += "/" + s.lat + "," + s.lng;
    });

    // Format date
    var now = new Date();
    var dateStr = now.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    var timeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit"
    });

    // ─── Build CSV ───
    var csv = "";
    csv += "MAID BRIDGE — ROUTE SHEET\r\n";
    csv += "Generated:," + dateStr + " at " + timeStr + "\r\n";
    csv += "Origin:,\"" + (origin.name || "HQ") + "\",\"" + (origin.addr || "") + "\"," + origin.lat + "," + origin.lng + "\r\n";
    csv += "Total Stops:," + stops.length + "\r\n";
    csv += "Total Distance:," + totalDist.toFixed(2) + " mi\r\n";
    csv += "Est. Drive Time:," + totalTime + " min (" + (totalTime / 60).toFixed(1) + " hrs)\r\n";
    csv += "Google Maps:," + gmUrl + "\r\n";
    csv += "\r\n";

    // Header row
    csv += '"Stop #"';
    csv += ',"Address"';
    csv += ',"City"';
    csv += ',"Status"';
    csv += ',"Value"';
    csv += ',"Latitude"';
    csv += ',"Longitude"';
    csv += ',"Leg Distance"';
    csv += ',"Leg Drive (min)"';
    csv += ',"Leg Walk (min)"';
    csv += ',"Cumulative Dist"';
    csv += ',"Cumulative Time"';
    csv += ',"Competitor"';
    csv += ',"Notes"';
    csv += ',"Google Maps Link"';
    csv += "\r\n";

    // Data rows
    legs.forEach(function (l) {
      var pinUrl = "https://www.google.com/maps/search/?api=1&query=" + l.lat + "," + l.lng;
      csv += '"' + l.stop + '"';
      csv += ',"' + l.street + '"';
      csv += ',"' + l.city + '"';
      csv += ',"' + l.status + '"';
      csv += ',"' + l.value + '"';
      csv += "," + l.lat;
      csv += "," + l.lng;
      csv += ',"' + (l.legDist < 0.1 ? Math.round(l.legDist * 5280) + " ft" : l.legDist.toFixed(2) + " mi") + '"';
      csv += "," + l.legDrive;
      csv += "," + l.legWalk;
      csv += ',"' + l.cumDist.toFixed(2) + ' mi"';
      csv += ',"' + l.cumTime + ' min"';
      csv += ',"' + l.competitor + '"';
      csv += ',"' + l.notes + '"';
      csv += ',"' + pinUrl + '"';
      csv += "\r\n";
    });

    // Summary footer
    csv += "\r\n";
    csv += "SUMMARY\r\n";
    csv += "Stops:," + stops.length + "\r\n";
    csv += "Total Distance:," + totalDist.toFixed(2) + " mi\r\n";
    csv += "Est. Drive:," + totalTime + " min\r\n";
    csv += "Avg per Stop:," + (totalDist / stops.length).toFixed(2) + " mi / " + Math.round(totalTime / stops.length) + " min\r\n";
    csv += "Full Route (Google Maps):," + gmUrl + "\r\n";

    // Status breakdown
    var statusCounts = {};
    stops.forEach(function (s) {
      var st = s.status || "pending";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });
    csv += "\r\nSTATUS BREAKDOWN\r\n";
    Object.keys(statusCounts).forEach(function (s) {
      csv += s + "," + statusCounts[s] + "\r\n";
    });

    var filename = "MaidBridge_Route_" + now.toISOString().split("T")[0] + ".csv";
    if (window.dlFile) {
      window.dlFile(csv, filename, "text/csv");
    } else {
      var blob = new Blob([csv], { type: "text/csv" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    if (window.msg) window.msg("success", "Route Exported", stops.length + " stops · " + totalDist.toFixed(1) + "mi · " + filename);
  };

  function enhanceRouteStops() {
    var stops = $("rteStops");
    if (!stops) return;

    var stopEls = stops.querySelectorAll(".rte-stop");
    var hq = getHQ();
    var prevLat = (window.routeOrigin && window.routeOrigin.lat) || hq.lat;
    var prevLng = (window.routeOrigin && window.routeOrigin.lng) || hq.lng;

    stopEls.forEach(function (el) {
      var nameEl = el.querySelector(".sn");
      if (!nameEl) return;
      var addr = getA().find(function (a) {
        return a.street === nameEl.textContent;
      });
      if (addr && !el.querySelector(".rte-segment")) {
        var dist = havMi(prevLat, prevLng, addr.lat, addr.lng);
        var walkMin = Math.round(dist / 0.05);
        var seg = document.createElement("div");
        seg.className = "rte-segment";
        seg.innerHTML =
          '<i class="fas fa-walking"></i> ' +
          (dist < 0.1
            ? Math.round(dist * 5280) + "ft"
            : dist.toFixed(2) + "mi") +
          " · ~" +
          walkMin +
          "min walk";
        el.insertBefore(seg, el.firstChild);
        prevLat = addr.lat;
        prevLng = addr.lng;
      }
    });
  }

  function havMi(a, b, c, d) {
    var R = 3959,
      dLa = ((c - a) * Math.PI) / 180,
      dLn = ((d - b) * Math.PI) / 180;
    var x =
      Math.sin(dLa / 2) * Math.sin(dLa / 2) +
      Math.cos((a * Math.PI) / 180) *
        Math.cos((c * Math.PI) / 180) *
        Math.sin(dLn / 2) *
        Math.sin(dLn / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function pip(pt, poly) {
    var ins = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0],
        yi = poly[i][1],
        xj = poly[j][0],
        yj = poly[j][1];
      if (
        yi > pt[1] !== yj > pt[1] &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
      )
        ins = !ins;
    }
    return ins;
  }

  // ═══ ENHANCED ANALYTICS ═══
  var origOpenStats = window.openStats;
  window.openStats = function () {
    var A = getA();
    var t = A.length;
    var COL = getCOL();
    var sc = {};
    Object.keys(COL).forEach(function (s) {
      sc[s] = t
        ? A.filter(function (a) {
            return a.status === s;
          }).length
        : 0;
    });
    var cr = t ? ((sc.converted / t) * 100).toFixed(1) : 0;
    var ir = t ? ((sc.interested / t) * 100).toFixed(1) : 0;
    var visitedTotal =
      (sc.visited || 0) +
      (sc.interested || 0) +
      (sc.converted || 0) +
      (sc.declined || 0) +
      (sc["not-home"] || 0);
    var vr = t ? ((visitedTotal / t) * 100).toFixed(1) : 0;

    var valueMap = { $: 50, $$: 150, $$$: 350, $$$$: 600 };
    var pipeline = t
      ? A.reduce(function (sum, a) {
          return sum + (valueMap[a.value] || 0);
        }, 0)
      : 0;
    var won = t
      ? A.filter(function (a) {
            return a.status === "converted";
          }).reduce(function (sum, a) {
            return sum + (valueMap[a.value] || 0);
          }, 0)
      : 0;

    var teams = [];
    var teamSet = {};
    if (t) {
      A.forEach(function (a) {
        if (a.assigned && !teamSet[a.assigned]) {
          teamSet[a.assigned] = true;
          teams.push(a.assigned);
        }
      });
    }
    var teamColors = [
      "var(--p)",
      "var(--g)",
      "var(--o)",
      "var(--v)",
      "var(--c)",
    ];

    var breakdownHtml = Object.keys(COL)
      .map(function (s) {
        var count = sc[s] || 0;
        var pct = t ? (count / t) * 100 : 0;
        return (
          '<div style="display:flex;align-items:center;gap:8px;padding:4px 0">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' +
          COL[s] +
          ';flex-shrink:0"></div>' +
          '<span style="font:500 10px var(--f);flex:1">' +
          s +
          "</span>" +
          '<span style="font:700 10px var(--f)">' +
          count +
          "</span>" +
          '<div style="width:60px;height:4px;background:var(--s2);border-radius:2px;overflow:hidden"><div style="height:100%;width:' +
          pct +
          "%;background:" +
          COL[s] +
          ';border-radius:2px"></div></div></div>'
        );
      })
      .join("");

    var teamHtml = teams.length
      ? '<div class="intel-section"><div class="intel-header"><h4><i class="fas fa-trophy" style="color:var(--o)"></i> Teams</h4></div>' +
        teams
          .map(function (team, i) {
            var teamA = A.filter(function (a) {
              return a.assigned === team;
            });
            var teamConv = teamA.filter(function (a) {
              return a.status === "converted";
            }).length;
            return (
              '<div class="team-row"><div class="team-avatar" style="background:' +
              teamColors[i % teamColors.length] +
              '">' +
              team[0] +
              '</div><div class="team-info"><div class="team-name">' +
              team +
              '</div><div class="team-sub">' +
              teamA.length +
              " addr · " +
              teamConv +
              ' conv</div></div><div class="team-score">' +
              (teamA.length
                ? Math.round((teamConv / teamA.length) * 100)
                : 0) +
              "%</div></div>"
            );
          })
          .join("") +
        "</div>"
      : "";

    var rpIn = $("rpIn");
    if (!rpIn) return;

    rpIn.innerHTML =
      '<div class="rp-h"><h2><i class="fas fa-chart-pie" style="color:var(--p)"></i> Analytics</h2><button class="xb" onclick="closeRP()"><i class="fas fa-times"></i></button></div>' +
      '<div class="rp-body">' +
      '<div class="kpi-row">' +
      '<div class="kpi-card"><div class="kpi-v" style="color:var(--p)">' +
      t +
      '</div><div class="kpi-l">Total Addresses</div><div class="kpi-d ' +
      (cr > 5 ? "kpi-up" : "") +
      '"><i class="fas fa-' +
      (cr > 5 ? "arrow-up" : "arrow-right") +
      '"></i> ' +
      cr +
      "% conversion</div></div>" +
      '<div class="kpi-card"><div class="kpi-v" style="color:var(--g)">' +
      sc.converted +
      '</div><div class="kpi-l">Converted</div><div class="kpi-d kpi-up"><i class="fas fa-dollar-sign"></i> $' +
      won.toLocaleString() +
      " won</div></div>" +
      '<div class="kpi-card"><div class="kpi-v" style="color:var(--o)">' +
      sc.interested +
      '</div><div class="kpi-l">Hot Leads</div><div class="kpi-d"><i class="fas fa-fire"></i> ' +
      ir +
      "% interest</div></div>" +
      '<div class="kpi-card"><div class="kpi-v" style="color:var(--c)">' +
      vr +
      '%</div><div class="kpi-l">Coverage</div><div class="kpi-d"><i class="fas fa-shoe-prints"></i> ' +
      visitedTotal +
      " doors</div></div></div>" +
      '<div class="intel-section"><div class="intel-header"><h4><i class="fas fa-funnel-dollar" style="color:var(--g)"></i> Pipeline</h4><span style="font:900 14px var(--f);color:var(--g)">$' +
      pipeline.toLocaleString() +
      "</span></div>" +
      '<div class="pipeline-track"><div class="pipeline-fill" style="width:' +
      (pipeline ? (won / pipeline) * 100 : 0) +
      '%;background:linear-gradient(90deg,var(--g),var(--v))"></div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="font:500 8px var(--f);color:var(--g)">Won: $' +
      won.toLocaleString() +
      '</span><span style="font:500 8px var(--f);color:var(--t3)">Pipeline: $' +
      pipeline.toLocaleString() +
      "</span></div></div>" +
      '<div class="intel-section"><div class="intel-header"><h4><i class="fas fa-chart-bar" style="color:var(--p)"></i> Breakdown</h4></div>' +
      breakdownHtml +
      "</div>" +
      teamHtml +
      "</div>";

    $("rp").classList.add("open");
  };

  // ═══ ADD INTEL TAB TO SIDEBAR ═══
  function addIntelTab() {
    var sideTabs = document.querySelector(".side-tabs");
    if (!sideTabs || sideTabs.querySelector('[data-tab="intel"]')) return;

    var btn = document.createElement("button");
    btn.className = "st";
    btn.dataset.tab = "intel";
    btn.textContent = "Intel";
    btn.onclick = function () {
      window.sTab("intel", this);
    };
    sideTabs.appendChild(btn);

    var origSTab = window.sTab;
    window.sTab = function (t, el) {
      if (t === "intel") {
        document.querySelectorAll(".st").forEach(function (x) {
          x.classList.remove("on");
        });
        el.classList.add("on");
        [
          "cards",
          "filEl",
          "blocksP",
          "todayP",
          "custP",
          "logsP",
          "dndP",
          "funnelP",
          "moreP",
        ].forEach(function (h) {
          var e = $(h);
          if (e) e.classList.add("hidden");
        });
        var se = $('statsEl');
        if (se) se.classList.remove('hidden');
        showIntelPanel();
      } else {
        var ip = $("intelP");
        if (ip) ip.classList.add("hidden");
        var mp = $("moreP");
        if (mp) mp.classList.add("hidden");
        origSTab(t, el);
      }
    };
  }

  // ═══ TOUCH GESTURES ═══
  var touchStartX = 0;
  var touchStartY = 0;

  document.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    function (e) {
      if (window.innerWidth > 768) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;

      // Swipe right from left edge → open sidebar
      if (touchStartX < 30 && dx > 80 && Math.abs(dy) < 60) {
        openMobileSide();
      }
      // Swipe left → close sidebar
      if (dx < -80 && Math.abs(dy) < 60) {
        var side = $("side");
        if (side && side.classList.contains("mobile-open")) {
          closeMobileSide();
        }
      }
    },
    { passive: true }
  );

  // ═══ VIEWPORT META (ensure proper mobile scaling) ═══
  function ensureViewport() {
    if (!document.querySelector('meta[name="viewport"]')) {
      var meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content =
        "width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no";
      document.head.appendChild(meta);
    }
  }

  // ═══ CLOSE DETAIL PANEL ON MOBILE NAV AWAY ═══
  var origCloseRP = window.closeRP;
  window.closeRP = function () {
    if (origCloseRP) origCloseRP();
    // Reset mobile nav to map
    if (window.innerWidth <= 768) {
      var mapBtn = document.querySelector('.mnav-btn[data-view="map"]');
      if (mapBtn) {
        document.querySelectorAll(".mnav-btn").forEach(function (b) {
          b.classList.remove("on");
        });
        mapBtn.classList.add("on");
      }
    }
  };

  // ═══ INIT ═══
  function init() {
    ensureViewport();
    injectMobileNav();
    addIntelTab();

    // Update intel when stats update
    var origUpStats = window.upStats;
    window.upStats = function () {
      if (origUpStats) origUpStats();
      var ip = $("intelP");
      if (ip && !ip.classList.contains("hidden")) renderIntel();
    };

    console.log("[MB] Enhanced features loaded");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 100);
  }
})();
