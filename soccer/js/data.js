// Demo data. The player names are real footballers, picked for two fantasy
// rosters, the same way the football demo uses real NFL players. The fantasy
// team names and colors are made up, and so is the sample match: no event in
// it really happened.
(function (root) {
  'use strict';

  // Slots, 4-3-3: GK, LB, CB1, CB2, RB, CM1, CM2, CM3, LW, ST, RW.
  // `fantasy` lists the slots in the fantasy lineup (soccer/js/fantasy.js,
  // LINEUP). Only those players score points and carry a name on the pitch.
  // Names are written without accents so the pixel font and Node agree.
  var FANTASY = ['GK', 'CB1', 'CB2', 'CM2', 'LW', 'ST', 'RW'];
  var TEAMS = [
    {
      id: 'IRN',
      name: 'Ironside',
      full: 'Ironside FC',
      colors: { shirt: '#17191c', trim: '#d4ff2a', shorts: '#17191c', socks: '#d4ff2a', keeper: '#ff6a1a', tile: '#3a4a12' },
      roster: {
        GK: 'David Raya', LB: 'Alphonso Davies', CB1: 'William Saliba', CB2: 'Ruben Dias', RB: 'Achraf Hakimi',
        CM1: 'Declan Rice', CM2: 'Jude Bellingham', CM3: 'Florian Wirtz',
        LW: 'Khvicha Kvaratskhelia', ST: 'Erling Haaland', RW: 'Bukayo Saka'
      },
      fantasy: FANTASY
    },
    {
      id: 'RHB',
      name: 'Red Harbour',
      full: 'Red Harbour SC',
      colors: { shirt: '#b3121b', trim: '#f2ead8', shorts: '#f2ead8', socks: '#b3121b', keeper: '#1fb5ff', tile: '#7a0c12' },
      roster: {
        GK: 'Mike Maignan', LB: 'Nuno Mendes', CB1: 'Josko Gvardiol', CB2: 'Antonio Rudiger', RB: 'Jules Kounde',
        CM1: 'Federico Valverde', CM2: 'Vitinha', CM3: 'Cole Palmer',
        LW: 'Kylian Mbappe', ST: 'Harry Kane', RW: 'Mohamed Salah'
      },
      fantasy: FANTASY
    }
  ];

  // Event vocabulary. Every event has `min` (match minute), `t` (type) and
  // `team` (the team the event belongs to). Slots name the players.
  //   kickoff  {team}                       start of a half, or after a goal
  //   build    {team, chain, to}            passes along `chain` (slots); `to` is
  //                                         where the move ends: mid | att | box.
  //                                         A team without the ball wins it first.
  //   shot     {team, by, out, assist?, head?, offside?}
  //                                         out: in | saved | wide | post | blocked
  //   corner   {team, by, to?}              cross from the corner to `to`;
  //                                         without `to` the defense clears it
  //   freekick {team, by, to?}              with `to` it is a pass; without, the
  //                                         next event is a direct shot by `by`
  //   foul     {team, by, on, card?, box?}  `team` fouls; card: yellow | red;
  //                                         box: true gives a penalty
  //   pen      {team, by, out}              penalty kick, out: in | saved | wide
  //   offside  {team, by}                   `by` is caught offside
  //   ht       {}                           half time
  // Goals and the score are never in the file. soccer/js/rules.js works them
  // out: a shot or a penalty that goes in counts, unless it was offside.
  var SAMPLE_GAME = {
    note: 'Sample match. Mock data, made up for the demo.',
    events: [
      { min: 0, t: 'kickoff', team: 'IRN' },
      { min: 3, t: 'build', team: 'IRN', chain: ['CB1', 'CM2', 'LW'], to: 'mid' },
      { min: 5, t: 'build', team: 'RHB', chain: ['CB2', 'CM1', 'RW', 'ST'], to: 'att' },
      { min: 6, t: 'shot', team: 'RHB', by: 'ST', out: 'saved' },
      { min: 11, t: 'build', team: 'IRN', chain: ['GK', 'CB2', 'CM1', 'CM3', 'RW'], to: 'att' },
      { min: 12, t: 'foul', team: 'RHB', by: 'LB', on: 'RW', card: 'yellow' },
      { min: 13, t: 'freekick', team: 'IRN', by: 'CM2' },
      { min: 13, t: 'shot', team: 'IRN', by: 'CM2', out: 'saved' },
      { min: 14, t: 'corner', team: 'IRN', by: 'LW', to: 'ST' },
      { min: 14, t: 'shot', team: 'IRN', by: 'ST', assist: 'LW', head: true, out: 'in' },
      { min: 15, t: 'kickoff', team: 'RHB' },
      { min: 21, t: 'build', team: 'RHB', chain: ['CM2', 'CM3', 'LW'], to: 'att' },
      { min: 22, t: 'offside', team: 'RHB', by: 'ST' },
      { min: 27, t: 'build', team: 'IRN', chain: ['CB1', 'LB', 'LW', 'CM2'], to: 'att' },
      { min: 28, t: 'shot', team: 'IRN', by: 'RW', assist: 'CM2', out: 'wide' },
      { min: 34, t: 'build', team: 'RHB', chain: ['GK', 'CB1', 'CM2', 'RW'], to: 'box' },
      { min: 35, t: 'foul', team: 'IRN', by: 'CB2', on: 'RW', box: true },
      { min: 36, t: 'pen', team: 'RHB', by: 'ST', out: 'in' },
      { min: 37, t: 'kickoff', team: 'IRN' },
      { min: 43, t: 'build', team: 'IRN', chain: ['CM3', 'RW', 'ST'], to: 'box' },
      { min: 44, t: 'shot', team: 'IRN', by: 'ST', out: 'post' },
      { min: 45, t: 'ht' },
      { min: 46, t: 'kickoff', team: 'RHB' },
      { min: 52, t: 'build', team: 'RHB', chain: ['CB2', 'LB', 'LW'], to: 'att' },
      { min: 53, t: 'shot', team: 'RHB', by: 'LW', out: 'blocked' },
      { min: 53, t: 'corner', team: 'RHB', by: 'RW', to: 'CB2' },
      { min: 54, t: 'shot', team: 'RHB', by: 'CB2', assist: 'RW', head: true, out: 'saved' },
      { min: 60, t: 'build', team: 'IRN', chain: ['CB1', 'CM1', 'RW'], to: 'box' },
      { min: 61, t: 'shot', team: 'IRN', by: 'ST', assist: 'RW', out: 'in', offside: true },
      { min: 66, t: 'build', team: 'RHB', chain: ['CB1', 'CM3', 'RW'], to: 'att' },
      { min: 67, t: 'foul', team: 'IRN', by: 'CM2', on: 'RW', card: 'yellow' },
      { min: 68, t: 'freekick', team: 'RHB', by: 'RW', to: 'CB1' },
      { min: 68, t: 'shot', team: 'RHB', by: 'CB1', assist: 'RW', head: true, out: 'in' },
      { min: 69, t: 'kickoff', team: 'IRN' },
      { min: 74, t: 'build', team: 'IRN', chain: ['GK', 'CB2', 'CM1', 'LW'], to: 'box' },
      { min: 75, t: 'shot', team: 'IRN', by: 'CM2', assist: 'LW', out: 'in' },
      { min: 76, t: 'kickoff', team: 'RHB' },
      { min: 81, t: 'build', team: 'RHB', chain: ['CM1', 'CM2', 'ST'], to: 'box' },
      { min: 82, t: 'shot', team: 'RHB', by: 'ST', out: 'saved' },
      { min: 82, t: 'corner', team: 'RHB', by: 'LW' },
      { min: 87, t: 'build', team: 'IRN', chain: ['CB1', 'CM3', 'RW'], to: 'att' },
      { min: 88, t: 'shot', team: 'IRN', by: 'RW', assist: 'ST', out: 'in' },
      { min: 89, t: 'kickoff', team: 'RHB' },
      { min: 90, t: 'build', team: 'RHB', chain: ['CB2', 'CM2', 'ST'], to: 'box' },
      { min: 90, t: 'shot', team: 'RHB', by: 'ST', out: 'wide' }
    ]
  };

  var api = { TEAMS: TEAMS, SAMPLE_GAME: SAMPLE_GAME };
  root.SC_DATA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
