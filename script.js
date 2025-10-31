document.addEventListener('DOMContentLoaded', () => {
  // Views
  const views = {
    today: document.getElementById('today-view'),
    task: document.getElementById('task-view'),
    edit: document.getElementById('edit-task-view'),
  };

  // Today
  const taskList = document.getElementById('task-list');
  const addTaskBtn = document.getElementById('add-task-btn');

  // Task view
  const backToTodayBtn = document.getElementById('back-to-today-btn');
  const leafFallContainer = document.getElementById('leaf-fall-container');
  const timeDisplay = document.getElementById('time-display');
  const progressBar = document.getElementById('progress-bar');
  const reminderDotsEl = document.getElementById('reminder-dots');
  const activeReminderCount = document.getElementById('active-reminder-count');
  const activeTaskNameEl = document.getElementById('active-task-name');
  const activeDurationEl = document.getElementById('active-duration');
  const pauseBtn = document.getElementById('pause-btn');
  const doneBtn = document.getElementById('done-btn');
  const activeCheckbox = document.getElementById('active-checkbox');
  const inTaskEditBtn = document.getElementById('in-task-edit-btn');

  // Edit view
  const editViewTitle = document.getElementById('edit-view-title');
  const closeEditViewBtn = document.getElementById('close-edit-view-btn');
  const taskNameInput = document.getElementById('task-name-input');
  const durationHrInput = document.getElementById('task-duration-hr');
  const durationMinInput = document.getElementById('task-duration-min');
  const saveTaskBtn = document.getElementById('save-task-btn');
  const deleteTaskBtn = document.getElementById('delete-task-btn');
  const restartTaskBtn = document.getElementById('restart-task-btn');
  const reminderOptions = document.getElementById('reminder-options');
  const addCustomReminderBtn = document.getElementById('add-custom-reminder');

  // Overlays
  const mindfulBreakChips = document.querySelectorAll('.mindful-break-chip');
  const mindfulOverlay = document.getElementById('mindful-break-overlay');
  const mindfulLeafContainer = document.getElementById('mindful-leaf-container');
  const endMindfulBreakBtn = document.getElementById('end-mindful-break-btn');

  // Data/state
  let tasks = [];
  let activeTask = null;
  let timerInterval = null;
  let mindfulInterval = null;
  let editingTaskId = null;

  // Helpers
  const showView = (name) => {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[name].classList.remove('hidden');
  };

  const formatHM = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h} h ${m} m`;
    return `${m} m`;
  };

  const formatHMShort = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const saveTasks = () => localStorage.setItem('mindfulTasks', JSON.stringify(tasks));
  const loadTasks = () => tasks = JSON.parse(localStorage.getItem('mindfulTasks') || '[]');

  // Today rendering
  const renderTodayView = () => {
    taskList.innerHTML = '';
    tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'task-item';
      if (task.status === 'completed') row.classList.add('completed');

      row.innerHTML = `
        <div class="checkbox">${task.status === 'completed' ? '✓' : ''}</div>
        <div class="task-item-content">
          <h3>${task.name}</h3>
          <p><span class="clock-icn">🕒</span> Duration: ${formatHM(task.totalDuration)}</p>
          ${['running','paused'].includes(task.status) ? `<div class="status-line"><span>🕑</span> Started: ${formatHM(task.remainingTime)} remaining</div>` : ''}
        </div>
        <div class="right-icon" title="${task.status==='completed'?'Delete':'Edit'}">${task.status==='completed'?'🗑':'&#9998;'}</div>
      `;

      // Checkbox click toggles complete
      row.querySelector('.checkbox').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleComplete(task.id);
      });

      // Right icon edit/trash
      row.querySelector('.right-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        if (task.status === 'completed') {
          deleteTask(task.id);
        } else {
          openEditView(task.id);
        }
      });

      // Row click starts or resumes
      row.addEventListener('click', () => {
        if (task.status !== 'completed') startTask(task.id);
      });

      taskList.appendChild(row);
    });
  };

  const deleteTask = (id) => {
    tasks = tasks.filter(t => t.id !== id);
    if (activeTask && activeTask.id === id) {
      clearInterval(timerInterval);
      timerInterval = null;
      activeTask = null;
    }
    saveTasks(); renderTodayView();
  };

  const toggleComplete = (id) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    if (t.status === 'completed') {
      // un-complete (optional)
      t.status = 'paused';
    } else {
      t.status = 'completed';
      t.remainingTime = 0;
      if (activeTask && activeTask.id === id) {
        clearInterval(timerInterval);
        timerInterval = null; activeTask = null;
      }
    }
    saveTasks(); renderTodayView();
  };

  // Edit/New
  const validateDurationInput = () => {
    const nameOk = taskNameInput.value.trim().length > 0;
    const secs = getEditDurationSeconds();
    saveTaskBtn.disabled = !(nameOk && secs > 0);
    refreshReminderOptionsUI(secs);
  };

  const getEditDurationSeconds = () => {
    const h = parseInt(durationHrInput.value) || 0;
    const m = parseInt(durationMinInput.value) || 0;
    return h*3600 + m*60;
  };

  const getSelectedReminderOffsets = () => {
    const checked = [...reminderOptions.querySelectorAll('.rem-choice:checked')];
    return checked.map(i => parseInt(i.value));
  };

  const setSelectedReminderOffsets = (offsets=[]) => {
    [...reminderOptions.querySelectorAll('.rem-choice')].forEach(input => {
      input.checked = offsets.includes(parseInt(input.value));
    });
  };

  const refreshReminderOptionsUI = (totalSeconds) => {
    const inputs = reminderOptions.querySelectorAll('.rem-choice');
    inputs.forEach(input => {
      const off = parseInt(input.value);
      input.disabled = off >= totalSeconds; // can't set reminder after it starts or >= total
    });
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
      if (activeTask && activeTask.id === taskId && activeTask.status !== 'completed') {
        restartTaskBtn.classList.remove('hidden');
      }
    } else {
      editViewTitle.textContent = 'New Task';
      taskNameInput.value = '';
      durationHrInput.value = 0;
      durationMinInput.value = 10;
      setSelectedReminderOffsets([300]); // default 5 m
      refreshReminderOptionsUI(getEditDurationSeconds());
    }
    validateDurationInput();
    showView('edit');
  };

  const handleSaveTask = () => {
    const name = taskNameInput.value.trim();
    const total = getEditDurationSeconds();
    if (!name || total <= 0) return;
    const reminders = getSelectedReminderOffsets();

    if (editingTaskId) {
      const t = tasks.find(x => x.id === editingTaskId);
      t.name = name;
      t.totalDuration = total;
      t.reminders = reminders;
      if (activeTask && activeTask.id === editingTaskId) {
        activeTask.name = name;
        activeTask.totalDuration = total;
        activeTask.remainingTime = Math.min(activeTask.remainingTime, total);
      }
    } else {
      tasks.push({
        id: Date.now(),
        name,
        totalDuration: total,
        remainingTime: total,
        status: 'paused',
        reminders
      });
    }
    saveTasks(); renderTodayView(); showView('today');
  };

  deleteTaskBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    deleteTask(editingTaskId);
    showView('today');
  });

  restartTaskBtn.addEventListener('click', () => {
    if (!editingTaskId) return;
    const t = tasks.find(x => x.id === editingTaskId);
    t.remainingTime = t.totalDuration;
    t.status = 'paused';
    if (activeTask && activeTask.id === editingTaskId) {
      activeTask.remainingTime = t.totalDuration;
      activeTask.status = 'paused';
      clearInterval(timerInterval); timerInterval = null;
    }
    saveTasks(); renderTodayView();
  });

  // Add custom reminder
  addCustomReminderBtn.addEventListener('click', () => {
    const mins = prompt('Add reminder: minutes before end (e.g., 2 for 2 minutes)');
    if (mins === null) return;
    const m = parseInt(mins);
    if (isNaN(m) || m < 1) return alert('Enter a valid number of minutes.');
    const sec = m*60;
    // create a new option
    const row = document.createElement('label');
    row.className = 'rem-row';
    row.innerHTML = `<input type="checkbox" class="rem-choice" value="${sec}" checked><span>${m} m before end</span>`;
    reminderOptions.appendChild(row);
    validateDurationInput();
  });

  [taskNameInput, durationHrInput, durationMinInput].forEach(el => {
    el.addEventListener('input', validateDurationInput);
  });

  // Task runtime
  const renderReminderDots = (task) => {
    reminderDotsEl.innerHTML = '';
    const total = task.totalDuration;
    (task.reminders || []).forEach(off => {
      if (off >= total) return; // skip invalid
      const ratio = (total - off) / total; // progress at which reminder fires (elapsed)
      const dot = document.createElement('div');
      dot.className = 'reminder-dot';
      dot.style.left = `calc(${(ratio*100).toFixed(2)}% )`;
      reminderDotsEl.appendChild(dot);
    });
  };

  const updateTimerDisplay = () => {
    timeDisplay.textContent = `${formatHM(activeTask.remainingTime)} Remaining`;
    const elapsed = activeTask.totalDuration - activeTask.remainingTime;
    const pct = Math.max(0, Math.min(100, (elapsed / activeTask.totalDuration) * 100));
    progressBar.style.width = `${pct}%`;
  };

  const dropLeaf = ({parent, isYellow=false, isSwirl=false, progress}={}) => {
    const leaf = document.createElementNS('http://www.w3.org/2000/svg','svg');
    leaf.classList.add('leaf');
    if (isYellow) leaf.classList.add('yellow');
    if (isSwirl) leaf.classList.add(isYellow ? 'swirl-yellow':'swirl-green');
    leaf.innerHTML = '<use href="#leaf-shape"/>';
    const d = isSwirl ? (isYellow ? 12 : 9+Math.random()*3) : 6+Math.random()*4;
    leaf.style.animationDuration = `${d}s`;
    if (isSwirl) {
      leaf.style.setProperty('--x-start', `${10+Math.random()*80}vw`);
      leaf.style.setProperty('--x-end', `${(Math.random()-0.5)*60}vw`);
    } else {
      leaf.style.left = `${20 + Math.random()*60}%`;
      leaf.style.setProperty('--x-end', `${(Math.random()-0.5)*40}vw`);
      leaf.style.setProperty('--rotate-end', `${(Math.random()-0.5)*720}deg`);
      leaf.style.animationName = 'fall';
    }
    parent.appendChild(leaf);
    setTimeout(()=>leaf.remove(), d*1000);
  };

  const startTask = (id) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    activeTask = t;
    if (activeTask.remainingTime <= 0) activeTask.remainingTime = activeTask.totalDuration;
    activeTask.status = 'running';
    activeTaskNameEl.textContent = activeTask.name;
    activeDurationEl.textContent = formatHM(activeTask.totalDuration);
    activeReminderCount.textContent = (activeTask.reminders || []).length;
    renderReminderDots(activeTask);
    updateTimerDisplay();
    showView('task');

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      activeTask.remainingTime--;
      if (activeTask.remainingTime <= 0) {
        activeTask.remainingTime = 0;
        activeTask.status = 'completed';
        clearInterval(timerInterval); timerInterval = null;
      }
      updateTimerDisplay();

      // Decorative leaves
      const elapsed = activeTask.totalDuration - activeTask.remainingTime;
      if (elapsed % Math.ceil(activeTask.totalDuration/5) === 0) {
        dropLeaf({parent: leafFallContainer});
      }

      saveTasks();
    }, 60000); // tick every 1 minute (no seconds UI)
  };

  // Underbar actions
  activeCheckbox.addEventListener('click', () => {
    if (!activeTask) return;
    activeTask.status = 'completed';
    activeTask.remainingTime = 0;
    clearInterval(timerInterval); timerInterval = null;
    saveTasks(); renderTodayView(); showView('today');
  });
  inTaskEditBtn.addEventListener('click', () => {
    if (!activeTask) return;
    openEditView(activeTask.id);
  });

  // Pause/resume
  const pauseNow = () => {
    if (!activeTask) return;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    activeTask.status = 'paused';
    saveTasks();
  };

  pauseBtn.addEventListener('click', () => {
    if (timerInterval) {
      pauseNow();
      // optional in-view overlay removed per spec; button toggles to Resume
      pauseBtn.textContent = 'Resume';
    } else {
      // resume
      if (!activeTask) return;
      activeTask.status = 'running';
      timerInterval = setInterval(() => {
        activeTask.remainingTime--;
        if (activeTask.remainingTime <= 0) {
          activeTask.remainingTime = 0;
          activeTask.status = 'completed';
          clearInterval(timerInterval); timerInterval = null;
        }
        updateTimerDisplay(); saveTasks();
      }, 60000);
      pauseBtn.textContent = 'Pause';
    }
  });

  doneBtn.addEventListener('click', () => {
    if (!activeTask) return;
    activeTask.status = 'completed';
    activeTask.remainingTime = 0;
    clearInterval(timerInterval); timerInterval = null;
    saveTasks(); renderTodayView(); showView('today');
  });

  // Back button: pause + go to list (no overlay)
  backToTodayBtn.addEventListener('click', () => {
    if (activeTask) pauseNow();
    renderTodayView(); showView('today');
  });

  // Mindful break: pause + swirling leaves; button = Resume
  const startMindfulBreak = () => {
    if (activeTask) pauseNow();
    mindfulOverlay.classList.remove('hidden');
    clearInterval(mindfulInterval);
    mindfulInterval = setInterval(() => dropLeaf({parent: mindfulLeafContainer, isSwirl:true}), 500);
    // Yellow hero leaf after a moment
    setTimeout(() => dropLeaf({parent: mindfulLeafContainer, isSwirl:true, isYellow:true}), 1500);
  };
  mindfulBreakChips.forEach(c => c.addEventListener('click', startMindfulBreak));
  endMindfulBreakBtn.addEventListener('click', () => {
    clearInterval(mindfulInterval);
    mindfulOverlay.classList.add('hidden');
    setTimeout(()=> mindfulLeafContainer.innerHTML='', 500);
    if (activeTask) {
      // resume timer
      pauseBtn.textContent = 'Pause';
      activeTask.status = 'running';
      timerInterval = setInterval(() => {
        activeTask.remainingTime--;
        if (activeTask.remainingTime <= 0) {
          activeTask.remainingTime = 0;
          activeTask.status = 'completed';
          clearInterval(timerInterval); timerInterval = null;
        }
        updateTimerDisplay(); saveTasks();
      }, 60000);
      showView('task'); // stay in task view after resume
    }
  });

  // Add task
  addTaskBtn.addEventListener('click', () => openEditView(null));
  saveTaskBtn.addEventListener('click', handleSaveTask);
  closeEditViewBtn.addEventListener('click', () => activeTask ? showView('task') : showView('today'));

  // Scenarios for quick testing
  const scenario = new URLSearchParams(location.search).get('scenario');
  const setupScenario = () => {
    localStorage.clear();
    const base = [
      { id:1, name:'Article Reading', totalDuration:600, remainingTime:600, status:'paused', reminders:[300] },
      { id:2, name:'Programming exercises', totalDuration:7200, remainingTime:7200, status:'paused', reminders:[1800,900] },
      { id:3, name:'Bike Sketch', totalDuration:1800, remainingTime:1800, status:'paused', reminders:[600,300] },
      { id:4, name:'HCI Quiz Preparation', totalDuration:2700, remainingTime:2700, status:'paused', reminders:[900] },
      { id:5, name:'Programming Assignment', totalDuration:10800, remainingTime:10800, status:'paused', reminders:[3600,1800] },
    ];
    switch(scenario){
      case '1': tasks = [base[0]]; break;
      case '4': tasks = [base[0]]; setTimeout(()=>openEditView(null),100); break;
      case '5': tasks = [base[1]]; setTimeout(()=>startTask(2), 100); break;
      case '6': tasks = [base[0],base[1]]; break;
      case '7': tasks = [base[1]]; setTimeout(()=>{ startTask(2); activeTask.remainingTime -= 1200; updateTimerDisplay(); },100); break;
      case '8': tasks = [base[2]]; setTimeout(()=>startTask(3),100); break;
      case 'hci': tasks = [base[3], base[0]]; break;
      case 'prog': tasks = [base[4], base[1]]; break;
      default: tasks = base.slice(0,3); break;
    }
    saveTasks(); loadTasks(); renderTodayView(); showView('today');
  };

  setupScenario();
});