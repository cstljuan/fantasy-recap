// Renders the announcer's lines for a game with ElevenLabs, one audio file per line.
//
// Run from the repo root by a person who has an ElevenLabs API key:
//   ELEVENLABS_API_KEY=... node js/announcer/voice/render.js                 (football, the game the app plays)
//   ELEVENLABS_API_KEY=... node js/announcer/voice/render.js --sport soccer  (the soccer sample match)
//   node js/announcer/voice/render.js --dry-run                              (lists the lines, no key needed)
// Options: --game <file.json>  --styles straight,fun  --max-chars 20000  --dry-run  --json (print the lines)
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

var sport = arg('sport', 'football');
var dry = !!arg('dry-run', false);
var styles = String(arg('styles', 'straight,fun')).split(',');
var maxChars = +arg('max-chars', 20000);
var voices = require(path.join(ROOT, 'js/announcer/voices.js'));
var voice = voices[sport];
if (!voice) { console.error('Unknown sport ' + sport + '. Use football or soccer.'); process.exit(2); }

// ElevenLabs audio tags for the big moments. The tag is sent to ElevenLabs only; the text
// in the index (and on screen) stays without it.
var EXCITED = /^(touchdown|goal|memory_(lead_change|go_ahead|answer|hundred|hat_trick|late_|brace|equaliser)|big_gain|fg_good|final$|save_pen|interception|fumble|downs|penalty_given|foul_red)/;
function spoken(text, kind) { return (EXCITED.test(kind || '') ? '[excited] ' : '') + text; }

function readGameFile(file) {
  var src = fs.readFileSync(file, 'utf8');
  if (/\.js$/.test(file)) src = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1);
  return JSON.parse(src);
}

// Collect the lines in the order main.js asks for them.
function collectFootball() {
  var A = require(path.join(ROOT, 'js/announcer/index.js'));
  var Rules = require(path.join(ROOT, 'js/rules.js'));
  var file = arg('game', path.join(ROOT, 'data/games/current.js'));
  var game = readGameFile(file), teams = game.teams, out = [];
  var heard = []; A.onLine(function (text, kind) { heard.push({ text: text, kind: kind }); });
  styles.forEach(function (style) {
    A.reset(); A.setStyle(style);
    var s = Rules.create(teams), results = [];
    function take(t) { var h = heard[heard.length - 1]; if (t) out.push({ text: t, kind: h && h.text === t ? h.kind : '', style: style }); }
    take(A.intro({ teams: teams, score: [0, 0], style: style, leaders: [], plays: [], hidden: false }));
    Rules.flatten(game.game, teams).forEach(function (st) {
      if (st.kind === 'half') {
        Rules.startHalf(s);
        var hp = A.halftime({ teams: teams, score: s.score.slice(), style: style, leaders: [], plays: results.slice(), hidden: false });
        take(hp || A.line({ kind: 'half' }, { teams: teams, score: s.score.slice(), style: style }));
        return;
      }
      if (st.kind === 'final') {
        var wp = A.wrap({ teams: teams, score: s.score.slice(), style: style, leaders: [], plays: results.slice(), hidden: false });
        take(wp || A.line({ kind: 'final' }, { teams: teams, score: s.score.slice(), style: style }));
        return;
      }
      var res = Rules.apply(s, st.e, st.team); results.push(res);
      take(A.line(res, { teams: teams, score: res.post.score, style: style }));
    });
  });
  return { id: game.id || path.basename(file), lines: out };
}

function collectSoccer() {
  var A = require(path.join(ROOT, 'js/announcer/soccer/index.js'));
  var data = require(path.join(ROOT, 'soccer/js/data.js'));
  try { require(path.join(ROOT, 'soccer/js/fantasy.js')); } catch (err) { /* not needed */ }
  var Rules = require(path.join(ROOT, 'soccer/js/rules.js'));
  var teams = data.TEAMS, out = [], heard = [];
  A.onLine(function (text, kind) { heard.push({ text: text, kind: kind }); });
  styles.forEach(function (style) {
    A.reset(); A.setStyle(style);
    var s = Rules.create(teams);
    function take(t) { var h = heard[heard.length - 1]; if (t) out.push({ text: t, kind: h && h.text === t ? h.kind : '', style: style }); }
    Rules.flatten(data.SAMPLE_GAME, teams).forEach(function (st) {
      if (st.kind === 'half') { Rules.startHalf(s); take(A.line({ kind: 'half' }, { teams: teams, score: s.score.slice(), style: style })); return; }
      if (st.kind === 'final') { take(A.line({ kind: 'final' }, { teams: teams, score: s.score.slice(), style: style })); return; }
      var r = Rules.apply(s, st.e, st.team);
      take(A.line(r, { teams: teams, score: r.post.score, style: style }));
    });
  });
  return { id: 'soccer-sample', lines: out };
}

function idFor(text) {
  return crypto.createHash('sha1').update(voice.voice_id + '|' + voices.model + '|' + text).digest('hex').slice(0, 16);
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
  var c = sport === 'soccer' ? collectSoccer() : collectFootball();
  if (arg('json', false)) { console.log(JSON.stringify(c.lines)); return; }
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
  if (dry) {
    todo.forEach(function (l) { console.log('  ' + (l.kind || '?') + ' | ' + spoken(l.text, l.kind)); });
    console.log('Dry run: nothing was sent and nothing was written.');
    return;
  }
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
