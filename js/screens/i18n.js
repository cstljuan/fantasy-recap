// Spanish for the screens. One table: every English string the screens show, with the Spanish
// next to it, plus patterns for text that carries numbers or names. The switch saves fr.lang
// ('en' or 'es'). Text is translated in place as the app draws it: whole text nodes and the
// names screen readers hear (aria-label, title, aria-valuetext). Player and team names are
// never in the table, so they stay as they are. What the announcer says (captions) is Noah's:
// it is left alone here. Loaded by js/app.js.
(function () {
  'use strict';

  var TABLE = [
    // header, tabs, sport and language
    ['Match Viewer', 'Visor de partidos'], ['Sample games', 'Partidos de muestra'], ['Mock data', 'Datos de muestra'],
    ['League', 'Liga'], ['Matchup', 'Partido'], ['Lineups', 'Equipos'], ['Plays', 'Jugadas'], ['Recap', 'Resumen'],
    ['Screens', 'Pantallas'], ['Sections', 'Secciones'], ['Sport', 'Deporte'], ['Football', 'Fútbol americano'], ['Soccer', 'Fútbol'],
    ['Soccer match', 'Partido de fútbol'], ['Language', 'Idioma'],
    ['Sample league. Real player names. The games, stats and scores are made up for the demo.', 'Liga de muestra. Nombres de jugadores reales. Los partidos, las estadísticas y los marcadores son inventados para la demostración.'],
    ['Sample league. Every team, player, score and play in this app is made up for the demo.', 'Liga de muestra. Todos los equipos, jugadores, marcadores y jugadas de esta app son inventados para la demostración.'],
    // screen titles (hidden headings)
    ['Play by play', 'Jugada a jugada'], ['Film room', 'Sala de video'], ['This week in the league', 'Esta semana en la liga'],
    // league and season
    ['Your matchup', 'Tu partido'], ['vs', 'contra'], ['Opted in', 'Participa'], ['Not opted in', 'No participa'],
    ['Recap drops Tuesday', 'El resumen sale el martes'], ['Open', 'Abrir'], ["This week's biggest plays", 'Las mejores jugadas de la semana'],
    ['Standings', 'Clasificación'], ['Team', 'Equipo'], ['W', 'G'], ['L', 'P'], ['Points for', 'Puntos a favor'], ['Finished', 'Terminada'],
    ['Win', 'Gana'], ['Watch the recap', 'Ver el resumen'], ['Week', 'Semana'], ['Nothing for this week.', 'Nada para esta semana.'],
    ['Sample league, made up for the demo: the other teams, past scores and standings are invented. Each recap is released on Tuesday, after the week is over. Only your week 11 matchup has a game to watch.',
     'Liga de muestra, inventada para la demostración: los otros equipos, los marcadores pasados y la clasificación son inventados. Cada resumen sale el martes, cuando termina la semana. Solo tu partido de la semana 11 tiene un partido para ver.'],
    ['The app plays one game file at a time, and it is not this one.', 'La app juega un archivo de partido a la vez, y no es este.'],
    ['No game file for this matchup, so there are no plays to show. Only the score will be kept.', 'No hay archivo de partido para este enfrentamiento, así que no hay jugadas que mostrar. Solo se guardará el marcador.'],
    ['The three plays that moved the most fantasy points in each game, from the game file. Quarters and clock times are worked out from the order of the plays, since the game file has none.',
     'Las tres jugadas que más puntos de fantasía movieron en cada partido, según el archivo del partido. Los cuartos y los tiempos se calculan por el orden de las jugadas, porque el archivo no los tiene.'],
    ['Your score is hidden, so this game\'s biggest plays stay hidden until the final. Watch the game to see them.',
     'Tu puntuación está oculta, así que las mejores jugadas de este partido siguen ocultas hasta el final. Mira el partido para verlas.'],
    ['Hidden until the final.', 'Oculto hasta el final.'], ['Watch this play', 'Ver esta jugada'], ['Finding the play', 'Buscando la jugada'],
    ['Soccer is being built. It is not part of this app yet, but the match plays on its own page.', 'El fútbol está en construcción. Aún no forma parte de esta app, pero el partido se juega en su propia página.'],
    ['Open soccer', 'Abrir fútbol'], ['Back to football', 'Volver al fútbol americano'],
    // walkthrough and install hint
    ['Skip', 'Saltar'], ['Next', 'Siguiente'], ['Back', 'Atrás'], ['Start', 'Empezar'],
    ['Your week, as a game', 'Tu semana, como un partido'],
    ["At the end of the week your fantasy roster plays your opponent's, in a small 8-bit football game.", 'Al final de la semana tu equipo de fantasía juega contra el de tu rival, en un pequeño partido de fútbol americano de 8 bits.'],
    ['Opt in to hide your score', 'Participa para ocultar tu puntuación'],
    ['On the matchup screen, choose Opt in. Your points and stat lines stay hidden until the final whistle.', 'En la pantalla del partido, elige Participar. Tus puntos y estadísticas quedan ocultos hasta el pitido final.'],
    ['Watch, then the reveal', 'Mira, y luego la revelación'],
    ['Tap Watch the game. Speed it up or close it, it waits for you. At the final, the recap shows who won.', 'Toca Ver el partido. Acelera o ciérralo, te espera. Al final, el resumen muestra quién ganó.'],
    ['Put it on your Home Screen.', 'Ponlo en tu pantalla de inicio.'], ['Tap the Share button', 'Toca el botón Compartir'],
    [', then Add to Home Screen.', ', luego Añadir a la pantalla de inicio.'], ['Got it', 'Entendido'], ['Dismiss', 'Descartar'],
    ['Demo', 'Demo'], ['Demo stopped', 'Demo detenida'], ['Demo done', 'Demo terminada'],
    // matchup
    ['Hide my score until the recap', 'Ocultar mi puntuación hasta el resumen'],
    ['Fantasy points and stat lines stay hidden while you watch. Everything shows at the final.', 'Los puntos de fantasía y las estadísticas quedan ocultos mientras miras. Todo se muestra al final.'],
    ['Opt in', 'Participar'], ['No thanks', 'No, gracias'], ['Your score is hidden until the final.', 'Tu puntuación está oculta hasta el final.'],
    ['Show scores', 'Mostrar puntuaciones'], ['Saved on this device.', 'Guardado en este dispositivo.'], ['Saved to the league.', 'Guardado en la liga.'],
    ['Saving to the league…', 'Guardando en la liga…'],
    ['Fantasy pts', 'Pts de fantasía'], ['On the field', 'En el campo'], ['Watch the game', 'Ver el partido'], ['Keep watching', 'Seguir viendo'],
    ['Watch again', 'Ver de nuevo'], ['See the recap', 'Ver el resumen'], ['Your team', 'Tu equipo'], ['Neither', 'Ninguno'],
    ['Latest plays', 'Últimas jugadas'], ['All plays', 'Todas las jugadas'], ['Leaders', 'Líderes'], ['No fantasy points yet.', 'Aún no hay puntos de fantasía.'],
    ['Leaders are hidden until the final.', 'Los líderes están ocultos hasta el final.'], ['Plays show up here once the game kicks off.', 'Las jugadas aparecen aquí cuando empieza el partido.'],
    ['Kicks off when you start watching', 'Empieza cuando lo empieces a ver'], ['Full time', 'Final del partido'],
    ['Pregame', 'Previa'], ['Live', 'En vivo'], ['Paused', 'En pausa'], ['Final', 'Final'], ['Kickoff', 'Saque inicial'],
    ['Extra point try', 'Intento de punto extra'], ['Halftime', 'Medio tiempo'], ['hidden', 'oculto'],
    // lineups
    ['Yet to play', 'Aún sin jugar'], ['No stats yet', 'Aún sin estadísticas'], ['steady', 'estable'], ['hot', 'en racha'], ['cold', 'frío'],
    ['Scoring in this sample league: 0.1 per rushing or receiving yard, 0.04 per passing yard, 6 for a rushing or receiving touchdown, 4 for a passing touchdown, minus 2 for an interception or lost fumble. Kickers get 1 for an extra point and 3 to 5 for a field goal. A defense gets 1 for a sack and 2 for a takeaway.',
     'Puntuación de esta liga de muestra: 0.1 por yarda por tierra o recibida, 0.04 por yarda de pase, 6 por touchdown por tierra o de recepción, 4 por touchdown de pase, menos 2 por intercepción o balón suelto perdido. Los pateadores suman 1 por punto extra y de 3 a 5 por gol de campo. Una defensa suma 1 por captura y 2 por recuperación.'],
    // plays
    ['All', 'Todas'], ['Scoring', 'Anotaciones'], ['Penalties', 'Castigos'], ['No scoring plays yet.', 'Aún no hay anotaciones.'],
    ['No penalties yet.', 'Aún no hay castigos.'], ['Waiting for the first play.', 'Esperando la primera jugada.'],
    ['Paused before the first play. Keep watching to see it.', 'En pausa antes de la primera jugada. Sigue viendo para verla.'],
    ['Touchdown', 'Touchdown'], ['Field goal', 'Gol de campo'], ['Extra point', 'Punto extra'], ['Flag', 'Castigo'], ['Turnover', 'Pérdida'],
    ['Turnover on downs', 'Pérdida en downs'],
    ['Why this play', 'Por qué esta jugada'], ['Which play to call?', '¿Qué jugada pedir?'], ['Called', 'Elegida'],
    ['Deep pass', 'Pase largo'], ['Run', 'Carrera'], ['Short pass', 'Pase corto'], ['Screen', 'Pase pantalla'],
    ['Chosen by the play caller from these odds', 'Elegida por el seleccionador de jugadas con estas probabilidades'],
    // recap
    ['Scores are hidden. Watch the game to find out.', 'Las puntuaciones están ocultas. Mira el partido para saberlo.'],
    ['The recap is ready at the final whistle: final score, top performers and every scoring play.', 'El resumen está listo al pitido final: marcador final, mejores jugadores y cada anotación.'],
    [' The game is paused while you are away, so you will not miss a play.', ' El partido se detiene mientras no estás, así que no te perderás ninguna jugada.'],
    ['Scores are hidden. Watch the game to find out. The game is paused while you are away, so you will not miss a play.', 'Las puntuaciones están ocultas. Mira el partido para saberlo. El partido se detiene mientras no estás, así que no te perderás ninguna jugada.'],
    ['The recap is ready at the final whistle: final score, top performers and every scoring play. The game is paused while you are away, so you will not miss a play.', 'El resumen está listo al pitido final: marcador final, mejores jugadores y cada anotación. El partido se detiene mientras no estás, así que no te perderás ninguna jugada.'],
    ['win', 'ganan'], ['It is a tie', 'Es un empate'], ['Share result', 'Compartir resultado'], ['Share the top play', 'Compartir la mejor jugada'],
    ['Your score stays hidden again on the replay.', 'Tu puntuación vuelve a estar oculta en la repetición.'],
    ['Top performers', 'Mejores jugadores'], ['Scoring plays', 'Anotaciones'], ['Fantasy points', 'Puntos de fantasía'],
    ['Score on the field', 'Marcador en el campo'], ['Total yards', 'Yardas totales'], ['Net passing', 'Pase neto'], ['Rushing', 'Por tierra'],
    ['Turnovers', 'Pérdidas'], ['The story of the game', 'La historia del partido'], ['The plays that mattered', 'Las jugadas que importaron'],
    // film room
    ['Drive chart', 'Gráfico de series'], ['Recap', 'Resumen'], ['Punt', 'Despeje'], ['TD', 'TD'], ['FG', 'GC'], ['FG miss', 'GC fallado'],
    ['TO', 'PÉR'], ['Downs', 'Downs'], ['Half', 'Mitad'], ['End', 'Fin'], ['Score', 'Anotación'], ['Penalty', 'Castigo'], ['Lost yards', 'Yardas perdidas'],
    ['The play caller', 'El seleccionador de jugadas'], ['Plays it chose', 'Jugadas que eligió'], ['Average odds of its pick', 'Probabilidad media de su elección'],
    ['Most confident call', 'Su elección más segura'], ['Biggest surprise', 'La mayor sorpresa'], ['The play', 'La jugada'],
    ["Tap a play in the chart to see it here, with the play caller's odds when it chose the play.", 'Toca una jugada del gráfico para verla aquí, con las probabilidades del seleccionador cuando la eligió.'],
    ['No play caller odds for this play. The game decided it by itself (kicks, penalties, sacks, turnovers and forced plays).', 'Esta jugada no tiene probabilidades del seleccionador. El partido la decidió solo (patadas, castigos, capturas, pérdidas y jugadas obligadas).'],
    ["No play in this game carries the play caller's odds.", 'Ninguna jugada de este partido tiene probabilidades del seleccionador.'],
    ['Previous play', 'Jugada anterior'], ['Next play', 'Jugada siguiente'],
    ['The film room opens after the final: every drive on the field and what the play caller chose.', 'La sala de video abre después del final: cada serie en el campo y lo que eligió el seleccionador.'],
    // game view
    ['Close', 'Cerrar'], ['Straight', 'Serio'], ['Fun', 'Divertido'], ['Learn the game', 'Aprende el juego'], ['Game speed', 'Velocidad del partido'],
    ['Announcer style', 'Estilo del narrador'], ['Move around the game', 'Moverse por el partido'], ['Jump to any play', 'Ir a cualquier jugada'],
    ['Next score', 'Siguiente anotación'], ['Next big moment', 'Siguiente gran momento'], ['OK', 'OK'], ['Close the rule card', 'Cerrar la tarjeta de regla'],
    ['The game, seen from above. Sample game with mock data.', 'El partido, visto desde arriba. Partido de muestra con datos inventados.'],
    // rule card titles and my own rule text
    ['Kickoff.', 'Saque inicial.'], ['First down.', 'Primer down.'], ['Downs.', 'Pérdida en downs.'], ['Touchdown.', 'Touchdown.'],
    ['Extra point.', 'Punto extra.'], ['Field goal.', 'Gol de campo.'], ['Punt.', 'Despeje.'], ['Interception.', 'Intercepción.'],
    ['Fumble.', 'Balón suelto.'], ['Sack.', 'Captura.'], ['Penalty.', 'Castigo.'], ['Halftime.', 'Medio tiempo.'],
    ['Play starts with a kickoff: one team kicks the ball deep and the other runs it back.', 'El juego empieza con un saque: un equipo patea el balón lejos y el otro lo devuelve corriendo.'],
    ['The offense has four tries, called downs, to gain 10 yards. Make it and they get four new tries.', 'La ofensiva tiene cuatro intentos, llamados downs, para avanzar 10 yardas. Si lo logra, tiene cuatro intentos nuevos.'],
    ['Four tries and no 10 yards: the other team takes the ball where it stopped. A turnover on downs.', 'Cuatro intentos y no hay 10 yardas: el otro equipo toma el balón donde se detuvo. Una pérdida en downs.'],
    ['Get the ball into the other end zone: 6 points, then a try for 1 more.', 'Lleva el balón a la zona de anotación rival: 6 puntos, y luego un intento por 1 más.'],
    ['After a touchdown, a short kick through the posts adds 1 point.', 'Tras un touchdown, una patada corta entre los postes suma 1 punto.'],
    ['A kick through the posts from the field is worth 3 points.', 'Una patada entre los postes desde el campo vale 3 puntos.'],
    ['On fourth down far from the goal, teams kick the ball away so the other team starts far back.', 'En cuarto down lejos de la meta, los equipos patean el balón para que el rival empiece muy atrás.'],
    ['A defender catches the pass, and the defense takes the ball.', 'Un defensor atrapa el pase y la defensa se queda con el balón.'],
    ['The ball carrier drops the ball. Whoever falls on it keeps it.', 'El portador suelta el balón. Quien caiga sobre él se lo queda.'],
    ['The quarterback is tackled before he can throw. The offense loses yards and a down.', 'Derriban al mariscal antes de que pueda lanzar. La ofensiva pierde yardas y un down.'],
    ['A player broke a rule. A yellow flag, and the ball moves 5 to 15 yards.', 'Un jugador rompió una regla. Pañuelo amarillo, y el balón se mueve de 5 a 15 yardas.'],
    ['The game has two halves. At halftime the teams switch who kicks off.', 'El partido tiene dos mitades. En el medio tiempo los equipos cambian quién patea.'],
    // Noah's rule sentences (FF_ANNOUNCER.explain)
    ['The offense gets four tries, called downs, to move the ball 10 yards. If they make it, that is a first down and they get four new tries.', 'La ofensiva tiene cuatro intentos, llamados downs, para mover el balón 10 yardas. Si lo logra, es un primer down y tiene cuatro intentos nuevos.'],
    ['If the offense does not gain 10 yards in four tries, the other team takes the ball right there. That is a turnover on downs.', 'Si la ofensiva no avanza 10 yardas en cuatro intentos, el otro equipo toma el balón ahí mismo. Es una pérdida en downs.'],
    ["Carry or catch the ball in the other team's end zone for a touchdown. It is worth 6 points, and a try for 1 more follows.", 'Lleva o atrapa el balón en la zona de anotación rival para un touchdown. Vale 6 puntos, y sigue un intento por 1 más.'],
    ['After a touchdown, the kicker tries a short kick between the posts for 1 more point.', 'Tras un touchdown, el pateador intenta una patada corta entre los postes por 1 punto más.'],
    ['The kicker sends the ball between the posts for 3 points. Teams try it when they are close but stuck on fourth down.', 'El pateador manda el balón entre los postes por 3 puntos. Los equipos lo intentan cuando están cerca pero atascados en cuarto down.'],
    ['On fourth down far from the goal, teams usually kick the ball away, so the other team has to start a long way back.', 'En cuarto down lejos de la meta, los equipos suelen patear el balón, así el rival tiene que empezar muy atrás.'],
    ['A defender catches a pass that was meant for the offense. The defending team takes the ball.', 'Un defensor atrapa un pase que era para la ofensiva. El equipo defensor se queda con el balón.'],
    ['A player drops the ball while carrying it. Whoever picks it up keeps it, so the defense can take over.', 'Un jugador suelta el balón mientras lo lleva. Quien lo recoja se lo queda, así que la defensa puede tomarlo.'],
    ['The quarterback is tackled behind the line before throwing. The offense loses yards and uses up a down.', 'Derriban al mariscal detrás de la línea antes de lanzar. La ofensiva pierde yardas y gasta un down.'],
    ['A player broke a rule. The referee throws a yellow flag, and the ball moves back or forward, usually 5 to 15 yards.', 'Un jugador rompió una regla. El árbitro lanza un pañuelo amarillo y el balón se mueve atrás o adelante, por lo general de 5 a 15 yardas.'],
    ['Each half starts with a kickoff, and so does play after every score: one team kicks the ball deep to the other.', 'Cada mitad empieza con un saque, y también el juego tras cada anotación: un equipo patea el balón lejos hacia el otro.'],
    ['A game has two halves. At halftime the teams rest, and the team that received the first kickoff kicks off to start the second.', 'Un partido tiene dos mitades. En el medio tiempo los equipos descansan, y el que recibió el primer saque patea para empezar la segunda.'],
    ['Nobody in this matchup has opted in yet.', 'Nadie en este partido participa todavía.'],
    // watch party
    ['Watch party', 'Fiesta para ver'], ['Join a watch party', 'Unirse a una fiesta para ver'], ['Room code', 'Código de sala'], ['Join', 'Unirse'],
    ['Play', 'Jugar'], ['Hold', 'Pausar'], ['Release', 'Seguir'], ['Not started', 'Sin empezar'], ['Playing', 'Jugando'], ['Between plays', 'Entre jugadas'],
    ['Held', 'En pausa'], ['A room code is four letters.', 'Un código de sala tiene cuatro letras.'],
    ['No room with that code. Check it on the big screen.', 'No hay ninguna sala con ese código. Revísalo en la pantalla grande.'],
    ['The service does not answer.', 'El servicio no responde.'], ['This browser cannot join without the service.', 'Este navegador no puede unirse sin el servicio.'],
    ['Looking for the room on this computer. Phones need the service (?api=).', 'Buscando la sala en esta computadora. Los teléfonos necesitan el servicio (?api=).'],
    ['Tabs on this computer only. Phones need the service (?api=).', 'Solo pestañas de esta computadora. Los teléfonos necesitan el servicio (?api=).'],
    ['Open the app on a phone and join with this code.', 'Abre la app en un teléfono y únete con este código.'],
    ['No relay: this browser cannot link tabs, and there is no service.', 'Sin enlace: este navegador no puede unir pestañas y no hay servicio.'],
    ['Fantasy points so far, on this phone only.', 'Puntos de fantasía hasta ahora, solo en este teléfono.'],
    // share cards (drawn on a canvas)
    ['ON THE FIELD', 'EN EL CAMPO'], ['TOP PERFORMER', 'MEJOR JUGADOR'], ['WIN', 'GANAN'], ['FINAL', 'FINAL'], ['FANTASY POINTS', 'PUNTOS DE FANTASÍA'],
    ['TOP PLAY', 'MEJOR JUGADA'], ['Sample league with mock data. Made with Fantasy Recap.', 'Liga de muestra con datos inventados. Hecho con Fantasy Recap.'],
    ['Sample game. Real names, made-up stats.', 'Partido de muestra. Nombres reales, estadísticas inventadas.'], ['No play moved any points.', 'Ninguna jugada movió puntos.']
  ];

  // The profiles' source line, as data/profiles/*.json give it.
  var SOURCES = {
    "Scout, season 2026 numbers from Sleeper's public stats API, read on 2026-11-14. The address and date of every number are in tendency_sources.":
      'Scout, números de la temporada 2026 de la API pública de estadísticas de Sleeper, leídos el 2026-11-14. La dirección y la fecha de cada número están en tendency_sources.'
  };
  var ORD_ES = { '1st': '1.º', '2nd': '2.º', '3rd': '3.º', '4th': '4.º' };
  function yd(n) { return n + (Math.abs(Number(n)) === 1 ? ' yarda' : ' yardas'); }
  // "1st and 10 at the PYT 24" -> "1.º y 10 en la 24 de PYT"
  function where(s) {
    var m = /^(1st|2nd|3rd|4th) and (goal|\d+) at the (?:([A-Z]{2,4}) )?(\d+)$/.exec(s);
    if (!m) return null;
    return ORD_ES[m[1]] + ' y ' + (m[2] === 'goal' ? 'gol' : m[2]) + ' en la ' + m[4] + (m[3] ? ' de ' + m[3] : '');
  }
  var PEN = { 'False start': 'Salida en falso', 'Holding': 'Sujeción', 'Offside': 'Fuera de lugar', 'Pass interference': 'Interferencia de pase' };
  // A play's description from js/app.js describe(), and its rules.js short form.
  function play(s) {
    var fd = '';
    if (/ First down\.$/.test(s)) { fd = ' Primer down.'; s = s.replace(/ First down\.$/, ''); }
    var m, t = null;
    if ((m = /^(.+) kick off\. (.+) returns it to the ([A-Z]{2,4}) (\d+)\.$/.exec(s))) t = 'Saque de los ' + m[1] + '. ' + m[2] + ' lo devuelve hasta la ' + m[4] + ' de ' + m[3] + '.';
    else if ((m = /^(.+) loses (\d+) yards?\.$/.exec(s))) t = m[1] + ' pierde ' + yd(m[2]) + '.';
    else if ((m = /^(.+) is stopped for no gain\.$/.exec(s))) t = 'Detienen a ' + m[1] + ' sin ganancia.';
    else if ((m = /^(.+) runs for (\d+) yards? and fumbles\. (.+) recover\.$/.exec(s))) t = m[1] + ' corre ' + yd(m[2]) + ' y suelta el balón. Lo recuperan los ' + m[3] + '.';
    else if ((m = /^(.+) runs for (\d+) yards?\.$/.exec(s))) t = m[1] + ' corre ' + yd(m[2]) + '.';
    else if ((m = /^(.+) pass to (.+) falls incomplete\.$/.exec(s))) t = 'Pase de ' + m[1] + ' a ' + m[2] + ', incompleto.';
    else if ((m = /^(.+) to (.+) for (\d+) yards?\.$/.exec(s))) t = m[1] + ' a ' + m[2] + ' por ' + yd(m[3]) + '.';
    else if ((m = /^(.+) sacked by the (.+) defense, loss of (\d+)\.$/.exec(s))) t = 'La defensa de los ' + m[2] + ' captura a ' + m[1] + ', pérdida de ' + m[3] + '.';
    else if ((m = /^(.+) kneels to run out the game\.$/.exec(s))) t = m[1] + ' se arrodilla para agotar el reloj.';
    else if ((m = /^(.+) on the (.+), (\d+) yards?\.( The gain is wiped out\.)?$/.exec(s)) && PEN[m[1]]) t = PEN[m[1]] + ' de los ' + m[2] + ', ' + yd(m[3]) + '.' + (m[4] ? ' Se anula la ganancia.' : '');
    else if ((m = /^(.+) punt, (\d+) yards net\.$/.exec(s))) t = 'Despeje de los ' + m[1] + ', ' + m[2] + ' yardas netas.';
    else if ((m = /^(.+) (\d+) yard field goal is (good|no good)\.$/.exec(s))) t = 'Gol de campo de ' + m[2] + ' yardas de ' + m[1] + (m[3] === 'good' ? ': bueno.' : ': fallado.');
    else if ((m = /^(.+) extra point is (good|no good)\.$/.exec(s))) t = 'Punto extra de ' + m[1] + (m[2] === 'good' ? ': bueno.' : ': fallado.');
    else if ((m = /^(.+) intercepted by the (.+) defense, returned (\d+) yards?\.$/.exec(s))) t = 'La defensa de los ' + m[2] + ' intercepta a ' + m[1] + ' y devuelve ' + yd(m[3]) + '.';
    return t === null ? null : t + fd;
  }
  // The rules engine's short text for a play (js/rules.js r.text), with or without "where: " in
  // front, and with its endings (touchdown, first down, turnover on downs).
  var SUFFIX = { 'touchdown': 'touchdown', 'first down': 'primer down', 'turnover on downs': 'pérdida en downs' };
  function short(s) {
    var full = /^(.+?): (.+)$/.exec(s);
    if (full && where(full[1])) { var rest = short(full[2]); return rest === null ? null : where(full[1]) + ': ' + rest; }
    var x = s.replace(/\.$/, ''), ends = [], mm;
    while ((mm = /, (touchdown|first down|turnover on downs)$/i.exec(x))) { ends.unshift(SUFFIX[mm[1].toLowerCase()]); x = x.slice(0, mm.index); }
    var m, t = null;
    if ((m = /^([A-Z]{2,4}) kicks off, (.+) returns to the ([A-Z]{2,4}) (\d+)$/.exec(x))) t = 'Saque de ' + m[1] + ', ' + m[2] + ' lo devuelve hasta la ' + m[4] + ' de ' + m[3];
    else if ((m = /^Extra point by (.+) is (good|no good)$/.exec(x))) t = 'Punto extra de ' + m[1] + (m[2] === 'good' ? ': bueno' : ': fallado');
    else if ((m = /^(.+) runs for (-?\d+) and fumbles, ([A-Z]{2,4}) recover$/.exec(x))) t = m[1] + ' corre ' + m[2] + ' y suelta el balón, recupera ' + m[3];
    else if ((m = /^(.+) runs for (-?\d+)$/.exec(x))) t = m[1] + ' corre ' + m[2];
    else if ((m = /^(.+) pass to (.+) for (-?\d+)$/.exec(x))) t = 'Pase de ' + m[1] + ' a ' + m[2] + ' por ' + m[3];
    else if ((m = /^(.+) pass to (.+) incomplete$/.exec(x))) t = 'Pase de ' + m[1] + ' a ' + m[2] + ', incompleto';
    else if ((m = /^(.+) sacked for (-?\d+)$/.exec(x))) t = 'Captura a ' + m[1] + ', ' + m[2];
    else if ((m = /^(.+) kneels$/.exec(x))) t = m[1] + ' se arrodilla';
    else if ((m = /^Penalty: (.+), (\d+) yards$/.exec(x))) { var pn = PEN[m[1].charAt(0).toUpperCase() + m[1].slice(1)]; if (pn) t = 'Castigo: ' + pn.toLowerCase() + ', ' + m[2] + ' yardas'; }
    else if ((m = /^Punt, net (\d+)$/.exec(x))) t = 'Despeje, neto ' + m[1];
    else if ((m = /^(.+) (\d+) yard field goal is (good|no good)$/.exec(x))) t = 'Gol de campo de ' + m[2] + ' yardas de ' + m[1] + (m[3] === 'good' ? ': bueno' : ': fallado');
    else if ((m = /^(.+) intercepted, returned (\d+)$/.exec(x))) t = 'Intercepción a ' + m[1] + ', devuelta ' + m[2];
    if (t === null) return null;
    return t + ends.map(function (e) { return ', ' + e; }).join('') + (/\.$/.test(s) ? '.' : '');
  }
  var TENDENCY = { 'deep ball rate': 'tasa de pase largo', 'short pass rate': 'tasa de pase corto', 'scramble rate': 'tasa de escapadas', 'run share': 'parte de carreras',
    'pass catching': 'recepción de pases', 'red zone use': 'uso en zona roja', 'catch rate': 'tasa de recepción', 'long kick share': 'parte de patadas largas', 'accuracy': 'precisión' };
  function stat(part) {
    var m;
    if ((m = /^(\d+) of (\d+)$/.exec(part))) return m[1] + ' de ' + m[2];
    if ((m = /^(\d+) of (\d+) (FG|XP)$/.exec(part))) return m[1] + ' de ' + m[2] + (m[3] === 'FG' ? ' GC' : ' PE');
    if ((m = /^(-?\d+) yds$/.exec(part))) return m[1] + ' yds';
    if ((m = /^(\d+) car$/.exec(part))) return m[1] + ' acarreos';
    if ((m = /^(\d+) rec$/.exec(part))) return m[1] + ' recepciones';
    if ((m = /^(\d+) TD$/.exec(part))) return m[1] + ' TD';
    if ((m = /^(\d+) INT$/.exec(part))) return m[1] + ' INT';
    if ((m = /^(\d+) FUM$/.exec(part))) return m[1] + ' BS';
    if ((m = /^(\d+) sacks?$/.exec(part))) return m[1] + (m[1] === '1' ? ' captura' : ' capturas');
    if ((m = /^(\d+) fumble rec$/.exec(part))) return m[1] + ' balón recuperado';
    if (/^[A-Z]{2,4}$/.test(part)) return part;
    return null;
  }
  var PATTERNS = [
    [/^Week (\d+)$/, function (m) { return 'Semana ' + m[1]; }],
    [/^Week (\d+), now$/, function (m) { return 'Semana ' + m[1] + ', actual'; }],
    [/^Week (\d+) matchups$/, function (m) { return 'Partidos de la semana ' + m[1]; }],
    [/^Week (\d+) matchup$/, function (m) { return 'Partido de la semana ' + m[1]; }],
    [/^Week (\d+) result$/, function (m) { return 'Resultado de la semana ' + m[1]; }],
    [/^Week (\d+), final$/, function (m) { return 'Semana ' + m[1] + ', final'; }],
    [/^Week (\d+), biggest plays$/, function (m) { return 'Semana ' + m[1] + ', las mejores jugadas'; }],
    [/^WEEK (\d+) RESULT$/, function (m) { return 'RESULTADO DE LA SEMANA ' + m[1]; }],
    [/^WEEK (\d+), TOP PLAY$/, function (m) { return 'SEMANA ' + m[1] + ', MEJOR JUGADA'; }],
    [/^(\d+) matchups, (\d+) teams$/, function (m) { return m[1] + ' partidos, ' + m[2] + ' equipos'; }],
    [/^after (\d+) weeks?$/, function (m) { return 'tras ' + m[1] + (m[1] === '1' ? ' semana' : ' semanas'); }],
    [/^No game file for week (\d+)\. Only the final scores were kept\.$/, function (m) { return 'No hay archivo de partido de la semana ' + m[1] + '. Solo se guardaron los marcadores finales.'; }],
    [/^(\d+) of (\d+)$/, function (m) { return m[1] + ' de ' + m[2]; }],
    [/^Play (\d+)$/, function (m) { return 'Jugada ' + m[1]; }],
    [/^Play (\d+) of (\d+)$/, function (m) { return 'Jugada ' + m[1] + ' de ' + m[2]; }],
    [/^Play (\d+) of (\d+): (.+)$/, function (m) { var w = tr(m[3]); return 'Jugada ' + m[1] + ' de ' + m[2] + ': ' + w; }],
    [/^Play (\d+), play caller odds$/, function (m) { return 'Jugada ' + m[1] + ', probabilidades del seleccionador'; }],
    [/^(\d+) of (\d+) plays$/, function (m) { return m[1] + ' de ' + m[2] + ' jugadas'; }],
    [/^of (\d+) plays$/, function (m) { return 'de ' + m[1] + ' jugadas'; }],
    [/^(\d+) of (\d+) plays so far$/, function (m) { return m[1] + ' de ' + m[2] + ' jugadas hasta ahora'; }],
    [/^Paused, (.+)$/, function (m) { return 'En pausa, ' + tr(m[1]); }],
    [/^Paused before the first play\. Keep watching to see it\.$/, function () { return 'En pausa antes de la primera jugada. Sigue viendo para verla.'; }],
    [/^(.+) attack this way →$/, function (m) { return 'Los ' + m[1] + ' atacan hacia aquí →'; }],
    [/^(.+) against (.+)$/, function (m) { return m[1] + ' contra ' + m[2]; }],
    [/^Pass to (.+), (\d+%)$/, function (m) { return 'Pase a ' + m[1] + ', ' + m[2]; }],
    [/^Run by (.+), (\d+%)$/, function (m) { return 'Carrera de ' + m[1] + ', ' + m[2]; }],
    [/^Pass to (.+)$/, function (m) { return 'Pase a ' + m[1]; }],
    [/^Run by (.+)$/, function (m) { return 'Carrera de ' + m[1]; }],
    [/^(\d+) for (\d+)$/, function (m) { return m[1] + ' por ' + m[2]; }],
    [/^Q(\d) (\d+:\d\d)$/, function (m) { return 'C' + m[1] + ' ' + m[2]; }],
    [/^Q(\d) (\d+:\d\d), ([\d.]+) pts$/, function (m) { return 'C' + m[1] + ' ' + m[2] + ', ' + m[3] + ' pts'; }],
    [/^TOP PLAY, Q(\d) (\d+:\d\d), ([A-Z]{2,4})$/, function (m) { return 'MEJOR JUGADA, C' + m[1] + ' ' + m[2] + ', ' + m[3]; }],
    [/^(.+) \(you\)$/, function (m) { return m[1] + ' (tú)'; }],
    [/^(.+), yours$/, function (m) { return m[1] + ', el tuyo'; }],
    [/^(.+) \(YOU\), FANTASY PTS$/, function (m) { return m[1] + ' (TÚ), PTS DE FANTASÍA'; }],
    [/^(.+), FANTASY PTS$/, function (m) { return m[1] + ', PTS DE FANTASÍA'; }],
    [/^Saved to the league\. Opted in: (.+)\.$/, function (m) { return 'Guardado en la liga. Participan: ' + m[1] + '.'; }],
    [/^Recent form: (.+)$/, function (m) { return 'Forma reciente: ' + (SOURCES[m[1]] || m[1]); }],
    [/^(.+?) ([\d.]+) over (weeks [\d, ]+|recent weeks), ([\d.]+) on the season$/, function (m) {
      if (!TENDENCY[m[1]]) return null;
      return TENDENCY[m[1]] + ' ' + m[2] + ' en ' + (m[3] === 'recent weeks' ? 'las últimas semanas' : m[3].replace('weeks', 'las semanas')) + ', ' + m[4] + ' en la temporada';
    }],
    [/^Rule: (.+)$/, function (m) { return 'Regla: ' + tr(m[1]); }],
    [/^Opted in, in the league: (.+)$/, function (m) { return 'Participan, en la liga: ' + m[1]; }],
    [/^Connected to room ([A-Z]{4})( on this computer)?\.$/, function (m) { return 'Conectado a la sala ' + m[1] + (m[2] ? ' en esta computadora' : '') + '.'; }]
  ];

  var ES = {};
  TABLE.forEach(function (p) { ES[p[0]] = p[1]; });
  var lang = 'en';
  try { lang = window.localStorage.getItem('fr.lang') === 'es' ? 'es' : 'en'; } catch (err) { lang = 'en'; }

  // Translate one string to Spanish, or give it back as it is when nothing matches.
  function tr(s) {
    if (lang !== 'es' || s == null) return s;
    var raw = String(s), lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0], t = raw.trim();
    if (!t) return raw;
    if (Object.prototype.hasOwnProperty.call(ES, t)) return lead + ES[t] + trail;
    var w = where(t);
    if (w) return lead + w + trail;
    var pl = play(t) || short(t);
    if (pl) return lead + pl + trail;
    // A stat line: "10 of 21, 136 yds, 1 TD"
    if (/,/.test(t) || /^\d/.test(t)) {
      var parts = t.split(', '), outp = parts.map(stat);
      if (outp.every(function (x) { return x !== null; })) return lead + outp.join(', ') + trail;
    }
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = PATTERNS[i][0].exec(t);
      if (m) { var r = PATTERNS[i][1](m); if (r != null) return lead + r + trail; }
    }
    return raw;
  }

  // ------------------------------------------------- translating the page
  var ATTRS = ['aria-label', 'title', 'aria-valuetext', 'alt'];
  var origText = new WeakMap(), origAttr = new WeakMap();
  function skip(el) { return !el || !!(el.closest && el.closest('.captions, script, style, [data-i18n-skip]')); }
  function doText(n) {
    if (skip(n.parentElement)) return;
    var cur = n.nodeValue;
    var en = origText.has(n) && origText.get(n).es === cur ? origText.get(n).en : cur;
    var out = lang === 'es' ? tr(en) : en;
    if (out !== cur) { origText.set(n, { en: en, es: out }); n.nodeValue = out; }
    else if (lang === 'es') origText.set(n, { en: en, es: out });
  }
  function doAttrs(el) {
    if (skip(el)) return;
    var store = origAttr.get(el) || {};
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var cur = el.getAttribute(a), rec = store[a], en = rec && rec.es === cur ? rec.en : cur;
      var out = lang === 'es' ? tr(en) : en;
      store[a] = { en: en, es: out };
      if (out !== cur) el.setAttribute(a, out);
    });
    origAttr.set(el, store);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    doAttrs(root);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    var n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  var busy = false;
  var mo = new MutationObserver(function (list) {
    if (busy) return;
    busy = true;
    try {
      list.forEach(function (r) {
        if (r.type === 'characterData') doText(r.target);
        else if (r.type === 'attributes') doAttrs(r.target);
        else r.addedNodes.forEach(walk);
      });
    } finally { busy = false; }
  });
  function start() {
    walk(document.body);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.documentElement.lang = lang;
    document.documentElement.classList.remove('i18n-wait');
  }

  function setLang(l) {
    lang = l === 'es' ? 'es' : 'en';
    try { window.localStorage.setItem('fr.lang', lang); } catch (err) { /* storage may be off */ }
    document.documentElement.lang = lang;
    var A = window.FF_ANNOUNCER;
    if (A) { if (typeof A.setLang === 'function') { try { A.setLang(lang); } catch (err) { /* optional */ } } else A.lang = lang; }
    busy = true;
    try { walk(document.body); } finally { busy = false; }
    if (window.FR_I18N.onchange) window.FR_I18N.onchange(lang);
  }

  window.FR_I18N = { tr: tr, setLang: setLang, get lang() { return lang; }, table: TABLE, onchange: null };
  var A0 = window.FF_ANNOUNCER;
  if (A0 && lang === 'es') { if (typeof A0.setLang === 'function') { try { A0.setLang('es'); } catch (err) { /* optional */ } } else A0.lang = 'es'; }
  start();
})();
