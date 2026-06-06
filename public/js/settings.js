const authSection = document.getElementById('authSection');
const profileSection = document.getElementById('profileSection');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authError = document.getElementById('authError');

const themeOptions = document.querySelectorAll('.theme-option');

let currentUser = null;

function initSettings() {
  loadTheme();
  loadUser();
  setupThemeListeners();
  setupAuthListeners();
  updateUI();
}

function loadTheme() {
  const saved = localStorage.getItem('photon_theme') || 'shadow';
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('photon_theme', theme);
  themeOptions.forEach(opt => opt.classList.remove('active'));
  document.querySelector(`[data-theme="${theme}"]`).classList.add('active');
}

function setupThemeListeners() {
  themeOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.getAttribute('data-theme');
      setTheme(theme);
    });
  });
}

function loadUser() {
  const saved = localStorage.getItem('photon_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
    } catch {
      currentUser = null;
    }
  }
}

function saveUser() {
  if (currentUser) {
    currentUser.lastLogin = new Date().toISOString();
    localStorage.setItem('photon_user', JSON.stringify(currentUser));
  }
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h).toString(16);
}

function login() {
  const username = authUsername.value.trim();
  const password = authPassword.value;
  authError.textContent = '';

  if (!username || !password) {
    authError.textContent = 'Username and password required';
    return;
  }

  const accounts = JSON.parse(localStorage.getItem('photon_accounts') || '{}');
  const passwordHash = hash(password);

  if (!accounts[username] || accounts[username].hash !== passwordHash) {
    authError.textContent = 'Invalid username or password';
    return;
  }

  currentUser = {
    username,
    created: accounts[username].created,
    lastLogin: new Date().toISOString(),
    progress: accounts[username].progress || {}
  };
  saveUser();
  updateUI();
  authUsername.value = '';
  authPassword.value = '';
}

function signup() {
  const username = authUsername.value.trim();
  const password = authPassword.value;
  authError.textContent = '';

  if (!username || !password) {
    authError.textContent = 'Username and password required';
    return;
  }

  if (username.length < 3) {
    authError.textContent = 'Username must be at least 3 characters';
    return;
  }

  if (password.length < 6) {
    authError.textContent = 'Password must be at least 6 characters';
    return;
  }

  const accounts = JSON.parse(localStorage.getItem('photon_accounts') || '{}');

  if (accounts[username]) {
    authError.textContent = 'Username already exists';
    return;
  }

  const passwordHash = hash(password);
  accounts[username] = {
    hash: passwordHash,
    created: new Date().toISOString(),
    progress: {}
  };
  localStorage.setItem('photon_accounts', JSON.stringify(accounts));

  currentUser = {
    username,
    created: accounts[username].created,
    lastLogin: new Date().toISOString(),
    progress: {}
  };
  saveUser();
  updateUI();
  authUsername.value = '';
  authPassword.value = '';
}

function logout() {
  currentUser = null;
  localStorage.removeItem('photon_user');
  updateUI();
}

function updateUI() {
  if (currentUser) {
    authSection.classList.remove('show');
    profileSection.classList.add('show');
    document.getElementById('profileUsername').textContent = currentUser.username;
    document.getElementById('profileCreated').textContent = new Date(currentUser.created).toLocaleDateString();
    document.getElementById('profileLastLogin').textContent = new Date(currentUser.lastLogin).toLocaleDateString();
  } else {
    authSection.classList.add('show');
    profileSection.classList.remove('show');
  }
}

function setupAuthListeners() {
  loginBtn.addEventListener('click', login);
  signupBtn.addEventListener('click', signup);
  logoutBtn.addEventListener('click', logout);

  authUsername.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') authPassword.focus();
  });
  authPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
}

window.getGameProgress = function(gameId) {
  if (!currentUser) return null;
  return currentUser.progress[gameId];
};

window.saveGameProgress = function(gameId, progressData) {
  if (!currentUser) return false;
  currentUser.progress[gameId] = {
    ...progressData,
    savedAt: new Date().toISOString()
  };
  saveUser();
  return true;
};

initSettings();
