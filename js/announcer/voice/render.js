// Renders the announcer's lines for a game with ElevenLabs, one audio file per line.
//
// Run from the repo root by a person who has an ElevenLabs API key:
//   ELEVENLABS_API_KEY=... node js/announcer/voice/render.js                 (football, the game the app plays)
//   ELEVENLABS_API_KEY=... node js/announcer/voice/render.js --sport soccer  (week 11 soccer and the sample match)
//   node js/announcer/voice/render.js --dry-run                              (the bill: no key, no network)
//
// --dry-run (C25) never calls ElevenLabs and needs no key. For football and soccer (or the one
// --sport names) it prints every line it would render, each line once, with the count, the
// characters (what ElevenLabs bills) and an estimate of the audio size against the 15 MB cap,
// and writes that list to js/announcer/voice/render-list.json. A real run then renders exactly
// the lines in that list for its sport (skipping files that exist); pass --fresh to collect the
// lines again instead.
// Options: --game <file.json>  --max-chars 20000  --dry-run  --json (print the lines)
//
// What it does: replays the game the same way js/main.js does (intro at kickoff, a line for
// every play result, the half time and final lines) in each style, collects every line the
// announcer will say, and saves each as assets/voice/<sport>/<id>.mp3. The announcer's picks
// are seeded per kind, so these are exactly the lines a viewer hears on a first run of the
// game. assets/voice/<sport>/index.json and index.js map each line's text to its file;
// js/announcer/voice/play.js reads index.js and falls back to the browser voice for any line
// without a file. Files that already exist are kept, so a second run only pays for new lines.
//
// The key is read from the environment only. It is never printed, logged or written to a file.
'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '../../..');
var MAX_BYTES = 15 * 1024 * 1024;   // all voice audio together
var FORMAT = 'mp3_22050_32';        // small and clear enough for speech

function arg(name, dflt) {
  var i = process.argv.indexOf('--' + name);
  if (i < 0) return dflt;
  var v = process.argv[i + 1];
  return v && v.indexOf('--') !== 0 ? v : true;
}

var sportArg = arg('sport', null);
var sport = sportArg || 'football';
var dry = !!arg('dry-run', false);
var styles = ['straight'];   // one style
var maxChars = +arg('max-chars', 20000);
var voices = require(path.join(ROOT, 'js/announcer/voices.js'));
var voice = voices[sport];
if (!voice) { console.error('Unknown sport ' + sport + '. Use football or soccer.'); process.exit(2); }
var LIST = path.join(__dirname, 'render-list.json');
var BYTES_PER_SEC = 4000;   // mp3 at 32 kbit/s
// About how long the line takes to say, and so how big its file is.
function estBytes(text) { return Math.round((text.split(/\s+/).length / 2.6 + 0.4) * BYTES_PER_SEC); }

// ElevenLabs audio tags for the big moments. The tag is sent to ElevenLabs only; the text
// in the index (and on screen) stays without it.
var EXCITED = /^(touchdown|goal|memory_(lead_change|go_ahead|answer|hundred|hat_trick|late_|brace|equaliser)|big_gain|fg_good|final$|save_pen|interception|fumble|downs|penalty_given|foul_red)/;
// ElevenLabs gets the spoken form (C27: team codes, downs, scores and capitals as words), with
// the tag for big moments; the index keeps the written line, which is what speak() is given.
function spoken(text, kind, sp) {
  var A = (sp || sport) === 'soccer' ? require(path.join(ROOT, 'js/announcer/soccer/index.js')) : require(path.join(ROOT, 'js/announcer/index.js'));
  return (EXCITED.test(kind || '') ? '[excited] ' : '') + (A.spoken ? A.spoken(text) : text);
}

function readGameFile(file) {
  var src = fs.readFileSync(file, 'utf8');
  if (/\.js$/.test(file)) src = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1);
  return JSON.parse(src);
}

// Every way a game can be heard (C31, "no missing sounds"): played from the start, and after a
// jump to any play with the jump bar (js/main.js seek: the announcer is reset, the skipped plays
// are silent, one catch-up line, then every play from there with fresh decks), each with and
// without the players' profiles (js/main.js loads data/profiles/<team>.json, which adds the
// tendency remarks) and with scores shown or hidden. take(text) collects each spoken line.
function hear(A, Rules, teams, game, o, take) {
  var steps = Rules.flatten(game, teams), plays = 0;
  steps.forEach(function (st) { if (st.kind === 'play') plays++; });
  var ctxBase = { teams: teams, style: 'straight', leaders: [], hidden: !!o.hidden, profiles: o.profiles || undefined };
  function ctx(extra) { var c = {}; Object.keys(ctxBase).forEach(function (k) { c[k] = ctxBase[k]; }); Object.keys(extra).forEach(function (k) { c[k] = extra[k]; }); return c; }
  var targets = [0];
  if (o.jumps) for (var j = 2; j <= plays; j++) targets.push(j);
  targets.forEach(function (target) {
    A.reset();
    var s = Rules.create(teams), results = [], n = 0, live = target === 0;
    if (live && A.intro) take(A.intro(ctx({ score: [0, 0], plays: [] })));
    steps.forEach(function (st) {
      if (st.kind === 'half') {
        Rules.startHalf(s);
        if (!live) return;
        // Both the halftime piece and the plain half line: the page may say either.
        if (A.halftime) take(A.halftime(ctx({ score: s.score.slice(), plays: results.slice() })));
        take(A.line({ kind: 'half' }, ctx({ score: s.score.slice() })));
        return;
      }
      if (st.kind === 'final') {
        if (!live) return;
        take(A.line({ kind: 'final' }, ctx({ score: s.score.slice() })));
        if (A.wrap) take(A.wrap(ctx({ score: s.score.slice(), plays: results.slice() })));
        return;
      }
      n++;
      var res = Rules.apply(s, st.e, st.team);
      if (!live && n === target) {
        if (A.catchUp && results.length) take(A.catchUp(results.slice(), ctx({ score: (res.pre && res.pre.score ? res.pre.score : s.score).slice() })));
        live = true;
      }
      results.push(res);
      if (live) take(A.line(res, ctx({ score: res.post.score })));
    });
  });
}

function profilesFor(teams) {
  var out = {}, any = false;
  teams.forEach(function (T) {
    var f = path.join(ROOT, 'data/profiles', T.id + '.json');
    if (fs.existsSync(f)) { try { var d = JSON.parse(fs.readFileSync(f, 'utf8')); if (d && d.players) { out[T.id] = d; any = true; } } catch (err) { /* skip */ } }
  });
  return any ? out : null;
}

function collect(A, Rules, matches) {
  var out = [], heard = [];
  A.onLine(function (text, kind) { if (kind !== 'sound') heard.push({ text: text, kind: kind }); });
  function take(t) { var h = heard[heard.length - 1]; if (t) out.push({ text: t, kind: h && h.text === t ? h.kind : '', style: 'straight' }); }
  matches.forEach(function (m) {
    var profs = [null], pf = profilesFor(m.teams);
    if (pf) profs.push(pf);
    profs.forEach(function (pr) {
      [false, true].forEach(function (hidden) { hear(A, Rules, m.teams, m.game, { profiles: pr, hidden: hidden, jumps: !arg('no-jumps', false) }, take); });
    });
  });
  return { id: matches.map(function (m) { return m.id; }).join(' + '), lines: out };
}

// Football: every game file in data/games/ (the app plays current.js, a copy of one of them, or
// the built-in sample with ?game=sample), or --game <file>.
function collectFootball() {
  var A = require(path.join(ROOT, 'js/announcer/index.js'));
  var Rules = require(path.join(ROOT, 'js/rules.js'));
  var dir = path.join(ROOT, 'data/games');
  var files = arg('game', null) ? [arg('game')] : fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).sort().map(function (f) { return path.join(dir, f); });
  var matches = files.filter(function (f) { return fs.existsSync(f); }).map(function (f) { var g = readGameFile(f); return { id: g.id || path.basename(f, '.json'), teams: g.teams, game: g.game }; });
  return collect(A, Rules, matches);
}

// Soccer: soccer/data/week11-soccer.json (the default, from soccer/data/current.js) and the
// built-in sample (?game=sample), or --game <file>.
function collectSoccer() {
  var A = require(path.join(ROOT, 'js/announcer/soccer/index.js'));
  var data = require(path.join(ROOT, 'soccer/js/data.js'));
  try { require(path.join(ROOT, 'soccer/js/fantasy.js')); } catch (err) { /* not needed */ }
  var Rules = require(path.join(ROOT, 'soccer/js/rules.js'));
  var matches = [];
  if (arg('game', null)) { var g0 = readGameFile(arg('game')); matches.push({ id: g0.id || 'soccer', teams: g0.teams, game: g0.game }); }
  else {
    fs.readdirSync(path.join(ROOT, 'soccer/data')).filter(function (f) { return /\.json$/.test(f) && f !== 'week11-lines.json'; }).sort().forEach(function (f) {
      var g = readGameFile(path.join(ROOT, 'soccer/data', f));
      if (g && g.game && g.teams) matches.push({ id: g.id || f, teams: g.teams, game: g.game });
    });
    matches.push({ id: 'soccer-built-in', teams: data.TEAMS, game: data.SAMPLE_GAME });
  }
  return collect(A, Rules, matches);
}

function idFor(text, v) {
  return crypto.createHash('sha1').update((v || voice).voice_id + '|' + voices.model + '|' + text).digest('hex').slice(0, 16);
}

// What one sport still needs: each line once, minus the files that already exist.
function plan(sp) {
  var v = voices[sp], c = sp === 'soccer' ? collectSoccer() : collectFootball();
  var outDir = path.join(ROOT, 'assets/voice', sp);
  var indexFile = path.join(outDir, 'index.json');
  var index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : { lines: {} };
  var seen = {}, todo = [], have = 0;
  c.lines.forEach(function (l) {
    if (seen[l.text]) return;
    seen[l.text] = true;
    var f = index.lines[l.text];
    if (f && fs.existsSync(path.join(outDir, f)) && index.voice_id === v.voice_id && index.model === voices.model) { have++; return; }
    var said = spoken(l.text, l.kind, sp);
    todo.push({ sport: sp, text: l.text, kind: l.kind, spoken: said, chars: said.length, bytes: estBytes(said), file: idFor(l.text, v) + '.mp3' });
  });
  return { sport: sp, id: c.id, said: c.lines.length, different: Object.keys(seen).length, have: have, todo: todo, voice: v };
}

function dryRun() {
  // The list file always covers both sports, so a real run of either finds its lines; --sport
  // only narrows what is printed.
  var sports = ['football', 'soccer'], show = sportArg ? [sport] : sports, all = [], totalChars = 0, totalBytes = 0;
  var existing = dirSize(path.join(ROOT, 'assets/voice/football')) + dirSize(path.join(ROOT, 'assets/voice/soccer'));
  var per = sports.map(function (sp) {
    var p = plan(sp);
    var chars = p.todo.reduce(function (n, l) { return n + l.chars; }, 0), bytes = p.todo.reduce(function (n, l) { return n + l.bytes; }, 0);
    totalChars += chars; totalBytes += bytes; all = all.concat(p.todo);
    var shown = show.indexOf(sp) >= 0;
    if (shown) console.log('== ' + sp + ' (' + p.id + '), voice ' + p.voice.name + ' ==');
    if (shown) p.todo.forEach(function (l) { console.log('  ' + (l.kind || '?') + ' | ' + l.spoken); });
    console.log((shown ? '  ' : sp + ': ') + p.said + ' lines said in ' + styles.join(' and ') + ', ' + p.different + ' different, ' + p.have + ' already recorded, ' +
      p.todo.length + ' to render: ' + chars + ' characters, about ' + (bytes / 1048576).toFixed(1) + ' MB.');
    return { sport: sp, game: p.id, voice: p.voice.name, voice_id: p.voice.voice_id, lines: p.todo.length, characters: chars, bytes: bytes };
  });
  var after = existing + totalBytes;
  console.log('\nTotal: ' + all.length + ' lines, ' + totalChars + ' characters (ElevenLabs bills about one credit per character), about ' +
    (totalBytes / 1048576).toFixed(1) + ' MB of audio, ' + (after / 1048576).toFixed(1) + ' MB with what is already in assets/voice/, against the 15 MB cap' +
    (after > MAX_BYTES ? ': OVER THE CAP.' : '.'));
  fs.writeFileSync(LIST, JSON.stringify({ note: 'Written by render.js --dry-run. A real run renders exactly these lines. Nothing here was sent to ElevenLabs.',
    model: voices.model, format: FORMAT, styles: styles, sports: per, total: { lines: all.length, characters: totalChars, bytes: totalBytes, cap: MAX_BYTES },
    lines: all.map(function (l) { return { sport: l.sport, kind: l.kind, text: l.text, spoken: l.spoken, chars: l.chars, file: l.file }; }) }, null, 1) + '\n');
  console.log('Wrote ' + path.relative(ROOT, LIST) + '. Dry run: nothing was sent to ElevenLabs and no audio was written.');
}

async function tts(text, key) {
  var url = 'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voice.voice_id) + '?output_format=' + FORMAT;
  var res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: text, model_id: voices.model })
  });
  if (!res.ok) {
    var body = '';
    try { body = (await res.text()).slice(0, 300); } catch (err) { /* ignore */ }
    throw new Error('ElevenLabs answered ' + res.status + ' ' + body);
  }
  return Buffer.from(await res.arrayBuffer());
}

function dirSize(dir) {
  var n = 0;
  (fs.existsSync(dir) ? fs.readdirSync(dir) : []).forEach(function (f) { n += fs.statSync(path.join(dir, f)).size; });
  return n;
}

async function main() {
  if (dry) return dryRun();
  var c = sport === 'soccer' ? collectSoccer() : collectFootball();
  if (arg('json', false)) { console.log(JSON.stringify(c.lines)); return; }
  // The approved list from the dry run, unless --fresh.
  var approved = null;
  if (!arg('fresh', false) && fs.existsSync(LIST)) {
    approved = JSON.parse(fs.readFileSync(LIST, 'utf8')).lines.filter(function (l) { return l.sport === sport; });
    c = { id: c.id, lines: approved.map(function (l) { return { text: l.text, kind: l.kind }; }) };
    console.log('Using the approved list in ' + path.relative(ROOT, LIST) + ' (' + approved.length + ' ' + sport + ' lines). Pass --fresh to collect again.');
  }
  var outDir = path.join(ROOT, 'assets/voice', sport);
  var seen = {}, unique = [];
  c.lines.forEach(function (l) { if (!seen[l.text]) { seen[l.text] = true; unique.push(l); } });
  var indexFile = path.join(outDir, 'index.json');
  var index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : { lines: {} };
  var todo = unique.filter(function (l) {
    var f = index.lines[l.text];
    return !(f && fs.existsSync(path.join(outDir, f)) && index.voice_id === voice.voice_id && index.model === voices.model);
  });
  var chars = todo.reduce(function (n, l) { return n + spoken(l.text, l.kind).length; }, 0);
  console.log(sport + ', ' + c.id + ': ' + c.lines.length + ' lines said in ' + styles.join(' and ') + ', ' + unique.length + ' different, ' +
    todo.length + ' still to render (' + chars + ' characters).');
  console.log('Voice: ' + voice.name + ' (' + voice.voice_id + '), model ' + voices.model + ', format ' + FORMAT + '.');
  var key = process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error('Set ELEVENLABS_API_KEY in the environment (never in a file). Use --dry-run to only list the lines.'); process.exit(2); }
  if (chars > maxChars) { console.error('That is ' + chars + ' characters, over --max-chars ' + maxChars + '. Raise it to go ahead.'); process.exit(2); }
  fs.mkdirSync(outDir, { recursive: true });
  index.voice_id = voice.voice_id; index.model = voices.model; index.format = FORMAT; index.game = c.id;
  for (var i = 0; i < todo.length; i++) {
    var l = todo[i], file = idFor(l.text) + '.mp3';
    var total = dirSize(path.join(ROOT, 'assets/voice/football')) + dirSize(path.join(ROOT, 'assets/voice/soccer'));
    if (total > MAX_BYTES) { console.error('Stopped: voice audio is over 15 MB.'); break; }
    try {
      var audio = await tts(spoken(l.text, l.kind), key);
      fs.writeFileSync(path.join(outDir, file), audio);
      index.lines[l.text] = file;
      console.log('  ' + (i + 1) + '/' + todo.length + ' ' + file + '  ' + l.text);
    } catch (err) {
      console.error('  failed: ' + l.text + ': ' + err.message);
      if (/401|403|quota|credits/i.test(err.message)) break;
    }
  }
  // Drop entries whose file is gone, then write the index as JSON and as a script the page can load.
  Object.keys(index.lines).forEach(function (t) { if (!fs.existsSync(path.join(outDir, index.lines[t]))) delete index.lines[t]; });
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, 'index.js'),
    '// Written by js/announcer/voice/render.js. Do not edit by hand.\n' +
    '(window.FF_VOICE_INDEX = window.FF_VOICE_INDEX || {})[' + JSON.stringify(sport) + '] = ' +
    JSON.stringify({ dir: 'assets/voice/' + sport + '/', voice: voice.name, lines: index.lines }) + ';\n');
  console.log('Done: ' + Object.keys(index.lines).length + ' lines with audio, ' + Math.round(dirSize(outDir) / 1024) + ' KB in assets/voice/' + sport + '/.');
}

main().catch(function (err) { console.error(err.message); process.exit(1); });
