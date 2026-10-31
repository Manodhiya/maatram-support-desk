/*
 * searchable-select.js
 * Turns every <select> into a type-to-search box.
 *  - Click or tab in: the full list opens.
 *  - Type: the list filters as you type.
 *  - Typed text matches an option: it gets selected.
 *  - Typed text matches nothing: "Can't find ..." is shown and the old value is kept.
 * Works for selects added later by your app (MutationObserver).
 * Skip one select with:  <select data-no-search> 
 */
(function () {
  'use strict';

  var css =
    '.ss-wrap{position:relative;display:block}' +
    '.ss-native{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;left:0;bottom:0;margin:0!important;padding:0!important;border:0!important}' +
    '.ss-input{width:100%;box-sizing:border-box;-webkit-appearance:none;appearance:none;outline:none;cursor:text}' +
    '.ss-input.ss-bad{border-color:#d33!important}' +
    '.ss-arrow{position:absolute;right:18px;top:50%;width:7px;height:7px;margin-top:-6px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);pointer-events:none;opacity:.7}' +
    '.ss-list{position:absolute;left:0;right:0;top:calc(100% + 4px);max-height:240px;overflow-y:auto;background:#fff;color:#111;border:1px solid #e3d9b5;border-radius:12px;box-shadow:0 10px 28px rgba(0,0,0,.15);z-index:2000;padding:4px;display:none}' +
    '.ss-wrap.ss-open .ss-list{display:block}' +
    '.ss-item{padding:9px 12px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1.3}' +
    '.ss-item.ss-active,.ss-item:hover{background:#fff1c2}' +
    '.ss-item.ss-selected{font-weight:700}' +
    '.ss-empty{padding:10px 12px;color:#b3261e;font-size:14px}' +
    '.ss-msg{position:absolute;left:4px;top:100%;margin-top:3px;font-size:13px;color:#b3261e;z-index:1999;white-space:nowrap}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var syncers = [];

  function enhance(sel) {
    if (sel.dataset.ss || sel.multiple || sel.size > 1 || sel.hasAttribute('data-no-search')) return;
    sel.dataset.ss = '1';

    var cs = window.getComputedStyle(sel);
    var wrap = document.createElement('div');
    wrap.className = 'ss-wrap';
    wrap.style.margin = cs.margin;
    if (cs.flexGrow !== '0' || cs.flexBasis !== 'auto') wrap.style.flex = cs.flex;
    if (sel.style.width) wrap.style.width = sel.style.width;

    var input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.className = sel.className + ' ss-input';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    // copy the look of the original select so the page design does not change
    ['font', 'color', 'background', 'border', 'borderRadius', 'padding', 'letterSpacing'].forEach(function (p) {
      if (cs[p]) input.style[p] = cs[p];
    });
    var pr = parseFloat(cs.paddingRight) || 12;
    input.style.paddingRight = Math.max(pr, 38) + 'px';
    input.style.margin = '0';

    var arrow = document.createElement('span');
    arrow.className = 'ss-arrow';
    var list = document.createElement('div');
    list.className = 'ss-list';
    list.setAttribute('role', 'listbox');
    var msg = document.createElement('div');
    msg.className = 'ss-msg';
    msg.style.display = 'none';

    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(input);
    wrap.appendChild(arrow);
    wrap.appendChild(list);
    wrap.appendChild(msg);
    wrap.appendChild(sel);
    sel.classList.add('ss-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    sel.addEventListener('focus', function () { input.focus(); }); // label clicks, validation focus

    var active = -1, shown = [], msgTimer = null;

    function realOptions() {
      return Array.prototype.filter.call(sel.options, function (o) { return o.value !== '' && !o.disabled; });
    }
    function placeholderOpt() {
      return Array.prototype.find.call(sel.options, function (o) { return o.value === ''; });
    }
    function currentText() {
      var o = sel.options[sel.selectedIndex];
      return o && o.value !== '' ? o.text : '';
    }
    function sync() {
      if (!document.body.contains(wrap)) return false;
      if (document.activeElement !== input) input.value = currentText();
      var ph = placeholderOpt();
      input.placeholder = ph ? ph.text : 'Type to search…';
      input.disabled = sel.disabled;
      input.required = sel.required;
      return true;
    }
    function hideMsg() { msg.style.display = 'none'; input.classList.remove('ss-bad'); clearTimeout(msgTimer); }
    function showMsg(text) {
      msg.textContent = text; msg.style.display = 'block'; input.classList.add('ss-bad');
      clearTimeout(msgTimer); msgTimer = setTimeout(hideMsg, 3000);
    }

    function render(q) {
      q = (q || '').trim().toLowerCase();
      shown = realOptions().filter(function (o) { return !q || o.text.toLowerCase().indexOf(q) !== -1; });
      list.innerHTML = '';
      if (!shown.length) {
        var e = document.createElement('div');
        e.className = 'ss-empty';
        e.textContent = 'Can\u2019t find \u201C' + input.value.trim() + '\u201D in the list';
        list.appendChild(e);
        active = -1;
        return;
      }
      active = -1;
      shown.forEach(function (o, i) {
        var d = document.createElement('div');
        d.className = 'ss-item' + (o.value === sel.value ? ' ss-selected' : '');
        d.setAttribute('role', 'option');
        d.textContent = o.text;
        d.addEventListener('mousedown', function (ev) { ev.preventDefault(); choose(o); });
        list.appendChild(d);
      });
      // start on the selected item if there is no typed filter
      if (!q) { var si = shown.findIndex(function (o) { return o.value === sel.value; }); if (si > -1) setActive(si); }
    }
    function setActive(i) {
      var items = list.querySelectorAll('.ss-item');
      if (!items.length) return;
      active = (i + items.length) % items.length;
      Array.prototype.forEach.call(items, function (it, k) { it.classList.toggle('ss-active', k === active); });
      items[active].scrollIntoView({ block: 'nearest' });
    }
    function open(q) { wrap.classList.add('ss-open'); render(q); }
    function close() { wrap.classList.remove('ss-open'); }

    function choose(o) {
      var changed = sel.value !== o.value;
      sel.value = o.value;
      input.value = o.text;
      hideMsg(); close();
      if (changed) {
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    function clearSelection() {
      var ph = placeholderOpt();
      if (ph && sel.value !== '') {
        sel.value = '';
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    // decide what the typed text means when the user leaves the box
    function commit() {
      var t = input.value.trim(), low = t.toLowerCase();
      close();
      if (!t) { if (placeholderOpt()) clearSelection(); input.value = currentText(); return; }
      var opts = realOptions();
      var exact = opts.filter(function (o) { return o.text.trim().toLowerCase() === low; })[0];
      if (!exact) {
        var part = opts.filter(function (o) { return o.text.toLowerCase().indexOf(low) !== -1; });
        if (part.length === 1) exact = part[0]; // only one possible match: take it
      }
      if (exact) { choose(exact); return; }
      showMsg('Can\u2019t find \u201C' + t + '\u201D \u2014 please pick from the list');
      input.value = currentText();
    }

    input.addEventListener('focus', function () { hideMsg(); input.select(); open(''); });
    input.addEventListener('click', function () { if (!wrap.classList.contains('ss-open')) open(''); });
    input.addEventListener('input', function () { hideMsg(); open(input.value); });
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) {
      var isOpen = wrap.classList.contains('ss-open');
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) open(input.value); else setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (!isOpen) open(input.value); else setActive(active - 1); }
      else if (e.key === 'Enter' && isOpen) {
        e.preventDefault();
        if (active > -1 && shown[active]) choose(shown[active]); else commit();
      }
      else if (e.key === 'Escape' && isOpen) { e.preventDefault(); input.value = currentText(); close(); }
    });
    sel.addEventListener('change', sync);
    if (sel.form) sel.form.addEventListener('reset', function () { setTimeout(sync, 0); });

    sync();
    syncers.push(sync);
  }

  // removes the "How this page works" help box on the Notifications page
  function dropHelpBox(root) {
    var cards = root.matches && root.matches('.card') ? [root] : [];
    Array.prototype.push.apply(cards, root.querySelectorAll('.card'));
    cards.forEach(function (c) {
      if (/^\s*How this page works/i.test(c.textContent) && c.textContent.length < 900) c.remove();
    });
  }

  function scan(root) {
    if (root.nodeType !== 1) return;
    dropHelpBox(root);
    if (root.tagName === 'SELECT') enhance(root);
    Array.prototype.forEach.call(root.querySelectorAll('select'), enhance);
  }

  function start() {
    scan(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, scan); });
    }).observe(document.body, { childList: true, subtree: true });
    // keeps the box in step when the app changes a select's value or options by code
    setInterval(function () { syncers = syncers.filter(function (s) { return s(); }); }, 400);
  }

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();