// Switches the app between football and soccer. The header control in js/app.js calls
// window.FR_SPORT_CHANGE(name). Soccer is its own page (soccer/index.html), shown here
// in a frame so one sport can never break the other.
(function () {
  'use strict';
  var frame = null;
  function el(id) { return document.getElementById(id); }
  window.FR_SPORT_CHANGE = function (name) {
    var soccer = name === 'soccer';
    var main = document.querySelector('#app main'), tabs = el('tabs'), view = el('soccerView'), note = document.querySelector('#app .note');
    if (!main || !view) return;
    if (soccer && !frame) {
      frame = document.createElement('iframe');
      frame.title = 'Soccer match';
      frame.src = 'soccer/index.html';
      frame.setAttribute('allow', 'autoplay');
      view.appendChild(frame);
    }
    if (!soccer && window.FF_GAME && frame && frame.contentWindow && frame.contentWindow.SC_GAME) {
      try { frame.contentWindow.SC_GAME.setActive(false); } catch (err) { /* the frame is optional */ }
    }
    if (soccer && window.FF_GAME && window.FF_GAME.active) { try { window.FF_GAME.setActive(false); } catch (err) { /* same */ } }
    main.hidden = soccer; view.hidden = !soccer;
    if (tabs) tabs.hidden = soccer;
    if (note) note.hidden = soccer;
    document.documentElement.setAttribute('data-sport', soccer ? 'soccer' : 'football');
  };
})();
