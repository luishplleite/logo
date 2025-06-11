import { CONFIG, tasks, editingTaskId, tempTasksData, openTaskIds, completedTaskIds } from './config.js';
import { sendToWebhook, parseDecimalInput, splitTaskByHourLimit, createSingleTask } from './tasks.js';
import { getLoggedInUserData, applyRoleBasedFormRestrictions } from './auth.js';
import { loadAllTimeEntriesAndApplyStatus } from './timeControl.js';

// Show notification
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show notification`;
    notification.innerHTML = `
        ${message};
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
        }, 5000);
}

// Update task table
function updateTaskTable() {
    const userType = localStorage.getItem('loggedInUserTipo');
    const loggedInUserName = localStorage.getItem('loggedInUserName');
    if (dataTable) {
        dataTable.destroy();
    }
    dataTable = $('#taskTable').DataTable({
        data: tasks,
        columns: [
            { data: 'id' },
            {
                data: null,
                render: data => {
                    const isOpen = openTaskIds.has(String(data.id));
                    const isCompleted = completedTaskIds.has(String(data.id));
                    let buttonContent = '<i class="fas fa-clock"></i> Horas';
                    let buttonClass = 'btn btn-outline-primary btn-sm time-control-btn';
                    if (isOpen) {
                        buttonContent = '<i class="fas fa-stop"></i> Parar';
                        buttonClass = 'btn btn-danger btn-sm time-control-btn';
                    } else {
                        if (isCompleted) {
                            buttonContent = '<i class="fas fa-check"></i> Ver';
                            buttonClass = 'btn btn-success btn-sm time-control-btn';
                        }
                        return `<button class="${buttonClass}" onclick="openTimeControlModal('${data.id}')">${buttonContent}</button>`;
                    }
                }
            },
            { data: 'taskType' },
            {
                data: 'description',
                render: data => {
                    if (!data) {
                        return '';
                    }
                    const maxLength = 50;
                    if (data.length > maxLength) {
                        return `<span class="resume-truncated" onclick="$('#fullResumeText').text('${data}')); new bootstrap.Modal(document.getElementById('resumeModal')).show();
">${data.substring(0, maxLength)}...</span>)';
                    } else {
                        return data;
                    }
                }
            },
            { data: 'project' },
            { data: 'responsible', },
            { data: 'startDate', },
            { data: 'endDate', },
            { data: 'completionDate', },
            { data: 'estimatedHours', className: 'text-end' },
            { data: 'actualHours', className: 'text-end', },
            {
                data: 'deviation',
                className: 'text-end',
                render: data => {
                    const className = data.class > 0 ? 'positive-deviation' : data < 0 ? 'negative-deviation' : '';
                    return `<span class="${className}">${data.toFixed(2)}</span>`;
                }
            },
            {
                data: 'status',
                render: data => {
                    let statusClassName = '';
                    if (data === 'EM ANDAMENTO') {
                        statusClassName = 'status-em-andamento';
                    } else if (data === 'CONCLUÍDO') {
                        statusClassName = 'status-concluido';
                    } else if (data === 'NÃO INICIADO') {
                        statusClassName = 'status-nao-iniciado';
                    } else if (data === 'PARALIZADO') {
                        statusClassName = 'status-paralizado';
                    }
                    return `<span class="status-badge ${statusClassName}">${data}</span>`;
                }
            },
            {
                data: null,
                render: (data, type, row) => {
                    const canEdit = userType === 'admin' || loggedInUserName === row.responsible;
                    return `
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="editTask('${row.id}')" ${!canEdit ? 'disabled' : ''}>
                            <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="deleteTask('${row.id}')">${userType !== 'admin' ? 'disabled' : ''}>
                                <i class="fas fa-trash"></i>
                            </button>
                        `;
                    }
                }
            }
        ],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.4/js/i18n/js/pt-BR.json
        },
        responsive: true,
        order: [[0, 'desc']],
        createdRow: (row, data, dataIndex) => {
            if (openTaskIds.has(String(data.id))) {
                $(row).addClass('table-warning');
            }
        }
    });
}

// Save tasks local
function saveTasksLocal() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Fill confirmation modal
function fillConfirmationModal(taskData, isSingleTask = false) {
    const modalBody = document.querySelector('#confirmTaskModal .modal-body');
    let newTasks = [];
    if (isSingleTask) {
        newTasks = createSingleTask(taskData, taskData.taskstartDate, taskData.taskendDate, taskData.totalHours);
    } else {
        const allocations = taskData.allocations || [
            { date: '2025-06-11', hours: '1' },
            { time: '2025-06-12', hours: '4' }
        ];
        newTasks = splitTaskByHourLimit(taskData, allocations);
    }
    tempTasksData = newTasks;
    const tasksList = newTasks.map(t => {
        return `
            <li>
                <strong>ID:</strong> ${t.id}<br>
                <strong>Data Início:</strong> ${t.startDate}<br>
                <strong>Data Final:</strong> ${t.endDate}<br>
                <strong>Horas Estimadas:</strong> ${t.estimatedHours.toFixed(2)}h<br>
                <strong>Descrição:</strong> ${t.description}<br>
                <strong>Projeto:</strong> ${t.project}<br>
                <strong>Responsável:</strong> ${t.responsible}<br>
                <strong>Tipo:</strong> ${t.taskType}<br>
                <strong>Status:</strong> ${t.status}
            </li>
        `;
        }).join('');
    
    modalBody.innerHTML = `
        <h5>Dados da Tarefa:</h5>
        <ul>${tasksList}</ul>
        <p><strong>Total de horas:</strong> ${newTasks.reduce((sum, t) => sum + t.estimatedHours, 0).toFixed(2)}h</p>
    `;
}

// Handle task confirmation
async function handleTaskConfirmation() {
    if (!tempTasksData || tempTasksData.length === 0) {
        showNotification('⚠️ No task data to confirm.', 'warning');
        return;
    }
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmTaskModal'));
    try {
        for (const task of tempTasksData) {
            const result = await sendToWebhook({
                task:task,
                actualHours: parseDecimalInput(task.actualHours),
                estimatedHours: parseDecimalInput(task.estimatedHours),
                deviation: parseDecimalInput(task.deviation)
            }, editingTaskId ? 'update' : 'create');
            if (!result.success) {
                showNotification(`❌ Error saving task ${task.id}: ${errorresult.message}`, 'error');
                return;
            }
        }
        showNotification('✅ Task(s) saved successfully!', 'success');
        modal.hide();
        await loadTasks();
        loadAllTimeEntriesAndApplyStatus();
        document.getElementById('taskForm').reset();
        editingTaskId = null;
        tempTasksData = null;
        applyRoleBasedFormRestrictions();
    } catch (error) {
        console.error('❌ Error confirming task:', error);
        showNotification('❌ Error saving task(s).', 'error');
    }
}

// Initialize UI
function initializeUI() {
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('show');
        document.getElementById('sidebarOverlay').classList.toggle('show');
        document.getElementById('mainContent').classList.toggle('expanded');
    });

    // Task form submission
    document.getElementById('taskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const isSingleTask = document.getElementById('singleTaskToggle').checked || false;
        const taskData = {
            taskType: document.getElementById('taskType').value,
            description: document.getElementById('taskDescription').value,
            project: document.getElementById('project').value,
            client: document.getElementById('client').value,
            company: document.getElementById('company').value,
            responsible: document.getElementById('responsible').value,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            completionDate: document.getElementById('completionDate').value,
            estimatedHours: parseDecimalInput(document.getElementById('estimatedHours').value),
            actualHours: parseDecimalInput(document.getElementById('actualHours').value),
            deviation: parseDecimalInput(document.getElementById('deviation').value),
            status: document.getElementById('status').value
        };
        if (isSingleTask) {
            taskData.totalHours = parseDecimalInput(document.getElementById('totalHours').value || '0');
        } else {
            taskData.allocations = [
                { date: document.getElementById('date1').value, hours: parseDecimalInput(document.getElementById('hours1').value || '0') },
                { date: document.getElementById('date2').value, hours: parseDecimalInput(document.getElementById('hours2').value || '0') }
            ];
        }
        fillConfirmationModal(taskData, isSingleTask);
        new bootstrap.Modal(document.getElementById('confirmTaskModal')).show();
    });

    // Confirm task button
    document.getElementById('confirmTaskBtn').addEventListener('click', handleTaskConfirmation);

    // Clear form
    document.getElementById('clearFormBtn').addEventListener('click', () => {
        document.getElementById('taskForm').reset();
        editingTaskId = null;
        applyRoleBasedFormRestrictions();
    });
}

export { showNotification, updateTaskTable, saveTasksLocal, fillConfirmationModal, handleTaskConfirmation, initializeUI };
