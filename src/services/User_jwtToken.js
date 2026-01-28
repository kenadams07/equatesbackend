/* JWT helpers for issuing and verifying user tokens. */
const jwt = require("jsonwebtoken");

// Issue a signed JWT for authenticated users
module.exports.issueUser = function (payload) {
  return jwt.sign(
    {
      id: payload.id,
    },
    process.env.JWT_USER_SECRETKEY,
    { algorithm: "HS512",
      expiresIn: process.env.USER_TOKEN_EXPIRES_IN
     }
  );
};

// Issue a signed JWT for demo users
module.exports.issueDemoUser = function (payload) {
  return jwt.sign(
    {
      exp: payload.exp,
      id: payload.id,
    },
    process.env.JWT_USER_SECRETKEY,
    { algorithm: "HS512" }
  );
};

// Verify JWT signature and return decoded payload
module.exports.verify = function (token, callback) {
  try {
    return jwt.verify(token, process.env.JWT_USER_SECRETKEY, { algorithms: ['HS512'] }, callback);
  } catch (err) {
    return "error";
  }
};

// Extract raw JWT from Authorization header value
module.exports.decode = async (token) => {
  const parts = token.split(" ");
  if (parts.length === 2) {
    const scheme = parts[0];
    const credentials = parts[1];
    if (/^Bearer$/i.test(scheme)) {
      return credentials;
    }
    return false;
  }
  return false;
};
