document.addEventListener('DOMContentLoaded', () => {
  // Seconds-based timer
  const TICK_MS = 1000;
  const STEP_SECONDS = 1;

  // Include 2 m option by default
  const DEFAULT_REMINDER_VALUES = [5400,3600,2700,1800,900,300,120];

  // Views
  const views = {
    today: document.getElementById('today-view'),
    task: document.getElementById('task-view'),
    edit: document.getElementById('edit-task-view'),
  };

  // Today
  const taskList = document.getElementById('task-list');
  const addTaskBtn = document.getElementById('add-task-btn');
  const menuBtn = document.getElementById('menu-btn');

  // Task view
  const backToTodayBtn = document.getElementById('back-to-today-btn');
  const leafFallContainer = document.getElementById('leaf-fall-container');
  const timeDisplay = document.getElementById('time-display');
  const progressBar = document.getElementById('progress-bar');
  const progressContainer = document.getElementById('progress-container');
  const reminderDotsEl = document.getElementById('reminder-dots');
  const activeReminderCount = document.getElementById('active-reminder-count');
  const activeTaskNameEl = document.getElementById('active-task-name');
  const activeDurationEl = document.getElementById('active-duration');
  const pauseBtn = document.getElementById('pause-btn');
  const doneBtn = document.getElementById('done-btn');
  const activeCheckbox = document.getElementById('active-checkbox');
  const inTaskEditBtn = document.getElementById('in-task-edit-btn');
  const overdueBadge = document.getElementById('overdue-badge');
  const overdueText = document.getElementById('overdue-text');

  // Reminder toast
  const reminderToast = document.getElementById('reminder-toast');
  const toastText = document.getElementById('toast-text');

  // Edit
  const editViewTitle = document.getElementById('edit-view-title');
  const closeEditViewBtn = document.getElementById('close-edit-view-btn');
  const taskNameInput = document.getElementById('task-name-input');
  const durationHrInput = document.getElementById('task-duration-hr');
  const durationMinInput = document.getElementById('task-duration-min');
  const saveTaskBtn = document.getElementById('save-task-btn');
  const cancelTaskBtn = document.getElementById('cancel-task-btn');
  const restartTaskBtn = document.getElementById('restart-task-btn');
  const reminderOptions = document.getElementById('reminder-options');
  const addCustomReminderBtn = document.getElementById('add-custom-reminder');

  // Overlays
  const mindfulBreakChips = document.querySelectorAll('.mindful-break-chip');
  const mindfulOverlay = document.getElementById('mindful-break-overlay');
  const mindfulLeafContainer = document.getElementById('mindful-leaf-container');
  const endMindfulBreakBtn = document.getElementById('end-mindful-break-btn');

  const pauseOverlay = document.getElementById('pause-overlay');
  const resumeBtn = document.getElementById('resume-btn');

  const overdueOverlay = document.getElementById('overdue-overlay');
  const overdueAdd15Btn = document.getElementById('overdue-add-15');

  // Deleted overlay
  const deletedOverlay = document.getElementById('deleted-overlay');
  const deletedListEl = document.getElementById('deleted-list');
  const closeDeletedBtn = document.getElementById('close-deleted');

  // Custom reminder modal
  const customModal = document.getElementById('custom-reminder-modal');
  const customRemMin = document.getElementById('custom-rem-min');
  const customRemAdd = document.getElementById('custom-rem-add');
  const customRemCancel = document.getElementById('custom-rem-cancel');

  // State
  let tasks = [];
  let deletedTasks = [];
  let activeTask = null;
  let timerInterval = null;
  let editingTaskId = null;
  let mindfulInterval = null;
  let overdueShown = false;
  let toastCurrentOffset = null;
  
  // NEW: auto-hide timer for the toast and per-task reminder memory
  let toastHideTimer = null;
  const ensureReminderState = (t) => {
    if (!Array.isArray(t.firedReminders)) t.firedReminders = [];
  };

  // Tree state
  // Path data for the leaf (same as in #leaf-shape)
  const LEAF_PATH_D = "M15.4,29.3C12.3,29.7,9,28.6,6.4,26.4c-4.2-3.6-6-9-5.4-14.2c0.2-1.8,0.9-3.6,2-5.1C4.4,5,6.2,3.3,8.3,2.2 c4.1-2.2,9-2.2,13.1,0c4.9,2.6,8,7.6,8.6,12.9c0.1,1.1,0,2.2-0.2,3.3C29,20.2,28.2,21.8,27,23.2c-2.4,2.9-5.8,4.9-9.5,5.7 C16.8,29,16.1,29.1,15.4,29.3z";
  let treeLeaves = [];
  let fallenLeaves = [];

// Positions for leaves on a 400x500 tree viewBox
const TREE_LEAF_POSITIONS = [
  { x: 120, y: 250 }, { x: 140, y: 260 }, { x: 160, y: 270 },
  { x: 280, y: 280 }, { x: 260, y: 290 }, { x: 240, y: 300 },
  { x: 130, y: 240 }, { x: 270, y: 260 }, { x: 180, y: 310 },
  { x: 220, y: 320 }
];

  // Storage
  const saveTasks = () => localStorage.setItem('mindfulTasks', JSON.stringify(tasks));
  const loadTasks = () => tasks = JSON.parse(localStorage.getItem('mindfulTasks') || '[]');
  const saveDeleted = () => localStorage.setItem('mindfulDeleted', JSON.stringify(deletedTasks));
  const loadDeleted = () => deletedTasks = JSON.parse(localStorage.getItem('mindfulDeleted') || '[]');

  // Helpers
  const showView = (name) => { Object.values(views).forEach(v => v.classList.add('hidden')); views[name].classList.remove('hidden'); };
  const pad2 = (n) => String(n).padStart(2,'0');
  const formatHMS = (s) => { const sec=Math.max(0,Math.floor(s)); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), ss=sec%60; return h>0?`${h} h ${m} m ${pad2(ss)} s`:`${m} m ${pad2(ss)} s`; };
  const formatHM = (sec) => { const abs=Math.max(0,Math.floor(sec)); const h=Math.floor(abs/3600), m=Math.floor((abs%3600)/60); return h>0?`${h} h ${m} m`:`${m} m`; };
  const formatOffsetLabel = (off) => { const h=Math.floor(off/3600), m=Math.floor((off%3600)/60); return h>0?`${h} h ${m} m before end`:`${m} m before end`; };
  const formatOffsetText = (off) => `This is your ${Math.round(off/60)} minutes reminder`;
  const formatDateTime = (ms) => new Date(ms).toLocaleString();

  // Today rendering
  const renderTodayView = () => {
    taskList.innerHTML = '';
    tasks.forEach(task => {
      const showRemainingLine = (task.status === 'running' || task.status === 'paused') &&
                                (task.remainingTime !== task.totalDuration);
      const row = document.createElement('div');
      row.className = 'task-item';
      if (task.status === 'completed') row.classList.add('completed');

      row.innerHTML = `
        <div class="checkbox">${task.status === 'completed' ? '✓' : ''}</div>
        <div class="task-item-content">
          <h3>${task.name}</h3>
          <p><span class="clock-icn">🕒</span> Duration: ${formatHM(task.totalDuration)}</p>
          ${showRemainingLine
            ? `<div class="status-line" style="${task.remainingTime<0?'color:#b00020':''}">
                 <span>🕑</span> ${
                   task.remainingTime >= 0
                     ? `Started: ${formatHM(task.remainingTime)} remaining`
                     : `Overdue: ${formatHM(-task.remainingTime)}`
                 }
               </div>`
            : ''
          }
        </div>
        <div class="right-icon" title="${task.status==='completed'?'Delete':'Edit'}">${task.status==='completed'?'🗑':'&#9998;'}</div>
      `;

      row.querySelector('.checkbox').addEventListener('click', (e) => { e.stopPropagation(); toggleComplete(task.id); });
      row.querySelector('.right-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        if (task.status === 'completed') deleteTask(task.id);
        else openEditView(task.id);
      });
      row.addEventListener('click', () => { if (task.status !== 'completed') startTask(task.id); });
      taskList.appendChild(row);
    });
  };

  // Deleted tasks overlay
  const renderDeletedList = () => {
    deletedListEl.innerHTML = '';
    if (!deletedTasks.length) { deletedListEl.innerHTML = '<div class="meta">No deleted tasks.</div>'; return; }
    deletedTasks.slice().reverse().forEach(d => {
      const row = document.createElement('div');
      row.className = 'deleted-item';
      row.innerHTML = `
        <div>
          <div><strong>${d.name}</strong></div>
          <div class="meta">Deleted: ${formatDateTime(d.deletedAt)} · Duration: ${formatHM(d.totalDuration)}</div>
        </div>
        <button class="restore-btn">Restore</button>
      `;
      row.querySelector('.restore-btn').addEventListener('click', () => {
        tasks.push({ id:Date.now(), name:d.name, totalDuration:d.totalDuration, remainingTime:d.totalDuration, status:'paused', reminders:d.reminders||[] });
        deletedTasks = deletedTasks.filter(x => x.deletedAt !== d.deletedAt);
        saveTasks(); saveDeleted(); renderDeletedList(); renderTodayView();
      });
      deletedListEl.appendChild(row);
    });
  };

  // CRUD ops
  const deleteTask = (id) => {
    const t = tasks.find(x => x.id === id); if (!t) return;
    deletedTasks.push({ ...t, deletedAt: Date.now() });
    tasks = tasks.filter(x => x.id !== id);
    if (activeTask && activeTask.id === id) { clearInterval(timerInterval); timerInterval=null; activeTask=null; }
    saveDeleted(); saveTasks(); renderTodayView();
  };
  const toggleComplete = (id) => {
    const t = tasks.find(x => x.id === id); if (!t) return;
    if (t.status === 'completed') { t.status='paused'; t.remainingTime=t.totalDuration; }
    else { t.status='completed'; t.remainingTime=0; if (activeTask && activeTask.id===id){ clearInterval(timerInterval); timerInterval=null; activeTask=null; } }
    saveTasks(); renderTodayView();
  };

  // Edit/New helpers
  const ensureCustomRowForOffset = (sec) => {
    if (DEFAULT_REMINDER_VALUES.includes(sec)) return;
    if (reminderOptions.querySelector(`.rem-choice[value="${sec}"]`)) return;
    const label = document.createElement('label');
    label.className = 'rem-row custom';
    label.innerHTML = `
      <input type="checkbox" class="rem-choice" value="${sec}" checked />
      <span>${formatOffsetLabel(sec)}</span>
      <button type="button" class="remove-rem" title="Remove">×</button>
    `;
    reminderOptions.appendChild(label);
  };
  reminderOptions.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-rem')) {
      e.preventDefault();
      e.target.closest('.rem-row')?.remove();
    }
  });
  addCustomReminderBtn.addEventListener('click', () => { customRemMin.value='2'; customModal.classList.remove('hidden'); });
  customRemCancel.addEventListener('click', () => customModal.classList.add('hidden'));
  customRemAdd.addEventListener('click', () => {
    const m = parseInt(customRemMin.value,10);
    if (isNaN(m) || m<1) return;
    ensureCustomRowForOffset(m*60);
    customModal.classList.add('hidden');
  });

  const getEditDurationSeconds = () => {
    const h = parseInt(durationHrInput.value) || 0;
    const m = parseInt(durationMinInput.value) || 0;
    return h*3600 + m*60;
  };
  const setSelectedReminderOffsets = (offs=[]) => {
    offs.forEach(o => ensureCustomRowForOffset(o));
    [...reminderOptions.querySelectorAll('.rem-choice')].forEach(i => i.checked = offs.includes(parseInt(i.value)));
  };
  const getSelectedReminderOffsets = () => [...reminderOptions.querySelectorAll('.rem-choice:checked')].map(i => parseInt(i.value));
  const refreshReminderOptionsUI = (total) => { [...reminderOptions.querySelectorAll('.rem-choice')].forEach(i => i.disabled = parseInt(i.value) >= total); };
  const validateDurationInput = () => {
    const okName = taskNameInput.value.trim().length > 0;
    const total = getEditDurationSeconds();
    // Request 3: Save disabled if no name
    saveTaskBtn.disabled = !(okName && total > 0);
    refreshReminderOptionsUI(total);
  };

  const openEditView = (taskId=null) => {
    editingTaskId = taskId;
    restartTaskBtn.classList.add('hidden');

    if (taskId) {
      const t = tasks.find(x => x.id === taskId);
      editViewTitle.textContent = 'Editing Task';
      taskNameInput.value = t.name;
      durationHrInput.value = Math.floor(t.totalDuration/3600);
      durationMinInput.value = Math.floor((t.totalDuration%3600)/60);
      setSelectedReminderOffsets(t.reminders || []);
      refreshReminderOptionsUI(t.totalDuration);
      if (activeTask && activeTask.id === taskId && activeTask.status !== 'completed') restartTaskBtn.classList.remove('hidden');
    } else {
      editViewTitle.textContent = 'New Task';
      taskNameInput.value = '';
      durationHrInput.value = 1; durationMinInput.value = 0;
      setSelectedReminderOffsets([300,120]); // default 5m & 2m
      refreshReminderOptionsUI(getEditDurationSeconds());
    }
    validateDurationInput();
    showView('edit');
  };

  const handleSaveTask = () => {
    const name = taskNameInput.value.trim();
    const newTotal = getEditDurationSeconds();
    if (!name || newTotal <= 0) return;
    const reminders = getSelectedReminderOffsets().sort((a,b)=>a-b);

    if (editingTaskId) {
      const t = tasks.find(x => x.id === editingTaskId);
      const elapsed = t.totalDuration - t.remainingTime;
      const newRemaining = newTotal - elapsed;

      t.name = name;
      t.totalDuration = newTotal;
      t.reminders = reminders;
      t.remainingTime = newRemaining;

      if (activeTask && activeTask.id === editingTaskId) {
        activeTask.name = name;
        activeTask.totalDuration = newTotal;
        activeTask.remainingTime = newRemaining;
        activeTaskNameEl.textContent = name;
        activeDurationEl.textContent = formatHM(newTotal);
        activeReminderCount.textContent = reminders.length;
        renderReminderDots(activeTask);
        updateTimerDisplay();
      }
    } else {
      tasks.push({ id: Date.now(), name, totalDuration: newTotal, remainingTime: newTotal, status:'paused', reminders, firedReminders: [] });
    }
    saveTasks(); renderTodayView(); showView('today');
  };

  saveTaskBtn.addEventListener('click', handleSaveTask);
  cancelTaskBtn.addEventListener('click', () => { activeTask ? showView('task') : showView('today'); });
  restartTaskBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    const t = tasks.find(x => x.id === editingTaskId);
    t.remainingTime = t.totalDuration; t.status = 'paused';
    t.firedReminders = [];
    if (activeTask && activeTask.id === editingTaskId) { activeTask.remainingTime = t.totalDuration; activeTask.status='paused'; activeTask.firedReminders = []; clearInterval(timerInterval); timerInterval=null; }
    saveTasks(); renderTodayView();
  });
  [taskNameInput, durationHrInput, durationMinInput].forEach(el => el.addEventListener('input', validateDurationInput));
  closeEditViewBtn.addEventListener('click', () => activeTask ? showView('task') : showView('today'));
  addTaskBtn.addEventListener('click', () => openEditView(null));

  // Progress & time
  const renderReminderDots = (task) => {
    reminderDotsEl.innerHTML = '';
    const total = Math.max(task.totalDuration, 1);
    (task.reminders || []).forEach(off => {
      if (off >= total) return;
      const ratio = (total - off) / total;
      const dot = document.createElement('div');
      dot.className = 'reminder-dot';
      dot.style.left = `${(ratio*100).toFixed(2)}%`;
      reminderDotsEl.appendChild(dot);
    });
  };
  const setOverdueUI = (isOverdue) => {
    timeDisplay.classList.toggle('overdue', isOverdue);
    progressContainer.classList.toggle('overdue', isOverdue);
    overdueBadge.classList.toggle('hidden', !isOverdue);
  };
  const updateTimerDisplay = () => {
    if (activeTask.remainingTime >= 0) {
      timeDisplay.textContent = `~ ${formatHMS(activeTask.remainingTime)} Remaining`;
      setOverdueUI(false);
    } else {
      const over = -activeTask.remainingTime;
      timeDisplay.textContent = `~ ${formatHMS(over)} Overdue`;
      overdueText.textContent = `${formatHM(over)} Overdue`;
      setOverdueUI(true);
    }
    const total = Math.max(activeTask.totalDuration, 1);
    const remainingNonNeg = Math.max(0, activeTask.remainingTime);
    const elapsed = total - remainingNonNeg;
    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
    progressBar.style.width = `${pct}%`;
  };

  // Leaves helpers
  const dropLeaf = ({ parent, isYellow=false, isSwirl=false } = {}) => {
    const leaf = document.createElementNS('http://www.w3.org/2000/svg','svg');
    leaf.classList.add('leaf');
    if (isYellow) leaf.classList.add('yellow');
    if (isSwirl) leaf.classList.add(isYellow ? 'swirl-yellow' : 'swirl-green');
    const amp = (6 + Math.random() * 10).toFixed(1);
    const speed = (800 + Math.random() * 900).toFixed(0);
    leaf.style.setProperty('--flutter-amp', `${amp}deg`);
    leaf.style.setProperty('--flutter-speed', `${speed}ms`);
    leaf.innerHTML = '<g class="leaf-inner"><use href="#leaf-shape"/></g>';
    const d = isSwirl ? (isYellow ? 12 : 9 + Math.random()*3) : 6 + Math.random()*4;
    leaf.style.animationDuration = `${d}s`;
    if (isSwirl) { leaf.style.setProperty('--x-start', `${10 + Math.random()*80}vw`); leaf.style.setProperty('--x-end', `${(Math.random()-0.5)*60}vw`); }
    else { leaf.style.left = `${20 + Math.random()*60}%`; leaf.style.setProperty('--x-end', `${(Math.random()-0.5)*40}vw`); leaf.style.setProperty('--rotate-end', `${(Math.random()-0.5)*720}deg`); leaf.style.animationName = 'fall'; }
    parent.appendChild(leaf);
    setTimeout(()=>leaf.remove(), d*1000);
  };

  // Create swaying leaves on the SVG tree
// Draw static, light‑green leaves on branches and keep them
const initializeTree = () => {
  const g = document.getElementById('tree-leaves');
  if (!g) return;

  // If already drawn, keep them (don’t re-draw on every entry)
  if (g.childElementCount > 0) return;

  treeLeaves = []; // keep anchor list for start positions

  const lightGreens = ['#BFE8B8', '#CDECC5', '#D6F1CF']; // subtle variety

  TREE_LEAF_POSITIONS.forEach(pos => {
    // Parent group holds absolute position
    const leafG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    leafG.setAttribute('class', 'tree-leaf');
    leafG.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

    // Inner group wiggles gently (optional)
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    inner.setAttribute('class', 'tree-leaf-inner');
    inner.style.setProperty('--sway-delay', `${(Math.random()*3).toFixed(2)}s`);
    inner.setAttribute('transform', `scale(${0.9 + Math.random()*0.15}) rotate(${Math.floor(Math.random()*360)})`);

    // Use the same path as #leaf-shape, but draw it directly (no <use>) for reliability
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', "M15.4,29.3C12.3,29.7,9,28.6,6.4,26.4c-4.2-3.6-6-9-5.4-14.2c0.2-1.8,0.9-3.6,2-5.1C4.4,5,6.2,3.3,8.3,2.2 c4.1-2.2,9-2.2,13.1,0c4.9,2.6,8,7.6,8.6,12.9c0.1,1.1,0,2.2-0.2,3.3C29,20.2,28.2,21.8,27,23.2c-2.4,2.9-5.8,4.9-9.5,5.7 C16.8,29,16.1,29.1,15.4,29.3z");
    path.setAttribute('fill', lightGreens[Math.floor(Math.random()*lightGreens.length)]);
    path.setAttribute('stroke', '#1c1c1c');
    path.setAttribute('stroke-width', '1.2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    inner.appendChild(path);
    leafG.appendChild(inner);
    g.appendChild(leafG);

    treeLeaves.push({ pos }); // anchors to drop from
  });
};

// Drop one leaf from the tree onto the ground and keep it there
const dropLeafFromTree = () => {
  const leafFallLayer = document.getElementById('leaf-fall-container');
  if (!leafFallLayer) return;

  // Avoid 0×0 layout -> leaf at top-left
  const rect = leafFallLayer.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) {
    requestAnimationFrame(dropLeafFromTree);
    return;
  }

  // Pick a random branch anchor — do NOT hide static leaves
  const anchor = TREE_LEAF_POSITIONS[Math.floor(Math.random() * TREE_LEAF_POSITIONS.length)];

  const cw = rect.width;
  const ch = rect.height;

  const startXpx = (anchor.x / 400) * cw;
  const startYpx = (anchor.y / 500) * ch;

  const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leaf.classList.add('leaf', 'falling');
  // Random occasional yellow leaf
  if (Math.random() > 0.8) leaf.classList.add('yellow');
  leaf.innerHTML = '<g class="leaf-inner"><use href="#leaf-shape"/></g>';

  leaf.style.position = 'absolute';
  leaf.style.left = `${startXpx}px`;
  leaf.style.top = `${startYpx}px`;

  // Drift/rotation and landing calculation
  const xDriftPx = (Math.random() - 0.5) * Math.min(150, cw * 0.25);
  const rotation = Math.floor((Math.random() - 0.5) * 720);

  const groundHeight = 60; // matches #ground-line
  const leafHeight = 30;
  const stackOffset = fallenLeaves.length * 2 + Math.random() * 8;

  const targetY = Math.max(0, ch - groundHeight - leafHeight - stackOffset);
  const fallDistance = Math.max(0, targetY - startYpx);

  leaf.style.setProperty('--x-drift', `${xDriftPx}px`);
  leaf.style.setProperty('--fall-distance', `${fallDistance.toFixed(2)}px`);
  leaf.style.setProperty('--rotate-end', `${rotation}deg`);

  leafFallLayer.appendChild(leaf);

  // After animation, fix it so it stays until task ends
  setTimeout(() => {
    leaf.classList.remove('falling');
    leaf.classList.add('fallen');
    leaf.style.left = `${(startXpx + xDriftPx).toFixed(2)}px`;
    leaf.style.top = `${(startYpx + fallDistance).toFixed(2)}px`;
    leaf.style.transform = `rotate(${rotation}deg)`;
    fallenLeaves.push(leaf);

    // Safety: remove any stray leaf that somehow landed at the very top-left corner
    scrubCornerLeaves();
  }, 2600);
};

// Remove any non-animated leaf stuck at the very top-left (safety net)
const scrubCornerLeaves = () => {
  const container = document.getElementById('leaf-fall-container');
  if (!container) return;
  const crect = container.getBoundingClientRect();
  [...container.querySelectorAll('.leaf')].forEach(el => {
    const r = el.getBoundingClientRect();
    const nearLeft = (r.left - crect.left) < 6;
    const nearTop = (r.top - crect.top) < 6;
    if (!el.classList.contains('falling') && (nearLeft && nearTop)) {
      el.remove();
    }
  });
};


  // At each reminder, drop exactly one leaf from the tree and keep it
const burstAtReminder = () => {
  dropLeafFromTree(); // one leaf per reminder, stays on ground
};

  // Reminder toast & leaf trigger only at reminders (Request 1)
const updateReminderToast = () => {
  if (!activeTask || !activeTask.reminders) return;
  ensureReminderState(activeTask);

  // Window: trigger if remaining is in (off-60, off]
  const r = activeTask.reminders.find(off =>
    activeTask.remainingTime <= off && activeTask.remainingTime > off - 60
  );

  if (r && !activeTask.firedReminders.includes(r)) {
    // New reminder for this task
    toastCurrentOffset = r;
    activeTask.firedReminders.push(r);
    saveTasks();

    toastText.textContent = formatOffsetText(r);
    reminderToast.classList.remove('hidden');

    // Auto-hide in 10s
    clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      reminderToast.classList.add('hidden');
    }, 10000);

    // Drop exactly one leaf and keep it
    burstAtReminder();
  }

  // Let the next window hit later; do not re-show if already fired
};

  // Timer
  const startTicking = () => {
    clearInterval(timerInterval);
    overdueShown = activeTask.remainingTime <= 0;
    if (overdueShown) overdueOverlay.classList.remove('hidden');

    timerInterval = setInterval(() => {
      activeTask.remainingTime -= STEP_SECONDS;

      if (activeTask.remainingTime <= 0 && !overdueShown) {
        overdueShown = true;
        overdueOverlay.classList.remove('hidden');
      }

      updateTimerDisplay();
      updateReminderToast();
      saveTasks();
      // Removed continuous decorative leaves (Request 1)
    }, TICK_MS);
  };
  const pauseNow = () => { if (!activeTask) return; clearInterval(timerInterval); timerInterval=null; activeTask.status='paused'; saveTasks(); };

  // Start a task
  const startTask = (id) => {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  ensureReminderState(t);

  activeTask = t;
  activeTask.status = 'running';

  // Show the view first so containers have size
  showView('task');

  // Build branch leaves if not already present; do not clear the ground pile
  requestAnimationFrame(() => {
    initializeTree();
    scrubCornerLeaves();
  });

  // Reset toast display (not the history)
  clearTimeout(toastHideTimer);
  toastCurrentOffset = null;
  reminderToast.classList.add('hidden');

  activeTaskNameEl.textContent = activeTask.name;
  activeDurationEl.textContent = formatHM(activeTask.totalDuration);
  activeReminderCount.textContent = (activeTask.reminders || []).length;
  renderReminderDots(activeTask);

  updateTimerDisplay();
  updateReminderToast();

  pauseOverlay.classList.add('hidden');
  overdueOverlay.classList.toggle('hidden', !(activeTask.remainingTime <= 0));
  overdueShown = activeTask.remainingTime <= 0;

  pauseBtn.textContent = 'Pause';
  startTicking();
};

  // Complete active
  function completeActive() {
    if (!activeTask) return;
    activeTask.status = 'completed';
    activeTask.remainingTime = 0;
    overdueOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    clearInterval(timerInterval); timerInterval = null;
    saveTasks(); renderTodayView(); 
    // leafFallContainer.innerHTML = '';
    // fallenLeaves = [];
    // Hide toast and clear leaves at completion
    clearTimeout(toastHideTimer);
    reminderToast.classList.add('hidden');
    toastCurrentOffset = null;
    leafFallContainer.innerHTML = '';
    fallenLeaves = [];
    showView('today');
  }
  activeCheckbox.addEventListener('click', completeActive);
  doneBtn.addEventListener('click', completeActive);
  inTaskEditBtn.addEventListener('click', () => activeTask && openEditView(activeTask.id));

  // Pause overlay
  pauseBtn.addEventListener('click', () => { if (!activeTask) return; pauseNow(); pauseOverlay.classList.remove('hidden'); });
  resumeBtn.addEventListener('click', () => { if (!activeTask) return; pauseOverlay.classList.add('hidden'); activeTask.status='running'; pauseBtn.textContent='Pause'; startTicking(); });

  // Back
  backToTodayBtn.addEventListener('click', () => {
  if (activeTask) pauseNow();
  pauseOverlay.classList.add('hidden');
  overdueOverlay.classList.add('hidden');

  // Hide any toast only (don’t clear fallen leaves)
  clearTimeout(toastHideTimer);
  reminderToast.classList.add('hidden');
  toastCurrentOffset = null;

  renderTodayView();
  showView('today');
  });

  // Mindful break
  mindfulBreakChips.forEach(c => c.addEventListener('click', () => {
    if (activeTask) pauseNow();
    mindfulOverlay.classList.remove('hidden');
    clearInterval(mindfulInterval);
    mindfulInterval = setInterval(() => dropLeaf({parent: mindfulLeafContainer, isSwirl:true}), 500);
    setTimeout(() => dropLeaf({parent: mindfulLeafContainer, isSwirl:true, isYellow:true}), 1500);
  }));
  endMindfulBreakBtn.addEventListener('click', () => {
    clearInterval(mindfulInterval);
    mindfulOverlay.classList.add('hidden');
    setTimeout(()=> mindfulLeafContainer.innerHTML='', 500);
    if (activeTask) { activeTask.status='running'; pauseBtn.textContent='Pause'; startTicking(); showView('task'); }
  });

  // Overdue +15 min (also extend total duration)
  overdueAdd15Btn.addEventListener('click', () => {
    if (!activeTask) { overdueOverlay.classList.add('hidden'); return; }
    activeTask.remainingTime += 15*60;
    activeTask.totalDuration += 15*60;
    activeDurationEl.textContent = formatHM(activeTask.totalDuration);
    overdueShown = activeTask.remainingTime <= 0;
    if (!overdueShown) overdueOverlay.classList.add('hidden');
    renderReminderDots(activeTask);
    updateTimerDisplay(); saveTasks(); renderTodayView();
  });

  // Menu (deleted tasks)
  menuBtn.addEventListener('click', () => { renderDeletedList(); deletedOverlay.classList.remove('hidden'); });
  closeDeletedBtn.addEventListener('click', () => deletedOverlay.classList.add('hidden'));

  // Initial data: Article Reading only (10 mins) with 5m and 2m reminders
  const setupDefault = () => {
    localStorage.clear();
    tasks = [
      { id:1, name:'Article Reading', totalDuration:600, remainingTime:600, status:'paused', reminders:[300,120], firedReminders: [] }
    ];
    deletedTasks = [];
    saveTasks(); saveDeleted();
    loadTasks(); loadDeleted();
    tasks.forEach(t => ensureReminderState(t));
    renderTodayView(); showView('today');
  };

  setupDefault();
});