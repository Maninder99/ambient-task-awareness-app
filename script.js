document.addEventListener('DOMContentLoaded', () => {
  // Timer speed: seconds-based
  const TICK_MS = 1000;       // tick every second
  const STEP_SECONDS = 1;     // decrease 1 second per tick

  // Default built-in reminder values (seconds before end)
  const DEFAULT_REMINDER_VALUES = [5400,3600,2700,1800,900,300,120]; // + 2m

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
  const deleteTaskBtn = document.getElementById('delete-task-btn');
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

  // Deleted tasks overlay
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
  let toastCurrentOffset = null; // seconds before end currently being shown

  // Storage
  const saveTasks = () => localStorage.setItem('mindfulTasks', JSON.stringify(tasks));
  const loadTasks = () => tasks = JSON.parse(localStorage.getItem('mindfulTasks') || '[]');
  const saveDeleted = () => localStorage.setItem('mindfulDeleted', JSON.stringify(deletedTasks));
  const loadDeleted = () => deletedTasks = JSON.parse(localStorage.getItem('mindfulDeleted') || '[]');

  // Helpers
  const showView = (name) => { Object.values(views).forEach(v => v.classList.add('hidden')); views[name].classList.remove('hidden'); };
  const pad2 = (n) => String(n).padStart(2,'0');
  const formatHMS = (s) => {
    const sec = Math.max(0, Math.floor(s));
    const h = Math.floor(sec/3600);
    const m = Math.floor((sec%3600)/60);
    const ss = sec%60;
    if (h>0) return `${h} h ${m} m ${pad2(ss)} s`;
    return `${m} m ${pad2(ss)} s`;
  };
  const formatHM = (sec) => { const abs = Math.max(0, Math.floor(sec)); const h = Math.floor(abs/3600), m = Math.floor((abs%3600)/60); return h>0?`${h} h ${m} m`:`${m} m`; };
  const formatOffsetText = (offsetSec) => {
    const m = Math.round(offsetSec/60);
    return `This is your ${m} minutes reminder`;
  };
  const formatOffsetLabel = (offsetSec) => {
    const h = Math.floor(offsetSec/3600);
    const m = Math.floor((offsetSec%3600)/60);
    return h>0?`${h} h ${m} m before end`:`${m} m before end`;
  };
  const formatDateTime = (ms) => new Date(ms).toLocaleString();

  // Today render (only show remaining line when remaining != total)
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

  // Deleted overlay
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
        tasks.push({
          id: Date.now(), name: d.name, totalDuration: d.totalDuration,
          remainingTime: d.totalDuration, status:'paused', reminders: d.reminders || []
        });
        deletedTasks = deletedTasks.filter(x => x.deletedAt !== d.deletedAt);
        saveTasks(); saveDeleted(); renderDeletedList(); renderTodayView();
      });
      deletedListEl.appendChild(row);
    });
  };

  // CRUD helpers
  const deleteTask = (id) => {
    const t = tasks.find(x => x.id === id); if (!t) return;
    deletedTasks.push({ ...t, deletedAt: Date.now() });
    tasks = tasks.filter(x => x.id !== id);
    if (activeTask && activeTask.id === id) { clearInterval(timerInterval); timerInterval = null; activeTask = null; }
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
  addCustomReminderBtn.addEventListener('click', () => {
    customRemMin.value = '2';
    customModal.classList.remove('hidden');
  });
  customRemCancel.addEventListener('click', () => customModal.classList.add('hidden'));
  customRemAdd.addEventListener('click', () => {
    const m = parseInt(customRemMin.value,10);
    if (isNaN(m) || m<1) return;
    const sec = m*60;
    ensureCustomRowForOffset(sec);
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
    saveTaskBtn.disabled = !(okName && total > 0);
    refreshReminderOptionsUI(total);
  };

  const openEditView = (taskId=null) => {
    editingTaskId = taskId;
    deleteTaskBtn.classList.toggle('hidden', !taskId);
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
      setSelectedReminderOffsets([300,120]); // default: 5m & 2m before end
      refreshReminderOptionsUI(getEditDurationSeconds());
    }
    validateDurationInput();
    showView('edit');
  };

  const handleSaveTask = () => {
    const name = taskNameInput.value.trim();
    const newTotal = getEditDurationSeconds();
    if (!name || newTotal <= 0) return;
    const reminders = getSelectedReminderOffsets().sort((a,b)=>a-b); // low to high

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
      tasks.push({
        id: Date.now(), name,
        totalDuration: newTotal, remainingTime: newTotal,
        status: 'paused', reminders
      });
    }
    saveTasks();
    renderTodayView();
    showView('today');
  };

  saveTaskBtn.addEventListener('click', handleSaveTask);
  cancelTaskBtn.addEventListener('click', () => { activeTask ? showView('task') : showView('today'); });
  deleteTaskBtn.addEventListener('click', () => { if (!editingTaskId) return; deleteTask(editingTaskId); showView('today'); });
  restartTaskBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    const t = tasks.find(x => x.id === editingTaskId);
    t.remainingTime = t.totalDuration; t.status = 'paused';
    if (activeTask && activeTask.id === editingTaskId) { activeTask.remainingTime = t.totalDuration; activeTask.status='paused'; clearInterval(timerInterval); timerInterval=null; }
    saveTasks(); renderTodayView();
  });
  [taskNameInput, durationHrInput, durationMinInput].forEach(el => el.addEventListener('input', validateDurationInput));
  closeEditViewBtn.addEventListener('click', () => activeTask ? showView('task') : showView('today'));
  addTaskBtn.addEventListener('click', () => openEditView(null));

  // Progress + time
  const renderReminderDots = (task) => {
    reminderDotsEl.innerHTML = '';
    const total = Math.max(task.totalDuration, 1);
    (task.reminders || []).forEach(off => {
      if (off >= total) return;
      const ratio = (total - off) / total; // elapsed fraction when reminder fires
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

  // Reminder toast logic: show for 60 seconds window per offset
  const updateReminderToast = () => {
    if (!activeTask || !activeTask.reminders) return;
    // find an offset r where remainingTime in (r-60, r]
    const r = activeTask.reminders.find(off => activeTask.remainingTime <= off && activeTask.remainingTime > off - 60);
    if (r && toastCurrentOffset !== r) {
      toastCurrentOffset = r;
      toastText.textContent = formatOffsetText(r);
      reminderToast.classList.remove('hidden');
    }
    if (!r && toastCurrentOffset !== null) {
      // window ended
      reminderToast.classList.add('hidden');
      toastCurrentOffset = null;
    }
  };

  // Leaves
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

  // Timer
  const startTicking = () => {
    clearInterval(timerInterval);
    overdueShown = activeTask.remainingTime <= 0;
    if (overdueShown) overdueOverlay.classList.remove('hidden'); // keep visible, timer still runs

    timerInterval = setInterval(() => {
      activeTask.remainingTime -= STEP_SECONDS;

      if (activeTask.remainingTime <= 0 && !overdueShown) {
        overdueShown = true;
        overdueOverlay.classList.remove('hidden');
      }

      updateTimerDisplay();
      updateReminderToast();
      saveTasks();
      dropLeaf({parent: leafFallContainer});
    }, TICK_MS);
  };
  const pauseNow = () => { if (!activeTask) return; clearInterval(timerInterval); timerInterval=null; activeTask.status='paused'; saveTasks(); };

  // Start task
  const startTask = (id) => {
    const t = tasks.find(x => x.id === id); if (!t) return;
    activeTask = t; activeTask.status = 'running';
    toastCurrentOffset = null; reminderToast.classList.add('hidden');

    activeTaskNameEl.textContent = activeTask.name;
    activeDurationEl.textContent = formatHM(activeTask.totalDuration);
    activeReminderCount.textContent = (activeTask.reminders || []).length;
    renderReminderDots(activeTask);
    updateTimerDisplay();
    updateReminderToast();

    pauseOverlay.classList.add('hidden');
    overdueOverlay.classList.toggle('hidden', !(activeTask.remainingTime <= 0));
    overdueShown = activeTask.remainingTime <= 0;

    showView('task');
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
    saveTasks(); renderTodayView(); showView('today');
  }
  activeCheckbox.addEventListener('click', completeActive);
  doneBtn.addEventListener('click', completeActive);
  inTaskEditBtn.addEventListener('click', () => activeTask && openEditView(activeTask.id));

  // Pause overlay
  pauseBtn.addEventListener('click', () => { if (!activeTask) return; pauseNow(); pauseOverlay.classList.remove('hidden'); });
  resumeBtn.addEventListener('click', () => { if (!activeTask) return; pauseOverlay.classList.add('hidden'); activeTask.status='running'; pauseBtn.textContent='Pause'; startTicking(); });

  // Back
  backToTodayBtn.addEventListener('click', () => { if (activeTask) pauseNow(); pauseOverlay.classList.add('hidden'); overdueOverlay.classList.add('hidden'); renderTodayView(); showView('today'); });

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

  // Overdue +15 min (Request 5: extend duration too)
  overdueAdd15Btn.addEventListener('click', () => {
    if (!activeTask) { overdueOverlay.classList.add('hidden'); return; }
    activeTask.remainingTime += 15*60;
    activeTask.totalDuration += 15*60;     // extend original duration
    activeDurationEl.textContent = formatHM(activeTask.totalDuration);
    overdueShown = activeTask.remainingTime <= 0;
    if (!overdueShown) overdueOverlay.classList.add('hidden');
    renderReminderDots(activeTask);        // dots shift relative to new total
    updateTimerDisplay(); saveTasks(); renderTodayView();
  });

  // Menu: deleted tasks
  menuBtn.addEventListener('click', () => { renderDeletedList(); deletedOverlay.classList.remove('hidden'); });
  closeDeletedBtn.addEventListener('click', () => deletedOverlay.classList.add('hidden'));

  // Initial data: homepage only Article Reading (10 mins) with 5m and 2m reminders
  const setupDefault = () => {
    localStorage.clear();
    tasks = [
      { id:1, name:'Article Reading', totalDuration:600, remainingTime:600, status:'paused', reminders:[300,120] }
    ];
    deletedTasks = [];
    saveTasks(); saveDeleted();
    loadTasks(); loadDeleted();
    renderTodayView(); showView('today');
  };

  setupDefault();
});