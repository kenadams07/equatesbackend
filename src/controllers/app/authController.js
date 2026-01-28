/* User authentication and password management controller. */
const Transformer = require("object-transformer");
const bcrypt = require("bcrypt");
const Response = require("../../services/Response");
const Constants = require("../../services/Constants");
const Helper = require("../../services/Helper");
const Mailer = require("../../services/Mailer");
const {
  signUpValidation,
  loginValidation,
  logoutValidation,
  forgotPasswordValidation,
  resetPassValidation,
  verifyOTPValidation,
  changePasswordValidation,
  refreshTokenValidation,
} = require("../../services/UserValidation");
const { Login } = require("../../transformers/user/userAuthTransformer");
const { User } = require("../../models");
const {
  issueUser,
  issueUserRefreshToken,
  verifyRefreshToken,
} = require("../../services/User_jwtToken");
const {
  saveUserDetailsInRedis,
  saveOtpInRedis,
  getOtpFromRedis,
  deleteOtpFromRedis,
  getUserDetailsFromRedis,
  saveResetPasswordFlag,
  getResetPasswordFlag,
  deleteResetPasswordFlag,
} = require("../../services/redisService");

module.exports = {
  /**
   * @description "This function is for User-SignUp."
   * @param req
   * @param res
   */
  signUp: async (req, res) => {
    try {
      const requestParams = req.body;
      // Validate payload before processing
      signUpValidation(requestParams, res, async (validate) => {
        if (validate) {
          // Normalize identifiers for consistent lookups
          const username = String(requestParams?.username || "").toLowerCase();
          const email = String(requestParams?.email || "").toLowerCase();
          const normalizedMobileNo = String(
            requestParams.mobileNo || "",
          ).replace(/^\+/, "");
          const mobileNoNumber = Number(normalizedMobileNo);

          const conditions = [{ username }];
          conditions.push({ email });
          if (!Number.isNaN(mobileNoNumber)) {
            conditions.push({ mobileNo: mobileNoNumber });
          }

          // Check for existing user by username/email/mobile
          const existingUser = await User.findOne(
            { $or: conditions },
            { _id: 1, username: 1, email: 1, mobileNo: 1 },
          )?.lean();
          if (existingUser) {
            if (existingUser.emailVerify === null) {
              return Response.errorResponseWithoutData(
                res,
                res.__("verifyYourEmail"),
                Constants.FAIL,
              );
            }
            const errorMessage =
              existingUser.username === username
                ? "usernameAlreadyExistTryLogin"
                : existingUser.mobileNo == mobileNoNumber
                  ? "mobileAlreadyExistTryLogin"
                  : "UserAlreadyExists";
            return Response.errorResponseWithoutData(
              res,
              res.__(errorMessage),
              Constants.FAIL,
            );
          }

          // Hash password and cache signup data until OTP verification
          const hashedPass = bcrypt.hashSync(requestParams.password, 10);
          let layer = {
            name: requestParams.name,
            username,
            email,
            companyName: requestParams.companyName,
            groupName: requestParams.groupName,
            password: hashedPass,
            status: Constants.ACTIVE,
          };
          if (requestParams?.mobileNo) {
            layer.mobileNo = mobileNoNumber;
          }
          // Create OTP and store in Redis with short TTL
          const generateotp = Helper.makeRandomOTPNumber(6);
          await saveUserDetailsInRedis(layer.email, 3600, layer);
          await saveOtpInRedis(layer.email, generateotp, 300);
          // Send OTP email
          const mailSubject = "Verify your email";
          const text = `Hi ${requestParams.name}, your verification code is ${generateotp}. It expires in 5 minutes.`;
          const mail = await Mailer.sendSimpleMail(
            requestParams.email,
            mailSubject,
            text,
          );
          if (mail) {
            return Response.successResponseData(
              res,
              new Transformer.Single(layer, Login).parse(),
              Constants.SUCCESS,
              res.__("UserCreatedOTPConfirmationRequired"),
            );
          } else {
            await deleteOtpFromRedis(layer.email);
            return Response.errorResponseWithoutData(
              res,
              res.__("CouldntRegisterAtTheMoment"),
              Constants.FAIL,
            );
          }
        }
      });
    } catch (error) {
      console.error(error);
      return Response.errorResponseWithoutData(
        res,
        res.locals.__("internalError"),
        Constants.INTERNAL_SERVER,
      );
    }
  },

  /**
   * @description "This function is for OTP Verification."
   * @param req
   * @param res
   */
  verifyOTP: async (req, res) => {
    try {
      const reqParam = req.body;
      // Validate OTP request and action type
      verifyOTPValidation(reqParam, res, async (validate) => {
        if (validate) {
          const { type, from, OTP, email } = reqParam;
          // Load user by email to resolve username for Redis keys

          const userName = email?.trim();

          let userLayer = await getUserDetailsFromRedis(userName);
          // If user not in Redis (e.g. forgot password flow), try fetching from DB
          if (!userLayer) {
            userLayer = await User.findOne(
              { email: userName },
              { name: 1, email: 1, emailVerify: 1 },
            );
          }

          if (!userLayer) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("sessionExpired"),
              Constants.BAD_REQUEST,
            );
          }

          if (userLayer?.emailVerify && from === "OTPVerification") {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("alreadyEmailVerified."),
              Constants.FAIL,
            );
          }

          if (!userLayer?.emailVerify && from === "forgotPassword") {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("emailNotVerified"),
              Constants.FAIL,
            );
          }

          // Resend flow: generate a new OTP and email it
          if (type === "Resend") {
            const newOtp = Helper.makeRandomOTPNumber(6);
            await saveOtpInRedis(userName, newOtp, 300);

            if (from === "OTPVerification") {
              const mailSubject = "Your new verification code";
              const text = `Hi ${userLayer?.name || userName}, your new verification code is ${newOtp}. It expires in 5 minutes.`;
              await Mailer.sendSimpleMail(userLayer?.email, mailSubject, text);
            } else if (from === "forgotPassword") {
              if (userLayer?.email) {
                const locals = {
                  username: userLayer.username,
                  otp: newOtp,
                  appName: Helper.AppName,
                };
                const mail = await Mailer.sendMail(
                  userLayer.email,
                  "Password reset OTP",
                  "forgotPassword",
                  locals,
                );
                if (mail) {
                  return Response.successResponseWithoutData(
                    res,
                    res.locals.__("otpResent"),
                    Constants.SUCCESS,
                  );
                }
              }
              return Response.errorResponseWithoutData(
                res,
                res.locals.__("CouldntRegisterAtTheMoment"),
                Constants.FAIL,
              );
            }
            return Response.successResponseWithoutData(
              res,
              res.locals.__("otpResent"),
              Constants.SUCCESS,
            );
          }

          // Confirm flow: compare OTP from Redis
          const savedOtp = await getOtpFromRedis(userName);
          if (!savedOtp || savedOtp !== OTP) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("invalidOtp"),
              Constants.BAD_REQUEST,
            );
          }

          // Signup confirmation: persist cached user data
          if (from === "OTPVerification") {
            const layer = await getUserDetailsFromRedis(userName);
            if (!layer) {
              return Response.errorResponseWithoutData(
                res,
                res.locals.__("sessionExpired"),
                Constants.BAD_REQUEST,
              );
            }
            layer.emailVerify = new Date();
            const createdUser = await User.create(layer);
            await deleteOtpFromRedis(userName);
            return Response.successResponseData(
              res,
              new Transformer.Single(createdUser, Login).parse(),
              Constants.SUCCESS,
              res.locals.__("emailVerified"),
            );
          }

          // Forgot password confirmation: enable reset for a short window
          if (from === "forgotPassword") {
            await deleteOtpFromRedis(userName);
            await saveResetPasswordFlag(userName, 300);
            return Response.successResponseWithoutData(
              res,
              res.locals.__("otpVerified"),
              Constants.SUCCESS,
            );
          }
        }
      });
    } catch (error) {
      return Response.errorResponseData(
        res,
        res.__("internalError"),
        Constants.INTERNAL_SERVER,
      );
    }
  },

  /**
   * @description "This function is for User-Login."
   * @param req
   * @param res
   */
  login: async (req, res) => {
    try {
      const reqParam = req.body;
      // Validate login payload
      loginValidation(reqParam, res, async (validate) => {
        if (validate) {
          const loginValue = String(reqParam.username || "").trim();
          const loginLower = loginValue.toLowerCase();
          // Normalize input; allow username, email, or mobile number
          const normalizedMobileNo = loginValue.replace(/^\+/, "");
          const mobileNoNumber = Number(normalizedMobileNo);
          const conditions = [{ username: loginLower }, { email: loginLower }];
          if (!Number.isNaN(mobileNoNumber)) {
            conditions.push({ mobileNo: mobileNoNumber });
          }
          const user = await User.findOne(
            {
              $or: conditions,
            },
            {
              name: 1,
              username: 1,
              password: 1,
              status: 1,
              email: 1,
              emailVerify: 1,
              mobileNo: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          );

          // Track system and browser IPs for login audit
          const browser_ip =
            req.headers["x-forwarded-for"] || req.connection.remoteAddress;
          const system_ip = req.clientIp;
          if (user) {
            if (user?.status === Constants.ACTIVE) {
              const comparePassword = await bcrypt.compare(
                reqParam.password?.trim(),
                user.password,
              );
              if (comparePassword) {
                if (user?.email && !user?.emailVerify) {
                  return Response.errorResponseWithoutData(
                    res,
                    res.locals.__("emailNotVerified"),
                    Constants.BAD_REQUEST,
                  );
                }
                // Issue JWT and persist login metadata
                const token = issueUser({ id: user._id });
                const refreshToken = issueUserRefreshToken({ id: user._id });
                await User.updateOne(
                  { _id: user?._id },
                  {
                    $set: {
                      last_login: new Date(),
                      token,
                      refreshToken,
                      "ip_address.system_ip": system_ip,
                      "ip_address.browser_ip": browser_ip,
                    },
                  },
                );

                return Response.successResponseData(
                  res,
                  new Transformer.Single(user, Login).parse(),
                  Constants.SUCCESS,
                  res.locals.__("loginSuccessfull"),
                  { token, refreshToken },
                );
              } else {
                return Response.errorResponseWithoutData(
                  res,
                  res.locals.__("emailPasswordNotMatch"),
                  Constants.BAD_REQUEST,
                );
              }
            } else {
              Response.errorResponseWithoutData(
                res,
                res.locals.__("accountIsInactive"),
                Constants.FAIL,
              );
            }
          } else {
            Response.errorResponseWithoutData(
              res,
              res.locals.__("userNameNotExist"),
              Constants.FAIL,
            );
          }
        }
      });
    } catch (error) {
      console.log("error", error);
      return Response.errorResponseData(
        res,
        res.__("internalError"),
        Constants.INTERNAL_SERVER,
      );
    }
  },

  /**
   * @description This function is for Forgot Password of user.
   * @param req
   * @param res
   */
  forgotPassword: async (req, res) => {
    try {
      const reqParam = req.body;
      // Validate request email
      forgotPasswordValidation(reqParam, res, async (validate) => {
        if (validate) {
          // Generate OTP and send reset email
          const otp = Helper.makeRandomOTPNumber(6);
          const query = { email: reqParam.email?.trim()?.toLowerCase() };
          let user = await User.findOne(query, {
            name: 1,
            status: 1,
            mobileNo: 1,
            username: 1,
            email: 1,
            password: 1,
            emailVerify: 1,
          });

          if (user?.emailVerify == null) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("emailNotVerified"),
              Constants.FAIL,
            );
          }
          if (user) {
            if (user?.status === Constants.ACTIVE) {
              // Store OTP and email it to the user
              await saveOtpInRedis(user.email, otp, 300);
              const locals = {
                username: user.username,
                otp,
                appName: Helper.AppName,
              };
              if (user?.email) {
                const mail = await Mailer.sendMail(
                  user.email,
                  "Password reset OTP",
                  "forgotPassword",
                  locals,
                );
                if (mail) {
                  const data = { email: user.email };
                  return Response.successResponseData(
                    res,
                    data,
                    Constants.SUCCESS,
                    res.locals.__("forgotPasswordEmailSendSuccess"),
                  );
                }
              }
              return Response.errorResponseWithoutData(
                res,
                res.locals.__("CouldntRegisterAtTheMoment"),
                Constants.FAIL,
              );
            } else {
              Response.errorResponseWithoutData(
                res,
                res.locals.__("accountIsInactive"),
                Constants.FAIL,
              );
            }
          } else {
            Response.errorResponseWithoutData(
              res,
              res.locals.__("UserNotExists"),
              Constants.FAIL,
            );
          }
        }
      });
    } catch (error) {
      return Response.errorResponseData(
        res,
        res.locals.__("internalError"),
        Constants.INTERNAL_SERVER,
      );
    }
  },

  /**
   * @description This function is for reset Password of user with otp verification.
   * @param req
   * @param res
   */
  resetPassword: async (req, res) => {
    try {
      const reqParam = req.body;
      // Validate reset payload
      resetPassValidation(reqParam, res, async (validate) => {
        if (validate) {
          // Ensure user exists and is verified
          let user = await User.findOne(
            { email: reqParam?.email?.toLowerCase() },
            { email: 1, username: 1, password: 1, emailVerify: 1 },
          )?.lean();
          if (!user) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("UserNotExists"),
              Constants.FAIL,
            );
          }
          if (user?.emailVerify == null) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("emailNotVerified"),
              Constants.FAIL,
            );
          }
          const comparePassword = await bcrypt.compare(
            reqParam.password?.trim(),
            user.password,
          );
          if (comparePassword) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("passwordSameAsOld"),
              Constants.BAD_REQUEST,
            );
          }
          // Verify OTP confirmation window
          const resetFlag = await getResetPasswordFlag(user?.email?.trim());
          if (!resetFlag) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("otpNeedToVerifyThroughForgotPassword"),
              Constants.BAD_REQUEST,
            );
          }
          // Update password and clear reset flag
          const hashPass = bcrypt.hashSync(reqParam?.password?.trim(), 10);
          const updatedUser = await User.findOneAndUpdate(
            { _id: user?._id },
            {
              password: hashPass,
            },
            { new: true },
          );
          await deleteResetPasswordFlag(user?.email?.trim());
          let token = updatedUser?.token;
          return Response.successResponseData(
            res,
            new Transformer.Single(updatedUser, Login).parse(),
            Constants.SUCCESS,
            res.locals.__("loginSuccessfull"),
            { token },
          );
        }
      });
    } catch (error) {
      return Response.errorResponseData(
        res,
        res.locals.__("internalError"),
        Constants.INTERNAL_SERVER,
      );
    }
  },

  /**
   * @description This function is for change Password of user.
   * @param req
   * @param res
   */
  changePassword: async (req, res) => {
    try {
      const { authUserId } = req;
      const requestParams = req.body;
      // Validate change password payload
      changePasswordValidation(requestParams, res, async (validate) => {
        if (validate) {
          // Ensure new password differs from old
          if (requestParams.oldPassword !== requestParams.password) {
            const userData = await User.findOne(
              { _id: authUserId, role: Constants?.ROLES?.USER },
              { password: 1 },
            );
            if (userData) {
              const passValid = await bcrypt.compare(
                requestParams.oldPassword,
                userData.password,
              );
              if (passValid) {
                const passHash = await bcrypt.hashSync(
                  requestParams.password,
                  10,
                );
                await User.updateOne(
                  { _id: authUserId },
                  {
                    $set: {
                      password: passHash,
                      passwordText: requestParams.password,
                    },
                  },
                );
                return Response.successResponseWithoutData(
                  res,
                  res.locals.__("passwordChangedSuccessfully"),
                  Constants.SUCCESS,
                );
              } else {
                return Response.errorResponseWithoutData(
                  res,
                  res.locals.__("incorrectOldPassword"),
                  Constants.BAD_REQUEST,
                );
              }
            } else {
              return Response.errorResponseWithoutData(
                res,
                res.locals.__("youarenotauthenticated"),
                Constants.BAD_REQUEST,
              );
            }
          } else {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("oldPasswordAndNewPasswordSame"),
              Constants.BAD_REQUEST,
            );
          }
        }
      });
    } catch (error) {
      return Response.errorResponseData(
        res,
        res.__("internalError"),
        Constants.INTERNAL_SERVER,
      );
    }
  },

  /**
   * @description This function is for Refresh Token.
   * @param req
   * @param res
   */
  refreshToken: async (req, res) => {
    try {
      const requestParams = req.body;
      refreshTokenValidation(requestParams, res, async (validate) => {
        if (validate) {
          const { refreshToken } = requestParams;
          const decoded = verifyRefreshToken(refreshToken);
          if (decoded === "error" || !decoded.id) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("invalidRefreshToken"),
              Constants.UNAUTHORIZED,
            );
          }

          const user = await User.findOne({
            _id: decoded.id,
            refreshToken: refreshToken,
          });
          if (!user) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("invalidRefreshToken"),
              Constants.UNAUTHORIZED,
            );
          }

          if (user.status !== Constants.ACTIVE) {
            return Response.errorResponseWithoutData(
              res,
              res.locals.__("accountBlocked"),
              Constants.UNAUTHORIZED,
            );
          }

          // Issue new tokens
          const newToken = issueUser({ id: user._id });
          const newRefreshToken = issueUserRefreshToken({ id: user._id });

          // Update user with new refresh token
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                token: newToken,
                refreshToken: newRefreshToken,
              },
            },
          );

          return Response.successResponseData(
            res,
            {},
            Constants.SUCCESS,
            res.locals.__("tokenRefreshed"),
            { token: newToken, refreshToken: newRefreshToken },
          );
        }
      });
    } catch (error) {
      return Response.errorResponseData(
        res,
        res.locals.__("internalError"),
        Constants.INTERNAL_SERVER,
      );
    }
  },

  /**
   * @description "This function is for logout user."
   * @param req
   * @param res
   */
  logout: async (req, res) => {
    try {
      const requestParams = req.body;
      const { authUserId } = req;
      // Validate payload and clear user token
      logoutValidation(requestParams, res, async (validate) => {
        if (validate) {
          await User.updateOne(
            { _id: authUserId },
            {
              $set: {
                token: null,
                refreshToken: null,
              },
            },
          );

          return Response.successResponseWithoutData(
            res,
            res.locals.__("logout"),
            Constants.SUCCESS,
          );
        }
      });
    } catch (error) {
      return Response.errorResponseWithoutData(
        res,
        res.locals.__("internalError"),
        Constants.INTERNAL_SERVER,
      );
    }
  },
};
