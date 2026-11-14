'use strict';
// Watch party relay, in memory only (no database): a phone is the remote for a game playing on another screen.
// The host screen makes a room and gets a four letter code and a host key. Remotes send commands with the code;
// the host polls for them and posts its state back; remotes read the state. Rooms end two hours after they are
// made. Used by server/index.js; the routes and shapes are in server/README.md.
//
//   room     { code, host, created, expires, commands: [ { n, cmd, value, at } ], next, state, stateAt, waiters }
//   command  cmd is start, hold, release, seek or speed. value: seek takes a play index from 1, speed a number
//            from 0.25 to 8, the others take no value (null).
//   state    { index, mode, speed } from the host: index the play number (0 before the first), mode a short word
//            (ready, play, inter, final, ...), speed a number from 0.25 to 8.
var crypto = require('crypto');

var LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, they read like 1 and 0
var CMDS = ['start', 'hold', 'release', 'seek', 'speed'];

function createParties(opts) {
  opts = opts || {};
  var now = opts.now || Date.now;
  var TTL = opts.ttlMs || 2 * 60 * 60 * 1000;
  var MAX_ROOMS = opts.maxRooms || 200;
  var KEEP = opts.keepCommands || 200;     // commands kept per room; older ones are dropped, n keeps counting
  var MAX_WAIT = 25;                       // seconds a long poll may wait
  var rooms = {};

  function sweep() {
    var t = now();
    Object.keys(rooms).forEach(function (c) {
      if (rooms[c].expires <= t) { release(rooms[c]); delete rooms[c]; }
    });
  }
  function release(room) {
    (room.waiters || []).forEach(function (w) { clearTimeout(w.timer); w.done(); });
    room.waiters = [];
  }
  function newCode() {
    for (var tries = 0; tries < 50; tries++) {
      var b = crypto.randomBytes(4), c = '';
      for (var i = 0; i < 4; i++) c += LETTERS[b[i] % LETTERS.length];
      if (!rooms[c]) return c;
    }
    return null;
  }
  function normCode(code) { return typeof code === 'string' && /^[A-Za-z]{4}$/.test(code) ? code.toUpperCase() : null; }
  function get(code) {
    sweep();
    var c = normCode(code);
    if (!c) return { error: 400, message: 'a room code is four letters' };
    var r = rooms[c];
    if (!r) return { error: 404, message: 'no room ' + c + ' (it may have ended)' };
    return { room: r };
  }
  function pub(r) { return { code: r.code, created_at: new Date(r.created).toISOString(), expires_at: new Date(r.expires).toISOString() }; }

  // POST /party
  function create() {
    sweep();
    if (Object.keys(rooms).length >= MAX_ROOMS) return { error: 429, message: 'too many rooms open, try again later' };
    var code = newCode();
    if (!code) return { error: 503, message: 'could not find a free room code' };
    var t = now();
    var r = rooms[code] = { code: code, host: crypto.randomBytes(12).toString('hex'), created: t, expires: t + TTL,
      commands: [], next: 1, state: null, stateAt: null, waiters: [] };
    return { status: 201, body: Object.assign(pub(r), { host: r.host }) };
  }

  function checkCommand(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'the body must be an object { cmd, value }';
    if (CMDS.indexOf(body.cmd) < 0) return 'cmd must be one of ' + CMDS.join(', ');
    var v = body.value;
    if (body.cmd === 'seek') {
      if (!Number.isInteger(v) || v < 1 || v > 100000) return 'seek needs value: a play index from 1';
    } else if (body.cmd === 'speed') {
      if (typeof v !== 'number' || !isFinite(v) || v < 0.25 || v > 8) return 'speed needs value: a number from 0.25 to 8';
    } else if (v != null) return body.cmd + ' takes no value';
    return null;
  }

  // POST /party/:code/command
  function command(code, body) {
    var g = get(code);
    if (g.error) return g;
    var bad = checkCommand(body);
    if (bad) return { error: 400, message: bad };
    var r = g.room, c = { n: r.next++, cmd: body.cmd, value: body.value == null ? null : body.value, at: new Date(now()).toISOString() };
    r.commands.push(c);
    if (r.commands.length > KEEP) r.commands.splice(0, r.commands.length - KEEP);
    var ws = r.waiters; r.waiters = [];
    ws.forEach(function (w) { clearTimeout(w.timer); w.done(); });
    return { status: 201, body: { code: r.code, command: c } };
  }

  function since(r, after) {
    return { code: r.code, commands: r.commands.filter(function (c) { return c.n > after; }), last: r.next - 1,
      expires_at: new Date(r.expires).toISOString() };
  }

  // GET /party/:code/commands?after=n&wait=s   cb(result). With wait, the answer waits up to s seconds for a command.
  function commands(code, afterText, waitText, cb) {
    var g = get(code);
    if (g.error) return cb(g);
    var after = afterText == null || afterText === '' ? 0 : Number(afterText);
    if (!Number.isInteger(after) || after < 0) return cb({ error: 400, message: 'after must be a whole number from 0' });
    var wait = waitText == null || waitText === '' ? 0 : Number(waitText);
    if (!Number.isInteger(wait) || wait < 0 || wait > MAX_WAIT) return cb({ error: 400, message: 'wait must be a whole number of seconds from 0 to ' + MAX_WAIT });
    var r = g.room, out = since(r, after);
    if (out.commands.length || !wait) return cb({ status: 200, body: out });
    var w = { done: null, timer: null }, finished = false;
    w.done = function () {
      if (finished) return; finished = true;
      r.waiters = r.waiters.filter(function (x) { return x !== w; });
      cb({ status: 200, body: since(r, after) });
    };
    w.timer = setTimeout(w.done, wait * 1000);
    r.waiters.push(w);
    return function cancel() { if (!finished) { finished = true; clearTimeout(w.timer); r.waiters = r.waiters.filter(function (x) { return x !== w; }); } };
  }

  // POST /party/:code/state   body { host, index, mode, speed }
  function setState(code, body) {
    var g = get(code);
    if (g.error) return g;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 400, message: 'the body must be an object { host, index, mode, speed }' };
    if (typeof body.host !== 'string' || body.host !== g.room.host) return { error: 403, message: 'only the host screen may set the state' };
    if (!Number.isInteger(body.index) || body.index < 0 || body.index > 100000) return { error: 400, message: 'index must be a whole number from 0' };
    if (typeof body.mode !== 'string' || !/^[a-z]{1,16}$/.test(body.mode)) return { error: 400, message: 'mode must be one short word in lower case letters' };
    if (typeof body.speed !== 'number' || !isFinite(body.speed) || body.speed < 0.25 || body.speed > 8) return { error: 400, message: 'speed must be a number from 0.25 to 8' };
    var r = g.room;
    r.state = { index: body.index, mode: body.mode, speed: body.speed };
    r.stateAt = now();
    return { status: 200, body: { code: r.code, state: r.state, updated_at: new Date(r.stateAt).toISOString() } };
  }

  // GET /party/:code/state
  function getState(code) {
    var g = get(code);
    if (g.error) return g;
    var r = g.room;
    return { status: 200, body: { code: r.code, state: r.state, updated_at: r.stateAt ? new Date(r.stateAt).toISOString() : null,
      expires_at: new Date(r.expires).toISOString() } };
  }

  return { create: create, command: command, commands: commands, setState: setState, getState: getState,
    count: function () { sweep(); return Object.keys(rooms).length; }, MAX_WAIT: MAX_WAIT };
}

module.exports = { createParties: createParties, CMDS: CMDS };
