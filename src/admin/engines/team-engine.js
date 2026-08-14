/* =====================================================================
   Interior bazzar — TEAM ENGINE (IBTeam)
   ---------------------------------------------------------------------
   Identity, roles, permissions, and the resolution of one into the next.

   WHAT THIS DOES NOT DO, stated first because it matters most
   ---------------------------------------------------------------------
   This is not a security boundary, and describing it as one would be a
   lie. `localStorage` is the database and these functions are the API;
   anyone with the device can edit either from a console. There is no
   server.

   What is built is the SHAPE the real boundary will take, at the layer
   that becomes the API. `guard(module, action)` sits at the top of every
   mutating engine call and returns `403 forbidden`. When those calls
   become HTTP handlers, the check is already written and already in the
   right place — which is the whole reason to put it there now rather
   than only in the views.

   Two rules are real regardless of where the boundary ends up, and both
   are enforced here rather than in the UI:

     · NO SELF-ELEVATION. A member cannot edit their own roles, and
       cannot edit a role they themselves hold.
     · THE LAST SUPER ADMIN cannot be demoted, deactivated or deleted.
       A panel nobody can administer is unrecoverable without a console.

   WHAT IT REUSES
   ---------------------------------------------------------------------
   Members stay in `ib_team_users` — the store `admin-auth.html` already
   reads and writes. There is no second user model and no second login.
   This engine owns the SHAPE of a member and heals new fields onto old
   records; it does not own the store's existence.

   API (window.IBTeam):
     Members.create/update/setStatus/setRoles/resetPassword/remove
     Roles.create/update/setStatus/setPermissions/remove
     MODULE_ACTIONS ACTION_LABEL modules()
     effective(user) can(user, module, action) guard(module, action)
     currentUser() audit()
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.IBTeam) return;

  var D = root.IBData;
  var ROLES_KEY = "ib_team_roles", AUDIT_KEY = "ib_team_audit", SCHEMA = 1;
  var RDB = null;

  /* ================================================== PERMISSION MODEL === */
  /* Actions are declared PER MODULE, because they are not uniform. A
     Design-system page has nothing to create and nothing to export; a deal
     has a stage and a ledger. Handing every module the same seven verbs
     would produce a matrix mostly full of permissions that grant nothing,
     which is the fastest way to make a permission screen unreadable.

     `view` is special everywhere: without it the module leaves the sidebar
     and the route is refused. Every other action implies nothing on its own. */
  var MODULE_ACTIONS = {
    deals:      ["view", "create", "edit", "stage", "payment", "close", "export"],
    quotations: ["view", "create", "edit", "issue", "accept", "cancel", "export"],
    invoices:   ["view", "create", "edit", "issue", "cancel", "export"],
    plans:      ["view", "create", "edit", "pricing", "status", "archive"],
    team:       ["view", "create", "edit", "status", "roles"],
    roles:      ["view", "create", "edit", "status"],
    audit:      ["view", "export"],
    design:     ["view"]
  };
  var ACTION_LABEL = {
    view:"View", create:"Create", edit:"Edit", stage:"Change stage",
    payment:"Log payment", close:"Close", export:"Export",
    issue:"Issue", accept:"Accept", cancel:"Cancel",
    pricing:"Set pricing", status:"Activate", archive:"Archive", roles:"Manage roles"
  };
  /* The subject list is MODULES[] itself — the same array that drives nav,
     routing and breadcrumbs — so a module added there gets permissions with
     no second registration. Anything without a declared action list is
     assumed to be view-only rather than silently ungoverned. */
  function modules() {
    var shell = root.IBShell;
    var keys = shell && shell.moduleKeys ? shell.moduleKeys() : Object.keys(MODULE_ACTIONS);
    var seen = {}, out = [];
    keys.concat(Object.keys(MODULE_ACTIONS)).forEach(function (k) {
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ key:k, label:(shell && shell.moduleLabel ? shell.moduleLabel(k) : k),
                 actions:MODULE_ACTIONS[k] || ["view"] });
    });
    return out;
  }
  function actionsOf(moduleKey) { return MODULE_ACTIONS[moduleKey] || ["view"]; }

  /* ======================================================== PASSWORDS === */
  /* SHA-256 over salt + password. Synchronous on purpose: the whole panel is
     synchronous, and `crypto.subtle` is a Promise API that would force login,
     member creation and password reset to become async for a guarantee this
     environment cannot make anyway.

     Read §2.3 of TEAM_OPERATION.md before judging this: on a client-side
     prototype the hash, the salt and the algorithm are all in the same
     browser, so this stops nobody who has the device. It stops a password
     being legible over a shoulder, in a screenshot or in a devtools panel,
     and it stops a password reused from somewhere else sitting in the clear.
     The real protection is the server, and the record shape is right for the
     day it arrives.                                                        */
  var K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];

  function sha256(msg) {
    /* UTF-8 bytes */
    var bytes = [], i, c;
    for (i = 0; i < msg.length; i++) {
      c = msg.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xd800 || c >= 0xe000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else {                                   // surrogate pair
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (msg.charCodeAt(i) & 0x3ff));
        bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    /* 64-bit length, big-endian. The high word is 0 for any password a human
       will ever type; written out anyway so the padding is correct rather
       than correct-in-practice. */
    var hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
               (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var w = new Array(64), a, b, cc, d, e, f, g, h, t1, t2, j, blk;

    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

    for (blk = 0; blk < bytes.length; blk += 64) {
      for (j = 0; j < 16; j++)
        w[j] = (bytes[blk + j*4] << 24) | (bytes[blk + j*4 + 1] << 16) |
               (bytes[blk + j*4 + 2] << 8) | bytes[blk + j*4 + 3];
      for (j = 16; j < 64; j++) {
        var s0 = rotr(w[j-15], 7) ^ rotr(w[j-15], 18) ^ (w[j-15] >>> 3);
        var s1 = rotr(w[j-2], 17) ^ rotr(w[j-2], 19) ^ (w[j-2] >>> 10);
        w[j] = (w[j-16] + s0 + w[j-7] + s1) | 0;
      }
      a=H[0]; b=H[1]; cc=H[2]; d=H[3]; e=H[4]; f=H[5]; g=H[6]; h=H[7];
      for (j = 0; j < 64; j++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        t1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & cc) ^ (b & cc);
        t2 = (S0 + maj) | 0;
        h=g; g=f; f=e; e=(d + t1)|0; d=cc; cc=b; b=a; a=(t1 + t2)|0;
      }
      H[0]=(H[0]+a)|0; H[1]=(H[1]+b)|0; H[2]=(H[2]+cc)|0; H[3]=(H[3]+d)|0;
      H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
    }
    var hex = "";
    for (i = 0; i < 8; i++) hex += ("00000000" + (H[i] >>> 0).toString(16)).slice(-8);
    return hex;
  }

  function makeSalt() {
    var s = "", chars = "abcdef0123456789";
    /* Not crypto-random, and it does not need to be: a salt's job is to stop
       two identical passwords sharing a hash, not to be unguessable. */
    for (var i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * 16)];
    return s;
  }
  function hashPassword(plain, salt) { return sha256(String(salt) + String(plain)); }
  function verifyPassword(user, plain) {
    if (!user) return false;
    if (user.password_hash && user.password_salt)
      return hashPassword(plain, user.password_salt) === user.password_hash;
    /* A record written before hashing existed. Accept the legacy comparison
       once, so nobody is locked out by an upgrade, and migrate on the spot. */
    if (user.password !== undefined && user.password === plain) { setPassword(user, plain); return true; }
    return false;
  }
  function setPassword(user, plain) {
    user.password_salt = makeSalt();
    user.password_hash = hashPassword(plain, user.password_salt);
    delete user.password;                       // the plaintext does not survive
    return user;
  }
  /* Readable, not clever: an operator reads this down a phone line. */
  function generatePassword() {
    var words = ["amber","basalt","cedar","dune","ember","fern","granite","harbour",
                 "indigo","jute","kiln","linen","marble","nectar","onyx","poplar"];
    var w = words[Math.floor(Math.random() * words.length)];
    var n = 100 + Math.floor(Math.random() * 900);
    return w.charAt(0).toUpperCase() + w.slice(1) + "-" + n;
  }

  /* ============================================================ STORES === */
  function blankRoles() { return { _v:SCHEMA, roles:[], seq:0 }; }
  function loadRoles() {
    if (RDB) return RDB;
    try {
      var raw = JSON.parse(localStorage.getItem(ROLES_KEY));
      if (raw && raw._v === SCHEMA) { RDB = raw; return RDB; }
    } catch (e) {}
    RDB = seedRoles(); persistRoles(); return RDB;
  }
  function persistRoles() { try { localStorage.setItem(ROLES_KEY, JSON.stringify(RDB)); } catch (e) {} }
  function resetRoles() { RDB = seedRoles(); persistRoles(); return RDB; }

  if (typeof root.addEventListener === "function") {
    root.addEventListener("storage", function (e) { if (e && e.key === ROLES_KEY) RDB = null; });
  }

  function ok(data) { return { ok:true, data:data }; }
  function err(http, code, detail) { return { ok:false, http:http, code:code, detail:detail }; }
  function todayISO() {
    var t = (D && D.TODAY) || new Date();
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" +
           String(t.getDate()).padStart(2, "0");
  }

  /* ============================================================= AUDIT === */
  /* Appends to the SAME shape `IBData.audit` already carries, so the existing
     audit reader renders team events without knowing they are new. The seeded
     array is static; this persists the appended ones beside it. */
  function auditLog() {
    var stored = [];
    try { var raw = JSON.parse(localStorage.getItem(AUDIT_KEY)); if (Array.isArray(raw)) stored = raw; } catch (e) {}
    return stored.concat((D && D.audit) || []);
  }
  /* Written in the SAME shape `IBData.audit` already carries — `at · type ·
     tone · actor · role · module · text · ref · route` — so the existing audit
     reader renders a team event without knowing team events are new. Reuse
     means matching the record, not just the store. */
  function record(module, text, ref, actor, type, tone) {
    var stored = [];
    try { var raw = JSON.parse(localStorage.getItem(AUDIT_KEY)); if (Array.isArray(raw)) stored = raw; } catch (e) {}
    var who = actor || currentUser();
    var roleName = "System";
    if (who) {
      var rs = roleIdsOf(who).map(function (r) { return (roleOf(r) || {}).name; }).filter(Boolean);
      roleName = rs.length ? rs.join(", ") : (who.designation || "Team member");
    }
    stored.unshift({
      at:todayISO() + " " + new Date().toTimeString().slice(0, 5),
      type:type || "TEAM", tone:tone || "",
      actor:(who && who.name) || "System", role:roleName,
      module:module, text:text, ref:ref || null,
      route:ref && String(ref).indexOf("ROL-") === 0 ? "#/roles/" + ref
          : ref ? "#/team/" + ref : "#/team"
    });
    if (stored.length > 400) stored.length = 400;
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(stored)); } catch (e) {}
  }

  /* ============================================================= ROLES === */
  function allRoles() { return loadRoles().roles.slice(); }
  function roleOf(id) {
    var rs = loadRoles().roles;
    for (var i = 0; i < rs.length; i++) if (rs[i].role_id === id) return rs[i];
    return null;
  }
  function roleByName(n) {
    var rs = loadRoles().roles, k = String(n || "").trim().toLowerCase();
    for (var i = 0; i < rs.length; i++) if (rs[i].name.toLowerCase() === k) return rs[i];
    return null;
  }
  /* A permission set is a flat map of "module.action" → true. Flat because
     every question asked of it is "may I do this one thing", and a nested
     shape would be walked on every nav render. */
  function normalisePerms(p) {
    var out = {};
    Object.keys(p || {}).forEach(function (k) {
      if (!p[k]) return;
      var bits = String(k).split(".");
      if (bits.length !== 2) return;
      if (!MODULE_ACTIONS[bits[0]]) return;                       // unknown module
      if (actionsOf(bits[0]).indexOf(bits[1]) < 0) return;        // action that module has not got
      out[k] = true;
    });
    return out;
  }
  function grantedModules(role) {
    var seen = {};
    Object.keys(role.permissions || {}).forEach(function (k) { seen[k.split(".")[0]] = 1; });
    return Object.keys(seen);
  }

  /* ====================================================== EFFECTIVE PERMS = */
  /* The union of every role the member holds. Union rather than intersection
     because roles are additive responsibilities — somebody who is both a Sales
     Agent and a Finance reviewer does both jobs, and an intersection would
     leave them able to do neither. */
  function effective(user) {
    if (!user) return {};
    if (isSuper(user)) return { "*":true };
    var out = {};
    roleIdsOf(user).forEach(function (rid) {
      var r = roleOf(rid);
      if (!r || r.status !== "active") return;            // an inactive role grants nothing
      Object.keys(r.permissions || {}).forEach(function (k) { out[k] = true; });
    });
    return out;
  }
  /* Super Admin is a GRANT, not a special case in every check: it resolves to
     the wildcard above and everything downstream asks the same question. */
  function isSuper(user) {
    if (!user) return false;
    if (user.role === "super_admin") return true;
    return roleIdsOf(user).some(function (rid) {
      var r = roleOf(rid); return r && r.is_super;
    });
  }
  function roleIdsOf(user) {
    if (!user) return [];
    if (Array.isArray(user.role_ids) && user.role_ids.length) return user.role_ids;
    return user.role ? [user.role] : [];        // legacy single-key record
  }
  function can(user, module, action) {
    if (!user) return false;
    if (user.status !== "active") return false; // an inactive account can do nothing
    var p = effective(user);
    if (p["*"]) return true;
    return !!p[module + "." + (action || "view")];
  }
  function currentUser() {
    return D && D.TeamStore ? D.TeamStore.current() : null;
  }
  /* THE SEAM. Every mutating engine call starts here. Today it reads a local
     session; when there is a server it reads a verified token, and nothing
     around it changes. */
  function guard(module, action) {
    var u = currentUser();
    if (!u) return err(401, "unauthenticated", "Sign in first.");
    if (u.status !== "active")
      return err(403, "account_inactive", "This account is " + u.status + ".");
    if (!can(u, module, action))
      return err(403, "forbidden",
        "Your role does not include " + (ACTION_LABEL[action] || action) + " on " + module + ".");
    return null;                                 // null means "allowed"
  }

  /* =========================================================== MEMBERS === */
  function members() { return D.TeamStore.load(); }
  function memberOf(id) {
    var l = members();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function saveMembers(l) { D.TeamStore.save(l); }
  /* THE RECORD INSIDE *THIS* LIST.

     TeamStore.load() re-parses localStorage on every call, so members() and
     memberOf() hand back objects from two different parses. Mutating the one
     and saving the other writes the untouched array and silently loses the
     edit — which is exactly what happened to every setRoles, setStatus,
     update and resetPassword until a test compared the STORE rather than the
     returned object. Every mutating call now edits a record it found in the
     list it is about to save. */
  function findIn(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function superAdmins(list) {
    return (list || members()).filter(function (u) {
      return isSuper(u) && u.status === "active";
    });
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_RE = /^\+?[0-9][0-9\s-]{7,15}$/;
  var USER_RE  = /^[a-z0-9._-]{3,24}$/i;

  function findBy(list, field, value, exceptId) {
    var v = String(value || "").trim().toLowerCase();
    if (!v) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === exceptId) continue;
      if (String(list[i][field] || "").trim().toLowerCase() === v) return list[i];
    }
    return null;
  }
  /* Derived from the name, deduped against the store. An operator who has to
     invent a unique username while creating an account invents a bad one. */
  function suggestUsername(name, list) {
    var base = String(name || "user").toLowerCase().replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "").slice(0, 20) || "user";
    var candidate = base, n = 1;
    while (findBy(list, "username", candidate, null)) { n++; candidate = base + n; }
    return candidate;
  }

  root.IBTeam = {
    MODULE_ACTIONS:MODULE_ACTIONS, ACTION_LABEL:ACTION_LABEL,
    modules:modules, actionsOf:actionsOf,
    sha256:sha256, hashPassword:hashPassword, verifyPassword:verifyPassword,
    generatePassword:generatePassword, suggestUsername:suggestUsername,
    loadRoles:loadRoles, resetRoles:resetRoles, allRoles:allRoles,
    roleOf:roleOf, roleByName:roleByName, grantedModules:grantedModules,
    effective:effective, can:can, guard:guard, isSuper:isSuper,
    roleIdsOf:roleIdsOf, currentUser:currentUser,
    members:members, memberOf:memberOf, superAdmins:superAdmins,
    audit:auditLog, record:record,
    Members:{}, Roles:{}
  };

  /* ---------------------------------------------------------------------- */
  var T = root.IBTeam;

  T.Roles.create = function (p, actor) {
    var g = guard("roles", "create"); if (g) return g;
    var name = String(p && p.name || "").trim();
    if (!name) return err(400, "validation_failed", "A role needs a name.");
    if (name.length > 40) return err(400, "validation_failed", "Keep the role name under 40 characters.");
    if (roleByName(name)) return err(409, "duplicate_role", "A role is already called “" + name + "”.");
    var db = loadRoles();
    var role = {
      role_id:"ROL-" + String(++db.seq).padStart(3, "0"),
      name:name, description:String(p.description || "").trim(),
      status:p.status === "inactive" ? "inactive" : "active",
      is_super:false,
      permissions:normalisePerms(p.permissions),
      created_at:todayISO(), created_by:(actor && actor.name) || "System",
      updated_at:todayISO()
    };
    db.roles.push(role); persistRoles();
    record("Team", "Role created — " + name, role.role_id, actor);
    return ok(role);
  };

  T.Roles.update = function (id, p, actor) {
    var g = guard("roles", "edit"); if (g) return g;
    var role = roleOf(id);
    if (!role) return err(404, "role_not_found", "No role " + id + ".");
    /* NO SELF-ELEVATION. Editing a role you hold is the shortest path to
       granting yourself anything, so it is refused outright rather than
       policed field by field. Another admin can make the change. */
    var me = currentUser();
    if (me && !isSuper(me) && roleIdsOf(me).indexOf(id) >= 0)
      return err(403, "self_elevation",
        "You hold this role. Someone else has to change it — nobody edits their own permissions.");
    if (role.is_super && p.permissions)
      return err(422, "role_protected", "Super Admin holds everything by definition; its matrix is not editable.");

    if (p.name !== undefined) {
      var n = String(p.name).trim();
      if (!n) return err(400, "validation_failed", "A role needs a name.");
      var clash = roleByName(n);
      if (clash && clash.role_id !== id)
        return err(409, "duplicate_role", "A role is already called “" + n + "”.");
      role.name = n;
    }
    if (p.description !== undefined) role.description = String(p.description).trim();
    if (p.status !== undefined) {
      if (role.is_super && p.status !== "active")
        return err(422, "role_protected", "Super Admin cannot be deactivated.");
      role.status = p.status === "inactive" ? "inactive" : "active";
    }
    if (p.permissions !== undefined) role.permissions = normalisePerms(p.permissions);
    role.updated_at = todayISO();
    persistRoles();
    record("Team", "Role updated — " + role.name, role.role_id, actor);
    return ok(role);
  };

  T.Roles.remove = function (id, actor) {
    var g = guard("roles", "edit"); if (g) return g;
    var role = roleOf(id);
    if (!role) return err(404, "role_not_found", "No role " + id + ".");
    if (role.is_super) return err(422, "role_protected", "Super Admin cannot be deleted.");
    var holders = members().filter(function (u) { return roleIdsOf(u).indexOf(id) >= 0; });
    if (holders.length)
      return err(422, "role_in_use",
        holders.length + " member(s) hold this role. Move them off it first, or deactivate it — " +
        "deleting it would leave those accounts pointing at a role that does not exist.");
    var db = loadRoles();
    db.roles = db.roles.filter(function (r) { return r.role_id !== id; });
    persistRoles();
    record("Team", "Role deleted — " + role.name, id, actor);
    return ok({ role_id:id });
  };

  /* ---------------------------------------------------------------------- */
  T.Members.create = function (p, actor) {
    var g = guard("team", "create"); if (g) return g;
    var list = members();
    var name = String(p && p.name || "").trim();
    var email = String(p.email || "").trim();
    var phone = String(p.phone || "").trim();
    var designation = String(p.designation || "").trim();
    var username = String(p.username || "").trim();

    if (!name) return err(400, "validation_failed", "A member needs a name.");
    if (!EMAIL_RE.test(email)) return err(400, "validation_failed", "That email address is not valid.");
    if (!PHONE_RE.test(phone)) return err(400, "validation_failed", "That phone number is not valid.");
    if (!designation) return err(400, "validation_failed", "Designation is required.");
    if (!username) username = suggestUsername(name, list);
    if (!USER_RE.test(username))
      return err(400, "validation_failed",
        "A username is 3–24 characters: letters, numbers, dot, dash or underscore.");
    if (findBy(list, "email", email, null))
      return err(409, "duplicate_email", "Someone is already registered with that email.");
    if (findBy(list, "username", username, null))
      return err(409, "duplicate_username", "That username is taken.");
    if (phone && findBy(list, "phone", phone, null))
      return err(409, "duplicate_phone", "Someone is already registered with that phone number.");

    var roleIds = (p.role_ids || []).filter(function (r) { return !!roleOf(r); });
    var password = p.password && String(p.password).trim() ? String(p.password).trim() : generatePassword();
    if (password.length < 8)
      return err(400, "validation_failed", "A password needs at least 8 characters.");

    /* The photo is a data URI the picker already downsized client-side — this
       just refuses anything that isn't one, so a stray value never lands here
       as a URL the record can't actually render, and never balloons the store. */
    var avatar = String(p.avatar_url || "").trim();
    if (avatar && avatar.indexOf("data:image/") !== 0)
      return err(400, "validation_failed", "Photo must be an uploaded image.");
    if (avatar.length > 300000)
      return err(400, "validation_failed", "That photo is too large — try a smaller one.");

    var user = {
      id:"u" + (Date.now().toString(36)) + Math.floor(Math.random() * 100),
      name:name, email:email, phone:phone, designation:designation, username:username,
      avatar_url:avatar || null,
      status:p.status === "inactive" ? "inactive" : "active",
      role_ids:roleIds,
      /* Kept in step with the first role so `admin-auth.html` and every view
         written before this module still resolve a role from the record. */
      role:roleIds.length ? roleIds[0] : null,
      registeredAt:Date.now(), lastLogin:null, failedAttempts:0
    };
    setPassword(user, password);
    list.push(user); saveMembers(list);
    record("Team", "Member created — " + name + " (" + designation + ")", user.id, actor);
    /* The generated password is returned ONCE, to the dialog that asked for
       it. It is never stored in the clear and no read path returns it again. */
    return ok({ user:user, password:password });
  };

  T.Members.update = function (id, p, actor) {
    var g = guard("team", "edit"); if (g) return g;
    var list = members();
    var u = findIn(list, id);
    if (!u) return err(404, "member_not_found", "No member " + id + ".");

    if (p.name !== undefined) {
      var n = String(p.name).trim();
      if (!n) return err(400, "validation_failed", "A member needs a name.");
      u.name = n;
    }
    if (p.email !== undefined) {
      var e = String(p.email).trim();
      if (!EMAIL_RE.test(e)) return err(400, "validation_failed", "That email address is not valid.");
      if (findBy(list, "email", e, id)) return err(409, "duplicate_email", "Someone else uses that email.");
      u.email = e;
    }
    if (p.phone !== undefined) {
      var ph = String(p.phone).trim();
      if (ph && !PHONE_RE.test(ph)) return err(400, "validation_failed", "That phone number is not valid.");
      if (ph && findBy(list, "phone", ph, id)) return err(409, "duplicate_phone", "Someone else uses that number.");
      u.phone = ph;
    }
    if (p.username !== undefined) {
      var un = String(p.username).trim();
      if (!USER_RE.test(un)) return err(400, "validation_failed", "A username is 3–24 characters.");
      if (findBy(list, "username", un, id)) return err(409, "duplicate_username", "That username is taken.");
      u.username = un;
    }
    if (p.designation !== undefined) {
      var d = String(p.designation).trim();
      if (!d) return err(400, "validation_failed", "Designation is required.");
      u.designation = d;
    }
    saveMembers(list);
    record("Team", "Member updated — " + u.name, u.id, actor);
    return ok(u);
  };

  /* Roles are their own call, not a field on update, because assigning a role
     is the sensitive act and it carries its own permission (`team.roles`).
     Somebody may be allowed to fix a typo in a colleague's phone number
     without being allowed to make them a Finance Manager. */
  T.Members.setRoles = function (id, roleIds, actor) {
    var g = guard("team", "roles"); if (g) return g;
    var list = members();
    var u = findIn(list, id);
    if (!u) return err(404, "member_not_found", "No member " + id + ".");
    var me = currentUser();
    if (me && me.id === id)
      return err(403, "self_elevation",
        "You cannot change your own roles. Someone else has to do it.");
    var clean = (roleIds || []).filter(function (r) { return !!roleOf(r); });
    /* Removing the last active Super Admin locks everyone out of the panel
       with no way back except a console. */
    if (isSuper(u)) {
      var stillSuper = clean.some(function (r) { var x = roleOf(r); return x && x.is_super; });
      if (!stillSuper && superAdmins(list).length <= 1)
        return err(422, "last_super_admin",
          "This is the only active Super Admin. Promote someone else first — a panel nobody can " +
          "administer cannot be recovered from inside it.");
    }
    u.role_ids = clean;
    u.role = clean.length ? clean[0] : null;
    saveMembers(list);
    record("Team", "Roles set for " + u.name + " — " +
      (clean.map(function (r) { return (roleOf(r) || {}).name; }).join(", ") || "none"), u.id, actor);
    return ok(u);
  };

  T.Members.setStatus = function (id, status, actor) {
    var g = guard("team", "status"); if (g) return g;
    var list = members();
    var u = findIn(list, id);
    if (!u) return err(404, "member_not_found", "No member " + id + ".");
    if (["active", "inactive", "suspended"].indexOf(status) < 0)
      return err(400, "validation_failed", "Unknown status " + status + ".");
    var me = currentUser();
    if (me && me.id === id && status !== "active")
      return err(403, "self_lockout", "You cannot deactivate your own account.");
    if (isSuper(u) && status !== "active" && superAdmins(list).length <= 1)
      return err(422, "last_super_admin", "This is the only active Super Admin.");
    var from = u.status;
    u.status = status;
    if (status === "active") u.failedAttempts = 0;   // reinstating clears a lockout
    saveMembers(list);
    record("Team", u.name + " — " + from + " → " + status, u.id, actor);
    return ok(u);
  };

  T.Members.resetPassword = function (id, actor) {
    var g = guard("team", "edit"); if (g) return g;
    var list = members();
    var u = findIn(list, id);
    if (!u) return err(404, "member_not_found", "No member " + id + ".");
    var password = generatePassword();
    setPassword(u, password);
    u.failedAttempts = 0;
    if (u.status === "locked") u.status = "active";
    saveMembers(list);
    record("Team", "Password reset for " + u.name, u.id, actor);
    return ok({ user:u, password:password });     // shown once, to whoever asked
  };

  /* Deactivate, do not delete. Deals, quotations and invoices name their owner
     by id; removing the record would leave those documents owned by nobody. */
  T.Members.remove = function (id, actor) {
    var g = guard("team", "status"); if (g) return g;
    var u = memberOf(id);
    if (!u) return err(404, "member_not_found", "No member " + id + ".");
    return err(422, "deactivate_instead",
      "Members are deactivated, never deleted. " + u.name + " owns deals, quotations and invoices " +
      "that name them — removing the record would leave those documents owned by nobody.");
  };

  /* ============================================================== SEED === */
  /* The eight legacy role keys become real records, keeping their ids so every
     existing member record (`role:"sales_agent"`) still resolves. Their
     matrices are the first honest version of what ROLE_GRANTS described in
     prose — and unlike that prose, they are now editable. */
  function seedRoles() {
    var db = blankRoles();
    var now = todayISO();

    function P(spec) {
      var out = {};
      Object.keys(spec).forEach(function (mod) {
        spec[mod].forEach(function (a) {
          if (actionsOf(mod).indexOf(a) >= 0) out[mod + "." + a] = true;
        });
      });
      return out;
    }
    function role(id, name, description, perms, isSuper) {
      db.roles.push({
        role_id:id, name:name, description:description,
        status:"active", is_super:!!isSuper,
        permissions:isSuper ? {} : P(perms || {}),
        created_at:now, created_by:"Seed", updated_at:now
      });
      db.seq++;
    }

    role("super_admin", "Super Admin",
      "Everything, including roles and permissions. Cannot be edited or deleted.",
      null, true);

    role("sales_head", "Sales Head",
      "The whole sales chain, plus closing deals and exporting.", {
        deals:["view","create","edit","stage","payment","close","export"],
        quotations:["view","create","edit","issue","accept","cancel","export"],
        invoices:["view","create","edit","issue","cancel","export"],
        plans:["view"], audit:["view"]
      });

    role("sales_agent", "Sales Agent",
      "Works deals and writes quotations. Cannot close a deal or cancel an invoice.", {
        deals:["view","create","edit","stage","payment"],
        quotations:["view","create","edit","issue"],
        invoices:["view","create"],
        plans:["view"]
      });

    role("finance", "Finance",
      "Reads the chain, owns invoice issue and cancellation.", {
        deals:["view","payment"],
        quotations:["view"],
        invoices:["view","edit","issue","cancel","export"],
        plans:["view"]
      });

    role("ops_manager", "Ops Manager",
      "Reads the chain and maintains the plan catalogue.", {
        deals:["view"], quotations:["view"], invoices:["view"],
        plans:["view","create","edit","pricing","status"],
        audit:["view"]
      });

    role("analyst", "Analyst",
      "Read-only across the chain, with export.", {
        deals:["view","export"], quotations:["view","export"],
        invoices:["view","export"], plans:["view"], audit:["view"]
      });

    role("content", "Content",
      "The design system only — a placeholder until the content surfaces are rebuilt.", {
        design:["view"]
      });

    role("catalog_mod", "Catalogue Moderator",
      "Maintains plans and nothing else.", {
        plans:["view","create","edit","pricing"]
      });

    return db;
  }

  /* ============================================================== HEAL === */
  /* Existing member records predate designation, username, role_ids and the
     password hash. Backfill them on first load rather than migrating with a
     schema bump: the fields are ADDITIVE, and discarding the store would
     throw away accounts somebody created. */
  (function healMembers() {
    if (!D || !D.TeamStore) return;
    var list = D.TeamStore.load(), moved = false;
    list.forEach(function (u) {
      if (!u.username) {
        u.username = suggestUsername(u.name, list);
        moved = true;
      }
      if (!u.designation) {
        var r = u.role ? roleOf(u.role) : null;
        u.designation = r ? r.name : "Team member";
        moved = true;
      }
      if (!Array.isArray(u.role_ids)) { u.role_ids = u.role ? [u.role] : []; moved = true; }
      if (u.password !== undefined) { setPassword(u, u.password); moved = true; }
      /* `pending` predates this module and meant "registered, awaiting a
         role". There is no public registration any more, so it can only be a
         member an admin has not finished setting up: inactive is the honest
         name for that, and it is the status login already refuses. */
      if (u.status === "pending") { u.status = "inactive"; moved = true; }
    });
    if (moved) D.TeamStore.save(list);
  })();
})(window);

/* ---------------------------------------------------------------- ES module
   The IIFE above is verbatim from the prototype and still attaches to
   `window`, because the engines find each other through `root.IB*` at
   runtime. This only re-exports what it already published. */
export const IBTeam = window.IBTeam;
export default window.IBTeam;
