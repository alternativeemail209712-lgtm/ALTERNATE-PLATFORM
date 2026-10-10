/* word-language.js  (update 48)
 * ONE shared client helper for every letter word game. It adds a "Word language" section to the
 * game's Settings drawer (just above "Strict fit") with the 7 modes:
 *   English / Bahasa Indonesia / Bahasa Melayu (Malaysia) /
 *   English + Indonesian / English + Bahasa Melayu / Bahasa Melayu + Indonesian / all three.
 *
 * Each game page calls, every time it renders a state:
 *     WordLanguage.update(state.game, (mode) => <send "set word language" to this game's server>)
 * The server owns the choice (it is remembered), so the dropdown just mirrors what the server says.
 * It also hides word-length choices longer than the chosen language has words for.
 */
(function () {
  'use strict';
  if (window.WordLanguage) return;

  var select = null;
  var noteEl = null;
  var sendFn = null;
  var lastOptionsKey = '';
  var lastMax = null;

  var FLAGS = { en: '🇬🇧', id: '🇮🇩', ms: '🇲🇾' };
  function flagsFor(id) {
    return id.split('-').map(function (p) { return p === 'all' ? '🇬🇧🇮🇩🇲🇾' : (FLAGS[p] || ''); }).join('');
  }

  function buildSection() {
    var anchor = document.getElementById('strictFitToggle');
    if (!anchor) return false;
    var host = anchor.closest('.drawerSection') || anchor.closest('.host-card');
    if (!host) return false;
    var lengthSelect = document.getElementById('wordLengthSelect');
    var selectClass = (lengthSelect && lengthSelect.className) || 'selectInput';

    var wrap = document.createElement('div');
    wrap.id = 'wordLanguageSection';
    var isCard = host.classList.contains('host-card');
    wrap.className = isCard ? 'host-card' : 'drawerSection';

    var title = document.createElement(isCard ? 'div' : 'h4');
    if (isCard) title.className = 'host-card-title';
    title.textContent = isCard ? '🌏 Word language' : 'Word language';
    wrap.appendChild(title);

    var row = document.createElement('div');
    row.className = isCard ? 'host-card-row' : 'row';
    select = document.createElement('select');
    select.id = 'wordLanguageSelect';
    select.className = selectClass;
    select.setAttribute('aria-label', 'Word language');
    row.appendChild(select);
    wrap.appendChild(row);

    noteEl = document.createElement('p');
    noteEl.className = isCard ? 'mini-note' : 'sectionNote';
    if (isCard) noteEl.style.cssText = 'margin:6px 2px 0;font-size:12px;opacity:.8;line-height:1.4;';
    noteEl.textContent = 'Pick the language of the secret words AND of the guesses the game accepts. Mixed modes give every language a fair share of the rounds. Your choice is remembered; a round that is running restarts in the new language.';
    wrap.appendChild(noteEl);

    host.parentNode.insertBefore(wrap, host);

    select.addEventListener('change', function () {
      if (sendFn) sendFn(select.value);
    });
    return true;
  }

  function fillOptions(options) {
    var key = options.map(function (o) { return o.id; }).join(',');
    if (key === lastOptionsKey) return;
    lastOptionsKey = key;
    select.innerHTML = '';
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = flagsFor(o.id) + '  ' + o.label;
      select.appendChild(opt);
    });
  }

  // hide word-length choices that the chosen language has no words for
  function limitLengthSelects(max) {
    if (!max || max === lastMax) return;
    lastMax = max;
    ['wordLengthSelect', 'lengthMinSelect', 'lengthMaxSelect'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (!sel) return;
      Array.prototype.forEach.call(sel.options, function (opt) {
        var tooLong = Number(opt.value) > max;
        opt.hidden = tooLong;
        opt.disabled = tooLong;
      });
      if (Number(sel.value) > max) sel.value = String(max);
    });
  }

  function describe(info) {
    if (!info) return '';
    var bits = [];
    bits.push(info.secretWords.toLocaleString() + ' secret words, up to ' + info.maxLength + ' letters.');
    var usesId = /id|all/.test(info.mode);
    var usesMs = /ms|all/.test(info.mode);
    if (usesId) bits.push('Indonesian guess list: ' + info.idGuessWords.toLocaleString() + ' words (' + info.idSource + ').');
    if (usesMs) bits.push('Malay guess list: ' + info.msGuessWords.toLocaleString() + ' words (' + info.msSource + ').');
    return bits.join(' ');
  }

  window.WordLanguage = {
    update: function (game, send) {
      try {
        if (!game || !game.wordLanguages) return;
        if (typeof send === 'function') sendFn = send;
        if (!select && !buildSection()) return;
        fillOptions(game.wordLanguages);
        if (game.wordLanguage && select.value !== game.wordLanguage) select.value = game.wordLanguage;
        if (game.wordLanguageInfo && noteEl) {
          var extra = describe(game.wordLanguageInfo);
          var base = 'Pick the language of the secret words AND of the guesses the game accepts. Mixed modes give every language a fair share of the rounds. Your choice is remembered; a round that is running restarts in the new language.';
          noteEl.textContent = extra ? base + ' Now: ' + extra : base;
        }
        limitLengthSelects(game.maxWordLength);
      } catch (e) {
        if (window.console) console.warn('[WordLanguage]', e);
      }
    }
  };
})();
