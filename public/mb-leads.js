/**
 * Maid Bridge — Lead Intelligence & Conversation Tracking
 * Deep lead insights, conversation logs, enhanced heatmap, CRM pipeline
 */
(function () {
  "use strict";

  var $ = function (s) {
    return document.getElementById(s.replace("#", ""));
  };

  function getA() { return window.A || []; }
  function getCOL() { return window.COL || {}; }
  function getHQ() { return window.HQ || { lat: 29.6986, lng: -95.1280 }; }
  function getCUST() { return window.CUST || []; }
  function getLOGS() { return window.LOGS || []; }

  // ═══════════════════════════════════════════════
  //  LEAD SCORE ENGINE
  // ═══════════════════════════════════════════════
  function calcLeadScore(a) {
    if (!a) return 0;
    var score = 0;

    // Status weight
    var statusW = {
      pending: 5, scheduled: 15, visited: 25,
      interested: 55, callback: 45, converted: 100,
      declined: 0, "not-home": 10
    };
    score += statusW[a.status] || 0;

    // Visit count bonus (max 20)
    var visits = (a.visits && a.visits.length) || 0;
    score += Math.min(visits * 4, 20);

    // Has phone/email (reachable)
    if (a.phone) score += 8;
    if (a.email) score += 5;

    // Has owner name (known contact)
    if (a.owner) score += 7;

    // Value tier
    var valW = { "$": 2, "$$": 5, "$$$": 10, "$$$$": 15 };
    score += valW[a.value] || 0;

    // Conversations bonus
    var convos = (a.conversations && a.conversations.length) || 0;
    score += Math.min(convos * 5, 25);

    // Follow-up set
    if (a.followUp) score += 5;

    // Recency bonus — updated in last 7 days
    if (a.updatedAt) {
      var days = (Date.now() - new Date(a.updatedAt).getTime()) / 86400000;
      if (days < 1) score += 10;
      else if (days < 3) score += 6;
      else if (days < 7) score += 3;
    }

    // Competitor intel known
    if (a.competitor) score += 5;

    return Math.min(score, 100);
  }
  window.calcLeadScore = calcLeadScore;

  function scoreLabel(s) {
    if (s >= 80) return { label: "Hot", color: "#FF453A", icon: "fa-fire" };
    if (s >= 60) return { label: "Warm", color: "#FF9F0A", icon: "fa-temperature-high" };
    if (s >= 40) return { label: "Lukewarm", color: "#FFD60A", icon: "fa-thermometer-half" };
    if (s >= 20) return { label: "Cool", color: "#64D2FF", icon: "fa-snowflake" };
    return { label: "Cold", color: "#8E8E93", icon: "fa-icicles" };
  }
  window.scoreLabel = scoreLabel;

  // ═══════════════════════════════════════════════
  //  CONVERSATION / FEEDBACK SYSTEM
  // ═══════════════════════════════════════════════
  window.addConversation = async function (addrId, text, sentiment, type) {
    var A = getA();
    var a = A.find(function (x) { return x.id === addrId; });
    if (!a) return;

    if (!a.conversations) a.conversations = [];

    var entry = {
      id: "conv" + Date.now() + Math.random().toString(36).slice(2, 5),
      text: text || "",
      sentiment: sentiment || "neutral", // positive, neutral, negative
      type: type || "note", // note, call, visit, email, sms
      date: new Date().toISOString(),
      user: "field-agent"
    };

    a.conversations.push(entry);
    a.updatedAt = new Date().toISOString();

    if (window.addLog) window.addLog("note", "Note on " + a.street, text.substring(0, 60));
    if (window.saveAll) await window.saveAll();
    if (window.msg) window.msg("success", "Saved", "Feedback added to " + a.street);

    return entry;
  };

  window.addFeedback = async function (addrId, rating, comment) {
    var A = getA();
    var a = A.find(function (x) { return x.id === addrId; });
    if (!a) return;

    if (!a.feedback) a.feedback = [];

    a.feedback.push({
      id: "fb" + Date.now(),
      rating: rating, // 1-5 stars
      comment: comment || "",
      date: new Date().toISOString()
    });

    a.updatedAt = new Date().toISOString();
    if (window.saveAll) await window.saveAll();
  };

  // ═══════════════════════════════════════════════
  //  ENHANCED DETAIL PANEL (overrides detail())
  // ═══════════════════════════════════════════════
  var origDetail = window.detail;
  window.detail = function (id) {
    var A = getA();
    var COL = getCOL();
    var ICO = window.ICO || {};
    var a = A.find(function (x) { return x.id === id; });
    if (!a) return;

    if (!a.conversations) a.conversations = [];
    if (!a.feedback) a.feedback = [];

    var c = COL[a.status] || "#8E8E93";
    var ico = ICO[a.status] || "fa-home";
    var ls = calcLeadScore(a);
    var sl = scoreLabel(ls);

    // Visit timeline
    var visits = a.visits || [];
    var convos = a.conversations || [];

    // Merge visits + conversations into unified timeline
    var timeline = [];
    visits.forEach(function (v) {
      timeline.push({ date: v.date, type: "status", text: "Status → " + v.status, icon: "fa-exchange-alt", color: COL[v.status] || "var(--gr)" });
    });
    convos.forEach(function (cv) {
      var typeIco = { note: "fa-sticky-note", call: "fa-phone", visit: "fa-walking", email: "fa-envelope", sms: "fa-comment-dots" };
      var sentColor = { positive: "var(--g)", neutral: "var(--t2)", negative: "var(--r)" };
      timeline.push({
        date: cv.date,
        type: "convo",
        text: cv.text,
        icon: typeIco[cv.type] || "fa-comment",
        color: sentColor[cv.sentiment] || "var(--t2)",
        sentiment: cv.sentiment,
        convoType: cv.type
      });
    });

    // Sort by date descending
    timeline.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    // Feedback average
    var avgRating = 0;
    if (a.feedback.length) {
      var sum = a.feedback.reduce(function (s, f) { return s + f.rating; }, 0);
      avgRating = (sum / a.feedback.length).toFixed(1);
    }

    var starHtml = "";
    for (var si = 1; si <= 5; si++) {
      starHtml += '<i class="fa' + (si <= Math.round(avgRating) ? "s" : "r") + ' fa-star" style="color:' + (si <= Math.round(avgRating) ? "var(--o)" : "var(--t4)") + ';cursor:pointer;font-size:14px" onclick="quickRate(\'' + id + '\',' + si + ')"></i>';
    }

    var timelineHtml = timeline.length
      ? timeline.slice(0, 15).map(function (t) {
        var ago = timeAgo(t.date);
        return '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--t4)">' +
          '<div style="width:24px;height:24px;border-radius:7px;background:' + (t.type === "convo" ? "var(--pd)" : "var(--sf)") + ';display:grid;place-items:center;flex-shrink:0;margin-top:2px"><i class="fas ' + t.icon + '" style="font-size:8px;color:' + t.color + '"></i></div>' +
          '<div style="flex:1;min-width:0"><div style="font:600 9px var(--f);color:var(--t)">' + t.text + '</div>' +
          '<div style="font:400 7px var(--f);color:var(--t3);margin-top:1px">' + ago +
          (t.sentiment ? ' · <span style="color:' + t.color + '">' + t.sentiment + '</span>' : '') +
          (t.convoType ? ' · ' + t.convoType : '') +
          '</div></div></div>';
      }).join("")
      : '<div style="text-align:center;padding:12px;color:var(--t3);font:400 9px var(--f)">No activity yet</div>';

    // Value map
    var valueMap = { "$": 50, "$$": 150, "$$$": 350, "$$$$": 600 };
    var estValue = valueMap[a.value] || 0;

    $("rpIn").innerHTML =
      '<div class="rp-h"><h2 style="color:' + c + '"><i class="fas ' + ico + '"></i> Lead Detail</h2><button class="xb" onclick="closeRP()"><i class="fas fa-times"></i></button></div>' +
      '<div class="rp-body">' +

      // Header
      '<div style="text-align:center;margin-bottom:12px">' +
      '<h3 style="font:800 14px var(--f)">' + a.street + '</h3>' +
      '<p style="font:400 10px var(--f);color:var(--t2)">' + a.city + ', TX ' + a.zip + '</p>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px">' +
      '<span class="pill pill-' + a.status + '">' + a.status.toUpperCase() + '</span>' +
      (a.value ? ' <span style="color:var(--o);font:700 10px var(--f)">' + a.value + '</span>' : '') +
      '</div></div>' +

      // Lead Score Card
      '<div style="background:linear-gradient(135deg,var(--sf),var(--s2));border:1px solid var(--bd);border-radius:12px;padding:12px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<div style="font:700 10px var(--f);display:flex;align-items:center;gap:5px"><i class="fas ' + sl.icon + '" style="color:' + sl.color + '"></i> Lead Score</div>' +
      '<div style="font:900 18px var(--f);color:' + sl.color + '">' + ls + '<span style="font:400 9px var(--f);color:var(--t3)">/100</span></div>' +
      '</div>' +
      '<div style="height:6px;background:var(--s2);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + ls + '%;background:' + sl.color + ';border-radius:3px;transition:width .5s ease"></div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="font:500 7px var(--f);color:var(--t3)">' + sl.label + '</span>' +
      '<span style="font:500 7px var(--f);color:var(--t3)">' + visits.length + ' visits · ' + convos.length + ' notes</span></div>' +
      '</div>' +

      // Quick Actions Row
      '<div style="display:flex;gap:3px;margin-bottom:8px">' +
      '<button class="btn btn-g btn-s" style="flex:1" onclick="openSV(' + a.lat + ',' + a.lng + ',\'' + esc(a.street) + '\')"><i class="fas fa-street-view"></i> Street</button>' +
      '<button class="btn btn-g btn-s" onclick="window.open(\'https://www.google.com/maps/@' + a.lat + ',' + a.lng + ',150m/data=!3m1!1e3\',\'_blank\')"><i class="fas fa-cube"></i> 3D</button>' +
      '<button class="btn btn-g btn-s" onclick="editAddr(\'' + id + '\')"><i class="fas fa-edit"></i> Edit</button>' +
      '</div>' +

      // Contact Info
      '<div class="gc" style="padding:10px;margin-bottom:8px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
      [
        ["Owner", a.owner || "—"],
        ["Phone", a.phone ? '<a href="tel:' + a.phone + '" style="color:var(--p)">' + a.phone + '</a>' : "—"],
        ["Email", a.email ? '<a href="mailto:' + a.email + '" style="color:var(--p);font-size:8px">' + a.email + '</a>' : "—"],
        ["Team", a.assigned || "—"],
        ["Priority", (a.priority || "normal").toUpperCase()],
        ["Follow-up", a.followUp || "—"],
        ["Competitor", a.competitor || "—"],
        ["Est. Value", estValue ? "$" + estValue : "—"]
      ].map(function (p) {
        return '<div><div style="font:500 7px var(--f);color:var(--t3);text-transform:uppercase">' + p[0] + '</div><div style="font:600 10px var(--f);margin-top:1px">' + p[1] + '</div></div>';
      }).join("") +
      '</div></div>' +

      // Rating
      '<div class="gc" style="padding:10px;margin-bottom:8px;text-align:center">' +
      '<div style="font:500 7px var(--f);color:var(--t3);text-transform:uppercase;margin-bottom:4px">Client Rating</div>' +
      '<div style="display:flex;justify-content:center;gap:4px">' + starHtml + '</div>' +
      (avgRating > 0 ? '<div style="font:700 10px var(--f);margin-top:4px;color:var(--o)">' + avgRating + ' / 5.0</div>' : '') +
      '</div>' +

      // Notes
      (a.notes ? '<div class="gc" style="padding:8px;margin-bottom:8px;font:400 9px var(--f);color:var(--t2)">' + a.notes + '</div>' : '') +

      // Status Buttons
      '<div style="margin-bottom:8px">' +
      '<div style="font:500 7px var(--f);color:var(--t3);text-transform:uppercase;margin-bottom:3px">Status</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:2px">' +
      Object.keys(COL).map(function (s) {
        return '<button class="btn btn-s ' + (a.status === s ? "btn-p" : "btn-g") + '" onclick="setDir(\'' + id + '\',\'' + s + '\')" style="font-size:7px">' + s + '</button>';
      }).join("") +
      '</div></div>' +

      // Add Conversation Form
      '<div style="margin-bottom:8px">' +
      '<div style="font:500 7px var(--f);color:var(--t3);text-transform:uppercase;margin-bottom:4px">Add Note / Conversation</div>' +
      '<div style="display:flex;gap:3px;margin-bottom:4px">' +
      '<button class="btn btn-s btn-g convo-type-btn" data-type="note" onclick="setConvoType(this,\'note\')"><i class="fas fa-sticky-note"></i></button>' +
      '<button class="btn btn-s btn-g convo-type-btn" data-type="call" onclick="setConvoType(this,\'call\')"><i class="fas fa-phone"></i></button>' +
      '<button class="btn btn-s btn-g convo-type-btn" data-type="visit" onclick="setConvoType(this,\'visit\')"><i class="fas fa-walking"></i></button>' +
      '<button class="btn btn-s btn-g convo-type-btn" data-type="email" onclick="setConvoType(this,\'email\')"><i class="fas fa-envelope"></i></button>' +
      '<button class="btn btn-s btn-g convo-type-btn" data-type="sms" onclick="setConvoType(this,\'sms\')"><i class="fas fa-comment-dots"></i></button>' +
      '</div>' +
      '<textarea id="convoText" class="fta" style="min-height:40px;font-size:10px" placeholder="What happened? Add feedback, conversation notes..."></textarea>' +
      '<div style="display:flex;gap:3px;margin-top:4px">' +
      '<select id="convoSent" class="fsel" style="padding:4px 6px;font-size:9px;flex:0 0 auto;width:auto">' +
      '<option value="neutral">😐 Neutral</option>' +
      '<option value="positive">😊 Positive</option>' +
      '<option value="negative">😞 Negative</option>' +
      '</select>' +
      '<button class="btn btn-p btn-s" style="flex:1" onclick="submitConvo(\'' + id + '\')"><i class="fas fa-plus"></i> Add</button>' +
      '</div></div>' +

      // Timeline
      '<div style="margin-bottom:8px">' +
      '<div style="font:500 7px var(--f);color:var(--t3);text-transform:uppercase;margin-bottom:4px">Timeline (' + timeline.length + ')</div>' +
      timelineHtml +
      '</div>' +

      // Actions
      '<div style="display:flex;gap:3px">' +
      '<button class="btn btn-g btn-s" style="flex:1" onclick="addDND(\'' + id + '\')"><i class="fas fa-ban"></i> DND</button>' +
      '<button class="btn btn-no btn-s" style="flex:1" onclick="delAddr(\'' + id + '\')"><i class="fas fa-trash"></i> Delete</button>' +
      '</div>' +
      '</div>';

    $("rp").classList.add("open");
  };

  // Conversation type selector state
  var currentConvoType = "note";
  window.setConvoType = function (el, type) {
    currentConvoType = type;
    var btns = document.querySelectorAll(".convo-type-btn");
    btns.forEach(function (b) {
      b.classList.remove("btn-p");
      b.classList.add("btn-g");
    });
    el.classList.remove("btn-g");
    el.classList.add("btn-p");
  };

  window.submitConvo = async function (addrId) {
    var text = $("convoText");
    var sent = $("convoSent");
    if (!text || !text.value.trim()) {
      if (window.msg) window.msg("warning", "Note", "Type something first");
      return;
    }
    await window.addConversation(addrId, text.value.trim(), sent.value, currentConvoType);
    currentConvoType = "note";
    // Re-render detail
    window.detail(addrId);
  };

  window.quickRate = async function (addrId, rating) {
    await window.addFeedback(addrId, rating, "");
    window.detail(addrId);
  };

  function esc(s) {
    return (s || "").replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }

  function timeAgo(dateStr) {
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = now - then;
    var min = Math.floor(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return min + "m ago";
    var hrs = Math.floor(min / 60);
    if (hrs < 24) return hrs + "h ago";
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + "d ago";
    return new Date(dateStr).toLocaleDateString();
  }

  // ═══════════════════════════════════════════════
  //  ENHANCED HEAT MAP
  // ═══════════════════════════════════════════════
  var heatLayer = null;
  var heatLegend = null;

  window.toggleHeat = function () {
    if (heatLayer) {
      window.map.removeLayer(heatLayer);
      heatLayer = null;
      if (heatLegend) {
        window.map.removeControl(heatLegend);
        heatLegend = null;
      }
      window.hG = null;
      return;
    }

    var A = getA();
    if (!A.length) {
      if (window.msg) window.msg("warning", "Heatmap", "Add addresses first");
      return;
    }

    heatLayer = L.layerGroup();

    A.forEach(function (a) {
      var ls = calcLeadScore(a);
      var sl = scoreLabel(ls);

      // Radius based on score
      var radius = 30 + (ls / 100) * 50; // 30-80m

      // Opacity based on score
      var opacity = 0.15 + (ls / 100) * 0.45; // 0.15-0.6

      // Color by lead temperature
      var fillColor;
      if (ls >= 80) fillColor = "rgba(255,69,58,0.5)";      // Hot red
      else if (ls >= 60) fillColor = "rgba(255,159,10,0.4)"; // Warm orange
      else if (ls >= 40) fillColor = "rgba(255,214,10,0.3)"; // Lukewarm yellow
      else if (ls >= 20) fillColor = "rgba(100,210,255,0.25)"; // Cool blue
      else fillColor = "rgba(142,142,147,0.12)";             // Cold grey

      var circle = L.circle([a.lat, a.lng], {
        radius: radius,
        color: "transparent",
        fillColor: fillColor,
        fillOpacity: opacity,
        className: ls >= 70 ? "heat-pulse" : ""
      }).addTo(heatLayer);

      // Tooltip on hover
      circle.bindTooltip(
        '<div style="font:700 10px var(--f)">' + a.street + '</div>' +
        '<div style="font:400 8px var(--f);color:#999">Score: ' + ls + '/100 · ' + sl.label + '</div>' +
        '<div style="font:400 8px var(--f);color:#999">' + a.status + (a.value ? " · " + a.value : "") + '</div>',
        { direction: "top", offset: [0, -10] }
      );
    });

    heatLayer.addTo(window.map);
    window.hG = heatLayer;

    // Add legend control
    heatLegend = L.control({ position: "bottomright" });
    heatLegend.onAdd = function () {
      var div = L.DomUtil.create("div", "mp");
      div.style.cssText = "padding:10px;min-width:120px;border-radius:12px";
      div.innerHTML =
        '<div style="font:700 8px var(--f);color:var(--t3);text-transform:uppercase;margin-bottom:6px">Lead Heat</div>' +
        '<div style="display:flex;flex-direction:column;gap:3px">' +
        [
          ["#FF453A", "Hot (80+)"],
          ["#FF9F0A", "Warm (60-79)"],
          ["#FFD60A", "Lukewarm (40-59)"],
          ["#64D2FF", "Cool (20-39)"],
          ["#8E8E93", "Cold (0-19)"]
        ].map(function (r) {
          return '<div style="display:flex;align-items:center;gap:6px;font:400 8px var(--f);color:var(--t2)">' +
            '<div style="width:10px;height:10px;border-radius:50%;background:' + r[0] + ';flex-shrink:0"></div>' +
            r[1] + '</div>';
        }).join("") +
        '</div>';
      return div;
    };
    heatLegend.addTo(window.map);
  };

  // ═══════════════════════════════════════════════
  //  ENHANCED PIN POPUPS
  // ═══════════════════════════════════════════════
  var origMkMk = window.mkMk;
  window.mkMk = function (a) {
    var COL = getCOL();
    var ICO = window.ICO || {};
    var c = COL[a.status] || "#8E8E93";
    var ls = calcLeadScore(a);
    var sl = scoreLabel(ls);

    var m = L.marker([a.lat, a.lng], {
      icon: L.divIcon({
        className: "mic",
        html: '<div class="pin ' + (a.status === "scheduled" ? "pulse" : "") + '" style="background:' + c + '">' +
          '<i class="fas ' + (ICO[a.status] || "fa-home") + '"></i></div>' +
          (ls >= 60 ? '<div style="position:absolute;top:-6px;right:-8px;width:14px;height:14px;border-radius:50%;background:' + sl.color + ';border:1.5px solid #fff;display:grid;place-items:center;font:700 6px var(--f);color:#fff">' + ls + '</div>' : ''),
        iconSize: [22, 32],
        iconAnchor: [11, 32],
        popupAnchor: [0, -32]
      })
    }).addTo(window.map);

    var convCount = (a.conversations && a.conversations.length) || 0;
    var visitCount = (a.visits && a.visits.length) || 0;

    m.bindPopup(
      '<div class="pop">' +
      '<div style="display:flex;justify-content:space-between;align-items:start">' +
      '<div><h3>' + a.street + '</h3>' +
      '<p>' + a.city + ' · <span class="pill pill-' + a.status + '">' + a.status + '</span>' +
      (a.value ? " · " + a.value : "") + '</p></div>' +
      '<div style="text-align:center;padding:2px 6px;border-radius:6px;background:' + sl.color + '20;min-width:28px">' +
      '<div style="font:900 10px var(--f);color:' + sl.color + '">' + ls + '</div>' +
      '<div style="font:400 5px var(--f);color:' + sl.color + '">' + sl.label + '</div></div></div>' +

      // Quick stats
      '<div style="display:flex;gap:6px;margin:4px 0;font:400 7px var(--f);color:var(--t3)">' +
      '<span><i class="fas fa-walking"></i> ' + visitCount + ' visits</span>' +
      '<span><i class="fas fa-comment"></i> ' + convCount + ' notes</span>' +
      (a.owner ? '<span><i class="fas fa-user"></i> ' + a.owner + '</span>' : '') +
      '</div>' +

      // Buttons
      '<div class="pop-b" style="margin-top:4px">' +
      '<button class="btn btn-s btn-p" onclick="detail(\'' + a.id + '\')"><i class="fas fa-edit"></i> Detail</button>' +
      '<button class="btn btn-s btn-ok" onclick="qUp(\'' + a.id + '\')"><i class="fas fa-arrow-right"></i></button>' +
      '<button class="btn btn-s btn-g" onclick="quickNote(\'' + a.id + '\')"><i class="fas fa-comment-dots"></i></button>' +
      '<button class="btn btn-s btn-g" onclick="openSV(' + a.lat + ',' + a.lng + ',\'' + esc(a.street) + '\')"><i class="fas fa-street-view"></i></button>' +
      '</div></div>',
      { className: "cpop", maxWidth: 280 }
    );

    window.MK[a.id] = m;
  };

  // Quick note from popup
  window.quickNote = function (addrId) {
    var note = prompt("Quick note for this lead:");
    if (note && note.trim()) {
      window.addConversation(addrId, note.trim(), "neutral", "note");
    }
  };

  // ═══════════════════════════════════════════════
  //  ENHANCED CRM / LEADS TAB
  // ═══════════════════════════════════════════════
  var origRenderCust = window.renderCust;
  window.renderCust = function () {
    var CUST = getCUST();
    var A = getA();
    var el = $("custP");
    if (!el) return;

    // Pipeline counts
    var prospects = CUST.filter(function (c) { return c.status === "prospect"; }).length;
    var hotLeads = CUST.filter(function (c) { return c.status === "hot-lead"; }).length;
    var followUps = CUST.filter(function (c) { return c.status === "follow-up"; }).length;
    var clients = CUST.filter(function (c) { return c.status === "client"; }).length;
    var lost = CUST.filter(function (c) { return c.status === "lost"; }).length;

    // Total conversations across all addresses
    var totalConvos = A.reduce(function (sum, a) {
      return sum + ((a.conversations && a.conversations.length) || 0);
    }, 0);

    // Sort by most recent interaction
    var sorted = CUST.slice().sort(function (a, b) {
      var aLast = a.interactions.length ? new Date(a.interactions[a.interactions.length - 1].date) : new Date(a.firstSeen);
      var bLast = b.interactions.length ? new Date(b.interactions[b.interactions.length - 1].date) : new Date(b.firstSeen);
      return bLast - aLast;
    });

    el.innerHTML =
      '<div class="sec-h"><span>Lead Pipeline</span><span class="badge">' + CUST.length + '</span></div>' +

      // Pipeline KPIs
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-bottom:10px">' +
      [
        [prospects, "Prospect", "var(--gr)"],
        [hotLeads, "Hot", "var(--r)"],
        [followUps, "Follow-up", "var(--o)"],
        [clients, "Client", "var(--v)"],
        [lost, "Lost", "var(--t3)"]
      ].map(function (k) {
        return '<div style="text-align:center;padding:6px 2px;background:var(--sf);border:1px solid var(--bd);border-radius:8px">' +
          '<div style="font:900 14px var(--f);color:' + k[2] + '">' + k[0] + '</div>' +
          '<div style="font:500 6px var(--f);color:var(--t3);text-transform:uppercase">' + k[1] + '</div></div>';
      }).join("") +
      '</div>' +

      // Total conversations stat
      '<div class="gc" style="padding:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font:600 9px var(--f);color:var(--t2)"><i class="fas fa-comments" style="color:var(--p)"></i> Total Conversations</span>' +
      '<span style="font:900 14px var(--f);color:var(--p)">' + totalConvos + '</span></div>' +

      // Lead cards
      (sorted.length ? sorted.map(function (c) {
        // Find matching address for lead score
        var addr = A.find(function (a) {
          return (a.phone && a.phone === c.phone) || (a.street === c.street && a.zip === c.zip);
        });
        var ls = addr ? calcLeadScore(addr) : 0;
        var sl = scoreLabel(ls);
        var convCount = addr && addr.conversations ? addr.conversations.length : 0;
        var lastInteraction = c.interactions.length
          ? timeAgo(c.interactions[c.interactions.length - 1].date)
          : "—";
        var statusColors = {
          prospect: "var(--gr)", "hot-lead": "var(--r)",
          "follow-up": "var(--o)", client: "var(--v)", lost: "var(--t3)"
        };

        return '<div class="acard" onclick="' + (addr ? "detail('" + addr.id + "')" : "showLead('" + c.id + "')") + '">' +
          '<div class="row1"><div style="flex:1;min-width:0">' +
          '<div class="street">' + (c.owner || c.street) +
          ' <span style="font:900 8px var(--f);color:' + sl.color + ';background:' + sl.color + '15;padding:1px 5px;border-radius:4px">' + ls + '</span></div>' +
          '<div class="sub">' + c.interactions.length + ' interactions · ' + convCount + ' notes · ' + lastInteraction + '</div>' +
          '</div>' +
          '<span class="pill" style="background:' + (statusColors[c.status] || "var(--gr)") + '20;color:' + (statusColors[c.status] || "var(--gr)") + '">' + c.status + '</span>' +
          '</div></div>';
      }).join("") : '<div style="text-align:center;padding:16px;color:var(--t3)"><i class="fas fa-user-plus" style="font-size:20px;margin-bottom:6px;display:block;opacity:.4"></i><p style="font:500 9px var(--f)">Add & track leads to build your pipeline</p></div>');
  };

  // ═══════════════════════════════════════════════
  //  HEAT PULSE CSS INJECTION
  // ═══════════════════════════════════════════════
  function injectStyles() {
    var style = document.createElement("style");
    style.textContent =
      "@keyframes heatPulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.15);opacity:0.3}}" +
      ".heat-pulse{animation:heatPulse 3s ease-in-out infinite}" +
      ".convo-type-btn.btn-p{box-shadow:0 0 0 2px var(--p)}";
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    console.log("[MB] Lead Intelligence loaded");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 120);
  }
})();
