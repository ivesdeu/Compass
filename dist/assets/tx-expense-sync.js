/**
 * tx-expense-sync.js
 *
 * When a dashboard transaction of type "expense" is saved,
 * mirror it into the workspace.expenses array so it appears
 * in the Expenses tab without the user re‑entering it.
 *
 * This is implemented as a small, isolated script that runs
 * after the main bundle and uses localStorage directly.
 */
(function () {
  'use strict';

  var PREFIX = 'bizdash:v1:';

  function currentWorkspaceId() {
    try {
      var urlId = new URLSearchParams(location.search).get('w');
      if (urlId) return urlId;
    } catch (_) {}
    try {
      return localStorage.getItem(PREFIX + 'current') || null;
    } catch (_) {
      return null;
    }
  }

  function loadWorkspace(id) {
    if (!id) return null;
    try {
      var raw = localStorage.getItem(PREFIX + 'ws:' + id);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveWorkspace(id, ws) {
    if (!id || !ws) return;
    try {
      localStorage.setItem(PREFIX + 'ws:' + id, JSON.stringify(ws));
    } catch (_) {}
  }

  var EXP_LABELS = {
    svc: 'Services',
    ret: 'Retainer',
    lab: 'Labor',
    sw:  'Software',
    ads: 'Advertising',
    oth: 'Other'
  };

  function syncLastTransaction() {
    var id = currentWorkspaceId();
    if (!id) return;
    var ws = loadWorkspace(id);
    if (!ws || !Array.isArray(ws.transactions)) return;

    var tx = null;
    for (var i = ws.transactions.length - 1; i >= 0; i--) {
      var t = ws.transactions[i];
      if (t && t.category && ['svc','ret','lab','sw','ads','oth'].indexOf(t.category) !== -1) {
        tx = t;
        break;
      }
    }
    if (!tx) return;

    ws.expenses = ws.expenses || [];
    // Avoid duplicating if already mirrored
    if (ws.expenses.some(function (e) { return e && e.txId === tx.id; })) {
      return;
    }

    var label = EXP_LABELS[tx.category] || tx.category || 'Expense';
    ws.expenses.push({
      id: 'ex-' + tx.id,
      txId: tx.id,
      title: label,
      category: label,
      amount: Math.max(0, +tx.amount || 0),
      date: tx.date || new Date().toISOString().slice(0, 10),
      vendor: '',
      notes: tx.note || '',
      recurring: false,
      createdAt: tx.at || Date.now(),
      updatedAt: Date.now()
    });

    saveWorkspace(id, ws);

    // Force a lightweight full-page reload so the main bundle + date filter
    // re-hydrate cleanly from the updated workspace snapshot. This avoids any
    // in-memory state drift that can cause the UI to hang while still giving
    // you up-to-date expense charts and tables.
    try {
      window.location.reload();
    } catch (_) {}
  }

  function wire() {
    var btn = document.getElementById('btn-tx-save');
    if (!btn) return;
    // Run after the main click handler (which saves the transaction)
    btn.addEventListener('click', function () {
      setTimeout(syncLastTransaction, 0);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();

