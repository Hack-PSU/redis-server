let passport = require('passport');

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/login');
}

let ensureScannerAuthenticated = passport.authenticate('scanner-api', { session: false });

function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.admin) {
    return next();
  }
  req.flash('message', {
    status: 'danger',
    value: 'You are not an Admin.'
  });
  res.redirect('/auth/login');
}

function ensureAdminJSON(req, res, next) {
  if (req.isAuthenticated() && req.user.admin) {
    return next();
  }
  res.status(401)
    .json({
      status: 'error',
      message: 'You do not have permission to do that.'
    });
}

function loginRedirect(req, res, next) {
  if (req.isAuthenticated()) {
    res.redirect('/');
  } else {
    return next();
  }
}

function setUserInfo(request) {
  var getUserInfo = {
    _id: request._id,
    email: request.email
  };

  return getUserInfo;
}

function clone(a) {
  return JSON.parse(JSON.stringify(a));
}


module.exports = {
  clone: clone,
  setUserInfo: setUserInfo,
  ensureAuthenticated: ensureAuthenticated,
  ensureScannerAuthenticated: ensureScannerAuthenticated,
  ensureAdmin: ensureAdmin,
  ensureAdminJSON: ensureAdminJSON,
  loginRedirect: loginRedirect
};
