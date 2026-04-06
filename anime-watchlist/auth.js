document.addEventListener('DOMContentLoaded', () => {
    // Supabase
    const SUPABASE_URL = 'https://klxbsnywxpchrqavxjcd.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGJzbnl3eHBjaHJxYXZ4amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzE4NDEsImV4cCI6MjA4OTY0Nzg0MX0.wxmFEKE0FMiUrZluQWnNoxWMAwHTwFDK7kJ83Rtu3mg';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // State
    let isLoginMode = true;

    // DOM Elements
    const authEmail     = document.getElementById('authEmail');
    const authPassword  = document.getElementById('authPassword');
    const authError     = document.getElementById('authError');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authBtnText   = document.getElementById('authBtnText');
    const authSpinner   = document.getElementById('authSpinner');
    const authForm      = document.getElementById('authForm');
    const toastContainer = document.getElementById('toastContainer');
    const cardTitle     = document.getElementById('cardTitle');
    const cardSubtitle  = document.getElementById('cardSubtitle');
    const switchModeBtn = document.getElementById('switchModeBtn');
    const switchPrompt  = document.getElementById('switchPrompt');
    const forgotLink    = document.getElementById('forgotLink');

    function showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = 'background:#1f1f1f; border:1px solid #2a2a2a; border-radius:8px; padding:0.75rem 1rem; color:#fff; font-size:0.85rem; display:flex; align-items:center; gap:0.5rem;';
        toast.innerHTML = `<i class="fa-solid fa-check" style="color:#a855f7"></i> <span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // Redirect if already logged in
    async function checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) window.location.href = 'index.html';
    }
    checkAuth();

    supabase.auth.onAuthStateChange((event, session) => {
        if (session) window.location.href = 'index.html';
    });

    // Switch between Login / Register
    function attachSwitchListener() {
        const btn = document.getElementById('switchModeBtn');
        if (btn) btn.addEventListener('click', toggleMode);
    }

    function toggleMode() {
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            cardTitle.textContent    = 'Welcome Back';
            cardSubtitle.textContent = 'Continue your cinematic archiving odyssey.';
            authBtnText.textContent  = 'Sign In';
            if (forgotLink) forgotLink.style.display = '';
            switchPrompt.innerHTML = 'Don\'t have an account? <a id="switchModeBtn">Start archiving for free.</a>';
        } else {
            cardTitle.textContent    = 'Create Account';
            cardSubtitle.textContent = 'Start your anime archiving journey today.';
            authBtnText.textContent  = 'Register';
            if (forgotLink) forgotLink.style.display = 'none';
            switchPrompt.innerHTML = 'Already have an account? <a id="switchModeBtn">Sign in here.</a>';
        }
        authError.className = 'hidden';
        attachSwitchListener();
    }

    attachSwitchListener();

    // Form Submit
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.className = 'hidden';

        const loadingText = isLoginMode ? 'Signing in...' : 'Creating account...';
        authBtnText.textContent = loadingText;
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

        authBtnText.textContent = isLoginMode ? 'Sign In' : 'Register';
        authSpinner.classList.add('hidden');
        authSubmitBtn.disabled = false;

        if (response.error) {
            showAuthError(response.error.message);
        } else if (!isLoginMode) {
            showToast('Account created! Signing you in...');
        }
    });

    function showAuthError(msg) {
        authError.textContent = msg;
        authError.className = '';  // remove 'hidden'
    }

    // Social buttons (placeholder — wire up OAuth here if needed)
    const googleBtn = document.getElementById('googleBtn');
    const githubBtn = document.getElementById('githubBtn');

    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            await supabase.auth.signInWithOAuth({ provider: 'google' });
        });
    }
    if (githubBtn) {
        githubBtn.addEventListener('click', async () => {
            await supabase.auth.signInWithOAuth({ provider: 'github' });
        });
    }
});
