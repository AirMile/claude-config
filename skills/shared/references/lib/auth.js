// Auth module: token-based auth with cookies
// Config: ~/.claude/server-auth.json (auto-created on first load)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const AUTH_PATH = path.join(
  require("os").homedir(),
  ".claude/server-auth.json",
);
const COOKIE_NAME = "auth";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

var _cache = null;
var _cacheMtime = 0;

function generateToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function loadAuth() {
  // Create default config if missing
  if (!fs.existsSync(AUTH_PATH)) {
    var defaultConfig = {
      adminToken: generateToken(),
      invites: [],
    };
    var dir = path.dirname(AUTH_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUTH_PATH, JSON.stringify(defaultConfig, null, 2), "utf8");
    _cache = defaultConfig;
    _cacheMtime = fs.statSync(AUTH_PATH).mtimeMs;
    return _cache;
  }

  // Hot-reload on file change
  try {
    var mtime = fs.statSync(AUTH_PATH).mtimeMs;
    if (_cache && mtime === _cacheMtime) return _cache;
    _cache = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
    _cacheMtime = mtime;
  } catch {
    if (!_cache) _cache = { adminToken: "", invites: [] };
  }
  return _cache;
}

function parseCookie(req) {
  var header = req.headers.cookie || "";
  var match = header.match(
    new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]+)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function getSession(req) {
  var token = parseCookie(req);
  if (!token) return null;

  var auth = loadAuth();

  if (token === auth.adminToken) {
    return { role: "admin" };
  }

  for (var i = 0; i < auth.invites.length; i++) {
    var inv = auth.invites[i];
    if (inv.token === token) {
      return {
        role: "teammate",
        name: inv.name,
        projects: inv.projects || [inv.project],
      };
    }
  }

  return null;
}

function setAuthCookie(res, token) {
  var cookie =
    COOKIE_NAME +
    "=" +
    encodeURIComponent(token) +
    "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" +
    COOKIE_MAX_AGE;
  // Append to existing Set-Cookie headers
  var existing = res.getHeader("Set-Cookie") || [];
  if (typeof existing === "string") existing = [existing];
  existing.push(cookie);
  res.setHeader("Set-Cookie", existing);
}

function clearAuthCookie(res) {
  var cookie = COOKIE_NAME + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
  res.setHeader("Set-Cookie", cookie);
}

function createInvite(name, projects) {
  var auth = loadAuth();
  var token = generateToken();
  auth.invites.push({ token: token, name: name, projects: projects });
  fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2), "utf8");
  _cache = auth;
  _cacheMtime = fs.statSync(AUTH_PATH).mtimeMs;
  return token;
}

function removeInvite(token) {
  var auth = loadAuth();
  auth.invites = auth.invites.filter(function (inv) {
    return inv.token !== token;
  });
  fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2), "utf8");
  _cache = auth;
  _cacheMtime = fs.statSync(AUTH_PATH).mtimeMs;
}

module.exports = {
  AUTH_PATH: AUTH_PATH,
  loadAuth: loadAuth,
  getSession: getSession,
  setAuthCookie: setAuthCookie,
  clearAuthCookie: clearAuthCookie,
  generateToken: generateToken,
  createInvite: createInvite,
  removeInvite: removeInvite,
};
