(function () {
  'use strict';
  var COLS = [{ id: 'todo', name: 'To do', color: '#60a5fa' }, { id: 'doing', name: 'In progress', color: '#fbbf24' }, { id: 'done', name: 'Done', color: '#34d399' }];
  var KEY = 'pf-kanban-v2';
  var PRI = { high: 'High', medium: 'Medium', low: 'Low' };
  function $(s) { return document.querySelector(s); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      var v = attrs[k];
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(c); });
    return e;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function colIdx(id) { for (var i = 0; i < COLS.length; i++) if (COLS[i].id === id) return i; return -1; }

  var tasks = [], activeTab = 'todo', editingId = null, lastDeleted = null, toastTimer, dragId = null, trigger = null;
  try {
    var raw = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(raw)) tasks = raw.filter(function (t) { return t && typeof t.id === 'string' && typeof t.title === 'string' && colIdx(t.status) !== -1 && PRI[t.priority]; });
    else tasks = null;
  } catch (e) { tasks = null; }
  if (!tasks) tasks = [
    { id: 's1', title: 'Set up Supabase project', desc: 'Create tables and row-level security policies.', priority: 'high', status: 'todo' },
    { id: 's2', title: 'Test on a real phone', desc: 'Check touch targets and safe areas.', priority: 'medium', status: 'doing' },
    { id: 's3', title: 'Write the template manifest', desc: 'Keep the JSON format consistent.', priority: 'low', status: 'done' }
  ];
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch (e) {} }

  function move(id, dir) {
    var t = tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var n = colIdx(t.status) + dir; if (n < 0 || n >= COLS.length) return;
    t.status = COLS[n].id; persist(); render();
  }
  function remove(id) {
    var i = -1; tasks.forEach(function (t, n) { if (t.id === id) i = n; }); if (i < 0) return;
    lastDeleted = { task: tasks[i], index: i }; tasks.splice(i, 1); persist(); render(); showToast('Task deleted', true);
  }
  function showToast(msg, withUndo) {
    $('#toastMsg').textContent = msg; $('#undo').hidden = !withUndo; $('#toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { $('#toast').classList.remove('show'); lastDeleted = null; }, withUndo ? 5000 : 2000);
  }
  $('#undo').addEventListener('click', function () {
    if (!lastDeleted) return;
    tasks.splice(Math.min(lastDeleted.index, tasks.length), 0, lastDeleted.task); lastDeleted = null; persist(); render(); $('#toast').classList.remove('show');
  });

  function card(t) {
    var i = colIdx(t.status);
    var el = h('article', { class: 'card', draggable: 'true', 'data-id': t.id }, [
      h('div', { class: 'card-top' }, [h('h3', { text: t.title }), h('span', { class: 'pri ' + t.priority, text: PRI[t.priority] })]),
      t.desc ? h('p', { text: t.desc }) : null,
      h('div', { class: 'card-f' }, [
        h('div', { class: 'mv' }, [
          h('button', Object.assign({ class: 'ib', type: 'button', 'aria-label': 'Move back', text: '←', onclick: function () { move(t.id, -1); } }, i === 0 ? { disabled: '' } : {})),
          h('button', Object.assign({ class: 'ib', type: 'button', 'aria-label': 'Move forward', text: '→', onclick: function () { move(t.id, 1); } }, i === COLS.length - 1 ? { disabled: '' } : {}))
        ]),
        h('div', { class: 'mv' }, [
          h('button', { class: 'ib', type: 'button', 'aria-label': 'Edit task', text: 'Edit', onclick: function (e) { openModal(t, e.currentTarget); } }),
          h('button', { class: 'ib del', type: 'button', 'aria-label': 'Delete task', text: '✕', onclick: function () { remove(t.id); } })
        ])
      ])
    ]);
    el.addEventListener('dragstart', function (e) { dragId = t.id; el.classList.add('drag'); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', t.id); } catch (x) {} } });
    el.addEventListener('dragend', function () { dragId = null; el.classList.remove('drag'); document.querySelectorAll('.col.over').forEach(function (c) { c.classList.remove('over'); }); });
    return el;
  }

  function render() {
    var board = $('#board'), tabs = $('#tabs'); board.textContent = ''; tabs.textContent = '';
    COLS.forEach(function (c) {
      var items = tasks.filter(function (t) { return t.status === c.id; });
      var list = h('div', { class: 'list' });
      if (!items.length) list.appendChild(h('div', { class: 'empty', text: c.id === 'done' ? 'Finished tasks land here' : 'Nothing here yet' }));
      items.forEach(function (t) { list.appendChild(card(t)); });
      var col = h('section', { class: 'col' + (c.id === activeTab ? ' show' : ''), 'data-col': c.id, 'aria-label': c.name }, [
        h('div', { class: 'col-h' }, [h('span', {}, [h('i', { class: 'dot', style: 'background:' + c.color }), h('span', { text: c.name })]), h('span', { class: 'count', text: String(items.length) })]),
        list
      ]);
      col.addEventListener('dragover', function (e) { if (dragId) { e.preventDefault(); col.classList.add('over'); } });
      col.addEventListener('dragleave', function (e) { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('over');
        var t = tasks.filter(function (x) { return x.id === dragId; })[0];
        if (t && t.status !== c.id) { t.status = c.id; persist(); render(); }
      });
      board.appendChild(col);
      tabs.appendChild(h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(c.id === activeTab), onclick: function () { activeTab = c.id; render(); } }, [h('span', { text: c.name }), h('b', { text: String(items.length) })]));
    });
    var done = tasks.filter(function (t) { return t.status === 'done'; }).length;
    $('#summary').textContent = done + ' of ' + tasks.length + ' done';
    $('#bar').style.width = (tasks.length ? Math.round(done / tasks.length * 100) : 0) + '%';
  }

  // Modal
  var shade = $('#shade');
  function openModal(task, from) {
    trigger = from || $('#newBtn'); editingId = task ? task.id : null;
    $('#mTitle').textContent = task ? 'Edit task' : 'New task'; $('#save').textContent = task ? 'Save changes' : 'Add task';
    $('#fTitle').value = task ? task.title : ''; $('#fDesc').value = task ? task.desc : '';
    $('#fPri').value = task ? task.priority : 'medium'; $('#fCol').value = task ? task.status : activeTab; $('#err').textContent = '';
    shade.hidden = false; $('#fTitle').focus();
  }
  function closeModal() { shade.hidden = true; if (trigger && trigger.focus && document.body.contains(trigger)) trigger.focus(); }
  $('#newBtn').addEventListener('click', function (e) { openModal(null, e.currentTarget); });
  $('#cancel').addEventListener('click', closeModal);
  shade.addEventListener('click', function (e) { if (e.target === shade) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !shade.hidden) closeModal(); });
  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('#fTitle').value.trim();
    if (!title) { $('#err').textContent = 'Please give the task a title.'; $('#fTitle').focus(); return; }
    var data = { title: title, desc: $('#fDesc').value.trim(), priority: $('#fPri').value, status: $('#fCol').value };
    if (editingId) { tasks.forEach(function (t) { if (t.id === editingId) { t.title = data.title; t.desc = data.desc; t.priority = data.priority; t.status = data.status; } }); }
    else { data.id = uid(); tasks.unshift(data); }
    activeTab = data.status; persist(); render(); closeModal();
  });

  render();
})();