// Fantasy soccer on top of the match: the scoring rules as data, the points
// each event is worth, and a full breakdown. Same shape as football: every
// rules result carries `fp`, a list of { team, role, pts }, where `team` is the
// team index and `role` is a lineup slot. Extra field: `why` ('goal', 'assist'...).
// Runs in the browser and in Node.
(function (root) {
  'use strict';

  // Position group of each slot in the 4-3-3.
  var POS = { GK: 'GK', LB: 'DEF', CB1: 'DEF', CB2: 'DEF', RB: 'DEF', CM1: 'MID', CM2: 'MID', CM3: 'MID', LW: 'FWD', ST: 'FWD', RW: 'FWD' };

  // Points per event. Numbers per position group where it differs.
  var SCORING = {
    goal: { GK: 6, DEF: 6, MID: 5, FWD: 4 },
    assist: 3,
    clean_sheet: { GK: 4, DEF: 4, MID: 1, FWD: 0 },   // at full time, only if the team conceded nothing
    save: 1,                                         // keeper, per save from open play or a header
    pen_save: 5,
    pen_miss: -2,
    yellow: -1,
    red: -3
  };

  // The fantasy lineup: the slots a manager owns, the same for both teams.
  var LINEUP = [
    { role: 'GK', pos: 'GK' }, { role: 'CB1', pos: 'DEF' }, { role: 'CB2', pos: 'DEF' },
    { role: 'CM2', pos: 'MID' }, { role: 'LW', pos: 'FWD' }, { role: 'ST', pos: 'FWD' }, { role: 'RW', pos: 'FWD' }
  ];
  var OWNED = {};
  LINEUP.forEach(function (l) { OWNED[l.role] = true; });

  function byPos(rule, slot) { return typeof rule === 'number' ? rule : rule[POS[slot]] || 0; }

  // Points for one rules result `r` (from SC_RULES.apply). Only lineup slots score.
  function pointsFor(r) {
    var e = r.e, out = [];
    function add(team, slot, pts, why) { if (pts && OWNED[slot]) out.push({ team: team, role: slot, pts: pts, why: why }); }
    if (r.goal) {
      add(r.team, r.scorer, byPos(SCORING.goal, r.scorer), r.kind === 'pen' ? 'penalty goal' : 'goal');
      if (r.assist) add(r.team, r.assist, SCORING.assist, 'assist');
    }
    if (r.saver) add(1 - r.team, 'GK', r.kind === 'pen' ? SCORING.pen_save : SCORING.save, r.kind === 'pen' ? 'penalty save' : 'save');
    if (r.kind === 'pen' && e.out === 'wide') add(r.team, e.by, SCORING.pen_miss, 'penalty miss');
    if (r.card) add(r.team, e.by, SCORING[r.card], r.card + ' card');
    return out;
  }

  // Clean sheets, worked out at full time from the goals each team conceded.
  function fullTime(score) {
    var out = [];
    [0, 1].forEach(function (t) {
      if (score[1 - t] !== 0) return;
      LINEUP.forEach(function (l) {
        var pts = byPos(SCORING.clean_sheet, l.role);
        if (pts) out.push({ team: t, role: l.role, pts: pts, why: 'clean sheet' });
      });
    });
    return out;
  }

  // The whole match: every event that was worth points, and the totals.
  //   { events: [{ min, text, fp: [{ team, role, name, pts, why }] }], totals: [{ total, players: { slot: pts } }, ...] }
  function breakdown(game, teams, Rules) {
    var s = Rules.create(teams), events = [];
    var totals = [0, 1].map(function () {
      var p = {}; LINEUP.forEach(function (l) { p[l.role] = 0; }); return { total: 0, players: p };
    });
    function keep(min, text, fp) {
      if (!fp.length) return;
      fp.forEach(function (f) { totals[f.team].players[f.role] += f.pts; totals[f.team].total += f.pts; });
      events.push({ min: min, text: text, fp: fp.map(function (f) {
        return { team: f.team, role: f.role, name: teams[f.team].roster[f.role], pts: f.pts, why: f.why };
      }) });
    }
    Rules.flatten(game, teams).forEach(function (st) {
      if (st.kind === 'half') Rules.startHalf(s);
      else if (st.kind === 'play') { var r = Rules.apply(s, st.e, st.team); keep(r.min, r.text.replace(/^\d+' /, ''), r.fp); }
      else if (st.kind === 'final') keep(90, 'Full time', fullTime(s.score));
    });
    return { events: events, totals: totals, score: s.score.slice() };
  }

  var api = { SCORING: SCORING, POS: POS, LINEUP: LINEUP, pointsFor: pointsFor, fullTime: fullTime, breakdown: breakdown };
  root.SC_FANTASY = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
