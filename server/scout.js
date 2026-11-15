// Scout's reports through the service.
//   GET  /scout                 which players have a report and who made it
//   GET  /scout/:player         the newest report for one player (TEAM.SLOT, for example GOB.QB), parsed: claims with the plays
//                               behind each, the notes page, and the newest run log that wrote it. Never runs a model.
//   POST /scout/:player/refresh runs Scout for that one player and stores the result, ONLY when GOOGLE_API_KEY or
//                               ANTHROPIC_API_KEY is in the service's environment. Without one it answers the stored report
//                               with refreshed: false and says why.
// Reports are the files data/profiles/notes/<team>-<slot>-report.md (written by Scout's write_report, which refuses a claim
// without real plays); notes pages are <team>-<slot>.md; run logs are agents/scout/runs/*.txt. Nothing is read from outside.
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ID = /^[A-Za-z]{2,4}\.[A-Za-z0-9]{1,3}$/;
var TIMEOUT_MS = 10 * 60 * 1000;

// The report file is markdown: "N. claim text [1, 2]" lines, then "## Evidence" with "n. Week W, Qq clock: text ([game](url))".
function parseReport(md) {
  var lines = md.split('\n'), out = { title: null, team: null, slot: null, made_by: null, date: null, claims: [] };
  var t = /^# Scouting report: (.*)$/.exec(lines[0] || ''); if (t) out.title = t[1];
  var h = /^(\w+), (\w+)\. Made by (.+?) on (\d{4}-\d{2}-\d{2}),/.exec(lines[2] || ''); if (h) { out.team = h[1]; out.slot = h[2]; out.made_by = h[3]; out.date = h[4]; }
  var ev = {}, inEv = false, claims = [];
  lines.forEach(function (l) {
    if (/^## Evidence/.test(l)) { inEv = true; return; }
    var m;
    if (!inEv && (m = /^(\d+)\. (.*) \[([\d, ]+)\]$/.exec(l))) claims.push({ text: m[2], refs: m[3].split(',').map(function (x) { return parseInt(x, 10); }) });
    else if (inEv && (m = /^(\d+)\. Week (\d+), Q(\S+) ?(\S*): (.*) \(\[game\]\((.*)\)\)$/.exec(l))) {
      ev[m[1]] = { n: parseInt(m[1], 10), week: parseInt(m[2], 10), quarter: m[3], clock: m[4] || null, text: m[5], game: m[6] || null };
    }
  });
  out.claims = claims.map(function (c) { return { text: c.text, evidence: c.refs.map(function (r) { return ev[r]; }).filter(Boolean) }; });
  return out;
}

function createScout(opts) {
  opts = opts || {};
  var root = opts.root || path.join(__dirname, '..');
  var env = opts.env || process.env;
  var notesDir = path.join(root, 'data', 'profiles', 'notes'), runsDir = path.join(root, 'agents', 'scout', 'runs');
  var running = {};
  // runner(key) -> Promise<{ code, output }>; the default runs agents/scout/scout.py for one player
  var runner = opts.runner || function (key) {
    return new Promise(function (ok) {
      var out = '';
      var c = cp.spawn('python3', [path.join(root, 'agents', 'scout', 'scout.py'), '--players', key], { cwd: root, env: process.env });
      var timer = setTimeout(function () { c.kill(); out += '\nSTOPPED: timed out after 10 minutes'; }, TIMEOUT_MS);
      c.stdout.on('data', function (d) { out += d; }); c.stderr.on('data', function (d) { out += d; });
      c.on('error', function (e) { clearTimeout(timer); ok({ code: 1, output: 'could not start python3: ' + e.message }); });
      c.on('close', function (code) { clearTimeout(timer); ok({ code: code, output: out.slice(-2000) }); });
    });
  };

  function hasKey() { return !!(env.GOOGLE_API_KEY || env.ANTHROPIC_API_KEY); }
  function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }

  function newestRun(key) {
    var files;
    try { files = fs.readdirSync(runsDir).filter(function (f) { return /\.txt$/.test(f); }).sort().reverse(); } catch (e) { return null; }
    for (var i = 0; i < files.length; i++) {
      var text = read(path.join(runsDir, files[i])) || '';
      var lines = text.split('\n').filter(function (l) { return l.indexOf('write_report(' + key + ')') >= 0 && /->/.test(l); });
      if (lines.length) return { log: 'agents/scout/runs/' + files[i], line: lines[lines.length - 1].trim() };
    }
    return null;
  }

  function stored(key) {
    var base = key.replace('.', '-').toUpperCase();
    var rep = read(path.join(notesDir, base + '-report.md')), notes = read(path.join(notesDir, base + '.md'));
    if (rep === null && notes === null) return null;
    var out = { player: key.toUpperCase(), report: null, notes: null, run: newestRun(key.toUpperCase()) };
    if (rep !== null) {
      var r = parseReport(rep);
      r.file = 'data/profiles/notes/' + base + '-report.md';
      r.modelMade = /^model /.test(r.made_by || '');
      out.name = r.title; out.report = r;
    }
    if (notes !== null) out.notes = { file: 'data/profiles/notes/' + base + '.md', markdown: notes };
    return out;
  }

  function list() {
    var files;
    try { files = fs.readdirSync(notesDir).filter(function (f) { return /-report\.md$/.test(f); }).sort(); } catch (e) { files = []; }
    return { players: files.map(function (f) {
      var r = parseReport(read(path.join(notesDir, f)) || '');
      return { player: f.replace(/-report\.md$/, '').replace('-', '.'), name: r.title, made_by: r.made_by, date: r.date, claims: r.claims.length };
    }), canRefresh: hasKey() };
  }

  // Both return { status, body }
  function get(id) {
    if (!ID.test(id)) return { status: 400, body: { error: 'the player is TEAM.SLOT, for example GOB.QB' } };
    var s = stored(id);
    if (!s) return { status: 404, body: { error: 'no report or notes page for ' + id } };
    s.refreshed = false; s.canRefresh = hasKey();
    return { status: 200, body: s };
  }

  function refresh(id) {
    if (!ID.test(id)) return Promise.resolve({ status: 400, body: { error: 'the player is TEAM.SLOT, for example GOB.QB' } });
    var key = id.toUpperCase();
    function answer(extra) { var s = stored(key); if (!s) return { status: 404, body: Object.assign({ error: 'no report or notes page for ' + id }, extra) }; return { status: 200, body: Object.assign(s, { refreshed: false, canRefresh: hasKey() }, extra) }; }
    if (!hasKey()) return Promise.resolve(answer({ reason: 'not refreshed: no model key (GOOGLE_API_KEY or ANTHROPIC_API_KEY) in the service environment, so this is the stored report' }));
    if (running[key]) return Promise.resolve({ status: 409, body: { error: 'Scout is already running for ' + key } });
    running[key] = true;
    return runner(key).then(function (r) {
      delete running[key];
      var s = answer({});
      if (r.code === 0) { s.body.refreshed = true; s.body.reason = 'Scout ran for ' + key; s.status = 200; return s; }
      s.body.reason = 'not refreshed: Scout stopped with code ' + r.code + ': ' + String(r.output || '').replace(/\s+/g, ' ').trim().slice(0, 400);
      s.status = 502; return s;
    }, function (e) { delete running[key]; return { status: 502, body: { error: 'could not run Scout: ' + e.message } }; });
  }

  return { get: get, refresh: refresh, list: list, parseReport: parseReport };
}

module.exports = { createScout: createScout, parseReport: parseReport };
