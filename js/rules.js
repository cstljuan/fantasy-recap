// Football rules engine. Takes one feed event at a time and keeps down,
// distance, field position, possession and score consistent. Runs in the
// browser and in Node (tools/validate.js) with the same code.
(function (root) {
  'use strict';

  function create(teams) {
    return {
      teams: teams,
      score: [0, 0],
      poss: -1,          // team index with the ball
      ballOn: 0,         // yards from the offense's own goal line, 1 to 99
      down: 0,
      toGo: 0,
      awaiting: 'kickoff', // 'kickoff' | 'xp' | null
      lastScorer: -1,
      openingKicker: -1,
      mustReceive: -1,
      half: 1
    };
  }

  function teamIndex(teams, id) {
    for (var i = 0; i < teams.length; i++) if (teams[i].id === id) return i;
    throw new Error('Unknown team ' + id);
  }

  // Turn the drives into one ordered list of steps for the viewer.
  function flatten(game, teams) {
    var steps = [];
    game.drives.forEach(function (d, di) {
      var team = teamIndex(teams, d.team);
      if (d.half === 2) steps.push({ kind: 'half' });
      d.plays.forEach(function (e, pi) {
        steps.push({ kind: 'play', e: e, team: team, drive: di, index: pi, last: pi === d.plays.length - 1 });
      });
    });
    steps.push({ kind: 'final' });
    return steps;
  }

  function startHalf(s) {
    s.half = 2;
    s.awaiting = 'kickoff';
    s.lastScorer = -1;
    s.mustReceive = s.openingKicker;
    s.poss = -1;
  }

  function last(name) { return name.split(' ').pop(); }
  function ord(n) { return ['', '1st', '2nd', '3rd', '4th'][n] || String(n); }

  function snapshot(s) {
    return { poss: s.poss, ballOn: s.ballOn, down: s.down, toGo: s.toGo, ytg: 100 - s.ballOn, score: s.score.slice() };
  }

  function firstDown(s) {
    s.down = 1;
    s.toGo = Math.min(10, 100 - s.ballOn);
  }

  function flip(s, r, newBallOn) {
    s.poss = 1 - s.poss;
    s.ballOn = newBallOn;
    firstDown(s);
    r.flip = true;
  }

  function nextDown(s, r) {
    s.down += 1;
    if (s.down > 4) {
      r.downs = true;
      r.calls.push('TURNOVER ON DOWNS');
      r.say = 'Turnover on downs. ' + s.teams[1 - s.poss].name + ' take over.';
      flip(s, r, 100 - s.ballOn);
    }
  }

  // Move the ball `yds` from scrimmage and settle down and distance.
  function advance(s, r, yds) {
    var nb = s.ballOn + yds;
    if (nb > 100) throw new Error('Gain of ' + yds + ' is longer than the ' + (100 - s.ballOn) + ' yards to the goal line');
    if (nb <= 0) throw new Error('Safeties are not supported in this prototype');
    r.yds = yds;
    if (nb === 100) {
      r.td = true;
      s.score[s.poss] += 6;
      s.awaiting = 'xp';
      s.lastScorer = s.poss;
      r.calls.push('TOUCHDOWN ' + s.teams[s.poss].name.toUpperCase() + '!');
      return;
    }
    s.ballOn = nb;
    s.toGo -= yds;
    if (s.toGo <= 0) { firstDown(s); r.first = true; }
    else nextDown(s, r);
  }

  function penaltyYards(want, room) {
    // Half the distance to the goal when the full penalty would be more than that.
    return Math.min(want, Math.floor(room / 2) || 1);
  }

  function apply(s, e, team) {
    var T = s.teams;
    var r = { e: e, kind: e.t, calls: [], fp: [], td: false, flip: false, first: false, say: '', text: '' };
    function fp(t, role, pts) { if (pts) r.fp.push({ team: t, role: role, pts: Math.round(pts * 10) / 10 }); }
    function nm(t, role) { return last(T[t].roster[role]); }

    if (e.t === 'kickoff') {
      if (s.awaiting !== 'kickoff') throw new Error('Kickoff when none is due');
      var kicker = 1 - team;
      if (s.lastScorer >= 0 && s.lastScorer !== kicker) throw new Error('The team that scored has to kick off');
      if (s.mustReceive >= 0 && s.mustReceive !== team) throw new Error('Wrong team receives the second half kickoff');
      if (s.openingKicker < 0) s.openingKicker = kicker;
      r.kickTeam = kicker;
      s.poss = team; s.ballOn = e.to; firstDown(s);
      s.awaiting = null; s.lastScorer = -1; s.mustReceive = -1;
      r.pre = { poss: team, ballOn: e.to, down: 0, toGo: 0, ytg: 100 - e.to, score: s.score.slice() };
      r.text = T[kicker].id + ' kicks off, ' + nm(team, 'WR3') + ' returns to the ' + T[team].id + ' ' + e.to;
      r.where = ''; r.desc = r.text;
      r.post = snapshot(s);
      r.scoring = false;
      return r;
    }

    if (e.t === 'xp') {
      if (s.awaiting !== 'xp') throw new Error('Extra point without a touchdown');
      if (team !== s.poss) throw new Error('Extra point by the wrong team');
      r.pre = snapshot(s); r.pre.ballOn = 85; r.pre.ytg = 15; r.pre.down = 0;
      r.fgDist = 33;
      if (e.good) {
        s.score[s.poss] += 1; fp(s.poss, 'K', 1);
        r.calls.push('EXTRA POINT IS GOOD');
      } else {
        r.calls.push('EXTRA POINT NO GOOD');
      }
      r.text = 'Extra point by ' + nm(s.poss, 'K') + (e.good ? ' is good' : ' is no good');
      r.where = ''; r.desc = r.text;
      s.awaiting = 'kickoff';
      r.post = snapshot(s);
      r.scoring = !!e.good;
      return r;
    }

    if (s.awaiting) throw new Error('Expected ' + s.awaiting + ' but got ' + e.t);
    if (team !== s.poss) throw new Error('Drive belongs to ' + T[team].id + ' but ' + T[s.poss].id + ' has the ball');

    var off = s.poss, def = 1 - off;
    r.pre = snapshot(s);
    var where = ord(s.down) + ' and ' + (s.ballOn + s.toGo >= 100 ? 'goal' : s.toGo) + ' at the ' + spot(T, off, s.ballOn);

    switch (e.t) {
      case 'run': {
        advance(s, r, e.yds);
        fp(off, e.by, e.yds * 0.1 + (r.td ? 6 : 0));
        r.text = nm(off, e.by) + ' runs for ' + e.yds;
        if (r.td) r.say = 'Touchdown ' + T[off].name + '! ' + nm(off, e.by) + ' runs it in from ' + e.yds + ' yards out.';
        break;
      }
      case 'pass': {
        advance(s, r, e.yds);
        fp(off, 'QB', e.yds * 0.04 + (r.td ? 4 : 0));
        fp(off, e.to, e.yds * 0.1 + (r.td ? 6 : 0));
        r.text = nm(off, 'QB') + ' pass to ' + nm(off, e.to) + ' for ' + e.yds;
        if (r.td) r.say = 'Touchdown ' + T[off].name + '! ' + nm(off, 'QB') + ' finds ' + nm(off, e.to) + ' for ' + e.yds + ' yards.';
        break;
      }
      case 'inc': {
        r.yds = 0;
        r.calls.push('INCOMPLETE');
        r.text = nm(off, 'QB') + ' pass to ' + nm(off, e.to) + ' incomplete';
        nextDown(s, r);
        break;
      }
      case 'sack': {
        r.calls.push('SACK');
        fp(def, 'DST', 1);
        r.text = nm(off, 'QB') + ' sacked for ' + e.yds;
        r.say = 'Sacked! A loss of ' + (-e.yds) + '.';
        advance(s, r, e.yds);
        break;
      }
      case 'kneel': {
        r.text = nm(off, 'QB') + ' kneels';
        advance(s, r, -1);
        break;
      }
      case 'pen': {
        r.yds = 0;
        var pen, room;
        if (e.kind === 'false_start' || e.kind === 'holding') {
          pen = penaltyYards(e.kind === 'holding' ? 10 : 5, s.ballOn);
          s.ballOn -= pen; s.toGo += pen;
          r.pen = { title: e.kind === 'holding' ? 'HOLDING' : 'FALSE START', sub: 'OFFENSE. ' + pen + ' YARDS. REPLAY ' + ord(s.down).toUpperCase() + ' DOWN', on: off, yds: pen };
          r.say = (e.kind === 'holding' ? 'Holding' : 'False start') + ', offense. ' + pen + ' yard penalty.';
        } else if (e.kind === 'offside') {
          room = 100 - s.ballOn;
          pen = penaltyYards(5, room);
          s.ballOn += pen; s.toGo -= pen;
          var auto = s.toGo <= 0;
          if (auto) { firstDown(s); r.first = true; }
          r.pen = { title: 'OFFSIDE', sub: 'DEFENSE. ' + pen + ' YARDS. ' + (auto ? 'FIRST DOWN' : 'REPLAY ' + ord(s.down).toUpperCase() + ' DOWN'), on: def, yds: pen };
          r.say = 'Offside, defense. ' + pen + ' yard penalty.';
        } else if (e.kind === 'dpi') {
          // Spot foul. In the end zone the ball goes to the 1.
          var nb = Math.min(99, s.ballOn + e.spot);
          pen = nb - s.ballOn;
          s.ballOn = nb; firstDown(s); r.first = true;
          r.pen = { title: 'PASS INTERFERENCE', sub: 'DEFENSE. BALL AT THE SPOT. FIRST DOWN', on: def, yds: pen };
          r.say = 'Pass interference on the defense. Automatic first down.';
        } else {
          throw new Error('Unknown penalty ' + e.kind);
        }
        r.text = 'Penalty: ' + r.pen.title.toLowerCase() + ', ' + pen + ' yards';
        break;
      }
      case 'punt': {
        var land = s.ballOn + e.net;
        r.net = e.net;
        r.text = 'Punt, net ' + e.net;
        if (land >= 100) { r.touchback = true; flip(s, r, 20); }
        else flip(s, r, 100 - land);
        break;
      }
      case 'fg': {
        r.fgDist = (100 - s.ballOn) + 17;
        r.text = nm(off, 'K') + ' ' + r.fgDist + ' yard field goal ' + (e.good ? 'is good' : 'is no good');
        if (e.good) {
          s.score[off] += 3;
          fp(off, 'K', r.fgDist >= 50 ? 5 : r.fgDist >= 40 ? 4 : 3);
          s.awaiting = 'kickoff'; s.lastScorer = off;
          r.calls.push('FIELD GOAL IS GOOD');
          r.say = 'The kick is good! ' + r.fgDist + ' yard field goal for the ' + T[off].name + '.';
        } else {
          // Missed: the other team takes over at the spot of the kick, or its 20 if that is closer in.
          var kickSpot = s.ballOn - 7;
          r.calls.push('NO GOOD');
          r.say = 'No good! The ' + r.fgDist + ' yard try is off the mark.';
          flip(s, r, Math.max(20, 100 - kickSpot));
        }
        break;
      }
      case 'int': {
        r.calls.push('INTERCEPTION');
        fp(off, 'QB', -2); fp(def, 'DST', 2);
        r.text = nm(off, 'QB') + ' intercepted, returned ' + e.ret;
        r.say = 'Intercepted! ' + T[def].name + ' ball.';
        var newOwn = 100 - (s.ballOn + e.at) + e.ret;
        if (newOwn < 1 || newOwn > 99) throw new Error('Interception return leaves the field of play');
        flip(s, r, newOwn);
        break;
      }
      case 'fumble': {
        r.calls.push('FUMBLE! ' + T[def].name.toUpperCase() + ' BALL');
        fp(off, e.by, e.yds * 0.1 - 2); fp(def, 'DST', 2);
        r.text = nm(off, e.by) + ' runs for ' + e.yds + ' and fumbles, ' + T[def].id + ' recover';
        r.say = 'Fumble! Recovered by the ' + T[def].name + '.';
        r.yds = e.yds;
        var at = s.ballOn + e.yds;
        if (at < 1 || at > 99) throw new Error('Fumble spot leaves the field of play');
        flip(s, r, 100 - at);
        break;
      }
      default:
        throw new Error('Unknown event type ' + e.t);
    }

    r.where = where; r.desc = r.text; // the two halves, for the play-by-play feed
    r.text = where + ': ' + r.text + (r.td ? ', TOUCHDOWN' : '') + (r.first && !r.td ? ', first down' : '') + (r.downs ? ', turnover on downs' : '');
    r.post = snapshot(s);
    var scoreChanged = r.post.score[0] !== r.pre.score[0] || r.post.score[1] !== r.pre.score[1];
    r.scoring = scoreChanged || r.fp.some(function (f) { return Math.abs(f.pts) >= 1; });
    return r;
  }

  function spot(T, off, ballOn) {
    if (ballOn === 50) return '50';
    return ballOn < 50 ? T[off].id + ' ' + ballOn : T[1 - off].id + ' ' + (100 - ballOn);
  }

  var api = { create: create, flatten: flatten, apply: apply, startHalf: startHalf, lastName: last, ord: ord };
  root.FF_RULES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
