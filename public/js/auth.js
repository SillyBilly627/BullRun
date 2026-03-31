// ============================================================
// BullRun — Auth Module
// ============================================================
// Handles login, signup, logout, and session checking.
// ============================================================

const Auth = (() => {

  // Switch to signup form
  function showSignup() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
    document.getElementById('signup-error').textContent = '';
    document.getElementById('signup-username').focus();
  }

  // Switch to login form
  function showLogin() {
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('login-error').textContent = '';
    document.getElementById('login-username').focus();
  }

  // Handle signup
  async function signup() {
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const errorEl = document.getElementById('signup-error');
    const btn = document.getElementById('signup-btn');

    errorEl.textContent = '';

    // Client-side validation
    if (!username) { errorEl.textContent = 'Enter a username'; return; }
    if (username.length < 2) { errorEl.textContent = 'Username must be at least 2 characters'; return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { errorEl.textContent = 'Letters, numbers, underscores only'; return; }
    if (!password) { errorEl.textContent = 'Enter a password'; return; }
    if (password.length < 4) { errorEl.textContent = 'Password must be at least 4 characters'; return; }
    if (!/[A-Z]/.test(password)) { errorEl.textContent = 'Need at least one capital letter'; return; }
    if (!/[0-9]/.test(password)) { errorEl.textContent = 'Need at least one number'; return; }
    if (password !== confirm) { errorEl.textContent = 'Passwords don\'t match'; return; }

    // Disable button while loading
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Creating...';

    const res = await API.signup(username, password);

    btn.disabled = false;
    btn.querySelector('span').textContent = 'Create Account';

    if (res.ok) {
      // Success — load the main app
      App.onLogin(res.data.user);
    } else {
      errorEl.textContent = res.data.error || 'Signup failed';
    }
  }

  // Handle login
  async function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    errorEl.textContent = '';

    if (!username) { errorEl.textContent = 'Enter your username'; return; }
    if (!password) { errorEl.textContent = 'Enter your password'; return; }

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Signing in...';

    const res = await API.login(username, password);

    btn.disabled = false;
    btn.querySelector('span').textContent = 'Sign In';

    if (res.ok) {
      App.onLogin(res.data.user);
    } else {
      errorEl.textContent = res.data.error || 'Login failed';
    }
  }

  // Handle logout
  async function logout() {
    await API.logout();
    // Clear local state and show auth screen
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('auth-screen').classList.add('active');
    showLogin();
    // Clear password fields
    document.querySelectorAll('input[type="password"]').forEach(el => el.value = '');
  }

  // Check if user is already logged in (on page load)
  async function checkSession() {
    const token = API.getToken();
    if (!token) return null;

    const res = await API.getMe();
    if (res.ok) {
      return res.data.user;
    } else {
      API.setToken(null);
      return null;
    }
  }

  // Add Enter key support to login/signup forms
  function setupKeyHandlers() {
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') login();
    });
    document.getElementById('login-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') login();
    });
    document.getElementById('signup-confirm').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') signup();
    });
  }

  return { showSignup, showLogin, signup, login, logout, checkSession, setupKeyHandlers };
})();
