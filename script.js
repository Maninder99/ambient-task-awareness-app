document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM Element References =====
    const views = {
        today: document.getElementById('today-view'),
        task: document.getElementById('task-view'),
        edit: document.getElementById('edit-task-view'),
    };
    const taskList = document.getElementById('task-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const saveTaskBtn = document.getElementById('save-task-btn');
    const backToTodayBtn = document.getElementById('back-to-today-btn');
    const closeEditViewBtn = document.getElementById('close-edit-view-btn');
    const taskNameInput = document.getElementById('task-name-input');
    const durationMinInput = document.getElementById('task-duration-min');
    const durationSecInput = document.getElementById('task-duration-sec');
    const editViewTitle = document.getElementById('edit-view-title');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const restartTaskBtn = document.getElementById('restart-task-btn');
    
    const taskTreeContainer = document.getElementById('tree-container');
    const mindfulTreeContainer = document.getElementById('mindful-tree-container');
    const progressBar = document.getElementById('progress-bar');
    const timeDisplay = document.getElementById('time-display');
    const remindersDisplay = document.getElementById('reminders-display');
    const activeTaskName = document.getElementById('active-task-name');
    const pauseBtn = document.getElementById('pause-btn');
    const doneBtn = document.getElementById('done-btn');
    
    const pauseOverlay = document.getElementById('pause-overlay');
    const resumeBtn = document.getElementById('resume-btn');
    
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmActionBtn = document.getElementById('confirm-action-btn');
    const cancelActionBtn = document.getElementById('cancel-action-btn');

    // **FIX:** Select ALL mindful break chips
    const mindfulBreakChips = document.querySelectorAll('.mindful-break-chip');
    const mindfulOverlay = document.getElementById('mindful-break-overlay');
    const endMindfulBreakBtn = document.getElementById('end-mindful-break-btn');

    const addTimePrompt = document.getElementById('add-time-prompt');
    const add15MinBtn = document.getElementById('add-15-min-btn');

    // ===== State Management =====
    let tasks = [];
    let activeTask = null;
    let timerInterval = null;
    let editingTaskId = null;
    let confirmCallback = null;
    let mindfulInterval = null;

    // ===== Functions =====

    const showView = (viewName) => {
        Object.values(views).forEach(view => view.classList.add('hidden'));
        views[viewName].classList.remove('hidden');
    };

    const formatTime = (totalSeconds) => {
        if (totalSeconds < 0) totalSeconds = 0;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const renderTodayView = () => {
        taskList.innerHTML = '';
        tasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = 'task-item';
            taskEl.dataset.id = task.id;
            if (task.completed) taskEl.classList.add('completed');

            taskEl.innerHTML = `
                <div class="checkbox">${task.completed ? '&#10003;' : ''}</div>
                <div class="task-item-content">
                    <h3>${task.name}</h3>
                    <p>Duration: ${formatTime(task.totalDuration)}</p>
                </div>
                <div class="edit-icon" data-id="${task.id}">&#9998;</div>
            `;
            
            taskEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('edit-icon')) openEditView(task.id);
                else if (!task.completed) startTask(task.id);
            });

            taskEl.querySelector('.checkbox').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleComplete(task.id);
            });

            taskList.appendChild(taskEl);
        });
    };
    
    const toggleComplete = (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        task.completed = !task.completed;
        if(task.completed) {
            const taskEl = taskList.querySelector(`.task-item[data-id="${taskId}"]`);
            taskEl.querySelector('.checkbox').innerHTML = '&#10003;';
            taskEl.classList.add('completed', 'completed-flash');
            setTimeout(() => {
                taskEl.classList.remove('completed-flash');
                renderTodayView();
            }, 1000);
        }
        
        saveTasks();
        renderTodayView();
    };

    const saveTasks = () => localStorage.setItem('mindfulTasks', JSON.stringify(tasks));
    const loadTasks = () => {
        const storedTasks = localStorage.getItem('mindfulTasks');
        tasks = storedTasks ? JSON.parse(storedTasks) : [];
    };

    const openEditView = (taskId = null) => {
        editingTaskId = taskId;
        restartTaskBtn.classList.add('hidden');
        deleteTaskBtn.classList.add('hidden');
        
        if (taskId) {
            const task = tasks.find(t => t.id === taskId);
            editViewTitle.textContent = 'Editing Task...';
            taskNameInput.value = task.name;
            durationMinInput.value = Math.floor(task.totalDuration / 60);
            durationSecInput.value = task.totalDuration % 60;
            deleteTaskBtn.classList.remove('hidden');

            if (activeTask && activeTask.id === taskId) {
                restartTaskBtn.classList.remove('hidden');
            }
        } else {
            editViewTitle.textContent = 'New Task';
            taskNameInput.value = '';
            durationMinInput.value = '1';
            durationSecInput.value = '00';
        }
        taskNameInput.dispatchEvent(new Event('input')); 
        showView('edit');
    };

    const handleSaveTask = () => {
        const name = taskNameInput.value.trim();
        const minutes = parseInt(durationMinInput.value) || 0;
        const seconds = parseInt(durationSecInput.value) || 0;
        const totalDuration = (minutes * 60) + seconds;

        if (!name || totalDuration <= 0) return;

        if (editingTaskId) {
            const task = tasks.find(t => t.id === editingTaskId);
            task.name = name;
            task.totalDuration = totalDuration;
            if (activeTask && activeTask.id === editingTaskId) {
                activeTask.name = name;
                activeTask.totalDuration = totalDuration;
                activeTask.remainingTime = totalDuration;
                activeTaskName.textContent = name;
                projectTimeChange();
            }
        } else {
            tasks.push({
                id: Date.now(), name, totalDuration,
                remainingTime: totalDuration, completed: false, reminders: 2
            });
            views.today.classList.add('purple-bg-flash');
            setTimeout(() => views.today.classList.remove('purple-bg-flash'), 2000);
        }
        saveTasks();
        renderTodayView();
        showView('today');
        editingTaskId = null;
    };
    
    const startTask = (taskId) => {
        activeTask = tasks.find(t => t.id === taskId);
        if (!activeTask) return;
        
        if(activeTask.remainingTime === 0 || activeTask.remainingTime === activeTask.totalDuration) {
           activeTask.remainingTime = activeTask.totalDuration;
        }

        activeTaskName.textContent = activeTask.name;
        remindersDisplay.textContent = `Reminders: ${activeTask.reminders}`;
        updateTimerDisplay();
        showView('task');
        
        clearInterval(timerInterval);
        timerInterval = setInterval(tick, 1000);
    };

    const tick = () => {
        if (activeTask.remainingTime > 0) {
            activeTask.remainingTime--;
            updateTimerDisplay();

            const progress = 1 - (activeTask.remainingTime / activeTask.totalDuration);
            if (Math.floor(progress * 100) % 20 === 0 && Math.floor(progress * 100) > 0) {
                 if( !document.querySelector(`.leaf[data-progress="${Math.floor(progress * 100)}"]`)) {
                    dropLeaf({ parent: taskTreeContainer, isYellow: false, progress: Math.floor(progress * 100) });
                 }
            }

            if (activeTask.remainingTime === 120 && scenario === '8') {
                addTimePrompt.classList.remove('hidden');
            }
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    };

    const updateTimerDisplay = () => {
        timeDisplay.textContent = formatTime(activeTask.remainingTime);
        const progress = (activeTask.remainingTime / activeTask.totalDuration) * 100;
        progressBar.style.width = `${progress}%`;
    };

    /**
     * Creates and animates a falling leaf. Now more generic.
     * @param {object} options - { parent, isYellow, progress }
     */
    const dropLeaf = (options) => {
        const { parent, isYellow, progress } = options;
        const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        leaf.classList.add('leaf');
        if (isYellow) leaf.classList.add('yellow');
        leaf.innerHTML = '<use href="#leaf-shape"/>';
        if (progress) leaf.dataset.progress = progress;

        const animDuration = isYellow ? 12 : 5 + Math.random() * 5;
        leaf.style.animationDuration = `${animDuration}s`;
        
        leaf.style.left = `${20 + Math.random() * 60}%`;
        leaf.style.setProperty('--x-end', `${(Math.random() - 0.5) * 40}vw`);
        leaf.style.setProperty('--rotate-end', `${(Math.random() - 0.5) * 720}deg`);

        parent.appendChild(leaf);

        setTimeout(() => leaf.remove(), animDuration * 1000);
    };

    const projectTimeChange = () => {
        const branch = document.getElementById('tree-branch');
        branch.classList.add('branch-shake-anim');
        for (let i = 0; i < 5; i++) {
            setTimeout(() => dropLeaf({ parent: taskTreeContainer, isYellow: false }), i * 100);
        }
        branch.addEventListener('animationend', () => {
            branch.classList.remove('branch-shake-anim');
        }, { once: true });
    };

    const showConfirmation = (message, onConfirm) => {
        confirmationMessage.textContent = message;
        confirmCallback = onConfirm;
        confirmationModal.classList.remove('hidden');
    };
    
    // ===== Event Listeners =====

    addTaskBtn.addEventListener('click', () => openEditView(null));
    saveTaskBtn.addEventListener('click', handleSaveTask);
    closeEditViewBtn.addEventListener('click', () => activeTask ? showView('task') : showView('today'));
    backToTodayBtn.addEventListener('click', () => {
        if (activeTask) pauseTask();
        showView('today');
    });

    taskNameInput.addEventListener('input', () => {
        const totalDuration = (parseInt(durationMinInput.value) || 0) * 60 + (parseInt(durationSecInput.value) || 0);
        saveTaskBtn.disabled = !(taskNameInput.value.trim().length > 0 && totalDuration > 0);
    });
    durationMinInput.addEventListener('input', () => taskNameInput.dispatchEvent(new Event('input')));
    durationSecInput.addEventListener('input', () => taskNameInput.dispatchEvent(new Event('input')));

    const pauseTask = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        pauseOverlay.classList.remove('hidden');
        pauseBtn.textContent = "Resume";
    };
    const resumeTask = () => {
        pauseOverlay.classList.add('hidden');
        if (activeTask && activeTask.remainingTime > 0) timerInterval = setInterval(tick, 1000);
        pauseBtn.textContent = "Pause";
    };
    pauseBtn.addEventListener('click', () => timerInterval ? pauseTask() : resumeTask());
    resumeBtn.addEventListener('click', resumeTask);

    doneBtn.addEventListener('click', () => {
        if (!activeTask) return;
        clearInterval(timerInterval);
        timerInterval = null;
        activeTask.completed = true;
        activeTask.remainingTime = 0;
        saveTasks();
        renderTodayView();
        const taskEl = taskList.querySelector(`.task-item[data-id="${activeTask.id}"]`);
        if (taskEl) {
            taskEl.classList.add('completed-flash');
            setTimeout(() => taskEl.classList.remove('completed-flash'), 1000);
        }
        activeTask = null;
        showView('today');
    });

    cancelActionBtn.addEventListener('click', () => {
        confirmationModal.classList.add('hidden');
        confirmCallback = null;
    });
    confirmActionBtn.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        confirmationModal.classList.add('hidden');
        confirmCallback = null;
    });
    
    restartTaskBtn.addEventListener('click', () => {
        showConfirmation("Are you sure you want to restart?", () => {
            if (activeTask && activeTask.id === editingTaskId) {
                activeTask.remainingTime = activeTask.totalDuration;
                updateTimerDisplay();
            }
            showView('edit');
        });
    });

    // **NEW & IMPROVED:** Mindful Break Sequence
    const startMindfulBreakSequence = () => {
        mindfulOverlay.classList.remove('hidden');
        
        // Drop a shower of green leaves
        mindfulInterval = setInterval(() => {
            dropLeaf({ parent: mindfulTreeContainer, isYellow: false });
        }, 400);

        // After 2 seconds, drop the special yellow leaf
        setTimeout(() => {
            dropLeaf({ parent: mindfulTreeContainer, isYellow: true });
        }, 2000);
    };

    // **FIX:** Add listener to ALL chips
    mindfulBreakChips.forEach(chip => chip.addEventListener('click', startMindfulBreakSequence));

    endMindfulBreakBtn.addEventListener('click', () => {
        clearInterval(mindfulInterval); // Stop new green leaves
        mindfulOverlay.classList.add('hidden');
        // Clear any remaining leaves in the mindful container
        setTimeout(() => {
             mindfulTreeContainer.querySelectorAll('.leaf').forEach(l => l.remove());
        }, 1000); // Wait a moment for animations to finish
    });

    add15MinBtn.addEventListener('click', () => {
        if (activeTask) {
            activeTask.remainingTime += 15 * 60;
            updateTimerDisplay();
            projectTimeChange();
        }
        addTimePrompt.classList.add('hidden');
    });

    // ===== SCENARIO SETUP =====
    const urlParams = new URLSearchParams(window.location.search);
    const scenario = urlParams.get('scenario');
    const setupScenario = (scenario) => {
        localStorage.clear();
        let initialTasks = [
            { id: 1, name: 'Article Reading', totalDuration: 600, remainingTime: 600, completed: false, reminders: 2 },
            { id: 2, name: 'Programming exercises', totalDuration: 7200, remainingTime: 7200, completed: false, reminders: 3 },
            { id: 3, name: 'Bike Sketch', totalDuration: 1800, remainingTime: 1800, completed: false, reminders: 1 },
            { id: 4, name: 'HCI Quiz Preparation', totalDuration: 2700, remainingTime: 2700, completed: false, reminders: 2 },
            { id: 5, name: 'Programming Assignment', totalDuration: 10800, remainingTime: 10800, completed: false, reminders: 4 },
        ];
        
        switch(scenario) {
            case '1': tasks = [initialTasks[0]]; break;
            case '4': 
                tasks = [initialTasks[0]];
                setTimeout(() => openEditView(null), 100);
                break;
            case '5': 
                tasks = [initialTasks[1]];
                setTimeout(() => startTask(2), 100);
                break;
            case '6': tasks = [initialTasks[0], initialTasks[1]]; break;
            case '7':
                tasks = [initialTasks[1]];
                setTimeout(() => {
                    startTask(2);
                    activeTask.remainingTime -= 600;
                    updateTimerDisplay();
                }, 100);
                break;
            case '8':
                tasks = [initialTasks[2]];
                setTimeout(() => startTask(3), 100);
                break;
            case 'hci': tasks = [initialTasks[3], initialTasks[0]]; break;
            case 'prog': tasks = [initialTasks[4], initialTasks[1]]; break;
            default: tasks = initialTasks.slice(0, 3); break;
        }

        saveTasks(); loadTasks(); renderTodayView();
        if (scenario !== '4') showView('today');
    };

    // ===== INITIALIZATION =====
    setupScenario(scenario);
});