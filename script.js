let userProfile; // Holds the decoded JWT profile
let tasks = [];
let settings = {};
let currentFilter = 'All';

// --- JWT Parsing and Auth Handling ---
function parseJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
        return null;
    }
}

function handleCredentialResponse(response) {
    const profile = parseJwt(response.credential);
    if (profile) {
        userProfile = profile;
        sessionStorage.setItem('google_jwt', response.credential);
        showApp();
    }
}

function signOut() {
    google.accounts.id.disableAutoSelect();
    sessionStorage.removeItem('google_jwt');
    userProfile = null;
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    // Update UI with user info
    document.getElementById('user-avatar').src = userProfile.picture;
    document.getElementById('user-name').textContent = userProfile.name;
    document.getElementById('user-email').textContent = userProfile.email;
    
    // Initialize the rest of the application
    initApp();
}

// --- User-Specific Data Storage ---
const getTasksKey = () => `academiaplan-tasks-${userProfile.sub}`;
const getSettingsKey = () => `academiaplan-settings-${userProfile.sub}`;

const loadTasks = () => { tasks = JSON.parse(localStorage.getItem(getTasksKey())) || []; };
const saveTasks = () => { localStorage.setItem(getTasksKey(), JSON.stringify(tasks)); };
const loadSettings = () => {
    settings = JSON.parse(localStorage.getItem(getSettingsKey())) || {
        notifications: false,
        reminderTime: 24
    };
};
const saveSettings = () => { localStorage.setItem(getSettingsKey(), JSON.stringify(settings)); };

// --- System Theme Handling ---
const applySystemTheme = () => {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
};

// Apply theme once on initial load
applySystemTheme();

// Listen for theme changes on the system
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);


document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication check on page load ---
    const jwt = sessionStorage.getItem('google_jwt');
    if (jwt) {
        userProfile = parseJwt(jwt);
        if (userProfile) {
            showApp();
        }
    }
    lucide.createIcons(); 
});

// --- App initialization logic ---
function initApp() {
    const mainContent = document.getElementById('main-content'),
          templates = document.getElementById('templates');

    const formatDate = (d) => {
        if (!d) return '';
        const [year, month, day] = d.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    };
    
    const renderPage = (page) => {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active-nav-link', l.dataset.page === page));
        mainContent.innerHTML = templates.querySelector(`#${page}-page`).innerHTML;
        if (page === 'dashboard') setupDashboardPage();
        if (page === 'tasks') setupTasksPage();
        if (page === 'calendar') setupCalendarPage();
        if (page === 'analytics') setupAnalyticsPage();
        if (page === 'settings') setupSettingsPage();
        lucide.createIcons();
    };

    function setupDashboardPage() {
        const total = tasks.length, completed = tasks.filter(t => t.status === 'Completed').length;
        
        const reminderHours = settings.reminderTime || 24;
        const dueSoon = tasks.filter(t => {
            if (t.status === 'Completed' || !t.dueDate) return false;
            const timeUntilDue = (new Date(t.dueDate).getTime() - new Date().getTime()) / 36e5;
            return timeUntilDue > 0 && timeUntilDue <= reminderHours;
        });

        const stats = [
            { label: 'Total Tasks', value: total, icon: 'book-open' }, { label: 'Completed', value: completed, icon: 'bar-chart-3' },
            { label: 'Due Soon', value: dueSoon.length, icon: 'calendar' }, { label: 'Success Rate', value: `${total > 0 ? Math.round(completed/total*100) : 0}%`, icon: 'trending-up' }
        ];
        document.getElementById('dashboard-stats').innerHTML = stats.map(s => `
            <div class="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div><p class="text-sm font-medium text-gray-600 dark:text-gray-400">${s.label}</p><p class="text-2xl font-bold text-gray-900 dark:text-white">${s.value}</p></div>
                <div class="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg"><i data-lucide="${s.icon}" class="w-6 h-6 text-blue-600 dark:text-blue-400"></i></div>
            </div>`).join('');
        
        const overviewEl = document.getElementById('dashboard-overview');
        overviewEl.innerHTML = `<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Overview</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"><p class="text-sm text-gray-600 dark:text-gray-300">Total</p><p class="font-bold text-lg text-gray-900 dark:text-white">${total}</p></div>
                <div class="p-4 bg-green-50 dark:bg-green-900/50 rounded-lg"><p class="text-sm text-green-800 dark:text-green-300">Completed</p><p class="font-bold text-lg text-green-600">${completed}</p></div>
                <div class="p-4 bg-yellow-50 dark:bg-yellow-900/50 rounded-lg"><p class="text-sm text-yellow-800 dark:text-yellow-300">Pending</p><p class="font-bold text-lg text-yellow-600">${total-completed}</p></div>
            </div>`;

        const getReminderLabel = (hours) => {
            if (hours < 24) return `Next ${hours} Hours`;
            if (hours === 24) return `Next 24 Hours`;
            if (hours === 168) return `Next 7 Days`;
            return `Next ${hours / 24} Days`;
        }
        const dueSoonLabel = getReminderLabel(reminderHours);
        const dueSoonEl = document.getElementById('dashboard-due-soon');
        dueSoonEl.innerHTML = `<h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">${dueSoonLabel}</h3>` + (dueSoon.length > 0 ? dueSoon.map(t => `
            <div class="p-3 rounded-lg mb-2 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div><p class="font-medium text-gray-900 dark:text-white">${t.title}</p><p class="text-sm text-gray-500 dark:text-gray-400">${t.subject}</p></div>
                <p class="text-sm font-semibold text-orange-600 dark:text-orange-400">${formatDate(t.dueDate)}</p>
            </div>`).join('') : `<p class="text-gray-500 dark:text-gray-400 text-center py-4">No tasks due soon.</p>`);
    }

    function setupTasksPage() {
        const filters = ['All', 'Pending', 'In Progress', 'Completed'];
        const filterButtonsContainer = document.getElementById('filter-buttons');
        const taskListContainer = document.getElementById('full-task-list');
        const filtered = currentFilter === 'All' ? tasks : tasks.filter(t => t.status === currentFilter);

        const renderTaskList = () => {
            const isOverdue = (dueDate, status) => {
                if (status === 'Completed' || !dueDate) return false;
                const due = new Date(dueDate);
                const today = new Date();
                today.setHours(0,0,0,0);
                return due < today;
            }
            taskListContainer.innerHTML = filtered.length > 0 ? `<div class="divide-y divide-gray-200 dark:divide-gray-700">${filtered.map(task => `
                <div class="p-6 flex items-start justify-between ${task.status === 'Completed' ? 'opacity-60' : ''}">
                    <div>
                       <h3 class="font-medium text-gray-900 dark:text-white ${task.status === 'Completed' ? 'line-through' : ''}">${task.title}</h3>
                       <div class="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                           <div class="flex items-center gap-1.5"><i data-lucide="book-open" class="w-4 h-4"></i><span>${task.subject}</span></div>
                           <div class="flex items-center gap-1.5">
                               <i data-lucide="calendar" class="w-4 h-4"></i>
                               <span class="${isOverdue(task.dueDate, task.status) ? 'text-red-500 font-medium' : ''}">
                                   Due ${formatDate(task.dueDate)}
                                   ${isOverdue(task.dueDate, task.status) ? ' (Overdue)' : ''}
                               </span>
                           </div>
                       </div>
                       <div class="mt-3"><select class="task-status-select text-xs px-3 py-1 rounded-full border font-medium bg-transparent status-badge-${task.status.replace(' ','-')}" data-id="${task.id}">${filters.slice(1).map(s => `<option value="${s}" ${task.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                    </div>
                    <div class="flex items-center gap-2">
                       <button class="edit-btn p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg" data-id="${task.id}"><i data-lucide="edit-2" class="w-4 h-4 text-gray-500"></i></button>
                       <button class="delete-btn p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg" data-id="${task.id}"><i data-lucide="trash-2" class="w-4 h-4 text-gray-500"></i></button>
                    </div>
                </div>`).join('')}</div>` : `<div class="text-center py-16"><i data-lucide="calendar" class="w-12 h-12 mx-auto text-gray-400"></i><h3 class="mt-2 text-lg font-medium text-gray-900 dark:text-white">No tasks yet</h3><p class="mt-1 text-sm text-gray-500">Add your first task to get started!</p></div>`;
            lucide.createIcons();
        };

        filterButtonsContainer.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="filter" class="w-5 h-5 text-gray-500"></i><span class="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by status:</span></div>` + filters.map(f => `<button class="px-3 py-1 rounded-full text-sm font-medium ${currentFilter === f ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}" data-filter="${f}">${f}</button>`).join('') + `<div class="ml-auto text-sm text-gray-500 dark:text-gray-400">${filtered.length} tasks</div>`;
        
        filterButtonsContainer.addEventListener('click', e => { 
            const button = e.target.closest('button');
            if (button && button.dataset.filter) { 
                currentFilter = button.dataset.filter;
                renderPage('tasks'); 
            }
        });

        taskListContainer.addEventListener('click', e => { const btn = e.target.closest('button'); if(btn){ const id = btn.dataset.id; if (btn.classList.contains('edit-btn')) openTaskModal(tasks.find(t=>t.id===id)); if (btn.classList.contains('delete-btn')) deleteTask(id); }});
        taskListContainer.addEventListener('change', e => { 
            if (e.target.classList.contains('task-status-select')) { 
                const {id} = e.target.dataset, {value} = e.target;
                const task = tasks.find(t => t.id === id);
                if (task) {
                    task.status = value;
                    if (value === 'Completed' && !task.completedAt) {
                        task.completedAt = new Date().toISOString();
                    } else if (value !== 'Completed' && task.completedAt) {
                        delete task.completedAt;
                    }
                }
                saveTasks(); 
                renderTaskList(); 
            }
        });
        document.getElementById('open-add-modal-btn').addEventListener('click', () => openTaskModal());
        renderTaskList();
    }
    
    function setupCalendarPage() {
        const container = document.getElementById('calendar-container');
        let currentDate = new Date();
        const renderCalendar = () => {
            const year = currentDate.getFullYear(), month = currentDate.getMonth();
            const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate(), startDayIndex = firstDay.getDay();
            let html = `<div class="flex items-center justify-between mb-6">
                            <button id="prev-month" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><i data-lucide="chevron-left"></i></button>
                            <h2 class="text-lg font-semibold">${currentDate.toLocaleString('default', { month: 'long' })} ${year}</h2>
                            <button id="next-month" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><i data-lucide="chevron-right"></i></button>
                        </div>
                        <div class="grid grid-cols-7 gap-1 text-center text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div>${d}</div>`).join('')}
                        </div>
                        <div id="calendar-grid" class="grid grid-cols-7 gap-1">`;
            for (let i = 0; i < startDayIndex; i++) html += `<div></div>`;
            for (let day = 1; day <= daysInMonth; day++) {
                const monthStr = String(month + 1).padStart(2, '0');
                const dayStr = String(day).padStart(2, '0');
                const dateStr = `${year}-${monthStr}-${dayStr}`;

                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                
                const dayTasks = tasks.filter(t => t.dueDate === dateStr);
                const isToday = todayStr === dateStr;
                const statusColor = (s) => ({'Completed': 'bg-green-500', 'In Progress': 'bg-blue-500', 'Pending': 'bg-yellow-500'})[s];
                html += `<div class="min-h-[90px] p-1 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 calendar-day ${isToday ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'bg-white dark:bg-gray-800/50'}" data-date="${dateStr}">
                            <div class="font-medium text-sm ${isToday ? 'text-blue-700 dark:text-blue-300' : ''}">${day}</div>
                            <div class="space-y-1 mt-1">${dayTasks.slice(0, 2).map(t => `<div class="text-xs px-1 py-0.5 rounded truncate text-white ${statusColor(t.status)}">${t.title}</div>`).join('')}
                            ${dayTasks.length > 2 ? `<div class="text-xs text-gray-500 px-1">+${dayTasks.length - 2} more</div>` : ''}</div>
                        </div>`;
            }
            html += `</div>`;
            container.innerHTML = html;
            
            const infoSection = document.getElementById('calendar-info-section');
            
            const now = new Date();
            const thisMonthTasks = tasks.filter(task => {
                if(!task.dueDate) return false;
                const taskDate = new Date(task.dueDate);
                return taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear();
            }).length;

            const oneWeekFromNow = new Date();
            oneWeekFromNow.setDate(now.getDate() + 7);
            const dueThisWeek = tasks.filter(task => {
                if (task.status === 'Completed' || !task.dueDate) return false;
                const taskDate = new Date(task.dueDate);
                return taskDate >= now && taskDate <= oneWeekFromNow;
            }).length;

            const overdueTasks = tasks.filter(task => {
                if (task.status === 'Completed' || !task.dueDate) return false;
                const taskDate = new Date(task.dueDate);
                return taskDate < now;
            }).length;

            infoSection.innerHTML = `
                <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">How to Use</h3>
                    <ul class="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                        <li class="flex items-start gap-3"><span class="w-2 h-2 mt-1.5 bg-blue-500 rounded-full"></span><span>Click on any date to see tasks scheduled for that day.</span></li>
                        <li class="flex items-start gap-3"><span class="w-2 h-2 mt-1.5 bg-green-500 rounded-full"></span><span>Colored dots indicate task status and subject.</span></li>
                        <li class="flex items-start gap-3"><span class="w-2 h-2 mt-1.5 bg-orange-500 rounded-full"></span><span>Today's date is highlighted with a blue border.</span></li>
                    </ul>
                </div>
                <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Quick Stats</h3>
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between"><span>This Month's Tasks</span><span class="font-medium">${thisMonthTasks}</span></div>
                        <div class="flex justify-between"><span>Due This Week</span><span class="font-medium">${dueThisWeek}</span></div>
                        <div class="flex justify-between"><span>Overdue Tasks</span><span class="font-medium text-red-500">${overdueTasks}</span></div>
                    </div>
                </div>
            `;
            
            lucide.createIcons();
            container.querySelector('#prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
            container.querySelector('#next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
            
            document.getElementById('calendar-grid').addEventListener('click', (e) => {
                const dayCell = e.target.closest('.calendar-day');
                if(dayCell && dayCell.dataset.date) {
                    openDateTasksModal(dayCell.dataset.date);
                }
            });
        };
        renderCalendar();
    }

    function setupAnalyticsPage() {
        const total = tasks.length, completedTasks = tasks.filter(t => t.status === 'Completed');
        const completed = completedTasks.length;
        const overdue = tasks.filter(t => t.status !== 'Completed' && new Date(t.dueDate) < new Date()).length;
        const completionRate = total > 0 ? Math.round(completed/total*100) : 0;
        const subjectStats = tasks.reduce((acc, t) => { acc[t.subject] = acc[t.subject] || { total: 0, completed: 0 }; acc[t.subject].total++; if (t.status === 'Completed') acc[t.subject].completed++; return acc; }, {});
        
        const completedWithDates = completedTasks.filter(t => t.createdAt && t.completedAt);
        let avgCompletionText = 'N/A';
        if (completedWithDates.length > 0) {
            const totalTime = completedWithDates.reduce((sum, task) => sum + (new Date(task.completedAt) - new Date(task.createdAt)), 0);
            const avgTime = totalTime / completedWithDates.length / (1000 * 60 * 60 * 24);
            avgCompletionText = `${avgTime.toFixed(1)}d`;
        }

        const icons = {'Completion Rate':'target', 'Avg. Completion':'trending-up', 'Overdue Tasks':'calendar', 'Active Subjects':'bar-chart-3'};
        document.getElementById('analytics-key-metrics').innerHTML = [
            { label: 'Completion Rate', value: `${completionRate}%` }, { label: 'Avg. Completion', value: avgCompletionText },
            { label: 'Overdue Tasks', value: overdue }, { label: 'Active Subjects', value: Object.keys(subjectStats).length }
        ].map(m => `<div class="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center"><div><p class="text-sm text-gray-500 dark:text-gray-400">${m.label}</p><p class="text-2xl font-bold">${m.value}</p></div><div class="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg"><i data-lucide="${icons[m.label]}"></i></div></div>`).join('');
        
        document.getElementById('analytics-subject-performance').innerHTML = `<h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Subject Performance</h3>` + (Object.keys(subjectStats).length > 0 ? Object.entries(subjectStats).map(([sub, stats]) => { const rate = stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0; return `<div class="mb-2"><p class="text-gray-800 dark:text-gray-200">${sub} (${rate}%)</p><div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"><div class="bg-blue-500 h-2 rounded-full" style="width: ${rate}%"></div></div></div>`; }).join('') : `<p class="text-gray-500 dark:text-gray-400 text-center py-8">No data available. Start adding tasks to see analytics!</p>`);
        
        // --- ACCURATE 4-WEEK PROGRESS LOGIC ---
        const weeklyData = [];
        // Loop for the last 4 weeks (i=0 is this week, i=3 is 3 weeks ago)
        for (let i = 3; i >= 0; i--) {
            const today = new Date();
            const weekStart = new Date(today);
            // Go to the first day of the week (Sunday), then go back i weeks
            weekStart.setDate(today.getDate() - today.getDay() - (i * 7));
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            // 1. Get all tasks CREATED in this week to calculate the "total"
            const weekTasks = tasks.filter(task => {
                if (!task.createdAt) return false;
                const createdAt = new Date(task.createdAt);
                return createdAt >= weekStart && createdAt <= weekEnd;
            });
            
            // 2. From THAT group of tasks, find how many are completed
            const completedThisWeek = weekTasks.filter(task => task.status === 'Completed').length;
            
            const weekIndex = 3 - i; // Makes the weeks appear in chronological order
            const label = ["3 Weeks Ago", "2 Weeks Ago", "Last Week", "This Week"][weekIndex];

            weeklyData.push({ 
                label: label, 
                completed: completedThisWeek, 
                total: weekTasks.length 
            });
        }

        const maxCompleted = Math.max(...weeklyData.map(w => w.completed), 1);
        const scale = 80 / maxCompleted;
        
        // Reverted to a fixed 4-column grid
        document.getElementById('analytics-weekly-progress').innerHTML = `<h3 class="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Weekly Progress</h3><div class="grid grid-cols-4 gap-4">${weeklyData.map(w => `<div class="text-center"><div class="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-end p-2 justify-center"><div class="w-8 bg-blue-400 rounded-t-md" style="height: ${w.completed * scale}%"></div></div><p class="mt-2 text-sm font-medium text-gray-900 dark:text-white">${w.label}</p><p class="text-xs text-gray-500 dark:text-gray-400">${w.completed}/${w.total}</p></div>`).join('')}</div>`;

        document.getElementById('analytics-study-insights').innerHTML = `<h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Study Insights</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div><h4 class="font-medium text-gray-900 dark:text-white">Strengths</h4><div class="space-y-2 text-sm mt-2">${completionRate >= 80 ? '<p class="text-green-600">High completion rate!</p>' : ''}${overdue === 0 && total > 0 ? '<p class="text-green-600">No overdue tasks.</p>' : ''}</div></div><div><h4 class="font-medium text-gray-900 dark:text-white">Areas for Improvement</h4><div class="space-y-2 text-sm mt-2">${completionRate < 60 && total > 0 ? '<p class="text-orange-600">Focus on task completion.</p>' : ''}${overdue > 0 ? `<p class="text-red-600">Address ${overdue} overdue tasks.</p>` : ''}</div></div></div>`;
    }

    function setupSettingsPage() {
        const preferencesEl = document.getElementById('settings-preferences');
        
        const reminderOptions = [
            { value: 1, label: '1 Hour' }, { value: 10, label: '10 Hours' },
            { value: 24, label: '24 Hours' }, { value: 48, label: '48 Hours' },
            { value: 168, label: '1 Week' }
        ];

        preferencesEl.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3"><i data-lucide="bell" class="text-gray-500 dark:text-gray-400"></i><div><h4 class="text-gray-900 dark:text-white">Notifications</h4><p class="text-sm text-gray-500 dark:text-gray-400">Remind you of upcoming deadlines</p></div></div>
                <label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="notifications-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div></label>
            </div>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3"><i data-lucide="clock" class="text-gray-500 dark:text-gray-400"></i><div><h4 class="text-gray-900 dark:text-white">Reminder Time</h4><p class="text-sm text-gray-500 dark:text-gray-400">Hours before due date</p></div></div>
                <select id="reminder-time-select" class="p-2 border rounded dark:bg-gray-700 bg-white dark:border-gray-600">
                    ${reminderOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
                </select>
            </div>`;
        
        document.getElementById('notifications-toggle').checked = settings.notifications;
        document.getElementById('reminder-time-select').value = settings.reminderTime;

        document.getElementById('notifications-toggle').addEventListener('change', handleNotificationToggle);
        document.getElementById('reminder-time-select').addEventListener('change', (e) => {
            settings.reminderTime = parseInt(e.target.value);
            saveSettings();
        });
        
        document.getElementById('settings-data-management').innerHTML = `<button id="export-data-btn" class="p-4 border dark:border-gray-700 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"><i data-lucide="upload" class="mb-2 text-blue-600"></i><h4 class="font-semibold text-gray-900 dark:text-white">Export Data</h4><p class="text-sm text-gray-500 dark:text-gray-400">Download backup</p></button><label class="p-4 border dark:border-gray-700 rounded-lg text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"><i data-lucide="download" class="mb-2 text-green-600"></i><h4 class="font-semibold text-gray-900 dark:text-white">Import Data</h4><p class="text-sm text-gray-500 dark:text-gray-400">Restore from backup</p><input type="file" id="import-file-input" class="hidden" accept=".json"></label><button id="clear-data-btn" class="p-4 border border-red-200 dark:border-red-800 text-red-500 rounded-lg text-left hover:bg-red-50 dark:hover:bg-red-900/50"><i data-lucide="trash-2" class="mb-2"></i><h4 class="font-semibold">Clear All Data</h4><p class="text-sm">Delete everything</p></button>`;
        document.getElementById('export-data-btn').addEventListener('click', exportData); document.getElementById('import-file-input').addEventListener('change', importData); document.getElementById('clear-data-btn').addEventListener('click', clearData);
        document.getElementById('settings-about').innerHTML = `<div><span>Version</span><span class="font-medium float-right">1.4.0 (Fixed 4-Week View)</span></div><div><span>Last Updated</span><span class="font-medium float-right">${new Date().toLocaleDateString()}</span></div><div><span>Data Storage</span><span class="font-medium float-right">Local Browser Storage</span></div><p class="mt-4 pt-4 border-t dark:border-gray-700">Smart Study Planner helps students organize their academic tasks...</p>`;
    }

    function openTaskModal(task = null) {
        const form = document.getElementById('task-form');
        document.getElementById('modal-title').textContent = task ? 'Edit Task' : 'Add New Task';
        form.innerHTML = `<input type="hidden" name="id" value="${task ? task.id : ''}">
            <div><label class="text-sm font-medium text-gray-700 dark:text-gray-300">Task Title</label><input type="text" name="title" required class="mt-1 w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600" value="${task ? task.title : ''}"></div>
            <div><label class="text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label><input type="text" name="subject" required class="mt-1 w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600" value="${task ? task.subject : ''}"></div>
            <div><label class="text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</label><input type="date" name="dueDate" required class="mt-1 w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600" value="${task ? task.dueDate : ''}"></div>
            <div><label class="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label><select name="status" class="mt-1 w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600">${['Pending', 'In Progress', 'Completed'].map(s => `<option value="${s}" ${task && task.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            <button type="submit" class="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700">${task ? 'Update Task' : 'Add Task'}</button>`;
        document.getElementById('task-modal').classList.remove('hidden');
    }

    function openDateTasksModal(dateStr) {
        const modal = document.getElementById('date-tasks-modal');
        const titleEl = document.getElementById('date-tasks-modal-title');
        const contentEl = document.getElementById('date-tasks-modal-content');
        
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        
        titleEl.textContent = `Tasks for ${formattedDate}`;

        const dayTasks = tasks.filter(t => t.dueDate === dateStr);
        if (dayTasks.length > 0) {
            contentEl.innerHTML = `<div class="space-y-3">${dayTasks.map(task => {
                const statusColor = {'Pending': 'bg-yellow-500', 'In Progress': 'bg-blue-500', 'Completed': 'bg-green-500'}[task.status];
                return `<div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-start gap-3">
                    <div class="w-2 h-2 mt-1.5 rounded-full ${statusColor} flex-shrink-0"></div>
                    <div>
                        <p class="font-medium text-gray-900 dark:text-white">${task.title}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${task.subject}</p>
                    </div>
                </div>`;
            }).join('')}</div>`;
        } else {
            contentEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center">No tasks scheduled for this day.</p>';
        }
        modal.classList.remove('hidden');
    }

    function saveTask(e) { e.preventDefault(); const data = new FormData(e.target), id = data.get('id'); const taskData = { title: data.get('title'), subject: data.get('subject'), dueDate: data.get('dueDate'), status: data.get('status') }; if (id) { const existingTask = tasks.find(t=>t.id===id); if (existingTask.dueDate !== taskData.dueDate) { delete existingTask.notified; } Object.assign(existingTask, taskData); if (existingTask.status === 'Completed' && !existingTask.completedAt) { existingTask.completedAt = new Date().toISOString(); } } else { tasks.push({ ...taskData, id: crypto.randomUUID(), createdAt: new Date().toISOString() }); } saveTasks(); closeModal(); renderPage(window.location.hash.slice(2) || 'dashboard'); }
    function deleteTask(id) { if (confirm('Are you sure you want to delete this task?')) { tasks = tasks.filter(t => t.id !== id); saveTasks(); renderPage(window.location.hash.slice(2) || 'dashboard'); } }
    const closeModal = () => document.getElementById('task-modal').classList.add('hidden');
    
    function handleNotificationToggle(e) {
        const enabled = e.target.checked;
        if (enabled && Notification.permission !== 'granted') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    settings.notifications = true;
                    saveSettings();
                } else {
                    alert('Notifications permission was denied.');
                    e.target.checked = false;
                }
            });
        } else {
            settings.notifications = enabled;
            saveSettings();
        }
    }

    function checkAndSendNotifications() {
        if (!settings.notifications || Notification.permission !== 'granted') return;
        const now = new Date().getTime();
        const reminderWindow = settings.reminderTime * 60 * 60 * 1000;
        tasks.forEach(task => {
            if (task.status !== 'Completed' && task.dueDate) {
                const dueDate = new Date(task.dueDate).getTime();
                const timeUntilDue = dueDate - now;
                if (timeUntilDue > 0 && timeUntilDue <= reminderWindow && !task.notified) {
                    new Notification('AcademiaPlan Reminder', { body: `Task "${task.title}" is due soon!` });
                    task.notified = true;
                    saveTasks();
                }
            }
        });
    }

    const exportData = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({tasks, settings}, null, 2)], {type:'application/json'})); a.download = 'academiaplan-backup.json'; a.click(); };
    const importData = (e) => { const reader = new FileReader(); reader.onload = (ev) => { try { const imported = JSON.parse(ev.target.result); if(Array.isArray(imported.tasks) && typeof imported.settings === 'object') { tasks = imported.tasks; settings = imported.settings; saveTasks(); saveSettings(); renderPage('dashboard'); alert('Data imported successfully!'); } else { alert('Invalid file format.'); } } catch { alert('Invalid file format.'); } }; reader.readAsText(e.target.files[0]); };
    const clearData = () => { if (confirm('This will delete all your tasks and settings permanently. This action cannot be undone.')) { tasks = []; settings = { notifications: false, reminderTime: 24 }; saveTasks(); saveSettings(); renderPage('dashboard'); } };
    
    // Initial setup for a logged-in user
    loadTasks();
    loadSettings();
    
    const navigate = () => renderPage(window.location.hash.slice(2) || 'dashboard');
    window.addEventListener('hashchange', navigate);
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => { if(window.innerWidth < 1024) document.getElementById('sidebar').classList.add('-translate-x-full'); }));
    navigate();
    document.getElementById('mobile-menu-button').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('-translate-x-full'));
    document.getElementById('task-form').addEventListener('submit', saveTask);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.querySelector('#task-modal .modal-overlay').addEventListener('click', closeModal);

    const dateTasksModal = document.getElementById('date-tasks-modal');
    dateTasksModal.querySelector('#date-tasks-modal-close').addEventListener('click', () => dateTasksModal.classList.add('hidden'));
    dateTasksModal.querySelector('.modal-overlay').addEventListener('click', () => dateTasksModal.classList.add('hidden'));
    
    document.getElementById('sign-out-btn').addEventListener('click', signOut);

    setInterval(checkAndSendNotifications, 60000); // Check every minute
}