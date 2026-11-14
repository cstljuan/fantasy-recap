// Sound check without ears. Loads js/audio.js against a fake AudioContext that records every
// node, gain change and start and stop time, plays a whole game's sounds through it the way
// js/main.js and js/plays.js do, with the announcer speaking a line after every play, and
// reports what a listener would notice:
//   - a gain above 1 (counting what an oscillator adds to a gain it modulates);
//   - the crowd at full level while a line is spoken (it must duck);
//   - any sound started while muted;
//   - two jingles playing at once (a jingle started over another, as on a quick restart);
//   - crowd sounds still running 2 seconds after crowd_stop, or anything 6 seconds after the final.
// Then it plays the week 11 soccer match the same way (C29: one broadcast sound for both sports),
// through window.SC_SOUND and FF_AUDIO.reactSoccer, and checks the same things, plus: every sound
// soccer/js/plays.js asks for exists, the bed runs under every soccer event, the whistle blows at
// half and full time, a goal roars, and crowd sounds of one kind never overlap (FF_AUDIO.claim).
// Run from the repo root:  node js/audio-check.js     Prints OK or the list; exits 1 on a problem.
'use strict';
var path = require('path');
var fs = require('fs');

// ---------------- the fake Web Audio ----------------
var nodes = [], ctx = null;

function Param(owner, name, value) {
  this.owner = owner; this.name = name; this.value = value; this.events = []; this.mods = [];
}
Param.prototype.setValueAtTime = function (v, t) { this.events.push({ type: 'set', v: v, t: t }); this.value = v; return this; };
Param.prototype.linearRampToValueAtTime = function (v, t) { this.events.push({ type: 'lin', v: v, t: t }); return this; };
Param.prototype.exponentialRampToValueAtTime = function (v, t) { this.events.push({ type: 'exp', v: v, t: t }); return this; };
Param.prototype.setTargetAtTime = function (v, t, tc) { this.events.push({ type: 'target', v: v, t: t, tc: tc }); return this; };
Param.prototype.cancelScheduledValues = function (t) {
  var at = this.at(t); this.events = this.events.filter(function (e) { return e.t < t; }); this.value = at; return this;
};
Param.prototype.cancelAndHoldAtTime = function (t) {
  var v = this.at(t); this.events = this.events.filter(function (e) { return e.t < t; }); this.events.push({ type: 'set', v: v, t: t }); return this;
};
// The value at time t, following the scheduled events.
Param.prototype.at = function (t) {
  var v = this.events.length ? this.events[0].type === 'set' ? this.events[0].v : this.value : this.value, from = 0;
  var evs = this.events.slice().sort(function (a, b) { return a.t - b.t; });
  for (var i = 0; i < evs.length; i++) {
    var e = evs[i];
    if (e.type === 'target') {
      if (t < e.t) break;
      var next = evs[i + 1] && evs[i + 1].t <= t ? evs[i + 1].t : t;
      v = e.v + (v - e.v) * Math.exp(-(next - e.t) / (e.tc || 0.01)); from = next;
      continue;
    }
    if (e.t <= t) { v = e.v; from = e.t; continue; }
    if (e.type === 'lin') return v + (e.v - v) * (t - from) / Math.max(1e-9, e.t - from);
    if (e.type === 'exp') return v * Math.pow(Math.max(1e-6, e.v) / Math.max(1e-6, v), (t - from) / Math.max(1e-9, e.t - from));
    break;
  }
  return v;
};
Param.prototype.peak = function () {
  var m = this.value;
  this.events.forEach(function (e) { if (e.v > m) m = e.v; });
  // An oscillator connected into this param through a gain adds up to that gain's level.
  this.mods.forEach(function (g) { m += Math.abs(g.gain.peak()); });
  return m;
};

function Node(kind) {
  this.kind = kind; this.outs = []; this.started = null; this.stopped = null; this.id = nodes.length;
  this.createdAt = ctx ? ctx.currentTime : 0; this.label = currentLabel;
  nodes.push(this);
}
Node.prototype.connect = function (to) {
  if (to instanceof Param) { to.mods.push(this.kind === 'gain' ? this : { gain: new Param(this, 'x', 1) }); return to; }
  this.outs.push(to); return to;
};
Node.prototype.disconnect = function () { this.outs = []; };
Node.prototype.start = function (t) { this.started = t == null ? ctx.currentTime : t; };
Node.prototype.stop = function (t) { this.stopped = t == null ? ctx.currentTime : t; };

function FakeContext() {
  ctx = this;
  this.currentTime = 0; this.sampleRate = 8000; this.state = 'running';
  this.destination = new Node('destination');
}
FakeContext.prototype.resume = function () {};
FakeContext.prototype.suspend = function () {};
FakeContext.prototype.createGain = function () { var n = new Node('gain'); n.gain = new Param(n, 'gain', 1); return n; };
FakeContext.prototype.createOscillator = function () {
  var n = new Node('osc'); n.frequency = new Param(n, 'frequency', 440); n.detune = new Param(n, 'detune', 0); n.type = 'sine'; return n;
};
FakeContext.prototype.createBiquadFilter = function () {
  var n = new Node('filter'); n.frequency = new Param(n, 'frequency', 350); n.Q = new Param(n, 'Q', 1); n.type = 'lowpass'; return n;
};
FakeContext.prototype.createBufferSource = function () { var n = new Node('source'); n.buffer = null; n.loop = false; return n; };
FakeContext.prototype.createBuffer = function (ch, len) { var d = new Float32Array(len); return { getChannelData: function () { return d; } }; };

// ---------------- load audio.js with fake timers, speech and storage ----------------
var intervals = [], timers = [];
global.setTimeout = function (fn, ms) { timers.push({ at: (ctx ? ctx.currentTime : 0) + (ms || 0) / 1000, fn: fn }); return timers.length; };
var speaking = false;
global.window = undefined;
global.speechSynthesis = { get speaking() { return speaking; } };
global.setInterval = function (fn) { intervals.push(fn); return intervals.length; };
global.clearInterval = function () { intervals = []; };
global.AudioContext = FakeContext;
var currentLabel = '';
require(path.join(__dirname, 'audio.js'));
var Snd = globalThis.FF_AUDIO;
var problems = [];

function tick() { intervals.forEach(function (fn) { fn(); }); }
function play(name) { currentLabel = name; Snd.play(name); currentLabel = ''; }
function advance(s) {
  var end = ctx.currentTime + s;
  for (;;) {
    var due = timers.filter(function (x) { return x.at <= end; }).sort(function (a, b) { return a.at - b.at; })[0];
    if (!due) break;
    timers.splice(timers.indexOf(due), 1);
    ctx.currentTime = Math.max(ctx.currentTime, due.at);
    due.fn();
  }
  ctx.currentTime = end;
}

Snd.init();
var master = nodes.filter(function (n) { return n.kind === 'gain' && n.outs.indexOf(ctx.destination) >= 0; })[0];
var gains = nodes.filter(function (n) { return n.kind === 'gain' && n.outs.indexOf(master) >= 0; });
// The crowd bus is the gain that feeds the ducker; the ducker feeds master.
var ducker = null, crowdBus = null;
nodes.forEach(function (n) { if (n.kind === 'gain' && n.outs.length && gains.indexOf(n.outs[0]) >= 0) { crowdBus = n; ducker = n.outs[0]; } });
if (!master || !ducker || !crowdBus) { console.log('PROBLEMS:\n  could not find the master, ducker and crowd bus in js/audio.js'); process.exit(1); }

function reachesCrowd(n, seen) {
  seen = seen || {};
  if (n === crowdBus) return true;
  if (seen[n.id]) return false;
  seen[n.id] = true;
  return n.outs.some(function (o) { return reachesCrowd(o, seen); });
}
function running(n, t) { return n.started != null && n.started <= t && (n.stopped == null || n.stopped > t); }

// ---------------- play a whole game ----------------
var Rules = require(path.join(__dirname, 'rules.js'));
var A = require(path.join(__dirname, 'announcer/index.js'));
var game = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/games/week11-football.json'), 'utf8')), teams = game.teams;
var st = Rules.create(teams), lines = 0, duckMisses = [];

// What js/plays.js plays for each kind of play (its cues), simplified to the sound names.
function playSounds(e, res) {
  if (e.t === 'kickoff') { play('whistle'); play('kick'); play('catch'); play('tackle'); return; }
  if (e.t === 'pass' || e.t === 'inc') { play('pass'); if (e.t === 'pass') play('catch'); }
  if (e.t === 'punt' || e.t === 'fg' || e.t === 'xp') play('kick');
  if (e.t === 'fg' || e.t === 'xp') play(e.good ? 'fg' : 'miss');
  if (e.t === 'int' || e.t === 'fumble') play('turnover');
  if (res.td) play('td'); else if (e.t !== 'fg' && e.t !== 'xp' && e.t !== 'punt') play('tackle');
  if (e.t === 'pen') play('whistle');
}

// A spoken line: speech is on for about as long as the line takes, and the crowd must duck.
function speak(text) {
  if (!text) return;
  lines++;
  var secs = Math.max(1, text.split(/\s+/).length / 2.6);
  speaking = true; tick();
  advance(secs / 2);
  var crowdLevel = crowdBus.gain.at(ctx.currentTime) * ducker.gain.at(ctx.currentTime);
  if (crowdLevel > 0.9 * crowdBus.gain.at(ctx.currentTime) || crowdLevel > 0.5) duckMisses.push(text);
  advance(secs / 2);
  speaking = false; tick();
}

play('jingle_kickoff');
advance(3.5);
speak(A.intro({ teams: teams, leaders: [] }));
var stopAt = [];
Rules.flatten(game.game, teams).forEach(function (x) {
  if (x.kind === 'half') {
    Rules.startHalf(st);
    play('crowd_stop'); stopAt.push({ t: ctx.currentTime, what: 'crowd_stop at half time' });
    speak(A.line({ kind: 'half' }, { teams: teams, score: st.score.slice() }));
    advance(8);
    return;
  }
  if (x.kind === 'final') {
    play('crowd_stop'); play('jingle_final'); stopAt.push({ t: ctx.currentTime, what: 'the final', all: true });
    speak(A.line({ kind: 'final' }, { teams: teams, score: st.score.slice() }));
    return;
  }
  play('crowd_murmur');
  var res = Rules.apply(st, x.e, x.team);
  playSounds(x.e, res);
  advance(1.5);
  var crowd = Snd.crowdFor(res); if (crowd) play(crowd);
  speak(A.line(res, { teams: teams, score: res.post.score }));
  advance(0.5);
});
var gameEnd = ctx.currentTime, ffLines = lines;

// ---------------- what a listener would notice ----------------
// 1. Gains above 1.
nodes.forEach(function (n) {
  // A gain that only feeds another node's parameter (vibrato depth on a frequency) is not a level.
  if (n.kind !== 'gain' || !n.outs.length) return;
  var p = n.gain.peak();
  if (p > 1.0001) problems.push('a gain reaches ' + p.toFixed(2) + ' (above 1) in ' + (n.label || 'the mix') + (n === master ? ' (master)' : ''));
});
// 2. Ducking under the voice.
if (duckMisses.length) problems.push('the crowd stays at full level under ' + duckMisses.length + ' of ' + lines + ' spoken lines, e.g. "' + duckMisses[0] + '"');
// 3. Crowd running after crowd_stop, anything after the final.
stopAt.forEach(function (s) {
  var later = s.all ? s.t + 6 : s.t + 2;
  var left = nodes.filter(function (n) { return (n.kind === 'source' || n.kind === 'osc') && n.createdAt <= s.t && running(n, later) && (s.all || reachesCrowd(n)); });
  if (left.length) problems.push(left.length + ' sound(s) still running ' + (later - s.t) + ' s after ' + s.what + ' (' + left.map(function (n) { return n.label || n.kind; }).slice(0, 3).join(', ') + ')');
});
// 4. Two jingles at once: a quick restart right after the final.
var jingles = function () { return nodes.filter(function (n) { return /^jingle_/.test(n.label) && (n.kind === 'osc' || n.kind === 'source'); }); };
advance(1);
var before = jingles().length;
play('jingle_kickoff');
var t0 = ctx.currentTime;
var overlap = jingles().slice(before).length && jingles().slice(0, before).some(function (n) { return running(n, t0 + 0.1); });
if (overlap) problems.push('a jingle starts while another is still playing (restart right after the final)');
// 5. Nothing starts while muted.
advance(10);
Snd.mute(true);
var mutedFrom = nodes.length;
['crowd_murmur', 'crowd_roar', 'td', 'tackle', 'jingle_final', 'whistle_long'].forEach(play);
var startedMuted = nodes.slice(mutedFrom).filter(function (n) { return n.started != null; }).map(function (n) { return n.label; });
if (startedMuted.length) problems.push('sounds start while muted: ' + startedMuted.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '));
Snd.mute(false);

// ---------------- the soccer match through the same sound (C29) ----------------
var SC = { active: true, seeking: false };
global.SC_GAME = SC;
var scNotes = [];
global.SC_ANNOUNCER = { notify: function (text, kind) { scNotes.push(text); } };
var snd = globalThis.SC_SOUND;
if (!snd || typeof snd.play !== 'function') problems.push('window.SC_SOUND.play is missing (soccer/js/main.js plays its sounds through it)');
var scPlays = fs.readFileSync(path.join(__dirname, '../soccer/js/plays.js'), 'utf8'), asked = {};
scPlays.replace(/sound\('([a-z_]+)'\)/g, function (m, n) { asked[n] = 1; return m; });
Object.keys(asked).forEach(function (n) { if (Snd.names().indexOf(n) < 0) problems.push('soccer/js/plays.js asks for sound "' + n + '" that js/audio.js does not have'); });
var SR = require(path.join(__dirname, '../soccer/js/rules.js'));
var sgame = JSON.parse(fs.readFileSync(path.join(__dirname, '../soccer/data/week11-soccer.json'), 'utf8'));
var sst = SR.create(sgame.teams), scStart = nodes.length, scEvents = 0, bedMiss = 0, goals = 0, roars = 0, scStops = [];
function scPlay(name) { currentLabel = name; snd.play(name); currentLabel = ''; }
// The sounds reactSoccer plays by itself are counted through FF_AUDIO.played.
function labelled(from, name) { return (Snd.played[name] || 0) - (from[name] || 0); }
function counts() { var c = {}; Object.keys(Snd.played).forEach(function (k) { c[k] = Snd.played[k]; }); return c; }
function bedRunning(t) { return nodes.some(function (n) { return n.kind === 'source' && n.loop && running(n, t); }); }
advance(30);
var whistleAt = {};
SR.flatten(sgame.game, sgame.teams).forEach(function (x) {
  if (x.kind === 'half') {
    SR.startHalf(sst);
    var h = counts();
    Snd.reactSoccer('half', { score: sst.score.slice() });
    scStops.push({ t: ctx.currentTime, what: 'soccer half time' });
    whistleAt.half = labelled(h, 'whistle_long');
    advance(8);
    return;
  }
  if (x.kind === 'final') {
    var f = counts();
    Snd.reactSoccer('final', { score: sst.score.slice() });
    scStops.push({ t: ctx.currentTime, what: 'the soccer final', all: true });
    advance(4);
    whistleAt.final = labelled(f, 'whistle_full');
    return;
  }
  var res = SR.apply(sst, x.e, x.team);
  scEvents++;
  Snd.reactSoccer('snap', { res: res });
  advance(0.5);
  if (!bedRunning(ctx.currentTime)) bedMiss++;
  scPlay('kick');
  if (res.goal && !res.disallowed) { scPlay('goal'); goals++; }
  else if (res.kind === 'shot' && /post|bar/.test(String(x.e.out))) scPlay('post');
  else if (res.kind === 'shot' && x.e.out === 'blocked') scPlay('block');
  if (res.kind === 'foul' || res.kind === 'offside') scPlay('whistle');
  advance(1.5);
  var r0 = counts();
  Snd.reactSoccer('result', { res: res });
  if (res.goal && !res.disallowed && labelled(r0, 'crowd_roar')) roars++;
  speak('A line from the soccer announcer for this event.');
  advance(0.5);
});
if (bedMiss) problems.push('the stadium bed is silent under ' + bedMiss + ' of ' + scEvents + ' soccer events');
if (!whistleAt.half) problems.push('no whistle at soccer half time');
if (!whistleAt.final) problems.push('no full-time whistle at the soccer final');
if (roars !== goals) problems.push('the crowd roars for ' + roars + ' of ' + goals + ' soccer goals');
if (scNotes.indexOf('[full-time whistle]') < 0) problems.push('the full-time whistle is not captioned on the soccer page');
nodes.slice(scStart).forEach(function (n) {
  if (n.kind !== 'gain' || !n.outs.length) return;
  var p = n.gain.peak();
  if (p > 1.0001) problems.push('a gain reaches ' + p.toFixed(2) + ' (above 1) in soccer ' + (n.label || 'the mix'));
});
scStops.forEach(function (s) {
  var later = s.all ? s.t + 6 : s.t + 2;
  var left = nodes.filter(function (n) { return (n.kind === 'source' || n.kind === 'osc') && n.createdAt <= s.t && running(n, later) && (s.all || reachesCrowd(n)); });
  if (left.length) problems.push(left.length + ' sound(s) still running ' + (later - s.t) + ' s after ' + s.what + ' (' + left.map(function (n) { return n.label || n.kind; }).slice(0, 3).join(', ') + ')');
});
// One crowd at a time: a second module asking for a kind that just played is told no.
advance(20);
if (!Snd.claim('chant') || Snd.claim('chant')) problems.push('FF_AUDIO.claim lets the same crowd kind play twice within 4 seconds');
advance(5);
if (!Snd.claim('chant')) problems.push('FF_AUDIO.claim still refuses a crowd kind after its 4 seconds');

if (problems.length) {
  console.log('PROBLEMS (' + problems.length + '):');
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exit(1);
}
console.log('OK: a whole game (' + Math.round(gameEnd / 60) + ' minutes of sound, ' + ffLines +
  ' spoken lines): no gain above 1, the crowd ducks under every line, nothing runs on after crowd_stop or the final, no two jingles at once, nothing starts while muted.');
console.log('OK: the soccer match through the same sound (' + scEvents + ' events, ' + goals + ' goals): every sound soccer asks for exists, the bed runs under every event, whistles at half and full time, a roar for every goal, no gain above 1, nothing runs on after the final, claim() keeps crowds from doubling up. ' + nodes.length + ' audio nodes in all.');
