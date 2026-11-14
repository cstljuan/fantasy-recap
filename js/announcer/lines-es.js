// Spanish lines for the football announcer (FF_ANNOUNCER.lang = 'es'), written the way a
// Spanish language NFL broadcast talks. Same kinds and placeholders as lines.js and the tables
// in index.js; index.js falls back to English for anything missing here, and to the Spanish
// straight lines when a Spanish fun line is missing. Play lines fit maxLength (56) with the
// longest names in the data. Team names stay as they are, with "los": "los Goblins".
(function (root) {
  'use strict';

  var ES = {
    // ---- Play lines (same kinds as lines.js) ----
    lines: {
      kickoff: {
        straight: ["Patada inicial. {player} la regresa hasta la {spot}.", "Sale la patada. {player} la devuelve a la {spot}.", "Alta y profunda. {player} hasta la {spot}."],
        fun: ["¡Arriba el balón! {player} lo trae hasta la {spot}.", "¡{player} recibe y corre hasta la {spot}!", "¡Patadón! {player} lo regresa a la {spot}."]
      },
      touchdown_run: {
        straight: ["¡{player} entra desde la {yds}! ¡Touchdown {team}!", "¡{player} la mete corriendo! ¡Touchdown!", "{player}, {yards}... ¡y adentro! ¡Touchdown!"],
        fun: ["¡Se va {player}! ¡{yds} yardas a la zona de anotación!", "¡Imparable! ¡Touchdown de {player}!", "¡{player} rompe y anota! ¡Touchdown {team}!"]
      },
      touchdown_pass: {
        straight: ["{qb} lanza... ¡atrapada! ¡Touchdown {team}!", "¡{qb} encuentra a {player}! ¡Touchdown!", "¡{player} sube y la atrapa! ¡Seis para los {team}!"],
        fun: ["¡Bombazo de {qb} y {player} la caza! ¡Touchdown!", "¡{qb} con {player}! ¡A la zona de anotación!", "¡Qué recepción de {player}! ¡Touchdown!"]
      },
      xp_good: {
        straight: ["{kicker} convierte el extra. {score}.", "Bueno el punto extra. {score}.", "{kicker} no falla. Los {team} suman {teamscore}."],
        fun: ["¡{kicker} la manda por el centro! Punto extra.", "¡Automático! {kicker} suma uno más.", "Punto extra bueno. ¡{kicker} no perdona!"]
      },
      xp_miss: {
        straight: ["¡{kicker} lo falla! No es bueno el punto extra.", "Punto extra... ¡no es bueno! Eso puede doler.", "¡{kicker} falla el extra! Siguen con {teamscore}."],
        fun: ["¡Uy, {kicker}! ¡Se le va el fácil!", "¡Al poste! {kicker} deja ir el punto extra.", "¡Desviado! {kicker} no lo puede creer."]
      },
      fg_good: {
        straight: ["{kicker} desde {dist}... ¡es bueno! {score}.", "Gol de campo de {dist} yardas. ¡Es bueno!", "Centro, sostiene, patea... ¡bueno desde {dist}!"],
        fun: ["¡{kicker} desde {dist} y adentro! ¡Tres puntos!", "¡Entre los postes! {kicker} desde {dist}!", "¡Qué pierna! {kicker} acierta desde {dist}!"]
      },
      fg_miss: {
        straight: ["{kicker} desde {dist}... ¡desviado! No es bueno.", "El intento de {dist} yardas... ¡no es bueno!", "¡{kicker} lo falla desde {dist}! {score}."],
        fun: ["¡Afuera! {kicker} falla desde {dist}.", "¡Desviadísimo! El de {dist} no entra.", "¡Casi! {kicker} falla desde {dist}."]
      },
      interception: {
        straight: ["{qb} lanza... ¡intercepción! Balón para {def}.", "¡Interceptan a {qb}! Balón de los {def}.", "Pase al aire... ¡interceptado por los {def}!"],
        fun: ["¡Se la roban! ¡Intercepción de los {def}!", "¡{qb} se la entrega al rival! ¡Intercepción!", "¡Ladrones! ¡Los {def} se quedan con el balón!"]
      },
      fumble: {
        straight: ["¡Balón suelto! {player} lo pierde. Balón {def}.", "¡Fumble de {player}! Recuperan los {def}.", "¡Se le cae a {player}! Los {def} lo recuperan."],
        fun: ["¡Balón suelto! ¡Y los {def} se lanzan encima!", "¡{player} lo suelta! ¡Balón de los {def}!", "¡Manos de mantequilla! ¡Los {def} recuperan!"]
      },
      sack: {
        straight: ["¡Captura sobre {qb}! Pierden {loss} yardas.", "{qb} no tiene salida... ¡captura! Menos {loss}.", "¡Llega la presión! Captura a {qb}, menos {loss}."],
        fun: ["¡Al suelo {qb}! ¡Los {def} llegan a tiempo!", "¡Captura! {qb} pierde {loss} yardas.", "¡Pum! Los {def} tumban a {qb}."]
      },
      big_gain: {
        straight: ["¡{player} se escapa! ¡Sigue corriendo! {yds} yardas.", "¡{player} encuentra espacio! {yds} yardas.", "¡Jugadón! {player} gana {yds} yardas."],
        fun: ["¡Se va {player}! ¡{yds} yardas de pura velocidad!", "¡Miren a {player}! ¡{yds} yardas!", "¡Jugada grande de los {team}! {player}, {yds}!"]
      },
      first_down: {
        straight: ["{player} gana {yards} y consigue el primero.", "{player} avanza {yards}. Primero y diez.", "Primero y diez para los {team}. {player}, {yards}.",
                   "{player} empuja por {yards}. ¡Primero!", "{player}, {yards}, y mueve las cadenas.", "Se mueven las cadenas: {player}, {yards}.", "{player} consigue el primero con {yards}."],
        fun: ["¡{player} mueve las cadenas! ¡Primero!", "¡{yards} de {player} y primero y diez!", "¡Seguimos! {player} consigue el primero.",
              "¡Primero y diez cortesía de {player}!", "¡Las cadenas avanzan! Gracias, {player}.", "¡{player} lo logra! Primero.", "¡{player} da nueva vida a los {team}!"]
      },
      gain: {
        straight: ["{player} gana {yards}.", "{player} avanza {yards} en la jugada.", "{player} consigue {yards} antes del tacleo.",
                   "Ganancia de {yards} para {player}.", "{player}, {yards} más.", "{yards} en la jugada de {player}.", "{player} avanza {yards}."],
        fun: ["{player} pelea {yards}. ¡Cada yarda cuenta!", "Buen trabajo de {player}, {yards} más.", "{player} suma {yards} en esa.",
              "Poco a poco: {yards} para {player}.", "{player} toma lo que hay, {yards}.", "Nada lujoso: {yards} para {player}.", "{player} gana {yards} a la fuerza."]
      },
      no_gain: {
        straight: ["¡Detienen a {player} en la línea! Sin ganancia.", "{player} no encuentra espacio. Sin ganancia.", "{player} choca con un muro. Nada."],
        fun: ["¡Frenan en seco a {player}!", "¡No hoy, {player}! Los {def} cierran.", "{player} solo encuentra tráfico."]
      },
      incomplete: {
        straight: ["{qb} lanza para {player}... incompleto.", "Pase para {player}, ¡desviado!", "{player} no la puede retener. Incompleto.",
                   "Incompleto, el objetivo era {player}.", "{qb} no conecta con {player}. Incompleto.", "Pase incompleto para {player}.", "¡Bateado! Incompleto para {player}."],
        fun: ["{qb} busca a {player}... ¡por la punta!", "Al pasto. ¡No había nadie!", "Cerca, pero {player} no la atrapa.",
              "¡Se le va a {qb}!", "¡Casi, {player}! Incompleto.", "{qb} y {player} no se entienden.", "Al césped. Otra vez, {qb}."]
      },
      pen_false_start: {
        straight: ["Bandera antes del centro. Salida en falso, {team}.", "Alguien se movió antes. Salida en falso.", "Salida en falso de los {team}, {pen} yardas."],
        fun: ["¡Muy nerviosos! Salida en falso de los {team}.", "¡Se adelantaron! Atrás {pen} yardas.", "¡Ansiedad! Salida en falso."]
      },
      pen_holding: {
        straight: ["¡Bandera! Sujeción de los {team}. {pen} yardas.", "Castigo: sujeción a la ofensiva, {pen} yardas.", "Sujeción, {team}. Les cuesta {pen} yardas."],
        fun: ["¡Suelta la camiseta! Sujeción, {pen} yardas.", "¡El árbitro lo vio! Sujeción de los {team}.", "¡Eso no es bloquear! Sujeción."]
      },
      pen_offside: {
        straight: ["¡Bandera! Fuera de lugar de los {def}, {pen} yardas.", "La defensa se adelantó. Fuera de lugar.", "Fuera de lugar, {def}. Los {team} avanzan {pen}."],
        fun: ["¡Muy ansiosos, {def}! {pen} yardas regaladas.", "¡Los {def} se adelantan! Fuera de lugar.", "¡Paciencia, {def}! Fuera de lugar."]
      },
      pen_dpi: {
        straight: ["¡Bandera! Interferencia de pase de los {def}.", "Contacto y bandera: interferencia, {pen} yardas.", "¡Interferencia! Gran ganancia para los {team}."],
        fun: ["¡Bandera! ¡Eso fue un abrazo!", "¡Eso no se hace, {def}! {pen} yardas.", "¡Demasiado contacto! Regalo de {pen} yardas."]
      },
      punt: {
        straight: ["Los {team} despejan. {net} yardas netas, balón {def}.", "Despeje alto de {net} yardas. Toman los {def}.", "Cuarta oportunidad y despejan los {team}."],
        fun: ["¡Patadón de {net} yardas! Los {def} empiezan lejos.", "¡Al despeje! Eso voltea el campo.", "¡Allá va! Despeje de {net} yardas."]
      },
      downs: {
        straight: ["¡Cuarta oportunidad... y los detienen! Balón {def}.", "Los {team} se quedan cortos en cuarta.", "¡Gran parada de los {def}! Pierden por downs."],
        fun: ["¡Se la jugaron y... NO! Balón de los {def}.", "¡Falla la apuesta en cuarta! Balón {def}.", "¡La defensa aguanta! Pierden por downs."]
      },
      kneel: {
        straight: ["{qb} se arrodilla para correr el reloj.", "Los {team} se arrodillan.", "{qb} se arrodilla y deja correr el tiempo."],
        fun: ["¡Formación de la victoria! {qb} se arrodilla.", "Sin lujos: {qb} se arrodilla.", "Rodilla al piso, {qb}. El reloj es amigo."]
      },
      half: {
        straight: ["Y llegamos al medio tiempo. {score}.", "Medio tiempo, y va {score}.", "Final de la primera mitad. {score}."],
        fun: ["¡Medio tiempo! {score}.", "¡A descansar! {score}.", "¡Se acaba la primera mitad! {score}."]
      },
      final: {
        straight: ["¡Se acabó! Ganan los {winner}, {score}.", "¡Final! Los {winner} se llevan el triunfo.", "¡Termina el partido! {score}."],
        fun: ["¡Fin del juego! ¡Ganan los {winner}!", "¡Para el libro! {winner} ganan, {score}.", "¡Eso es todo! ¡Victoria de los {winner}!"]
      },
      final_tie: {
        straight: ["Termina empatado. {score}.", "¡Se acabó, y es empate! {score}.", "Igualados al final. {score}."],
        fun: ["¡Empate al final! {score}.", "¡Nadie gana! Empate, {score}.", "¡Empate! Medio trofeo para cada uno."]
      }
    },

    // ---- Intro, halftime, wrap ----
    stories: {
      intro: {
        straight: ["Bienvenidos. Son los {t0} contra los {t1}. Atentos a {w0} por los {t0} y a {w1} por los {t1}.",
                   "Los {t0} y los {t1}, allá vamos. Los {t0} confían en {w0}. Los {t1} necesitan a {w1}.",
                   "Buenas tardes. {t0} contra {t1}. Las claves: {w0} por los {t0}, {w1} por los {t1}."],
        fun: ["¡Abróchense los cinturones! {t0} contra {t1}. ¡Si {w0} se enciende, cuidado! Y los {t1} tienen a {w1}.",
              "¡Bienvenidos al show! {t0} y {t1}, ¡vamos! Ojo con {w0} y {w1}.",
              "¡Día de partido! {t0} contra {t1}. ¡{w0} y {w1}, el escenario es suyo!"]
      },
      halftime: {
        straight: ["Medio tiempo, y va {score}. En puntos de fantasía manda {leader} con {lpts}.",
                   "Llegamos al descanso con {score}. El mejor hasta ahora es {leader}, {lpts} puntos de fantasía.",
                   "Medio tiempo: {score}. {leader} lidera la fantasía con {lpts}. {lead}"],
        fun: ["¡Medio tiempo! Va {score}, ¡y {leader} ya tiene {lpts} puntos!",
              "¡Dos cuartos jugados! {score}. ¡{leader} es el MVP de fantasía con {lpts}!",
              "¡A por algo de comer! {score} al descanso, y {leader} ya suma {lpts} puntos de fantasía."]
      },
      halftime_hidden: {
        straight: ["Medio tiempo, y va {score}. {leader} ha estado en todas partes.", "Medio tiempo, {score}. {lead}", "Llegamos al descanso, {score}. Atentos a {leader}."],
        fun: ["¡Medio tiempo! Va {score}, ¡y {leader} está dando show!", "¡Dos cuartos! {score}. ¡{leader} no para!", "¡A descansar! {score}. {lead}"]
      },
      wrap: {
        straight: ["Marcador final, {score}. La jugada que lo decidió: {decider}. El mejor, {leader} con {lpts} puntos de fantasía.",
                   "Se acabó, {score}. {decider} marcó la diferencia. {leader} lideró a todos con {lpts}.",
                   "Termina {score}. Los {winner} lo ganaron con {decider}. {leader} tuvo el mejor día, {lpts} puntos de fantasía."],
        fun: ["¡Fin del juego, {score}! La puñalada: {decider}. ¡Y {leader} se va con {lpts} puntos!",
              "¡Eso es todo, {score}! {decider} lo ganó. ¡Saludos a {leader}, {lpts} puntos!",
              "¡Para el libro! {score}. {decider} lo selló, ¡y {leader} fue imparable con {lpts}!"]
      },
      wrap_tie: {
        straight: ["Termina empatado, {score}. El mejor, {leader} con {lpts} puntos de fantasía.", "Empate a {score}. {leader} lideró a todos con {lpts}.", "Final {score}, nadie gana. {leader} tuvo el mejor día con {lpts}."],
        fun: ["¡Empate! {score}. ¡{leader} igual sumó {lpts}!", "¡Nadie parpadea! {score}. ¡Al menos {leader} hizo {lpts}!", "¡Igualados a {score}! ¡{leader} se lleva {lpts} puntos!"]
      }
    },

    // ---- Memory lines (C11) ----
    memory: {
      lead_change: {
        straight: ["¡{how} de los {team}, y toman la ventaja!", "¡{how}! Cambia el liderato. Adelante los {team}.", "¡{how}, y los {team} vuelven al frente!"],
        fun: ["¡Vuelta al guion! {how}, ¡y ganan los {team}!", "¡Nuevo líder! ¡Arriba los {team}!", "¡Miren quién va ganando! {how}, {team}."]
      },
      go_ahead: {
        straight: ["¡{how}, y los {team} se ponen adelante!", "{how} de los {team}. Rompen el empate.", "¡{how}! Ahora mandan los {team}."],
        fun: ["¡Se rompe el empate! {how}, {team}.", "¡Los {team} se adelantan! {score}.", "¡Ya no hay empate! {how}, {team}."]
      },
      answer: {
        straight: ["¡{how}, y los {team} responden de inmediato!", "¡Responden los {team}! {how}.", "¡Golpe por golpe! {how}, {team}."],
        fun: ["¡Lo que tú hagas! ¡Responden los {team}!", "¡Ojo por ojo! {how}, {team}.", "¡Los {team} devuelven el golpe! {how}."]
      },
      rz_empty: {
        straight: ["¡{what}! Zona roja y sin puntos.", "¡{what}! Los {team} se van en blanco.", "¡{what}! Nada desde la zona roja."],
        fun: ["¡{what}! ¡Tanto trabajo y nada!", "¡{what}! Los {def} aguantan.", "¡{what}! Zona roja, cero puntos."]
      },
      kicker_again: {
        straight: ["{kicker} desde {dist}, ¡bueno! {made} de {att} hoy.", "¡Otra vez! {kicker} va {made} de {att}.", "{kicker} acierta de nuevo desde {dist}."],
        fun: ["¡Automático! {kicker} va {made} de {att}.", "¡{kicker} otra vez! ¡Qué pierna!", "¡{kicker} no falla hoy! {made} de {att}."]
      },
      hundred: {
        straight: ["{player}, {yards}, y ya pasa las 100 yardas.", "¡{player} otra vez! Más de 100 yardas hoy.", "{player}, {yards}. Lleva {total} en el día."],
        fun: ["¡{player} llega a tres cifras! {total} yardas.", "¡Cien yardas y contando para {player}!", "¡Día enorme de {player}! {total} yardas."]
      },
      third_catch: {
        straight: ["¡{player} otra vez! Tercera recepción en la serie.", "{qb} sigue buscando a {player}. Van tres.", "{player}, {yards}, tercera atrapada de la serie."],
        fun: ["¡Imparable {player}! ¡Tres en esta serie!", "¡{qb} tiene favorito! ¡{player} otra vez!", "¡Triplete! Tercera recepción de {player}."]
      },
      need_answer: {
        straight: ["Los {team} necesitan responder. {player} a la {spot}.", "Abajo por {diff}, los {team} necesitan reaccionar.", "Les toca, {team}. {player} regresa la patada."],
        fun: ["¡Hora de responder, {team}! {player} a la {spot}.", "¡Abajo por {diff}! ¡A ver qué traen los {team}!", "¡Hay que responder, {team}!"]
      },
      rz_enter: {
        straight: ["{player}, {yards}. ¡Los {team} en zona roja!", "¡Dentro de las veinte! {player}, {yards}.", "{player} mete a los {team} en zona roja."],
        fun: ["¡Zona roja! {player} los deja cerca.", "¡Toc toc! Los {team} tocan la puerta.", "¡{player}, {yards}! ¡Huele a anotación!"]
      },
      near_hundred: {
        straight: ["{player}, {yards}. Lleva {total} yardas hoy.", "{player} otra vez, ya suma {total} yardas.", "{player} está en {total} yardas."],
        fun: ["¡{player} va por {total}! ¿Llegarán las 100?", "¡{total} yardas para {player}! ¡Sigan dándosela!", "¡{player} se acerca a 100! Lleva {total}."]
      }
    },

    // ---- Tendency remarks (C6) and hot and cold (C16) ----
    tendency: {
      deep_ball: { high: ["A {name} le encanta el pase largo.", "Clásico de {name}, buscando profundo.", "Eso es lo que mejor hace {name}."],
                   low: ["No es común que {name} tire así de largo.", "Un pase largo raro de {name}.", "{name} no suele buscar tan profundo."] },
      short_pass: { high: ["Corto y rápido, como le gusta a {name}.", "Así es {name}, el pase seguro.", "Pan de cada día para {name}."],
                    low: ["Un pase corto, poco usual en {name}.", "No es lo de {name} conformarse.", "Raro ver a {name} tan conservador."] },
      scramble: { high: ["{name} en movimiento otra vez.", "Nadie extiende jugadas como {name}.", "Eso hace {name}: arranca y corre."],
                  low: ["{name} corriendo, eso no se ve seguido.", "Una carrera rara de {name}.", "{name} sale corriendo, poco común."] },
      run_share: { high: ["La ofensiva pasa por {name}.", "Siguen alimentando a {name}.", "{name} es el motor del juego terrestre."],
                   low: ["Un acarreo para {name}, poco usual.", "Raro ver a {name} con el balón.", "{name} no recibe muchas de esas."] },
      target_share: { high: ["{name} es el objetivo favorito.", "¿A quién más? A {name}.", "El receptor de confianza, {name}."],
                      low: ["No es común que vaya para {name}.", "Un objetivo raro: {name}.", "{name} no recibe muchos de esos."] },
      catch_rate: { high: ["Manos seguras las de {name}.", "{name} lo atrapa todo.", "A {name} casi nunca se le cae."],
                    low: ["Buenas manos esta vez de {name}.", "{name} la retiene esta vez.", "Buena atrapada de {name}."] },
      pass_catching: { high: ["{name} es un peligro saliendo del backfield.", "Les encanta lanzarle a {name}.", "{name} atrapa como un receptor."],
                       low: ["Una recepción rara para {name}.", "No es común que le lancen a {name}.", "{name} con una atrapada, poco usual."] },
      red_zone_use: { high: ["Cerca de la meta, buscan a {name}.", "{name} es el arma en zona roja.", "Dentro de las veinte, toca {name}."],
                      low: ["Sorpresa cerca de la meta: {name}.", "No suele ser {name} aquí.", "{name} en zona roja, eso es nuevo."] },
      kicker_range: { high: ["De esa distancia, {name} es de los mejores.", "{name} tiene pierna para eso.", "La distancia no asusta a {name}."],
                      low: ["Eso es lejos para {name}.", "Probando el alcance de {name}.", "Una distancia poco usual para {name}."] }
    },
    form: {
      hot: { form: ["Momento caliente para {name}.", "{name} está en racha.", "Racha caliente de {name}."] },
      cold: { form: ["{name} necesitaba esa.", "{name} venía sin brillo.", "Poco visto últimamente en {name}."] }
    },

    // ---- The big call (C18) ----
    big: {
      td_pass: { straight: ["{qb} retrocede, encuentra a {player} por {yds} yardas, ¡y es touchdown!", "{qb} la suelta, {player} la atrapa, ¡{yds} yardas y adentro!", "¡Touchdown! {qb} con {player}, {yds} yardas."] },
      td_run: { straight: ["¡{player} corre {yds} yardas hasta la zona de anotación!", "¡{player} entra desde {yds} yardas! ¡Touchdown!", "Entrega a {player}, {yds} yardas, ¡y es touchdown!"] },
      int: { straight: ["¡{qb} lanza y la interceptan! Los {def} la regresan {ret} yardas.", "¡Interceptado! El pase de {qb} es de los {def}.", "{qb} la fuerza, ¡y los {def} se quedan con la intercepción!"] },
      fumble: { straight: ["{player} gana {yds}, pero se le cae el balón, ¡y recuperan los {def}!", "¡Fumble! {player} la pierde y el balón es de los {def}.", "¡Le arrancan el balón a {player}! ¡Los {def} se lanzan encima!"] },
      downs: { straight: ["Cuarta oportunidad, ¡y la defensa de los {def} frena en seco a los {team}!", "Los {team} se la juegan en cuarta, ¡y se quedan cortos!", "¡Detenidos en cuarta! Toman los {def}."] },
      big: { straight: ["¡{player} se escapa por {yds} yardas!", "Jugada grande: ¡{player} por {yds} yardas!", "¡{player} encuentra espacio y se va {yds} yardas!"] },
      big_pass: { straight: ["¡{qb} con {player}, ganancia de {yds} yardas!", "¡{qb} encuentra a {player} por {yds} yardas!", "Uno profundo, {qb} con {player}, {yds} yardas."] }
    },

    // ---- The spoken recap (C26) ----
    recap: {
      final: { straight: ["Final: {winner} {w}, {loser} {l}.", "Los {winner} vencieron a los {loser}, {w} a {l}.", "Terminó {winner} {w}, {loser} {l}."] },
      final_tie: { straight: ["Terminó empatado, {w} a {l}.", "Empate, {w} a {w}.", "Nadie ganó: {w} a {l}."] },
      decider: { straight: ["Los {team} se pusieron adelante para siempre en el {qth} cuarto, a los {clock}, con {s}.", "La jugada decisiva llegó en el {qth} cuarto, a los {clock}: {s}, y los {team} no miraron atrás.", "Desde los {clock} del {qth} cuarto, con {s}, los {team} ya no perdieron la ventaja."] },
      one_lead: { straight: ["Los {team} anotaron primero y nunca estuvieron abajo.", "Los {team} mandaron desde su primera anotación hasta el final.", "Cuando anotaron los {team}, ya no soltaron la ventaja."] },
      many_leads: { straight: ["El liderato cambió de manos {n} veces.", "Hubo {n} cambios de liderato.", "La ventaja fue y vino {n} veces."] },
      drive: { straight: ["La serie más larga fue de los {team}: {plays} jugadas y {yards} yardas, terminando en {result}.", "Los {team} armaron la serie más larga, {plays} jugadas y {yards} yardas, con {result}.", "Serie más larga: los {team}, {plays} jugadas, {yards} yardas, terminando en {result}."] },
      swing: { straight: ["El mayor vuelco llegó en el {qth} cuarto: {fp} puntos de fantasía de ventaja para los {team}.", "En el {qth} cuarto los {team} sacaron {fp} puntos de fantasía de ventaja.", "El impulso se inclinó más en el {qth} cuarto, {fp} puntos de fantasía para los {team}."] },
      best: { straight: ["Mejores en fantasía: {a} con {pa} por los {ta}, y {b} con {pb} por los {tb}.", "Los mejores de cada lado: {a}, {pa} puntos, y {b}, {pb}.", "{a} lideró a los {ta} con {pa} puntos de fantasía; {b} a los {tb} con {pb}."] }
    },

    // ---- Rule explainers (C14) ----
    explain: {
      first_down: "La ofensiva tiene cuatro intentos, llamados downs, para avanzar 10 yardas. Si lo logra, es primero y diez y tiene cuatro intentos nuevos.",
      downs: "Si la ofensiva no avanza 10 yardas en cuatro intentos, el otro equipo toma el balón ahí mismo. Eso es perderlo por downs.",
      touchdown: "Llevar o atrapar el balón en la zona de anotación rival es un touchdown. Vale 6 puntos y sigue un intento de punto extra.",
      extra_point: "Después de un touchdown, el pateador intenta una patada corta entre los postes por 1 punto más.",
      field_goal: "El pateador mete el balón entre los postes por 3 puntos. Se intenta cerca de la meta cuando la ofensiva se atasca.",
      punt: "En cuarta oportunidad lejos de la meta, se suele despejar el balón para que el rival empiece lejos.",
      interception: "Un defensor atrapa un pase que iba para la ofensiva. El equipo que defendía se queda con el balón.",
      fumble: "Un jugador suelta el balón mientras lo lleva. Quien lo recupere se lo queda, así que la defensa puede tomarlo.",
      sack: "Derriban al mariscal de campo detrás de la línea antes de que lance. La ofensiva pierde yardas y un intento.",
      penalty: "Alguien rompió una regla. El árbitro lanza una bandera amarilla y el balón avanza o retrocede, casi siempre de 5 a 15 yardas.",
      kickoff: "Cada mitad empieza con una patada inicial, y también después de cada anotación: un equipo patea el balón lejos al otro.",
      halftime: "El partido tiene dos mitades. En el medio tiempo los equipos descansan, y la segunda mitad empieza con otra patada inicial."
    },

    // ---- Sound captions (C17), read by js/audio.js ----
    sounds: {
      crowd_murmur: "[murmullo del público]", crowd_swell: "[el público se levanta]", crowd_roar: "[ovación]",
      crowd_groan: "[lamento del público]", whistle_long: "[silbatazo largo]", jingle_kickoff: "[suena la música de inicio]",
      jingle_final: "[suena la música final]", miss: "[corneta triste]"
    },

    // ---- Pieces the code puts together ----
    msg: {
      yards1: "{n} yarda", yardsN: "{n} yardas", points1: "{n} punto", pointsN: "{n} puntos",
      how_td: "Touchdown", how_fg: "Gol de campo", how_xp: "Punto extra",
      what_int: "Intercepción", what_fumble: "Fumble", what_fg: "No es bueno", what_downs: "Detenidos en cuarta", what_punt: "Despejan",
      cu_changed: "{n} jugadas: {what}, {sc}", cu_now: "{lead}, ahora {sc}", cu_still: "{lead}, sigue {sc}",
      cu_lead_on: "{n} jugadas después", cu_lead_later: "{n} jugadas más tarde", cu_sc: "{a} a {b}",
      td1: "TD {team}", tdN: "{n} TD {team}", fg1: "GC {team}", fgN: "{n} GC {team}",
      cu_pick: "{qb} lanzó una intercepción", cu_fumble: "{name} perdió el balón", cu_downs: "los {team} lo perdieron por downs",
      cu_big: "Gran ganancia: {name}, {yds}", cu_leader: "{name}: {pts} pts de fantasía",
      big_tie: "Eso lo empata a {n}.", big_lead: "Queda {score}, y los {team} ganan por {d}.", big_take: "Toman el balón los {def}, y sigue {score}.",
      big_rz: "Eso deja a los {team} en zona roja.", big_terr: "Eso deja a los {team} en campo de los {def}.", big_flip: "Eso voltea el campo para los {team}.",
      fact_td2: "Es el segundo touchdown de {name} hoy.", fact_td3: "Es el tercer touchdown de {name} hoy.", fact_tdN: "Otro touchdown de {name} hoy.",
      fact_rec: "{name} ya suma {n} yardas por recepción hoy.", fact_rush: "{name} ya suma {n} yardas por tierra hoy.",
      fact_catch: "Es la recepción número {n} de {name}.", fact_leads: "Este partido ya lleva {n} cambios de liderato.",
      fact_drives: "Son {n} series anotadoras para los {team}.", fact_fp: "Esa jugada le vale {pts} puntos de fantasía a {name}.",
      story_square: "Todo igualado al descanso.", story_lead: "Los {team} ganan por {d}.", story_hold: "la defensa de los {team} aguantando",
      dec_pass: "{a} con {b} por {n}", dec_run: "la carrera de {n} yardas de {a}"
    }
  };

  root.FF_ANNOUNCER_LINES_ES = ES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ES;
})(typeof window !== 'undefined' ? window : globalThis);
