document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM Element References =====
    const views = { today: document.getElementById('today-view'), task: document.getElementById('task-view'), edit: document.getElementById('edit-task-view'), };
    const addTaskBtn = document.getElementById('add-task-btn');
    const saveTaskBtn = document.getElementById('save-task-btn');
    const backToTodayBtn = document.getElementById('back-to-today-btn');
    const closeEditViewBtn = document.getElementById('close-edit-view-btn');
    const taskNameInput = document.getElementById('task-name-input');
    // CHANGE 4: Add hours input reference
    const durationHrInput = document.getElementById('task-duration-hr');
    const durationMinInput = document.getElementById('task-duration-min');
    const durationSecInput = document.getElementById('task-duration-sec');
    const editViewTitle = document.getElementById('edit-view-title');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const restartTaskBtn = document.getElementById('restart-task-btn');
    
    // CHANGE 1: Reference the new leaf container
    const leafFallContainer = document.getElementById('leaf-fall-container');
    const mindfulLeafContainer = document.getElementById('mindful-leaf-container');
    
    const taskList = document.getElementById('task-list');
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
    const mindfulBreakChips = document.querySelectorAll('.mindful-break-chip');
    const mindfulOverlay = document.getElementById('mindful-break-overlay');
    const endMindfulBreakBtn = document.getElementById('end-mindful-break-btn');
    const addTimePrompt = document.getElementById('add-time-prompt');
    const add15MinBtn = document.getElementById('add-15-min-btn');

    // ===== State Management =====
    let tasks = [], activeTask = null, timerInterval = null, editingTaskId = null, confirmCallback = null, mindfulInterval = null;

    // ===== Functions =====
    const showView = (viewName) => {
        Object.values(views).forEach(view => view.classList.add('hidden'));
        views[viewName].classList.remove('hidden');
    };

    const formatTime = (totalSeconds) => {
        if (totalSeconds < 0) totalSeconds = 0;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
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
            taskEl.querySelector('.checkbox').addEventListener('click', (e) => { e.stopPropagation(); toggleComplete(task.id); });
            taskList.appendChild(taskEl);
        });
    };
    
    const toggleComplete = (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        task.completed = !task.completed;
        saveTasks();
        renderTodayView(); // Re-render to apply the strike-through style
    };

    const saveTasks = () => localStorage.setItem('mindfulTasks', JSON.stringify(tasks));
    const loadTasks = () => tasks = JSON.parse(localStorage.getItem('mindfulTasks') || '[]');

    const openEditView = (taskId = null) => {
        editingTaskId = taskId;
        restartTaskBtn.classList.add('hidden');
        deleteTaskBtn.classList.add('hidden');
        
        if (taskId) {
            const task = tasks.find(t => t.id === taskId);
            editViewTitle.textContent = 'Editing Task...';
            taskNameInput.value = task.name;
            // CHANGE 4: Populate H/M/S fields from total duration
            durationHrInput.value = Math.floor(task.totalDuration / 3600);
            durationMinInput.value = Math.floor((task.totalDuration % 3600) / 60);
            durationSecInput.value = task.totalDuration % 60;
            deleteTaskBtn.classList.remove('hidden');
            if (activeTask && activeTask.id === taskId) restartTaskBtn.classList.remove('hidden');
        } else {
            editViewTitle.textContent = 'New Task';
            taskNameInput.value = '';
            durationHrInput.value = '0';
            durationMinInput.value = '10'; // Default to 10 mins
            durationSecInput.value = '0';
        }
        validateDurationInput();
        showView('edit');
    };

    const handleSaveTask = () => {
        const name = taskNameInput.value.trim();
        // CHANGE 4: Calculate total duration from H/M/S
        const hours = parseInt(durationHrInput.value) || 0;
        const minutes = parseInt(durationMinInput.value) || 0;
        const seconds = parseInt(durationSecInput.value) || 0;
        const totalDuration = (hours * 3600) + (minutes * 60) + seconds;

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
            }
        } else {
            tasks.push({ id: Date.now(), name, totalDuration, remainingTime: totalDuration, completed: false, reminders: 2 });
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
        if (activeTask.remainingTime <= 0) activeTask.remainingTime = activeTask.totalDuration;
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
                if (!document.querySelector(`.leaf[data-progress="${Math.floor(progress * 100)}"]`)) {
                    dropLeaf({ parent: leafFallContainer, progress: Math.floor(progress * 100) });
                }
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

    const dropLeaf = (options) => {
        const { parent, progress, isYellow, isSwirl } = options;
        const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        leaf.classList.add('leaf');
        if (progress) leaf.dataset.progress = progress;

        let animDuration = 5 + Math.random() * 5;

        if(isSwirl) {
            animDuration = isYellow ? 12 : 8 + Math.random() * 4;
            leaf.classList.add(isYellow ? 'swirl-yellow' : 'swirl-green');
            leaf.style.setProperty('--x-start', `${10 + Math.random() * 80}vw`);
            leaf.style.setProperty('--x-end', `${(Math.random() - 0.5) * 60}vw`);
        }
        if(isYellow) leaf.classList.add('yellow');

        leaf.innerHTML = '<use href="#leaf-shape"/>';
        leaf.style.animationDuration = `${animDuration}s`;
        if(!isSwirl) { // Only set these for regular fall
            leaf.style.left = `${20 + Math.random() * 60}%`;
            leaf.style.setProperty('--x-end', `${(Math.random() - 0.5) * 40}vw`);
            leaf.style.setProperty('--rotate-end', `${(Math.random() - 0.5) * 720}deg`);
        }
        
        parent.appendChild(leaf);
        setTimeout(() => leaf.remove(), animDuration * 1000);
    };

    // CHANGE 4 Helper: Validate duration inputs to enable/disable save button
    const validateDurationInput = () => {
        const totalDuration = (parseInt(durationHrInput.value) || 0) * 3600 + (parseInt(durationMinInput.value) || 0) * 60 + (parseInt(durationSecInput.value) || 0);
        saveTaskBtn.disabled = !(taskNameInput.value.trim().length > 0 && totalDuration > 0);
    };
    
    // ===== Event Listeners =====
    addTaskBtn.addEventListener('click', () => openEditView(null));
    saveTaskBtn.addEventListener('click', handleSaveTask);
    closeEditViewBtn.addEventListener('click', () => activeTask ? showView('task') : showView('today'));
    
    // CHANGE 2: Back arrow pauses without a popup
    backToTodayBtn.addEventListener('click', () => {
        if (activeTask) {
            clearInterval(timerInterval);
            timerInterval = null; // Mark as paused
            pauseBtn.textContent = "Resume"; // Update button text for when user returns
        }
        showView('today');
    });

    [taskNameInput, durationHrInput, durationMinInput, durationSecInput].forEach(el => el.addEventListener('input', validateDurationInput));

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
        toggleComplete(activeTask.id); // Use the toggle function
        activeTask = null;
        showView('today');
    });
    
    // CHANGE 5: New Mindful Break Sequence
    const startMindfulBreakSequence = () => {
        mindfulOverlay.classList.remove('hidden');
        // Drop a shower of green swirling leaves
        mindfulInterval = setInterval(() => {
            dropLeaf({ parent: mindfulLeafContainer, isSwirl: true, isYellow: false });
        }, 500);

        // After 2 seconds, drop the special yellow leaf
        setTimeout(() => {
            dropLeaf({ parent: mindfulLeafContainer, isSwirl: true, isYellow: true });
        }, 2000);
    };

    mindfulBreakChips.forEach(chip => chip.addEventListener('click', startMindfulBreakSequence));

    endMindfulBreakBtn.addEventListener('click', () => {
        clearInterval(mindfulInterval);
        mindfulOverlay.classList.add('hidden');
        setTimeout(() => mindfulLeafContainer.querySelectorAll('.leaf').forEach(l => l.remove()), 1000);
    });

    // ... (rest of the listeners and scenario setup code is unchanged) ...
    // ... (This includes confirmation modal, restart task, add time) ...

    // ===== SCENARIO SETUP (Unchanged from before) =====
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
            case '4': setTimeout(() => openEditView(null), 100); break;
            case '5': tasks = [initialTasks[1]]; setTimeout(() => startTask(2), 100); break;
            case '6': tasks = [initialTasks[0], initialTasks[1]]; break;
            case '7': tasks = [initialTasks[1]]; setTimeout(() => { startTask(2); activeTask.remainingTime -= 600; updateTimerDisplay(); }, 100); break;
            case '8': tasks = [initialTasks[2]]; setTimeout(() => startTask(3), 100); break;
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