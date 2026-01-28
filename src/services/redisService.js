/* Redis helpers used for OTPs, signup cache, and short-lived flags. */
const { createClient } = require("redis");

let client;

// Lazily initialize and reuse a single Redis client
async function getClient() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = process.env.REDIS_PORT || 6379;
  client = createClient(url ? { url } : { socket: { host, port: Number(port) } });
  client.on("error", (err) => console.error("Redis Client Error", err));
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

// Cache signup payload until OTP verification completes
async function saveUserDetailsInRedis(username, ttlSeconds, data) {
  const c = await getClient();
  const key = `user:signup:${username}`;
  await c.set(key, JSON.stringify(data), { EX: ttlSeconds });
  return true;
}

// Read cached signup payload
async function getUserDetailsFromRedis(username) {
  const c = await getClient();
  const key = `user:signup:${username}`;
  const val = await c.get(key);
  return val ? JSON.parse(val) : null;
}

// Store OTP with TTL
async function saveOtpInRedis(username, otp, ttlSeconds) {
  const c = await getClient();
  const key = `otp:${username}`;
  await c.set(key, String(otp), { EX: ttlSeconds });
  return true;
}

// Read OTP for a username
async function getOtpFromRedis(username) {
  const c = await getClient();
  const key = `otp:${username}`;
  const val = await c.get(key);
  return val;
}

// Remove OTP entry
async function deleteOtpFromRedis(username) {
  const c = await getClient();
  const key = `otp:${username}`;
  await c.del(key);
  return true;
}

// Store short-lived bet lock to prevent duplicate operations
async function betAlreadyInProcess(userId, payload) {
  const c = await getClient();
  const key = `bet:process:${userId}`;
  await c.set(key, JSON.stringify(payload), { EX: 60 });
  return true;
}

// Read bet lock payload
async function getPauseUserBetforSomeSecond(userId) {
  const c = await getClient();
  const key = `bet:process:${userId}`;
  const val = await c.get(key);
  return val ? JSON.parse(val) : null;
}

// Allow reset-password for a limited time after OTP verification
async function saveResetPasswordFlag(username, ttlSeconds) {
  const c = await getClient();
  const key = `reset:${username}`;
  await c.set(key, "verified", { EX: ttlSeconds });
  return true;
}

// Read reset-password flag
async function getResetPasswordFlag(username) {
  const c = await getClient();
  const key = `reset:${username}`;
  const val = await c.get(key);
  return val;
}

// Clear reset-password flag
async function deleteResetPasswordFlag(username) {
  const c = await getClient();
  const key = `reset:${username}`;
  await c.del(key);
  return true;
}

module.exports = {
  saveUserDetailsInRedis,
  getUserDetailsFromRedis,
  saveOtpInRedis,
  getOtpFromRedis,
  deleteOtpFromRedis,
  betAlreadyInProcess,
  getPauseUserBetforSomeSecond,
  saveResetPasswordFlag,
  getResetPasswordFlag,
  deleteResetPasswordFlag,
};
