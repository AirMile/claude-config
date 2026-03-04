// Login page HTML generator

function loginPage(error) {
  var errorHtml = error
    ? '<div class="login-error">' +
      String(error).replace(/</g, "&lt;") +
      "</div>"
    : "";

  return (
    '<!doctype html><html lang="nl"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Login</title>" +
    "<style>" +
    ":root{--bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--accent:#58a6ff;--danger:#f85149}" +
    "*{margin:0;padding:0;box-sizing:border-box}" +
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center}" +
    ".login-box{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:40px;width:100%;max-width:360px}" +
    ".login-box h1{font-size:20px;font-weight:700;margin-bottom:8px;letter-spacing:-0.3px}" +
    ".login-box p{font-size:13px;color:var(--muted);margin-bottom:24px}" +
    ".login-input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:10px 12px;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.15s}" +
    ".login-input:focus{border-color:var(--accent)}" +
    ".login-btn{width:100%;margin-top:12px;padding:10px;border-radius:6px;font-size:14px;font-weight:500;font-family:inherit;cursor:pointer;border:1px solid var(--accent);background:rgba(88,166,255,0.15);color:var(--accent);transition:all 0.15s}" +
    ".login-btn:hover{background:rgba(88,166,255,0.25)}" +
    ".login-error{margin-bottom:16px;padding:8px 12px;border-radius:6px;font-size:13px;background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);color:var(--danger)}" +
    "</style></head><body>" +
    '<div class="login-box">' +
    "<h1>Project Server</h1>" +
    "<p>Voer je code in om toegang te krijgen.</p>" +
    errorHtml +
    '<form method="POST" action="/login">' +
    '<input class="login-input" type="text" name="code" placeholder="Code" autocomplete="off" autofocus />' +
    '<button class="login-btn" type="submit">Inloggen</button>' +
    "</form>" +
    "</div>" +
    "</body></html>"
  );
}

module.exports = { loginPage: loginPage };
