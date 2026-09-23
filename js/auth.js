/* =========================================
   RubyEngine — Auth Module v2.0
   + Fitur expired / masa aktif akun
========================================= */
(function () {
  'use strict';

  var USERS_KEY = 're_users';
  var SESSION_KEY = 're_session';
  var DAY_MS = 86400000;

  /* ---------- Seed admin default (permanent) ---------- */
  function seedDefault() {
    var seed = [{
      username: 'RubyEngine',
      password: '046379',
      role: 'admin',
      active: true,
      createdAt: Date.now(),
      expiresAt: 'permanent'
    }];
    try { localStorage.setItem(USERS_KEY, JSON.stringify(seed)); } catch (_) {}
    return seed;
  }

  function loadUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        if (Array.isArray(list) && list.length) {
          // Migrasi user lama yang belum punya expiresAt
          list.forEach(function (u) {
            if (typeof u.expiresAt === 'undefined') {
              u.expiresAt = u.role === 'admin'
                ? 'permanent'
                : (u.createdAt || Date.now()) + 30 * DAY_MS;
            }
          });
          return list;
        }
      }
    } catch (_) {}
    return seedDefault();
  }

  function saveUsers(list) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(list)); } catch (_) {}
  }

  /* ---------- Query ---------- */
  function findUser(username) {
    var u = String(username || '').trim().toLowerCase();
    if (!u) return null;
    var list = loadUsers();
    for (var i = 0; i < list.length; i++) {
      if (list[i].username.toLowerCase() === u) return list[i];
    }
    return null;
  }

  /* ---------- Expiry helpers ---------- */
  function isExpired(user) {
    if (!user) return false;
    if (user.expiresAt === 'permanent' || !user.expiresAt) return false;
    return Date.now() > user.expiresAt;
  }

  function isPermanent(user) {
    return !user || user.expiresAt === 'permanent' || !user.expiresAt;
  }

  function getRemainingMs(user) {
    if (isPermanent(user)) return Infinity;
    return Math.max(0, user.expiresAt - Date.now());
  }

  function getRemainingDays(user) {
    var ms = getRemainingMs(user);
    if (ms === Infinity) return Infinity;
    return Math.ceil(ms / DAY_MS);
  }

  function getExpiryLevel(user) {
    // 'permanent' | 'safe' | 'warn' | 'danger' | 'critical' | 'expired'
    if (isPermanent(user)) return 'permanent';
    var ms = getRemainingMs(user);
    if (ms <= 0) return 'expired';
    var days = ms / DAY_MS;
    if (days >= 7) return 'safe';
    if (days >= 3) return 'warn';
    if (days >= 1) return 'danger';
    return 'critical';
  }

  /* ---------- Login / Logout / Session ---------- */
  function login(username, password) {
    var u = findUser(username);
    if (!u) return { ok: false, reason: 'not_found' };
    if (!u.active) return { ok: false, reason: 'disabled' };
    if (isExpired(u)) return { ok: false, reason: 'expired' };
    if (u.password !== String(password)) return { ok: false, reason: 'wrong_password' };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        username: u.username,
        role: u.role,
        loginAt: Date.now()
      }));
    } catch (_) {}
    return { ok: true, user: u };
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  function current() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var sess = JSON.parse(raw);
      // Auto-logout kalau user hilang / nonaktif / expired
      var u = findUser(sess.username);
      if (!u || !u.active || isExpired(u)) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return sess;
    } catch (_) {}
    return null;
  }

  function isAdmin() {
    var c = current();
    return !!(c && c.role === 'admin');
  }

  /* ---------- Guards ---------- */
  function requireLogin(redirect) {
    var c = current();
    if (!c) {
      location.href = redirect || 'login.html';
      return null;
    }
    return c;
  }

  function requireAdmin(redirect) {
    var c = current();
    if (!c || c.role !== 'admin') {
      location.href = redirect || 'login.html';
      return null;
    }
    return c;
  }

  /* ---------- CRUD User ---------- */
  function addUser(username, password, role, durationDays) {
    username = String(username || '').trim();
    password = String(password || '').trim();
    role = role === 'admin' ? 'admin' : 'user';

    if (!username || !password) return { ok: false, reason: 'empty' };
    if (username.length < 3) return { ok: false, reason: 'short_username' };
    if (password.length < 4) return { ok: false, reason: 'short_password' };
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return { ok: false, reason: 'invalid_username' };
    if (findUser(username)) return { ok: false, reason: 'exists' };

    // Tentukan expiresAt
    var expiresAt;
    if (role === 'admin' || durationDays === 'permanent' || !durationDays || Number(durationDays) >= 9999) {
      expiresAt = 'permanent';
    } else {
      expiresAt = Date.now() + (Number(durationDays) * DAY_MS);
    }

    var list = loadUsers();
    list.push({
      username: username,
      password: password,
      role: role,
      active: true,
      createdAt: Date.now(),
      expiresAt: expiresAt
    });
    saveUsers(list);
    return { ok: true };
  }

  function updateUser(username, patch) {
    var list = loadUsers();
    for (var i = 0; i < list.length; i++) {
      if (list[i].username.toLowerCase() === String(username).toLowerCase()) {
        for (var k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) list[i][k] = patch[k];
        }
        saveUsers(list);
        return { ok: true };
      }
    }
    return { ok: false, reason: 'not_found' };
  }

  function deleteUser(username) {
    var list = loadUsers();
    var uname = String(username).toLowerCase();
    var admins = list.filter(function (u) {
      return u.role === 'admin' && u.active;
    });
    var target = list.filter(function (u) {
      return u.username.toLowerCase() === uname;
    })[0];
    if (target && target.role === 'admin' && admins.length <= 1) {
      return { ok: false, reason: 'last_admin' };
    }
    var out = list.filter(function (u) {
      return u.username.toLowerCase() !== uname;
    });
    if (out.length === list.length) return { ok: false, reason: 'not_found' };
    saveUsers(out);
    return { ok: true };
  }

  /* ---------- Extend / Reset expiry ---------- */
  function extendUser(username, days) {
    var list = loadUsers();
    var uname = String(username).toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (list[i].username.toLowerCase() === uname) {
        var now = Date.now();
        if (days === 'permanent' || Number(days) >= 9999) {
          list[i].expiresAt = 'permanent';
        } else {
          var base = (list[i].expiresAt && list[i].expiresAt !== 'permanent' && list[i].expiresAt > now)
            ? list[i].expiresAt
            : now;
          list[i].expiresAt = base + (Number(days) * DAY_MS);
        }
        list[i].active = true;   // re-enable jika sempat dinonaktifkan
        saveUsers(list);
        return { ok: true };
      }
    }
    return { ok: false, reason: 'not_found' };
  }

  function resetExpiry(username, days) {
    // Set dari sekarang (bukan extend)
    var list = loadUsers();
    var uname = String(username).toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (list[i].username.toLowerCase() === uname) {
        if (days === 'permanent' || Number(days) >= 9999) {
          list[i].expiresAt = 'permanent';
        } else {
          list[i].expiresAt = Date.now() + (Number(days) * DAY_MS);
        }
        list[i].active = true;
        saveUsers(list);
        return { ok: true };
      }
    }
    return { ok: false, reason: 'not_found' };
  }

  function getAllUsers() {
    return loadUsers();
  }

  function genPassword(len) {
    len = len || 8;
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    var out = '';
    for (var i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  /* ---------- Expose ---------- */
  window.Auth = {
    login: login,
    logout: logout,
    current: current,
    isAdmin: isAdmin,
    requireLogin: requireLogin,
    requireAdmin: requireAdmin,
    addUser: addUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    extendUser: extendUser,
    resetExpiry: resetExpiry,
    getAllUsers: getAllUsers,
    findUser: findUser,
    genPassword: genPassword,
    isExpired: isExpired,
    isPermanent: isPermanent,
    getRemainingMs: getRemainingMs,
    getRemainingDays: getRemainingDays,
    getExpiryLevel: getExpiryLevel
  };
})();