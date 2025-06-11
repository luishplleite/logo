import { initializeUserSession, applyUserPermissions, showAuthenticatedInterface, updateUserInfo, checkLoginStatus, redirectToLogin } from './auth.js';
import { loadColaboradores, loadTasks } from './tasks.js';
import { initializeUI } from './ui.js';
import { loadAllTimeEntriesAndApplyStatus } from './timeControl.js';

// Initialize application
function init() {
    if (!checkLoginStatus()) {
        redirectToLogin();
        return;
    }
    
    try {
        showAuthenticatedInterface();
        updateUserInfo();
        await initializeUserSession();
        applyUIPermissions();
        await loadColaboradores();
        await loadTasks();
        await loadAllTimeEntriesAndApplyStatus();
        initializeUI();
        
        // Handle single task toggle
        const singleTaskToggle = document.getElementById('singleTaskToggle');
        const allocationsSection = document.getElementById('allocationsSection');
        const totalHoursSection = document.getElementById('totalHoursSection');
        if (singleTaskToggle) {
            singleTaskToggle.addEventListener('change', () => {
                if (singleTaskToggle.checked) {
                    allocationsSection.style.display = 'none';
                    totalHoursSection.style.display = 'block';
                } else {
                    allocationsSection.style.display = 'block';
                    totalHoursSection.style.display = 'none';
                }
            });
        }
    } catch (error) {
        console.error('❌ Error initializing application:', error);
    }
}

document.addEventListener('DOMContentLoaded', init);

export { init }
