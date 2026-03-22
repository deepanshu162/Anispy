document.addEventListener('DOMContentLoaded', () => {
    // Supabase
    const SUPABASE_URL = 'https://klxbsnywxpchrqavxjcd.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGJzbnl3eHBjaHJxYXZ4amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzE4NDEsImV4cCI6MjA4OTY0Nzg0MX0.wxmFEKE0FMiUrZluQWnNoxWMAwHTwFDK7kJ83Rtu3mg';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // State
    let isLoginMode = true;

    // DOM Elements
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const authError = document.getElementById('authError');
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authBtnText = document.getElementById('authBtnText');
    const authSpinner = document.getElementById('authSpinner');
    const authForm = document.getElementById('authForm');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const toastContainer = document.getElementById('toastContainer');

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fa-solid fa-check" style="color:var(--accent-red)"></i> <span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // Checking if already logged in -> redirect to index.html
    async function checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            window.location.href = 'index.html';
        }
    }
    checkAuth();

    // Listen to auth state changes to auto-redirect
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            window.location.href = 'index.html';
        }
    });

    // Auth Tabs
    tabLogin.addEventListener('click', () => {
        isLoginMode = true;
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        authBtnText.textContent = 'Login';
        authError.classList.add('hidden');
    });

    tabSignup.addEventListener('click', () => {
        isLoginMode = false;
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        authBtnText.textContent = 'Sign Up';
        authError.classList.add('hidden');
    });

    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
        const type = authPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        authPassword.setAttribute('type', type);
        togglePasswordBtn.classList.toggle('fa-eye');
        togglePasswordBtn.classList.toggle('fa-eye-slash');
    });

    // Unified Form Submit (Login & Signup)
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.classList.add('hidden');
        
        authBtnText.textContent = isLoginMode ? 'Logging in...' : 'Signing up...';
        authSpinner.classList.remove('hidden');
        authSubmitBtn.disabled = true;

        let response;
        if (isLoginMode) {
            response = await supabase.auth.signInWithPassword({
                email: authEmail.value,
                password: authPassword.value
            });
        } else {
            response = await supabase.auth.signUp({
                email: authEmail.value,
                password: authPassword.value
            });
        }
        
        authBtnText.textContent = isLoginMode ? 'Login' : 'Sign Up';
        authSpinner.classList.add('hidden');

        if (response.error) {
            showAuthError(response.error.message);
            authSubmitBtn.disabled = false;
        } else if (!isLoginMode) {
            showToast('Signup successful! Auto-logging in...');
            // onAuthStateChange will redirect
        }
    });

    function showAuthError(msg) {
        authError.textContent = msg;
        authError.classList.remove('hidden');
    }
});
