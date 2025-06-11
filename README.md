// js/main.js
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM carregado, verificando autenticação...');

    if (!Auth.checkLoginStatus()) {
        console.log('❌ Usuário não autenticado, redirecionando...');
        Auth.redirectToLogin();
        return;
    }

    console.log('✅ Usuário autenticado, carregando aplicação...');

    Auth.showAuthenticatedInterface();
    UI.updateUserInfo();
    UI.showCurrentDate();
    UI.adjustForTouchDevice(); // Mover para helpers ou ui?

    await App.initializeApplication();
    App.setupEventListeners();
});

// Objeto global para inicialização
const App = {
    async initializeApplication() {
        console.log('🚀 Iniciando Sistema de Gerenciamento de Tarefas...');
        try {
            await Theme.loadThemeConfig();
            await Auth.initializeUserSession();
            Auth.applyUIPermissions();
            UI.clearForm();
            await Data.loadColaboradores();
            await Data.loadTasks();
            await TimeControl.loadAllTimeEntriesAndApplyStatus();
            UI.showPage('tasks'); // Default page
            console.log('✅ Aplicação inicializada com sucesso');
        } catch (error) {
            console.error('❌ Erro durante inicialização:', error);
            Helpers.showNotification('❌ Erro ao carregar sistema. Tentando continuar...', 'error');
            localStorage.setItem('loggedInUserTipo', 'colaborador'); // Fallback
            Auth.applyUIPermissions();
        }
    },

    setupEventListeners() {
        console.log('🎯 Configurando event listeners...');
        // Chamar setup de listeners de outros módulos
        Auth.setupAuthListeners();
        UI.setupUIListeners();
        Data.setupFormListeners();
        TimeControl.setupTimeControlListeners();

        // Listeners globais que não se encaixam em módulos específicos
        window.addEventListener('resize', () => setTimeout(() => dataTable?.columns.adjust().responsive.recalc(), 300));
        console.log('✅ Event listeners configurados com sucesso');
    }
};
