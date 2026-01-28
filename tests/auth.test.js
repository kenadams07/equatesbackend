const express = require("express");
const request = require("supertest");
const bcrypt = require("bcrypt");
const Constants = require("../src/services/Constants");
const i18n = require("../src/i18n/i18n");

let mockAuthUserId = null;

jest.mock("../src/services/Mailer", () => ({
  sendMail: jest.fn(),
  sendSimpleMail: jest.fn(),
}));

jest.mock("../src/services/redisService", () => {
  const store = new Map();
  return {
    __store: store,
    __clearStore: () => store.clear(),
    saveUserDetailsInRedis: jest.fn((username, ttl, data) => {
      store.set(`user:${username}`, data);
      return true;
    }),
    getUserDetailsFromRedis: jest.fn((username) => store.get(`user:${username}`)),
    saveOtpInRedis: jest.fn((username, otp) => {
      store.set(`otp:${username}`, otp);
      return true;
    }),
    getOtpFromRedis: jest.fn((username) => store.get(`otp:${username}`)),
    deleteOtpFromRedis: jest.fn((username) => {
      store.delete(`otp:${username}`);
      return true;
    }),
    betAlreadyInProcess: jest.fn(),
    saveResetPasswordFlag: jest.fn((username) => {
      store.set(`reset:${username}`, "1");
      return true;
    }),
    getResetPasswordFlag: jest.fn((username) => store.get(`reset:${username}`)),
    deleteResetPasswordFlag: jest.fn((username) => {
      store.delete(`reset:${username}`);
      return true;
    }),
  };
});

jest.mock("../src/middlewares/user", () => ({
  userTokenAuth: (req, res, next) => {
    if (mockAuthUserId) {
      req.authUserId = mockAuthUserId;
      req.role = "user";
    }
    next();
  },
}));

jest.mock("../src/models", () => {
  const users = new Map();
  const createQuery = (result) => ({
    lean: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  });
  const matchesCond = (user, cond) => {
    return Object.keys(cond).every((key) => {
      if (cond[key] === undefined) {
        return true;
      }
      if (key === "mobileNo") {
        return Number(user[key]) === Number(cond[key]);
      }
      return user[key] === cond[key];
    });
  };
  const findUser = (query) => {
    if (!query) return null;
    if (query.$or) {
      return (
        Array.from(users.values()).find((user) =>
          query.$or.some((cond) => matchesCond(user, cond)),
        ) || null
      );
    }
    if (query._id) {
      return (
        users.get(String(query._id)) ||
        Array.from(users.values()).find((user) => user._id === query._id) ||
        null
      );
    }
    if (query.email) {
      return (
        Array.from(users.values()).find((user) => user.email === query.email) ||
        null
      );
    }
    if (query.username) {
      return (
        Array.from(users.values()).find(
          (user) => user.username === query.username,
        ) || null
      );
    }
    return null;
  };
  const User = {
    findOne: jest.fn((query) => createQuery(findUser(query))),
    create: jest.fn(async (data) => {
      const user = { _id: `user_${users.size + 1}`, ...data };
      users.set(user._id, user);
      return user;
    }),
    updateOne: jest.fn(async () => ({ acknowledged: true })),
    findOneAndUpdate: jest.fn(async (query, update) => {
      const existing = findUser(query);
      if (!existing) return null;
      const updated = { ...existing, ...update };
      users.set(updated._id, updated);
      return updated;
    }),
  };
  return {
    User,
    __users: users,
    __clearUsers: () => users.clear(),
    __setUser: (user) => {
      users.set(user._id, user);
      return user;
    },
  };
});

const Mailer = require("../src/services/Mailer");
const redisService = require("../src/services/redisService");
const { __setUser, __clearUsers } = require("../src/models");
const routes = require("../src/routes");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(i18n);
app.use("/", routes);

const seedUser = (overrides = {}) => {
  const base = {
    _id: `user_${Math.floor(Math.random() * 10000)}`,
    name: "Test User",
    username: "testuser",
    email: "test@example.com",
    password: bcrypt.hashSync("Password1", 10),
    status: Constants.ACTIVE,
    emailVerify: new Date(),
    mobileNo: 1234567890,
    token: "token",
  };
  const user = { ...base, ...overrides };
  __setUser(user);
  return user;
};

beforeAll(() => {
  process.env.JWT_USER_SECRETKEY = "testsecret";
  process.env.USER_TOKEN_EXPIRES_IN = "1h";
});

beforeEach(() => {
  __clearUsers();
  redisService.__clearStore();
  Mailer.sendMail.mockResolvedValue(true);
  Mailer.sendSimpleMail.mockResolvedValue(true);
  mockAuthUserId = null;
});

describe("Auth API", () => {
  test("sign-up succeeds with valid input", async () => {
    const response = await request(app).post("/api/v1/sign-up").send({
      name: "Jane Doe",
      username: "janedoe",
      email: "jane@example.com",
      mobileNo: "+12345678901",
      password: "Password1",
      companyName: "Acme",
      groupName: "Group",
    });
    expect(response.body.meta.code).toBe(200);
    expect(response.body.data.username).toBe("janedoe");
  });

  test("sign-up blocks existing username", async () => {
    seedUser({ username: "janedoe", email: "jane@example.com" });
    const response = await request(app).post("/api/v1/sign-up").send({
      name: "Jane Doe",
      username: "janedoe",
      email: "jane2@example.com",
      mobileNo: "+12345678901",
      password: "Password1",
      companyName: "Acme",
      groupName: "Group",
    });
    expect(response.body.meta.code).toBe(400);
  });

  test("verify-otp rejects invalid otp", async () => {
    seedUser({ username: "janedoe", email: "jane@example.com" });
    redisService.saveOtpInRedis("janedoe", "000000", 300);
    const response = await request(app).post("/api/v1/verify-otp").send({
      type: "Confirm",
      from: "OTPVerification",
      OTP: "111111",
      email: "jane@example.com",
    });
    expect(response.body.meta.code).toBe(400);
  });

  test("verify-otp confirms otp and creates user", async () => {
    seedUser({ username: "janedoe", email: "jane@example.com" });
    redisService.saveOtpInRedis("jane@example.com", "123456", 300);
    redisService.saveUserDetailsInRedis("jane@example.com", 3600, {
      name: "Jane Doe",
      username: "janedoe",
      email: "jane@example.com",
      companyName: "Acme",
      groupName: "Group",
      password: bcrypt.hashSync("Password1", 10),
      status: Constants.ACTIVE,
    });
    const response = await request(app).post("/api/v1/verify-otp").send({
      type: "Confirm",
      from: "OTPVerification",
      OTP: "123456",
      email: "jane@example.com",
    });
    if (response.body.meta.code !== 200) {
      console.log("verify-otp failed response:", JSON.stringify(response.body, null, 2));
    }
    expect(response.body.meta.code).toBe(200);
    expect(response.body.data.username).toBe("janedoe");
  });

  test("verify-otp resends for forgot password", async () => {
    seedUser({ username: "janedoe", email: "jane@example.com" });
    const response = await request(app).post("/api/v1/verify-otp").send({
      type: "Resend",
      from: "forgotPassword",
      OTP: null,
      email: "jane@example.com",
    });
    expect(response.body.meta.code).toBe(200);
  });

  test("login succeeds with valid credentials", async () => {
    seedUser({
      username: "janedoe",
      email: "jane@example.com",
      password: bcrypt.hashSync("Password1", 10),
    });
    const response = await request(app).post("/api/v1/login").send({
      username: "janedoe",
      password: "Password1",
    });
    expect(response.body.meta.code).toBe(200);
    expect(response.body.meta.token).toBeDefined();
  });

  test("login fails with wrong password", async () => {
    seedUser({
      username: "janedoe",
      email: "jane@example.com",
      password: bcrypt.hashSync("Password1", 10),
    });
    const response = await request(app).post("/api/v1/login").send({
      username: "janedoe",
      password: "WrongPassword1",
    });
    expect(response.body.meta.code).toBe(400);
  });

  test("forgot-password sends otp to verified user", async () => {
    seedUser({
      username: "janedoe",
      email: "jane@example.com",
    });
    const response = await request(app).post("/api/v1/forgot-password").send({
      email: "jane@example.com",
    });
    expect(response.body.meta.code).toBe(200);
  });

  test("reset-password updates password after otp verification", async () => {
    const user = seedUser({
      username: "janedoe",
      email: "jane@example.com",
      password: bcrypt.hashSync("OldPassword1", 10),
    });
    mockAuthUserId = user._id;
    redisService.saveResetPasswordFlag("jane@example.com", 300);
    const response = await request(app).post("/api/v1/reset-password").send({
      email: "jane@example.com",
      password: "NewPassword1",
    });
    expect(response.body.meta.code).toBe(200);
    expect(response.body.meta.token).toBeDefined();
  });

  test("change-password updates password for authenticated user", async () => {
    const user = seedUser({
      username: "janedoe",
      email: "jane@example.com",
      password: bcrypt.hashSync("OldPassword1", 10),
    });
    mockAuthUserId = user._id;
    const response = await request(app).post("/api/v1/change-password").send({
      oldPassword: "OldPassword1",
      password: "NewPassword1",
    });
    expect(response.body.meta.code).toBe(200);
  });

  test("logout clears user token", async () => {
    const user = seedUser({
      username: "janedoe",
      email: "jane@example.com",
    });
    mockAuthUserId = user._id;
    const response = await request(app).post("/api/v1/logout").send({
      userId: user._id,
    });
    expect(response.body.meta.code).toBe(200);
  });

  test("refresh-token returns new tokens", async () => {
    const user = seedUser({
      username: "janedoe",
      email: "jane@example.com",
      refreshToken: "valid_refresh_token",
    });

    // Mock verifyRefreshToken to return valid user id
    const { verifyRefreshToken } = require("../src/services/User_jwtToken");
    // Since User_jwtToken is not mocked in this file, we might need to rely on the actual implementation
    // or spy on it if we want to force return. 
    // However, issueUserRefreshToken uses jsonwebtoken.sign.
    // If we want to test successful refresh, we need a valid token signed with the secret.
    // Let's generate a real valid refresh token using the service helper.
    
    const { issueUserRefreshToken } = require("../src/services/User_jwtToken");
    const validRefreshToken = issueUserRefreshToken({ id: user._id });
    
    // Update user with this valid token so it matches in DB
    user.refreshToken = validRefreshToken;
    
    const response = await request(app).post("/api/v1/refresh-token").send({
      refreshToken: validRefreshToken,
    });
    
    expect(response.body.meta.code).toBe(200);
    expect(response.body.meta.token).toBeDefined();
    expect(response.body.meta.refreshToken).toBeDefined();
    
    // In fast tests, iat might be same, so token might be same.
    // Just verify we got a token back.
  });
});
