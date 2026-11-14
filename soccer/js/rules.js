// Soccer rules engine. Takes one event at a time and keeps possession, the
// half, cards and the score consistent. Goals are never in the event list:
// a shot or a penalty that goes in is a goal unless it was offside.
// Runs in the browser and in Node (soccer/check.js) with the same code.
(function (root) {
  'use strict';

  var SLOTS = ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CM1', 'CM2', 'CM3', 'LW', 'ST', 'RW'];

  function create(teams) {
    return {
      teams: teams,
      score: [0, 0],
      poss: -1,            // team index with the ball, -1 when it is loose or dead
      half: 1,
      min: 0,
      firstKicker: -1,
      expect: [{ t: 'kickoff' }], // what may come next; null means open play
      cards: {},           // "team:slot" -> 'yellow' | 'red'
      sentOff: {},
      goals: []            // { team, by, assist, min, how }
    };
  }

  function teamIndex(teams, id) {
    for (var i = 0; i < teams.length; i++) if (teams[i].id === id) return i;
    throw new Error('Unknown team ' + id);
  }

  // One ordered list of steps for the viewer.
  function flatten(game, teams) {
    var steps = [];
    game.events.forEach(function (e, i) {
      if (e.t === 'ht') steps.push({ kind: 'half', e: e, index: i });
      else steps.push({ kind: 'play', e: e, team: teamIndex(teams, e.team), index: i });
    });
    steps.push({ kind: 'final' });
    return steps;
  }

  function lastName(name) { return name.split(' ').pop(); }

  function allowed(s, e, team) {
    if (!s.expect) return true;
    return s.expect.some(function (x) {
      return (x.team === undefined || x.team === team) && (!x.t || x.t === e.t) && (!x.by || x.by === e.by);
    });
  }

  function describeExpect(s) {
    return s.expect.map(function (x) {
      return (x.t || 'any event') + (x.team !== undefined ? ' by ' + s.teams[x.team].id : '') + (x.by ? ' (' + x.by + ')' : '');
    }).join(' or ');
  }

  function startHalf(s) {
    s.half = 2;
    s.poss = -1;
    s.expect = [{ t: 'kickoff', team: 1 - s.firstKicker }];
  }

  function apply(s, e, team) {
    var T = s.teams, other = 1 - team;
    var r = { e: e, kind: e.t, team: team, min: e.min, half: s.half, calls: [], fp: [], goal: false, say: '', text: '',
              pre: { poss: s.poss, score: s.score.slice() } };
    function nm(t, slot) {
      if (SLOTS.indexOf(slot) < 0) throw new Error('Unknown slot ' + slot + ' at ' + e.min + "'");
      if (s.sentOff[t + ':' + slot]) throw new Error(T[t].id + ' ' + slot + ' was sent off and cannot play at ' + e.min + "'");
      return lastName(T[t].roster[slot]);
    }
    function call(text, sub, color) { r.calls.push({ text: text, sub: sub || '', color: color }); }
    function scoreLine() { return T[0].id + ' ' + s.score[0] + '  ' + T[1].id + ' ' + s.score[1]; }
    function spokenScore() { return T[0].name + ' ' + s.score[0] + ', ' + T[1].name + ' ' + s.score[1] + '.'; }
    function goal(by, assist, how) {
      s.score[team] += 1;
      s.goals.push({ team: team, by: by, assist: assist || null, min: e.min, how: how });
      r.goal = true; r.scorer = by; r.assist = assist || null;
      s.poss = -1;
      s.expect = [{ t: 'kickoff', team: other }];
      call('GOAL!', nm(team, by) + ' ' + e.min + "'", '#ffe600');
      call(scoreLine(), assist ? 'Assist ' + nm(team, assist) : '', '#ffffff');
      r.say = 'Goal! ' + nm(team, by) + ' scores for ' + T[team].name + '. ' + spokenScore();
    }

    if (typeof e.min !== 'number') throw new Error('Event without a minute: ' + JSON.stringify(e));
    if (e.min < s.min) throw new Error('Event at ' + e.min + "' comes after " + s.min + "'");
    if (s.half === 1 && e.min > 50) throw new Error('First half event at ' + e.min + "'");
    if (s.half === 2 && e.min < 45) throw new Error('Second half event at ' + e.min + "'");
    if (!allowed(s, e, team)) {
      throw new Error(e.min + "' " + T[team].id + ' ' + e.t + ' is not allowed here. Expected ' + describeExpect(s));
    }
    s.min = e.min;
    r.restart = s.restart || null;  // set piece that led to this event, for the play library
    s.restart = null;

    if (e.t === 'kickoff') {
      if (s.firstKicker < 0) s.firstKicker = team;
      s.poss = team; s.expect = null;
      r.text = e.min + "' Kickoff, " + T[team].id;
      if (e.min === 0) { call('KICKOFF', T[0].name.toUpperCase() + ' v ' + T[1].name.toUpperCase()); r.say = 'Kickoff. ' + T[0].name + ' against ' + T[1].name + '.'; }
      else if (s.half === 2 && !s.secondStarted) { call('SECOND HALF'); r.say = 'We are back under way.'; }
      if (s.half === 2) s.secondStarted = true;
    } else if (e.t === 'build') {
      if (!e.chain || !e.chain.length) throw new Error('Build without a chain at ' + e.min + "'");
      r.regain = s.poss !== team;
      s.poss = team; s.expect = null;
      r.text = e.min + "' " + T[team].id + ': ' + e.chain.map(function (k) { return nm(team, k); }).join(' to ');
    } else if (e.t === 'shot' || e.t === 'pen') {
      if (s.poss !== team) throw new Error(e.min + "' " + T[team].id + ' shoot without the ball');
      var who = nm(team, e.by), keeper = nm(other, 'GK');
      if (e.assist) nm(team, e.assist);
      r.text = e.min + "' " + (e.t === 'pen' ? 'Penalty, ' : 'Shot, ') + who + ': ' + e.out + (e.offside ? ' (offside)' : '');
      if (e.out === 'in') {
        if (e.offside) {
          call('NO GOAL', 'OFFSIDE, ' + who.toUpperCase(), '#ffd400');
          r.say = 'It is in, but the flag is up. ' + who + ' was offside. No goal.';
          r.disallowed = true;
          s.poss = other; s.expect = [{ team: other }];
          s.restart = 'fk';
        } else goal(e.by, e.assist, e.t === 'pen' ? 'pen' : e.head ? 'head' : 'foot');
      } else if (e.out === 'saved') {
        call('SAVE', keeper.toUpperCase());
        r.say = 'Saved by ' + keeper + '.';
        r.saver = 'GK';
        s.poss = other;
        s.expect = e.t === 'pen' ? [{ team: other }] : [{ team: other }, { team: team, t: 'corner' }];
      } else if (e.out === 'wide') {
        call(e.t === 'pen' ? 'MISSED' : 'WIDE', who.toUpperCase());
        r.say = who + (e.t === 'pen' ? ' misses the penalty.' : ' puts it wide.');
        s.poss = other; s.expect = [{ team: other }];
        s.restart = 'gk';
      } else if (e.out === 'post' && e.t === 'shot') {
        call('OFF THE POST', who.toUpperCase());
        r.say = 'Off the post! So close for ' + who + '.';
        s.poss = -1; s.expect = null;
      } else if (e.out === 'blocked' && e.t === 'shot') {
        call('BLOCKED');
        r.say = 'Blocked.';
        s.poss = -1; s.expect = null;
      } else throw new Error('Unknown ' + e.t + ' result ' + e.out + ' at ' + e.min + "'");
    } else if (e.t === 'corner') {
      nm(team, e.by);
      s.poss = team;
      call('CORNER', T[team].id);
      r.text = e.min + "' Corner " + T[team].id + ', ' + nm(team, e.by) + (e.to ? ' to ' + nm(team, e.to) : ', cleared');
      if (e.to) { nm(team, e.to); s.expect = [{ team: team, t: 'shot', by: e.to }, { team: other }]; s.restart = 'corner'; }
      else { s.poss = other; s.expect = [{ team: other }]; r.say = 'Corner, headed clear.'; }
    } else if (e.t === 'freekick') {
      nm(team, e.by);
      s.poss = team;
      call('FREE KICK', T[team].id);
      r.text = e.min + "' Free kick " + T[team].id + ', ' + nm(team, e.by) + (e.to ? ' to ' + nm(team, e.to) : ', direct');
      if (e.to) { nm(team, e.to); s.expect = null; s.restart = 'fkpass'; }
      else { s.expect = [{ team: team, t: 'shot', by: e.by }]; s.restart = 'fk'; r.direct = true; }
    } else if (e.t === 'foul') {
      var off = nm(team, e.by), vic = nm(other, e.on), key = team + ':' + e.by;
      r.text = e.min + "' Foul by " + off + ' on ' + vic + (e.card ? ', ' + e.card + ' card' : '') + (e.box ? ', penalty' : '');
      call(e.box ? 'PENALTY' : 'FOUL', off.toUpperCase() + ' ON ' + vic.toUpperCase(), e.box ? '#ffe600' : '#ffffff');
      var card = e.card;
      if (card === 'yellow' && s.cards[key] === 'yellow') card = 'red';
      if (card) {
        s.cards[key] = card;
        r.card = card;
        if (card === 'red') s.sentOff[key] = true;
        call(card === 'red' ? 'RED CARD' : 'YELLOW CARD', off.toUpperCase(), card === 'red' ? '#ff3b30' : '#ffd400');
      }
      r.say = e.box ? 'Penalty! ' + off + ' brings down ' + vic + '.' : 'Foul by ' + off + '.' + (card ? ' ' + (card === 'red' ? 'Red' : 'Yellow') + ' card.' : '');
      s.poss = other;
      s.expect = e.box ? [{ team: other, t: 'pen' }] : [{ team: other }];
      s.restart = e.box ? 'pen' : 'fk';
    } else if (e.t === 'offside') {
      var ow = nm(team, e.by);
      call('OFFSIDE', ow.toUpperCase(), '#ffd400');
      r.text = e.min + "' Offside, " + ow;
      r.say = 'Flag up. ' + ow + ' is offside.';
      s.poss = other; s.expect = [{ team: other }];
      s.restart = 'fk';
    } else {
      throw new Error('Unknown event type ' + e.t + ' at ' + e.min + "'");
    }

    r.post = { poss: s.poss, score: s.score.slice() };
    return r;
  }

  // Run a whole match through the rules. Used by soccer/check.js.
  function run(game, teams) {
    var s = create(teams);
    flatten(game, teams).forEach(function (st) {
      if (st.kind === 'half') {
        if (s.half !== 1) throw new Error('Second half time event');
        startHalf(s);
      } else if (st.kind === 'play') apply(s, st.e, st.team);
    });
    if (s.half !== 2) throw new Error('The match never reached the second half');
    return s;
  }

  var api = { create: create, flatten: flatten, apply: apply, startHalf: startHalf, run: run, lastName: lastName, SLOTS: SLOTS };
  root.SC_RULES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
