/**
 * Maid Bridge — Field Agent Mode
 * Mobile-first door-to-door canvassing interface
 * Step-by-step route navigation, quick status updates, conversation log
 */
(function () {
  "use strict";

  var $ = function (s) { return document.getElementById(s.replace("#", "")); };
  function getA() { return window.A || []; }
  function getCOL() { return window.COL || {}; }
  function getHQ() { return window.HQ || { lat: 29.6986, lng: -95.128 }; }

  var fieldActive = false;
  var fieldStops = [];  // ordered route stops (address objects)
  var currentIdx = 0;
  var fieldGpsId = null;

  // ═══════════════════════════════════════════════
  //  INJECT FIELD MODE UI
  // ═══════════════════════════════════════════════
  function createFieldUI() {
    if ($("fieldMode")) return;

    var div = document.createElement("div");
    div.id = "fieldMode";
    div.className = "field-mode";
    div.innerHTML =
      // Top bar
      '<div class="fm-topbar">' +
        '<div class="fm-brand"><i class="fas fa-walking"></i> Field Mode</div>' +
        '<div class="fm-top-actions">' +
          '<button class="fm-icon-btn" onclick="fieldToggleGPS()" id="fmGpsBtn"><i class="fas fa-location-crosshairs"></i></button>' +
          '<button class="fm-icon-btn fm-exit" onclick="exitFieldMode()"><i class="fas fa-times"></i></button>' +
        '</div>' +
      '</div>' +

      // Progress bar
      '<div class="fm-progress">' +
        '<div class="fm-progress-fill" id="fmProgressFill"></div>' +
        '<div class="fm-progress-text" id="fmProgressText">0 / 0</div>' +
      '</div>' +

      // Map area (reuses existing map)
      '<div class="fm-map" id="fmMap"></div>' +

      // Current Stop Card
      '<div class="fm-card-area">' +
        '<div class="fm-card" id="fmCard">' +
          '<div class="fm-card-inner" id="fmCardInner">' +
            '<div style="text-align:center;padding:30px;color:var(--t3)">' +
              '<i class="fas fa-route" style="font-size:28px;margin-bottom:8px;display:block;opacity:.4"></i>' +
              '<p style="font:600 11px var(--f)">No route loaded</p>' +
              '<p style="font:400 9px var(--f);margin-top:4px">Build a route in Admin mode first, then switch to Field Mode</p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Navigation arrows
        '<div class="fm-nav">' +
          '<button class="fm-nav-btn" id="fmPrev" onclick="fieldPrev()"><i class="fas fa-chevron-left"></i></button>' +
          '<button class="fm-nav-center" onclick="fieldNavigate()"><i class="fas fa-directions"></i> Navigate</button>' +
          '<button class="fm-nav-btn" id="fmNext" onclick="fieldNext()"><i class="fas fa-chevron-right"></i></button>' +
        '</div>' +

        // Quick Status Buttons
        '<div class="fm-status-bar" id="fmStatusBar">' +
          '<button class="fm-status-btn" data-s="visited" onclick="fieldSetStatus(\'visited\')"><i class="fas fa-eye"></i><span>Visited</span></button>' +
          '<button class="fm-status-btn" data-s="interested" onclick="fieldSetStatus(\'interested\')"><i class="fas fa-star"></i><span>Interested</span></button>' +
          '<button class="fm-status-btn" data-s="not-home" onclick="fieldSetStatus(\'not-home\')"><i class="fas fa-door-closed"></i><span>Not Home</span></button>' +
          '<button class="fm-status-btn" data-s="callback" onclick="fieldSetStatus(\'callback\')"><i class="fas fa-phone-alt"></i><span>Callback</span></button>' +
          '<button class="fm-status-btn" data-s="declined" onclick="fieldSetStatus(\'declined\')"><i class="fas fa-times-circle"></i><span>Declined</span></button>' +
          '<button class="fm-status-btn fm-status-converted" data-s="converted" onclick="fieldSetStatus(\'converted\')"><i class="fas fa-handshake"></i><span>Won!</span></button>' +
        '</div>' +

        // Quick Note
        '<div class="fm-quick-note">' +
          '<input type="text" class="fm-note-input" id="fmNoteInput" placeholder="Quick note about this lead..." />' +
          '<button class="fm-note-send" onclick="fieldAddNote()"><i class="fas fa-paper-plane"></i></button>' +
        '</div>' +

        // Stop list (collapsible)
        '<button class="fm-stops-toggle" id="fmStopsToggle" onclick="toggleFieldStops()">' +
          '<i class="fas fa-list"></i> All Stops <span id="fmStopsCount"></span>' +
          '<i class="fas fa-chevron-up fm-toggle-ico" id="fmToggleIco"></i>' +
        '</button>' +
        '<div class="fm-stops-list" id="fmStopsList"></div>' +
      '</div>';

    document.body.appendChild(div);
  }

  // ═══════════════════════════════════════════════
  //  ENTER / EXIT FIELD MODE
  // ═══════════════════════════════════════════════
  window.enterFieldMode = function () {
    createFieldUI();

    // Gather stops from current route
    var rteStops = $("rteStops");
    fieldStops = [];
    if (rteStops) {
      var stopEls = rteStops.querySelectorAll(".rte-stop");
      var A = getA();
      stopEls.forEach(function (el) {
        var nameEl = el.querySelector(".sn");
        if (!nameEl) return;
        var addr = A.find(function (a) { return a.street === nameEl.textContent; });
        if (addr) fieldStops.push(addr);
      });
    }

    // If no route, try using today's scheduled addresses
    if (!fieldStops.length) {
      var today = new Date().toISOString().split("T")[0];
      var A = getA();
      fieldStops = A.filter(function (a) {
        return a.status === "scheduled" || a.status === "pending";
      });
    }

    currentIdx = 0;
    fieldActive = true;
    $("fieldMode").classList.add("active");

    // Hide admin UI
    document.body.classList.add("field-mode-on");

    // Auto-enable GPS
    if (!window.gpsWatchId && navigator.geolocation) {
      fieldToggleGPS();
    }

    renderFieldStop();
    renderFieldStopList();

    if (window.msg) window.msg("info", "Field Mode", fieldStops.length + " stops loaded");
  };

  window.exitFieldMode = function () {
    fieldActive = false;
    var fm = $("fieldMode");
    if (fm) fm.classList.remove("active");
    document.body.classList.remove("field-mode-on");
  };

  // ═══════════════════════════════════════════════
  //  RENDER CURRENT STOP
  // ═══════════════════════════════════════════════
  function renderFieldStop() {
    if (!fieldStops.length) return;

    var a = fieldStops[currentIdx];
    if (!a) return;

    var COL = getCOL();
    var c = COL[a.status] || "#8E8E93";
    var ls = window.calcLeadScore ? window.calcLeadScore(a) : 0;
    var sl = window.scoreLabel ? window.scoreLabel(ls) : { label: "—", color: "#8E8E93", icon: "fa-circle" };
    var visits = (a.visits && a.visits.length) || 0;
    var convos = (a.conversations && a.conversations.length) || 0;
    var lastConvo = a.conversations && a.conversations.length
      ? a.conversations[a.conversations.length - 1].text
      : "";

    // Update progress
    var pct = ((currentIdx + 1) / fieldStops.length * 100).toFixed(0);
    $("fmProgressFill").style.width = pct + "%";
    $("fmProgressText").textContent = (currentIdx + 1) + " / " + fieldStops.length;

    // Count completed stops
    var completed = fieldStops.filter(function (s) {
      return ["visited", "interested", "converted", "declined", "not-home", "callback"].indexOf(s.status) >= 0;
    }).length;

    $("fmCardInner").innerHTML =
      // Stop number + status badge
      '<div class="fm-stop-header">' +
        '<div class="fm-stop-num">' + (currentIdx + 1) + '</div>' +
        '<div class="fm-stop-title">' +
          '<div class="fm-stop-street">' + a.street + '</div>' +
          '<div class="fm-stop-sub">' + a.city + ', TX ' + a.zip +
            (a.owner ? ' · ' + a.owner : '') + '</div>' +
        '</div>' +
        '<div class="fm-stop-score" style="background:' + sl.color + '20;color:' + sl.color + '">' +
          '<div style="font:900 16px var(--f)">' + ls + '</div>' +
          '<div style="font:500 6px var(--f);text-transform:uppercase">' + sl.label + '</div>' +
        '</div>' +
      '</div>' +

      // Status pill
      '<div class="fm-current-status">' +
        '<span class="pill pill-' + a.status + '" style="font-size:9px;padding:3px 10px">' + a.status.toUpperCase() + '</span>' +
        (a.value ? ' <span style="color:var(--o);font:700 11px var(--f)">' + a.value + '</span>' : '') +
        ' <span style="font:400 8px var(--f);color:var(--t3)">' + visits + ' visits · ' + convos + ' notes</span>' +
      '</div>' +

      // Contact info (if available)
      (a.phone || a.email || a.owner ? (
        '<div class="fm-contact-row">' +
          (a.phone ? '<a href="tel:' + a.phone + '" class="fm-contact-chip"><i class="fas fa-phone"></i> ' + a.phone + '</a>' : '') +
          (a.email ? '<a href="mailto:' + a.email + '" class="fm-contact-chip"><i class="fas fa-envelope"></i> Email</a>' : '') +
        '</div>'
      ) : '') +

      // Competitor info
      (a.competitor ? '<div style="font:500 8px var(--f);color:var(--o);padding:4px 0"><i class="fas fa-tag"></i> Competitor: ' + a.competitor + '</div>' : '') +

      // Last conversation
      (lastConvo ? '<div class="fm-last-note"><i class="fas fa-comment" style="color:var(--p);font-size:8px"></i> <span>' + lastConvo.substring(0, 80) + (lastConvo.length > 80 ? '...' : '') + '</span></div>' : '') +

      // Stats row
      '<div class="fm-stats-row">' +
        '<div class="fm-stat"><div class="fm-stat-v">' + completed + '</div><div class="fm-stat-l">Done</div></div>' +
        '<div class="fm-stat"><div class="fm-stat-v">' + (fieldStops.length - completed) + '</div><div class="fm-stat-l">Left</div></div>' +
        '<div class="fm-stat"><div class="fm-stat-v">' + pct + '%</div><div class="fm-stat-l">Progress</div></div>' +
      '</div>';

    // Fly map to stop
    if (window.map) {
      window.map.flyTo([a.lat, a.lng], 18, { duration: 0.5 });
    }

    // Highlight current marker
    highlightFieldMarker(a);

    // Update button states
    $("fmPrev").disabled = currentIdx === 0;
    $("fmNext").disabled = currentIdx >= fieldStops.length - 1;

    // Highlight active status btn
    var statusBtns = document.querySelectorAll(".fm-status-btn");
    statusBtns.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-s") === a.status);
    });

    // Update stop list active state
    updateFieldStopListActive();
  }

  function highlightFieldMarker(a) {
    if (!window.MK || !window.MK[a.id]) return;
    var m = window.MK[a.id];
    if (m.openPopup) {
      setTimeout(function () { m.openPopup(); }, 600);
    }
  }

  // ═══════════════════════════════════════════════
  //  NAVIGATION
  // ═══════════════════════════════════════════════
  window.fieldPrev = function () {
    if (currentIdx > 0) {
      currentIdx--;
      renderFieldStop();
    }
  };

  window.fieldNext = function () {
    if (currentIdx < fieldStops.length - 1) {
      currentIdx++;
      renderFieldStop();
    }
  };

  window.fieldGoTo = function (idx) {
    if (idx >= 0 && idx < fieldStops.length) {
      currentIdx = idx;
      renderFieldStop();
      // Collapse stop list
      $("fmStopsList").classList.remove("open");
      $("fmToggleIco").style.transform = "";
    }
  };

  window.fieldNavigate = function () {
    if (!fieldStops.length) return;
    var a = fieldStops[currentIdx];
    if (!a) return;
    window.open(
      "https://www.google.com/maps/dir/?api=1&destination=" + a.lat + "," + a.lng + "&travelmode=driving",
      "_blank"
    );
  };

  // ═══════════════════════════════════════════════
  //  STATUS UPDATE
  // ═══════════════════════════════════════════════
  window.fieldSetStatus = async function (status) {
    if (!fieldStops.length) return;
    var a = fieldStops[currentIdx];
    if (!a) return;

    a.status = status;
    a.updatedAt = new Date().toISOString();
    if (!a.visits) a.visits = [];
    a.visits.push({ date: new Date().toISOString(), status: status });

    if (window.upsertCust) window.upsertCust(a);
    if (window.addLog) window.addLog("status", a.street + " → " + status, "Field mode");
    if (status === "converted" && window.addLog) window.addLog("convert", "🎉 " + a.street, "Field mode");
    if (window.reMk) window.reMk(a);
    if (window.saveAll) await window.saveAll();
    if (window.upStats) window.upStats();

    renderFieldStop();
    renderFieldStopList();

    // Celebration for conversion
    if (status === "converted") {
      showFieldCelebration();
    }

    // Auto-advance after status update (unless converted — let them celebrate)
    if (status !== "converted" && currentIdx < fieldStops.length - 1) {
      setTimeout(function () {
        fieldNext();
        if (window.msg) window.msg("success", "→ " + status, "Moving to next stop");
      }, 800);
    } else {
      if (window.msg) window.msg("success", "→ " + status, a.street);
    }
  };

  // ═══════════════════════════════════════════════
  //  QUICK NOTE
  // ═══════════════════════════════════════════════
  window.fieldAddNote = async function () {
    var input = $("fmNoteInput");
    if (!input || !input.value.trim()) return;
    if (!fieldStops.length) return;
    var a = fieldStops[currentIdx];
    if (!a) return;

    if (window.addConversation) {
      await window.addConversation(a.id, input.value.trim(), "neutral", "visit");
    }
    input.value = "";
    renderFieldStop();
  };

  // ═══════════════════════════════════════════════
  //  STOP LIST
  // ═══════════════════════════════════════════════
  function renderFieldStopList() {
    var el = $("fmStopsList");
    var countEl = $("fmStopsCount");
    if (!el) return;

    var completed = fieldStops.filter(function (s) {
      return ["visited", "interested", "converted", "declined", "not-home", "callback"].indexOf(s.status) >= 0;
    }).length;

    if (countEl) countEl.textContent = "(" + completed + "/" + fieldStops.length + ")";

    var COL = getCOL();
    el.innerHTML = fieldStops.map(function (a, i) {
      var isActive = i === currentIdx;
      var isDone = ["visited", "interested", "converted", "declined", "not-home", "callback"].indexOf(a.status) >= 0;
      var c = COL[a.status] || "#8E8E93";

      return '<div class="fm-stop-item ' + (isActive ? "fm-stop-active" : "") + ' ' + (isDone ? "fm-stop-done" : "") + '" onclick="fieldGoTo(' + i + ')">' +
        '<div class="fm-stop-item-num" style="background:' + c + '20;color:' + c + '">' +
          (isDone ? '<i class="fas fa-check"></i>' : (i + 1)) +
        '</div>' +
        '<div class="fm-stop-item-info">' +
          '<div style="font:600 10px var(--f)' + (isDone ? ';opacity:.5' : '') + '">' + a.street + '</div>' +
          '<div style="font:400 7px var(--f);color:var(--t3)">' + a.status + (a.owner ? ' · ' + a.owner : '') + '</div>' +
        '</div>' +
        '<div style="font:400 8px var(--f);color:' + c + '">' + a.status + '</div>' +
      '</div>';
    }).join("");
  }

  function updateFieldStopListActive() {
    var items = document.querySelectorAll(".fm-stop-item");
    items.forEach(function (el, i) {
      el.classList.toggle("fm-stop-active", i === currentIdx);
    });
  }

  window.toggleFieldStops = function () {
    var list = $("fmStopsList");
    var ico = $("fmToggleIco");
    if (!list) return;
    list.classList.toggle("open");
    if (ico) ico.style.transform = list.classList.contains("open") ? "rotate(180deg)" : "";
  };

  // ═══════════════════════════════════════════════
  //  GPS FOR FIELD MODE
  // ═══════════════════════════════════════════════
  window.fieldToggleGPS = function () {
    var btn = $("fmGpsBtn");
    if (fieldGpsId) {
      navigator.geolocation.clearWatch(fieldGpsId);
      fieldGpsId = null;
      if (window.gpsMarker) { window.map.removeLayer(window.gpsMarker); window.gpsMarker = null; }
      if (btn) btn.classList.remove("active");
      return;
    }
    if (!navigator.geolocation) return;
    fieldGpsId = navigator.geolocation.watchPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      if (window.gpsMarker) {
        window.gpsMarker.setLatLng([lat, lng]);
      } else {
        window.gpsMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "mic",
            html: '<div class="gps-dot"></div>',
            iconSize: [14, 14], iconAnchor: [7, 7]
          }),
          zIndexOffset: 2000
        }).addTo(window.map);
      }
    }, function () {}, { enableHighAccuracy: true, maximumAge: 5000 });
    if (btn) btn.classList.add("active");
  };

  // ═══════════════════════════════════════════════
  //  CELEBRATION ANIMATION
  // ═══════════════════════════════════════════════
  function showFieldCelebration() {
    var overlay = document.createElement("div");
    overlay.className = "fm-celebration";
    overlay.innerHTML =
      '<div class="fm-celeb-content">' +
        '<div style="font-size:48px;margin-bottom:12px">🎉</div>' +
        '<div style="font:900 22px var(--f);color:#fff">Converted!</div>' +
        '<div style="font:400 11px var(--f);color:rgba(255,255,255,.7);margin-top:4px">Great job closing this lead!</div>' +
      '</div>';
    document.body.appendChild(overlay);
    setTimeout(function () {
      overlay.classList.add("fm-celeb-out");
      setTimeout(function () { overlay.remove(); }, 500);
    }, 1800);
  }

  // ═══════════════════════════════════════════════
  //  SWIPE GESTURE SUPPORT
  // ═══════════════════════════════════════════════
  function initSwipe() {
    var startX = 0, startY = 0;
    var card = null;

    document.addEventListener("touchstart", function (e) {
      card = e.target.closest(".fm-card");
      if (!card || !fieldActive) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener("touchend", function (e) {
      if (!card || !fieldActive) return;
      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var dx = endX - startX;
      var dy = endY - startY;

      // Only horizontal swipes (not vertical scroll)
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) fieldNext();  // swipe left = next
        else fieldPrev();         // swipe right = prev
      }
      card = null;
    }, { passive: true });
  }

  // ═══════════════════════════════════════════════
  //  INJECT CSS
  // ═══════════════════════════════════════════════
  function injectFieldCSS() {
    var style = document.createElement("style");
    style.textContent =
      /* Base field mode container */
      '.field-mode{position:fixed;inset:0;z-index:10000;background:var(--bg);display:none;flex-direction:column;overflow:hidden}' +
      '.field-mode.active{display:flex}' +
      '.field-mode-on .topbar,.field-mode-on .side,.field-mode-on .rpanel,.field-mode-on .mobile-nav,.field-mode-on .fab-area,.field-mode-on .mp,.field-mode-on .kb-panel,.field-mode-on .side-overlay{display:none!important}' +

      /* Topbar */
      '.fm-topbar{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--gt);border-bottom:1px solid var(--bd);flex-shrink:0;padding-top:env(safe-area-inset-top,10px)}' +
      '.fm-brand{font:800 13px var(--f);color:var(--p);display:flex;align-items:center;gap:6px}' +
      '.fm-top-actions{display:flex;gap:6px}' +
      '.fm-icon-btn{width:34px;height:34px;border-radius:10px;border:1px solid var(--bd);background:var(--sf);color:var(--t2);display:grid;place-items:center;cursor:pointer;font-size:13px;transition:all .2s ease}' +
      '.fm-icon-btn:active{transform:scale(.92)}.fm-icon-btn.active{background:var(--pd);color:var(--p);border-color:var(--p)}' +
      '.fm-exit{background:var(--rd);border-color:var(--r);color:var(--r)}' +

      /* Progress bar */
      '.fm-progress{height:4px;background:var(--s2);position:relative;flex-shrink:0}' +
      '.fm-progress-fill{height:100%;background:linear-gradient(90deg,var(--p),var(--g));border-radius:0 2px 2px 0;transition:width .5s ease}' +
      '.fm-progress-text{position:absolute;right:8px;top:-1px;font:700 7px var(--f);color:var(--t3);line-height:4px}' +

      /* Map area in field mode */
      '.fm-map{flex:0 0 35vh;position:relative;overflow:hidden}' +

      /* Card area */
      '.fm-card-area{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch}' +

      /* Stop card */
      '.fm-card{background:var(--gl);border:1px solid var(--bd);border-radius:16px;overflow:hidden}' +
      '.fm-card-inner{padding:14px}' +

      '.fm-stop-header{display:flex;align-items:center;gap:10px;margin-bottom:10px}' +
      '.fm-stop-num{width:36px;height:36px;border-radius:10px;background:var(--pd);display:grid;place-items:center;font:900 16px var(--f);color:var(--p);flex-shrink:0}' +
      '.fm-stop-title{flex:1;min-width:0}' +
      '.fm-stop-street{font:800 15px var(--f);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.fm-stop-sub{font:400 10px var(--f);color:var(--t3);margin-top:1px}' +
      '.fm-stop-score{padding:4px 8px;border-radius:10px;text-align:center;flex-shrink:0}' +

      '.fm-current-status{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}' +

      '.fm-contact-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}' +
      '.fm-contact-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:var(--pd);color:var(--p);border-radius:8px;font:600 9px var(--f);text-decoration:none;transition:all .2s ease}' +
      '.fm-contact-chip:active{transform:scale(.95)}' +

      '.fm-last-note{font:400 8px var(--f);color:var(--t2);padding:6px 8px;background:var(--sf);border-radius:8px;margin-bottom:6px;display:flex;align-items:start;gap:5px}' +
      '.fm-last-note span{flex:1}' +

      '.fm-stats-row{display:flex;gap:4px}' +
      '.fm-stat{flex:1;text-align:center;padding:8px 4px;background:var(--sf);border-radius:8px}' +
      '.fm-stat-v{font:900 14px var(--f);color:var(--t)}.fm-stat-l{font:500 6px var(--f);color:var(--t3);text-transform:uppercase;margin-top:1px}' +

      /* Navigation arrows */
      '.fm-nav{display:flex;gap:6px;align-items:center}' +
      '.fm-nav-btn{width:44px;height:44px;border-radius:12px;border:1px solid var(--bd);background:var(--sf);color:var(--t);display:grid;place-items:center;cursor:pointer;font-size:14px;transition:all .2s ease;flex-shrink:0}' +
      '.fm-nav-btn:active{transform:scale(.92)}.fm-nav-btn:disabled{opacity:.3;pointer-events:none}' +
      '.fm-nav-center{flex:1;height:44px;border-radius:12px;border:none;background:linear-gradient(135deg,#30D158,#28a745);color:#fff;font:700 12px var(--f);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 4px 16px rgba(48,209,88,.3);transition:transform .2s ease}' +
      '.fm-nav-center:active{transform:scale(.97)}' +

      /* Status buttons */
      '.fm-status-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}' +
      '.fm-status-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border-radius:10px;border:1.5px solid var(--bd);background:var(--sf);color:var(--t2);cursor:pointer;font:500 8px var(--f);transition:all .2s ease}' +
      '.fm-status-btn i{font-size:14px}' +
      '.fm-status-btn:active{transform:scale(.94)}' +
      '.fm-status-btn.active{border-color:var(--p);background:var(--pd);color:var(--p)}' +
      '.fm-status-converted{border-color:var(--v)!important;color:var(--v)}' +
      '.fm-status-converted.active{background:var(--vd);border-color:var(--v)}' +

      /* Quick note */
      '.fm-quick-note{display:flex;gap:4px}' +
      '.fm-note-input{flex:1;padding:10px 12px;background:var(--sf);border:1px solid var(--bd);border-radius:10px;color:var(--t);font:500 11px var(--f);outline:none;transition:border-color .2s ease}' +
      '.fm-note-input:focus{border-color:var(--p)}' +
      '.fm-note-input::placeholder{color:var(--t3)}' +
      '.fm-note-send{width:40px;border-radius:10px;border:none;background:var(--p);color:#fff;cursor:pointer;display:grid;place-items:center;font-size:12px;flex-shrink:0;transition:transform .2s ease}' +
      '.fm-note-send:active{transform:scale(.92)}' +

      /* Stop list */
      '.fm-stops-toggle{width:100%;padding:10px;border-radius:10px;border:1px solid var(--bd);background:var(--sf);color:var(--t2);font:600 10px var(--f);cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s ease}' +
      '.fm-stops-toggle:active{transform:scale(.98)}' +
      '.fm-toggle-ico{margin-left:auto;transition:transform .25s ease;font-size:9px}' +
      '.fm-stops-list{max-height:0;overflow:hidden;transition:max-height .35s ease}' +
      '.fm-stops-list.open{max-height:300px;overflow-y:auto}' +

      '.fm-stop-item{display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--t4);cursor:pointer;transition:background .2s ease}' +
      '.fm-stop-item:active{background:var(--sf)}' +
      '.fm-stop-active{background:var(--pd)!important;border-radius:8px}' +
      '.fm-stop-done{opacity:.6}' +
      '.fm-stop-item-num{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;font:700 9px var(--f);flex-shrink:0}' +
      '.fm-stop-item-info{flex:1;min-width:0}' +

      /* Celebration */
      '.fm-celebration{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:grid;place-items:center;animation:fmCelebIn .3s ease}' +
      '.fm-celeb-content{text-align:center;animation:fmCelebPop .5s cubic-bezier(.175,.885,.32,1.275)}' +
      '.fm-celeb-out{animation:fmCelebOut .5s ease forwards}' +
      '@keyframes fmCelebIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes fmCelebPop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}' +
      '@keyframes fmCelebOut{to{opacity:0;transform:scale(.8)}}' +

      /* Landscape adjustments */
      '@media(max-height:500px){.fm-map{flex:0 0 25vh}.fm-card-inner{padding:10px}}' +
      '@media(min-width:769px){.fm-map{flex:0 0 40vh}.fm-card-area{max-width:480px;margin:0 auto;width:100%}}';

    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════
  //  REPARENT MAP TO FIELD VIEW
  // ═══════════════════════════════════════════════
  var origMapParent = null;

  function moveMapToField() {
    var mapEl = $("map");
    var fmMap = $("fmMap");
    if (!mapEl || !fmMap) return;
    origMapParent = mapEl.parentElement;
    fmMap.appendChild(mapEl);
    mapEl.style.width = "100%";
    mapEl.style.height = "100%";
    if (window.map) window.map.invalidateSize();
  }

  function restoreMap() {
    var mapEl = $("map");
    if (!mapEl || !origMapParent) return;
    origMapParent.appendChild(mapEl);
    mapEl.style.width = "100%";
    mapEl.style.height = "100%";
    if (window.map) setTimeout(function () { window.map.invalidateSize(); }, 100);
  }

  // Patch enter/exit to move map
  var _origEnter = window.enterFieldMode;
  window.enterFieldMode = function () {
    _origEnter();
    moveMapToField();
  };

  var _origExit = window.exitFieldMode;
  window.exitFieldMode = function () {
    restoreMap();
    _origExit();
  };

  // ═══════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════
  function init() {
    injectFieldCSS();
    initSwipe();
    console.log("[MB] Field Agent Mode loaded");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 150);
  }
})();
