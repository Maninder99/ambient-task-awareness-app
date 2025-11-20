document.addEventListener('DOMContentLoaded', () => {
  const TICK_MS = 1000;
  const STEP_SECONDS = 1;
  const DEFAULT_REMINDER_VALUES = [5400, 3600, 2700, 1800, 900, 300, 120];

  // ----- Onboarding elements -----
  const onboardingView = document.getElementById('onboarding-view');
  const onboardingSlides = onboardingView
    ? onboardingView.querySelectorAll('.onboarding-slide')
    : [];
  const onboardingDots = onboardingView
    ? onboardingView.querySelectorAll('.onboarding-dot')
    : [];
  const onboardingBtn = document.getElementById('onboarding-primary-btn');

  // ----- Views -----
  const views = {
    onboarding: onboardingView,
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

  // Overlays & mindful
  const mindfulBreakChips = document.querySelectorAll('.mindful-break-chip');
  const mindfulOverlay = document.getElementById('mindful-break-overlay');
  const mindfulLeafContainer = document.getElementById('mindful-leaf-container');
  const endMindfulBreakBtn = document.getElementById('end-mindful-break-btn');

  const pauseOverlay = document.getElementById('pause-overlay');
  const resumeBtn = document.getElementById('resume-btn');

  // Overdue overlay controls
  const overdueOverlay = document.getElementById('overdue-overlay');
  const overdueMinusBtn = document.getElementById('overdue-minus');
  const overduePlusBtn = document.getElementById('overdue-plus');
  const overdueMinDisplay = document.getElementById('overdue-min-display');
  const overdueApplyBtn = document.getElementById('overdue-apply');

  const deletedOverlay = document.getElementById('deleted-overlay');
  const deletedListEl = document.getElementById('deleted-list');
  const closeDeletedBtn = document.getElementById('close-deleted');

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
  let toastHideTimer = null;

  let overdueExtensionMin = 5;

  // Tree state
  const TREE_LEAF_POSITIONS = [
    { x: 120, y: 250 }, { x: 140, y: 260 }, { x: 160, y: 270 },
    { x: 280, y: 280 }, { x: 260, y: 290 }, { x: 240, y: 300 },
    { x: 130, y: 240 }, { x: 270, y: 260 }, { x: 180, y: 310 },
    { x: 220, y: 320 }
  ];
  let fallenLeaves = [];

  // Storage helpers
  const saveTasks = () =>
    localStorage.setItem('mindfulTasks', JSON.stringify(tasks));
  const loadTasks = () =>
    (tasks = JSON.parse(localStorage.getItem('mindfulTasks') || '[]'));
  const saveDeleted = () =>
    localStorage.setItem('mindfulDeleted', JSON.stringify(deletedTasks));
  const loadDeleted = () =>
    (deletedTasks = JSON.parse(localStorage.getItem('mindfulDeleted') || '[]'));

  // ---------------- Helpers ----------------
  const showView = (name) => {
    Object.entries(views).forEach(([key, el]) => {
      if (!el) return;
      if (key === name) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  };

  const pad2 = (n) => String(n).padStart(2, '0');

  const formatHMS = (s) => {
    const sec = Math.max(0, Math.floor(s));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const ss = sec % 60;
    return h > 0
      ? `${h} h ${m} m ${pad2(ss)} s`
      : `${m} m ${pad2(ss)} s`;
  };

  const formatHM = (s) => {
    const abs = Math.max(0, Math.floor(s));
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    return h > 0 ? `${h} h ${m} m` : `${m} m`;
  };

  const formatOffsetLabel = (off) => {
    const h = Math.floor(off / 3600);
    const m = Math.floor((off % 3600) / 60);
    return h > 0
      ? `${h} h ${m} m before end`
      : `${m} m before end`;
  };

  const formatOffsetText = (off) =>
    `This is your ${Math.round(off / 60)} minutes reminder`;

  const formatDateTime = (ms) => new Date(ms).toLocaleString();

  const ensureReminderState = (t) => {
    if (!Array.isArray(t.firedReminders)) t.firedReminders = [];
  };

  // --------- Overdue picker UI helpers ---------
  function updateOverduePickerUI() {
    if (!overdueMinDisplay) return;
    overdueMinDisplay.textContent = `${overdueExtensionMin} m`;
    if (overdueMinusBtn) overdueMinusBtn.disabled = overdueExtensionMin <= 5;
  }

  function resetOverduePicker() {
    overdueExtensionMin = 5;
    updateOverduePickerUI();
  }

  function showOverdueOverlay() {
    resetOverduePicker();
    if (overdueOverlay) overdueOverlay.classList.remove('hidden');
  }

  function applyOverdueExtension() {
    if (!activeTask) {
      overdueOverlay.classList.add('hidden');
      return;
    }
    const extraSec = overdueExtensionMin * 60;
    activeTask.remainingTime += extraSec;
    activeTask.totalDuration += extraSec;

    activeDurationEl.textContent = formatHM(activeTask.totalDuration);
    overdueShown = activeTask.remainingTime <= 0;
    if (!overdueShown) overdueOverlay.classList.add('hidden');

    renderReminderDots(activeTask);
    updateTimerDisplay();
    saveTasks();
    renderTodayView();

    if (activeTask.status === 'running') {
      startTicking();
    }
  }

  // ---------------- Today rendering ----------------

  const renderTodayView = () => {
    taskList.innerHTML = '';
    tasks.forEach((task) => {
      const showRemainingLine =
        (task.status === 'running' || task.status === 'paused') &&
        task.remainingTime !== task.totalDuration;

      const row = document.createElement('div');
      row.className = 'task-item';
      if (task.status === 'completed') row.classList.add('completed');

      row.innerHTML = `
        <div class="checkbox">${task.status === 'completed' ? '✓' : ''}</div>
        <div class="task-item-content">
          <h3>${task.name}</h3>
          <p><span class="clock-icn">🕒</span> Duration: ${formatHM(task.totalDuration)}</p>
          ${
            showRemainingLine
              ? `<div class="status-line" style="${
                  task.remainingTime < 0 ? 'color:#b00020' : ''
                }">
                 <span>🕑</span>
                 ${
                   task.remainingTime >= 0
                     ? `Started: ${formatHM(task.remainingTime)} remaining`
                     : `Overdue: ${formatHM(-task.remainingTime)}`
                 }
               </div>`
              : ''
          }
        </div>
        <div class="right-icon" title="${
          task.status === 'completed' ? 'Delete' : 'Edit'
        }">${task.status === 'completed' ? '🗑' : '&#9998;'}</div>
      `;

      row.querySelector('.checkbox').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleComplete(task.id);
      });

      row.querySelector('.right-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        if (task.status === 'completed') deleteTask(task.id);
        else openEditView(task.id);
      });

      row.addEventListener('click', () => {
        if (task.status !== 'completed') startTask(task.id);
      });

      taskList.appendChild(row);
    });
  };

  // Deleted list rendering
  const renderDeletedList = () => {
    deletedListEl.innerHTML = '';
    if (!deletedTasks.length) {
      deletedListEl.innerHTML =
        '<div class="meta">No deleted tasks.</div>';
      return;
    }

    deletedTasks
      .slice()
      .reverse()
      .forEach((d) => {
        const row = document.createElement('div');
        row.className = 'deleted-item';
        row.innerHTML = `
          <div>
            <div><strong>${d.name}</strong></div>
            <div class="meta">
              Deleted: ${formatDateTime(d.deletedAt)} · Duration: ${formatHM(
          d.totalDuration
        )}
            </div>
          </div>
          <button class="restore-btn">Restore</button>
        `;
        row
          .querySelector('.restore-btn')
          .addEventListener('click', () => {
            tasks.push({
              id: Date.now(),
              name: d.name,
              totalDuration: d.totalDuration,
              remainingTime: d.totalDuration,
              status: 'paused',
              reminders: d.reminders || [],
              firedReminders: [],
            });
            deletedTasks = deletedTasks.filter(
              (x) => x.deletedAt !== d.deletedAt
            );
            saveTasks();
            saveDeleted();
            renderDeletedList();
            renderTodayView();
          });
        deletedListEl.appendChild(row);
      });
  };

  // ---------------- CRUD ops ----------------

  const deleteTask = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    deletedTasks.push({ ...t, deletedAt: Date.now() });
    tasks = tasks.filter((x) => x.id !== id);
    if (activeTask && activeTask.id === id) {
      clearInterval(timerInterval);
      timerInterval = null;
      activeTask = null;
    }
    saveDeleted();
    saveTasks();
    renderTodayView();
  };

  const toggleComplete = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.status === 'completed') {
      t.status = 'paused';
      t.remainingTime = t.totalDuration;
    } else {
      t.status = 'completed';
      t.remainingTime = 0;
      if (activeTask && activeTask.id === id) {
        clearInterval(timerInterval);
        timerInterval = null;
        activeTask = null;
      }
    }
    saveTasks();
    renderTodayView();
  };

  // ---------------- Edit/New helpers ----------------

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

  addCustomReminderBtn.addEventListener('click', () => {
    customRemMin.value = '2';
    customModal.classList.remove('hidden');
  });
  customRemCancel.addEventListener('click', () =>
    customModal.classList.add('hidden')
  );
  customRemAdd.addEventListener('click', () => {
    const m = parseInt(customRemMin.value, 10);
    if (Number.isNaN(m) || m < 1) return;
    ensureCustomRowForOffset(m * 60);
    customModal.classList.add('hidden');
  });

  const getEditDurationSeconds = () => {
    const h = parseInt(durationHrInput.value, 10) || 0;
    const m = parseInt(durationMinInput.value, 10) || 0;
    return h * 3600 + m * 60;
  };

  const setSelectedReminderOffsets = (offs = []) => {
    offs.forEach((o) => ensureCustomRowForOffset(o));
    [...reminderOptions.querySelectorAll('.rem-choice')].forEach((i) => {
      i.checked = offs.includes(parseInt(i.value, 10));
    });
  };

  const getSelectedReminderOffsets = () =>
    [...reminderOptions.querySelectorAll('.rem-choice:checked')].map((i) =>
      parseInt(i.value, 10)
    );

  const refreshReminderOptionsUI = (total) => {
    [...reminderOptions.querySelectorAll('.rem-choice')].forEach((i) => {
      i.disabled = parseInt(i.value, 10) >= total;
    });
  };

  const validateDurationInput = () => {
    const okName = taskNameInput.value.trim().length > 0;
    const total = getEditDurationSeconds();
    saveTaskBtn.disabled = !(okName && total > 0);
    refreshReminderOptionsUI(total);
  };

  const openEditView = (taskId = null) => {
    editingTaskId = taskId;
    restartTaskBtn.classList.add('hidden');

    if (taskId) {
      const t = tasks.find((x) => x.id === taskId);
      editViewTitle.textContent = 'Editing Task';
      taskNameInput.value = t.name;
      durationHrInput.value = Math.floor(t.totalDuration / 3600);
      durationMinInput.value = Math.floor(
        (t.totalDuration % 3600) / 60
      );
      setSelectedReminderOffsets(t.reminders || []);
      refreshReminderOptionsUI(t.totalDuration);

      if (activeTask && activeTask.id === taskId && activeTask.status !== 'completed') {
        restartTaskBtn.classList.remove('hidden');
      }
    } else {
      editViewTitle.textContent = 'New Task';
      taskNameInput.value = '';
      durationHrInput.value = 1;
      durationMinInput.value = 0;
      setSelectedReminderOffsets([300, 120]);
      refreshReminderOptionsUI(getEditDurationSeconds());
    }

    validateDurationInput();
    showView('edit');
  };

  const handleSaveTask = () => {
    const name = taskNameInput.value.trim();
    const newTotal = getEditDurationSeconds();
    if (!name || newTotal <= 0) return;
    const reminders = getSelectedReminderOffsets().sort((a, b) => a - b);

    if (editingTaskId) {
      const t = tasks.find((x) => x.id === editingTaskId);
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
        activeTask.reminders = reminders;

        activeTaskNameEl.textContent = name;
        activeDurationEl.textContent = formatHM(newTotal);
        activeReminderCount.textContent = reminders.length;
        renderReminderDots(activeTask);
        updateTimerDisplay();
      }
    } else {
      tasks.push({
        id: Date.now(),
        name,
        totalDuration: newTotal,
        remainingTime: newTotal,
        status: 'paused',
        reminders,
        firedReminders: [],
      });
    }
    saveTasks();
    renderTodayView();
    showView('today');
  };

  saveTaskBtn.addEventListener('click', handleSaveTask);

  cancelTaskBtn.addEventListener('click', () => {
    activeTask ? showView('task') : showView('today');
  });

  restartTaskBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    const t = tasks.find((x) => x.id === editingTaskId);
    t.remainingTime = t.totalDuration;
    t.status = 'paused';
    t.firedReminders = [];
    if (activeTask && activeTask.id === editingTaskId) {
      activeTask.remainingTime = t.totalDuration;
      activeTask.status = 'paused';
      activeTask.firedReminders = [];
      clearInterval(timerInterval);
      timerInterval = null;
    }
    saveTasks();
    renderTodayView();
  });

  [taskNameInput, durationHrInput, durationMinInput].forEach((el) =>
    el.addEventListener('input', validateDurationInput)
  );

  closeEditViewBtn.addEventListener('click', () => {
    activeTask ? showView('task') : showView('today');
  });

  addTaskBtn.addEventListener('click', () => openEditView(null));

  // ---------------- Progress & time ----------------

  const renderReminderDots = (task) => {
    reminderDotsEl.innerHTML = '';
    const total = Math.max(task.totalDuration, 1);
    (task.reminders || []).forEach((off) => {
      if (off >= total) return;
      const ratio = (total - off) / total;
      const dot = document.createElement('div');
      dot.className = 'reminder-dot';
      dot.style.left = `${(ratio * 100).toFixed(2)}%`;
      reminderDotsEl.appendChild(dot);
    });
  };

  const setOverdueUI = (isOverdue) => {
    timeDisplay.classList.toggle('overdue', isOverdue);
    progressContainer.classList.toggle('overdue', isOverdue);
    overdueBadge.classList.toggle('hidden', !isOverdue);
  };

  const updateTimerDisplay = () => {
    if (!activeTask) return;
    if (activeTask.remainingTime >= 0) {
      timeDisplay.textContent = `~ ${formatHMS(
        activeTask.remainingTime
      )} Remaining`;
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
    const pct = Math.max(
      0,
      Math.min(100, (elapsed / total) * 100)
    );
    progressBar.style.width = `${pct}%`;
  };

  // ---------------- Leaf helpers ----------------

  const scrubCornerLeaves = () => {
    const container = leafFallContainer;
    if (!container) return;
    const crect = container.getBoundingClientRect();
    [...container.querySelectorAll('.leaf')].forEach((el) => {
      const r = el.getBoundingClientRect();
      const nearLeft = r.left - crect.left < 6;
      const nearTop = r.top - crect.top < 6;
      if (!el.classList.contains('falling') && nearLeft && nearTop) {
        el.remove();
      }
    });
  };

  const dropLeafFromTree = () => {
    const layer = leafFallContainer;
    if (!layer) return;

    const rect = layer.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      requestAnimationFrame(dropLeafFromTree);
      return;
    }

    const anchor =
      TREE_LEAF_POSITIONS[
        Math.floor(Math.random() * TREE_LEAF_POSITIONS.length)
      ];

    const cw = rect.width;
    const ch = rect.height;

    const startXpx = (anchor.x / 400) * cw;
    const startYpx = (anchor.y / 500) * ch;

    const leaf = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    leaf.classList.add('leaf', 'falling');
    if (Math.random() > 0.8) leaf.classList.add('yellow');
    leaf.innerHTML = '<g class="leaf-inner"><use href="#leaf-shape"/></g>';

    leaf.style.position = 'absolute';
    leaf.style.left = `${startXpx}px`;
    leaf.style.top = `${startYpx}px`;

    const xDriftPx =
      (Math.random() - 0.5) * Math.min(150, cw * 0.25);
    const rotation = Math.floor(
      (Math.random() - 0.5) * 720
    );

    const groundHeight = 60;
    const leafHeight = 30;
    const stackOffset =
      fallenLeaves.length * 2 + Math.random() * 8;

    const targetY = Math.max(
      0,
      ch - groundHeight - leafHeight - stackOffset
    );
    const fallDistance = Math.max(0, targetY - startYpx);

    leaf.style.setProperty('--x-drift', `${xDriftPx}px`);
    leaf.style.setProperty(
      '--fall-distance',
      `${fallDistance.toFixed(2)}px`
    );
    leaf.style.setProperty('--rotate-end', `${rotation}deg`);

    layer.appendChild(leaf);

    setTimeout(() => {
      leaf.classList.remove('falling');
      leaf.classList.add('fallen');
      leaf.style.left = `${(startXpx + xDriftPx).toFixed(2)}px`;
      leaf.style.top = `${(
        startYpx + fallDistance
      ).toFixed(2)}px`;
      leaf.style.transform = `rotate(${rotation}deg)`;
      fallenLeaves.push(leaf);
      scrubCornerLeaves();
    }, 2600);
  };

  // Swirl leaves for mindful break overlay
  const dropLeaf = ({ parent, isSwirl = false, isYellow = false } = {}) => {
    const container = parent || leafFallContainer;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    leaf.classList.add('leaf');
    if (isYellow) leaf.classList.add('yellow');

    if (isSwirl) {
      leaf.classList.add(isYellow ? 'swirl-yellow' : 'swirl-green');
    } else {
      leaf.classList.add('falling');
    }

    leaf.innerHTML = '<g class="leaf-inner"><use href="#leaf-shape"/></g>';
    leaf.style.position = 'absolute';
    leaf.style.left = `${Math.random() * rect.width}px`;
    leaf.style.top = `-40px`;

    container.appendChild(leaf);

    const removeDelay = isSwirl ? 4500 : 3000;
    setTimeout(() => leaf.remove(), removeDelay);
  };

  const burstAtReminder = () => {
    dropLeafFromTree();
  };

  // ---------------- Reminders ----------------

  const updateReminderToast = () => {
    if (!activeTask || !activeTask.reminders) return;
    ensureReminderState(activeTask);

    const r = activeTask.reminders.find(
      (off) =>
        activeTask.remainingTime <= off &&
        activeTask.remainingTime > off - 60
    );

    if (r && !activeTask.firedReminders.includes(r)) {
      activeTask.firedReminders.push(r);
      saveTasks();

      toastText.textContent = formatOffsetText(r);
      reminderToast.classList.remove('hidden');

      clearTimeout(toastHideTimer);
      toastHideTimer = setTimeout(() => {
        reminderToast.classList.add('hidden');
      }, 10000);

      burstAtReminder();
    }
  };

  // ---------------- Timer ----------------

  const startTicking = () => {
    if (!activeTask) return;
    clearInterval(timerInterval);

    overdueShown = activeTask.remainingTime <= 0;
    if (overdueShown) showOverdueOverlay();
    else overdueOverlay.classList.add('hidden');

    timerInterval = setInterval(() => {
      activeTask.remainingTime -= STEP_SECONDS;

      if (activeTask.remainingTime <= 0 && !overdueShown) {
        overdueShown = true;
        showOverdueOverlay();
      }

      updateTimerDisplay();
      updateReminderToast();
      saveTasks();
    }, TICK_MS);
  };

  const pauseNow = () => {
    if (!activeTask) return;
    clearInterval(timerInterval);
    timerInterval = null;
    activeTask.status = 'paused';
    saveTasks();
  };

  // ---------------- Start / Complete active ----------------

  const startTask = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    ensureReminderState(t);

    activeTask = t;
    activeTask.status = 'running';

    showView('task');

    clearTimeout(toastHideTimer);
    reminderToast.classList.add('hidden');

    activeTaskNameEl.textContent = activeTask.name;
    activeDurationEl.textContent = formatHM(activeTask.totalDuration);
    activeReminderCount.textContent = (activeTask.reminders || []).length;
    renderReminderDots(activeTask);

    updateTimerDisplay();
    updateReminderToast();

    pauseOverlay.classList.add('hidden');
    overdueShown = activeTask.remainingTime <= 0;
    if (overdueShown) showOverdueOverlay();
    else overdueOverlay.classList.add('hidden');

    pauseBtn.textContent = 'Pause';
    startTicking();
  };

  const completeActive = () => {
    if (!activeTask) return;
    activeTask.status = 'completed';
    activeTask.remainingTime = 0;
    overdueOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    clearInterval(timerInterval);
    timerInterval = null;
    saveTasks();
    renderTodayView();
    clearTimeout(toastHideTimer);
    reminderToast.classList.add('hidden');
    leafFallContainer.innerHTML = '';
    fallenLeaves = [];
    activeTask = null;
    showView('today');
  };

  doneBtn.addEventListener('click', completeActive);

  inTaskEditBtn.addEventListener('click', () => {
    if (activeTask) openEditView(activeTask.id);
  });

  // Pause overlay
  pauseBtn.addEventListener('click', () => {
    if (!activeTask) return;
    pauseNow();
    pauseOverlay.classList.remove('hidden');
  });

  resumeBtn.addEventListener('click', () => {
    if (!activeTask) return;
    pauseOverlay.classList.add('hidden');
    activeTask.status = 'running';
    pauseBtn.textContent = 'Pause';
    startTicking();
  });

  // Back from task to today
  backToTodayBtn.addEventListener('click', () => {
    if (activeTask) pauseNow();
    pauseOverlay.classList.add('hidden');
    overdueOverlay.classList.add('hidden');
    clearTimeout(toastHideTimer);
    reminderToast.classList.add('hidden');
    renderTodayView();
    showView('today');
  });

  // Mindful break (header + home bottom)
  mindfulBreakChips.forEach((c) =>
    c.addEventListener('click', () => {
      if (activeTask) pauseNow();
      mindfulOverlay.classList.remove('hidden');
      clearInterval(mindfulInterval);
      mindfulLeafContainer.innerHTML = '';
      mindfulInterval = setInterval(
        () =>
          dropLeaf({
            parent: mindfulLeafContainer,
            isSwirl: true,
          }),
        600
      );
      setTimeout(
        () =>
          dropLeaf({
            parent: mindfulLeafContainer,
            isSwirl: true,
            isYellow: true,
          }),
        1200
      );
    })
  );

  endMindfulBreakBtn.addEventListener('click', () => {
    clearInterval(mindfulInterval);
    mindfulOverlay.classList.add('hidden');
    setTimeout(() => {
      mindfulLeafContainer.innerHTML = '';
    }, 500);
    if (activeTask) {
      activeTask.status = 'running';
      pauseBtn.textContent = 'Pause';
      startTicking();
      showView('task');
    }
  });

  // Overdue +/- & Apply
  if (overdueMinusBtn) {
    overdueMinusBtn.addEventListener('click', () => {
      if (overdueExtensionMin > 5) {
        overdueExtensionMin -= 5;
        updateOverduePickerUI();
      }
    });
  }
  if (overduePlusBtn) {
    overduePlusBtn.addEventListener('click', () => {
      overdueExtensionMin += 5;
      updateOverduePickerUI();
    });
  }
  if (overdueApplyBtn) {
    overdueApplyBtn.addEventListener('click', applyOverdueExtension);
  }

  // Menu for deleted tasks
  menuBtn.addEventListener('click', () => {
    renderDeletedList();
    deletedOverlay.classList.remove('hidden');
  });
  closeDeletedBtn.addEventListener('click', () =>
    deletedOverlay.classList.add('hidden')
  );

  // ---------------- Onboarding logic ----------------

  let onboardingStep = 0;

  const setOnboardingStep = (index) => {
    if (!onboardingView) return;
    const maxIndex = onboardingSlides.length - 1;
    onboardingStep = Math.max(0, Math.min(maxIndex, index));

    onboardingSlides.forEach((s, i) =>
      s.classList.toggle('active', i === onboardingStep)
    );
    onboardingDots.forEach((d, i) =>
      d.classList.toggle('active', i === onboardingStep)
    );

    if (!onboardingBtn) return;

    // First & last slide: "Start", middle slides: "Next"
    if (onboardingStep === 0 || onboardingStep === maxIndex) {
      onboardingBtn.textContent = 'Start';
    } else {
      onboardingBtn.textContent = 'Next';
    }
  };

  if (onboardingBtn) {
    onboardingBtn.addEventListener('click', () => {
      const maxIndex = onboardingSlides.length - 1;
      if (onboardingStep < maxIndex) {
        setOnboardingStep(onboardingStep + 1);
        return;
      }
      // finished onboarding
      localStorage.setItem('mindfulOnboardingDone', '1');
      renderTodayView();
      showView('today');
    });
  }

  // ---------------- Initial data & init ----------------

  const ensureDefaultData = () => {
    loadTasks();
    loadDeleted();
    tasks.forEach((t) => ensureReminderState(t));

    if (!tasks.length && !deletedTasks.length) {
      tasks = [
        {
          id: 1,
          name: 'Article Reading',
          totalDuration: 600,
          remainingTime: 600,
          status: 'paused',
          reminders: [300, 120],
          firedReminders: [],
        },
      ];
      saveTasks();
      saveDeleted();
    }
  };

  const initApp = () => {
    ensureDefaultData();
    renderTodayView();

    const onboardingDone =
      localStorage.getItem('mindfulOnboardingDone') === '1';

    if (!onboardingDone && onboardingView) {
      setOnboardingStep(0);
      showView('onboarding');
    } else {
      showView('today');
    }
  };

  initApp();
});