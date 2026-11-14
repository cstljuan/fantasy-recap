'use strict';
// Runs every check in the repository that needs no network and no key, one after another.
//   node data/checks/all.js            everything
//   node data/checks/all.js --quick    without the three browser runs
// One line per check: OK, FAILED or SKIPPED (with the reason), then a final OK or the number that failed.
// A check whose tool is missing (python3, a Python package, Chrome) is SKIPPED, not FAILED.
// Exit code 0 when nothing failed. The list is explained in data/checks/README.md.
var spawnSync = require('child_process').spawnSync;
var path = require('path');
var fs = require('fs');

var ROOT = path.join(__dirname, '..', '..');
var quick = process.argv.indexOf('--quick') > -1;

function has(cmd, args) {
  var r = spawnSync(cmd, args || ['--version'], { cwd: ROOT, encoding: 'utf8' });
  return !r.error && r.status === 0;
}
var python = has('python3');
var deepagents = python && has('python3', ['-c', 'import deepagents, langchain_core']);

// A smoke run passes when tools/smoke.sh prints JSON with ok true and no errors. Exit 2 means no Chrome.
function smoke(arg) {
  return {
    name: 'browser run ' + (arg || 'the app with its current game'),
    cmd: 'sh', args: ['tools/smoke.sh'].concat(arg ? [arg] : []),
    skip: quick ? 'left out with --quick' : null,
    judge: function (r) {
      if (r.status === 2) return { skip: 'no Chrome or Chromium on this machine' };
      var m = /\{.*\}/.exec(r.stdout || ''), j = null;
      try { j = m && JSON.parse(m[0]); } catch (e) { j = null; }
      if (!j) return { ok: false, why: 'no result from the page' };
      if (!j.ok || (j.errors && j.errors.length)) return { ok: false, why: (j.errors || []).join('; ') || j.error || 'not ok' };
      return { ok: true, why: (j.score ? 'final ' + j.score.join(' to ') : '') + (j.mode ? ', ' + j.mode : '') };
    }
  };
}

var CHECKS = [
  { name: 'football rules on the sample game', cmd: 'node', args: ['tools/validate.js'] },
  { name: 'announcer lines, football and soccer', cmd: 'node', args: ['js/announcer/check.js'] },
  { name: 'soccer announcer on its own', cmd: 'node', args: ['js/announcer/soccer/check.js'] },
  { name: 'soccer rules and fantasy points', cmd: 'node', args: ['soccer/check.js'] },
  { name: 'plays service against a fake database', cmd: 'node', args: ['server/test.js'] },
  { name: 'plays service under load and bad input', cmd: 'node', args: ['server/stress.js'] },
  { name: 'schema for a plain PostgreSQL can be made', cmd: 'node', args: ['db/make-plain.js'] },
  { name: 'league file and standings', cmd: 'node', args: ['data/checks/league.js'] },
  { name: 'league as the service gives it', cmd: 'node', args: ['server/league.js'] },
  { name: 'stat line sums', cmd: 'node', args: ['data/checks/statlines.js'] },
  { name: 'rosters, profiles and matchup lines', cmd: 'node', args: ['data/checks/rosters.js'] },
  { name: 'game files reproduce their stat lines', cmd: 'node', args: ['data/checks/game-vs-lines.js'] },
  { name: 'scoring file equals js/rules.js', cmd: 'node', args: ['agents/scout/check-scoring.js'] },
  { name: 'Scout tools on fixtures', cmd: 'python3', args: ['agents/scout/check.py'], skip: python ? null : 'python3 is not installed' },
  { name: 'real week stat lines on fixtures', cmd: 'python3', args: ['agents/scout/check_statlines.py'], skip: python ? null : 'python3 is not installed' },
  { name: 'recent form on fixtures', cmd: 'python3', args: ['agents/scout/check_form.py'], skip: python ? null : 'python3 is not installed' },
  { name: 'Scout play-by-play reader on fixtures', cmd: 'python3', args: ['agents/scout/check_plays.py'], skip: python ? null : 'python3 is not installed' },
  { name: 'tendencies from real plays', cmd: 'python3', args: ['agents/scout/check_play_tendencies.py'], skip: python ? null : 'python3 is not installed' },
  { name: 'Scout research tools and reports', cmd: 'python3', args: ['agents/scout/check_research.py'], skip: python ? null : 'python3 is not installed' },
  { name: 'Sleeper against ESPN on fixtures', cmd: 'python3', args: ['agents/scout/check_crosscheck.py'], skip: python ? null : 'python3 is not installed' },
  { name: 'Scout notes pages on fixtures', cmd: 'python3', args: ['agents/scout/check_notes.py'], skip: python ? null : 'python3 is not installed' },
  { name: 'soccer profiles and real round on fixtures', cmd: 'python3', args: ['agents/scout/check_soccer.py'], skip: python ? null : 'python3 is not installed' },
  { name: 'Scout team: main agent and subagents', cmd: 'python3', args: ['agents/scout/check_agent_team.py'],
    skip: !python ? 'python3 is not installed' : deepagents ? null : 'deepagents is not installed (pip install -r agents/scout/requirements.txt)' },
  { name: 'Scout agent graph with a stand-in model', cmd: 'python3', args: ['agents/scout/check_agent.py'],
    skip: !python ? 'python3 is not installed' : deepagents ? null : 'deepagents is not installed (pip install -r agents/scout/requirements.txt)' },
  { name: 'every commit authored by a team account', cmd: 'sh', args: ['tools/check-authors.sh'] },
  { name: 'reveal flow in a browser (Peyton)', cmd: 'node', args: ['js/screens/flow-test.js'],
    skip: quick ? 'left out with --quick' : fs.existsSync(path.join(ROOT, 'js', 'screens', 'flow-test.js')) ? null : 'js/screens/flow-test.js is not on this branch yet',
    judge: function (r) { return r.status === 2 ? { skip: 'no Chrome or Chromium on this machine' } : { ok: r.status === 0 }; } },
    smoke(''), smoke('game=sample'), smoke('page=soccer/index.html')
];

// Files named like a check that are not in the list above, so a new one is not forgotten.
function findUnlisted() {
  var listed = {}, found = [];
  CHECKS.forEach(function (c) { c.args.forEach(function (a) { listed[a] = true; }); });
  var skipDirs = { '.git': 1, node_modules: 1, fixtures: 1, runs: 1 };
  (function walk(dir) {
    fs.readdirSync(path.join(ROOT, dir)).forEach(function (n) {
      var rel = dir ? dir + '/' + n : n, st = fs.statSync(path.join(ROOT, rel));
      if (st.isDirectory()) { if (!skipDirs[n]) walk(rel); return; }
      if (/^(check|test)[-_.a-z]*\.(js|py)$/i.test(n) && !listed[rel]) found.push(rel);
    });
  })('');
  return found;
}

var failed = 0, skipped = 0, width = 0;
CHECKS.forEach(function (c) { width = Math.max(width, c.name.length); });
function pad(s) { while (s.length < width) s += ' '; return s; }
function last(text) {
  var lines = String(text || '').trim().split('\n').filter(Boolean);
  return (lines[lines.length - 1] || '').slice(0, 160);
}

CHECKS.forEach(function (c) {
  var cmdText = c.cmd + ' ' + c.args.join(' ');
  if (c.skip) { skipped++; console.log('SKIPPED ' + pad(c.name) + '  ' + c.skip + '  (' + cmdText + ')'); return; }
  var t0 = Date.now();
  var r = spawnSync(c.cmd, c.args, { cwd: ROOT, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  var secs = ((Date.now() - t0) / 1000).toFixed(1) + 's';
  var v = c.judge ? c.judge(r) : { ok: !r.error && r.status === 0, why: r.error ? r.error.message : '' };
  if (v.skip) { skipped++; console.log('SKIPPED ' + pad(c.name) + '  ' + v.skip + '  (' + cmdText + ')'); return; }
  if (v.ok) { console.log('OK      ' + pad(c.name) + '  ' + secs + (v.why ? '  ' + v.why : '')); return; }
  failed++;
  console.log('FAILED  ' + pad(c.name) + '  ' + secs + '  (' + cmdText + ')  ' + (v.why || last(r.stderr) || last(r.stdout) || 'exit ' + r.status));
});

var extra = findUnlisted();
extra.forEach(function (f) { console.log('NOTE    not in the list, not run: ' + f + ' (add it to data/checks/all.js)'); });
console.log(failed ? failed + ' FAILED' + (skipped ? ', ' + skipped + ' skipped' : '') : 'OK' + (skipped ? ' (' + skipped + ' skipped)' : ''));
process.exit(failed ? 1 : 0);
