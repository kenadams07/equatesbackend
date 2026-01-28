/* Joi-based validators for user auth flows with localized messages. */
const Response = require("./Response");
const Joi = require("@hapi/joi");
const Helper = require("./Helper");

module.exports = {
  /**
   * @description This function is used to validate User Sign Up fields.
   * @param req
   * @param res
   */
  // Validate signup inputs and emit i18n message keys
  signUpValidation: (req, res, callback) => {
    const schema = Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      username: Joi.string().trim().min(3).max(100).required(),
      email: Joi.string().trim().email().required(),
      mobileNo: Joi.string()
        .trim()
        .pattern(/^\+?[0-9]{10,15}$/)
        .required(),
      password: Joi.string()
        .trim()
        .min(8)
        .regex(/^(?=.*[0-9])(?=.*[a-zA-Z])[a-zA-Z0-9!@#$%^&*_]{8,}$/)
        .required(),
      companyName: Joi.string().trim().min(2).max(100).required(),
      groupName: Joi.string().trim().min(2).max(100).required(),
    });
    const { error } = schema.validate(req);
    if (error) {
      return Response.validationErrorResponseData(
        res,
        res.__(Helper.validationMessageKey("signUpValidation", error)),
      );
    }
    return callback(true);
  },
  /**
   * @description This function is used to validate User Login fields.
   * @param req
   * @param res
   */
  // Validate login inputs
  loginValidation: (req, res, callback) => {
    const schema = Joi.object({
      username: Joi.string().trim().required(),
      password: Joi.string().trim().required(),
    });
    const { error } = schema.validate(req);
    if (error) {
      return Response.validationErrorResponseData(
        res,
        res.__(Helper.validationMessageKey("loginValidation", error)),
      );
    }
    return callback(true);
  },

  /**
   * @description This function is used to validate forget password fields.
   * @param req
   * @param res
   */
  // Validate forgot password payload
  forgotPasswordValidation: (req, res, callback) => {
    const schema = Joi.object({
      email: Joi.string().trim().email().required(),
    });
    const { error } = schema.validate(req);
    if (error) {
      return Response.validationErrorResponseData(
        res,
        res.__(Helper.validationMessageKey("forgotPasswordValidation", error)),
      );
    }
    return callback(true);
  },

  /**
   * @description This function is used to validate user otp verification fields.
   * @param req
   * @param res
   */

  // Validate OTP action payload
  verifyOTPValidation: (req, res, callback) => {
    const schema = Joi.object({
      type: Joi.string().valid("Confirm", "Resend").required(),
      from: Joi.string().valid("forgotPassword", "OTPVerification").required(),
      OTP: Joi.string()
        .pattern(/^[0-9]+$/)
        .when("type", {
          is: "Resend",
          then: Joi.valid(null).allow(null),
          otherwise: Joi.required(),
        }),
      email: Joi.string().trim().email().required(),
    }).required();
    const { error } = schema.validate(req);
    if (error) {
      return Response.validationErrorResponseData(
        res,
        res.__(Helper.validationMessageKey("verifyOTPValidation", error)),
      );
    }
    return callback(true);
  },

  /**
   * @description This function is used to validate resetPass fields.
   * @param req
   * @param res
   */

  // Validate reset-password payload
  resetPassValidation: (req, res, callback) => {
    const schema = Joi.object({
      email: Joi.string().trim().email().required(),
      password: Joi.string()
        .trim()
        .min(8)
        .regex(/^(?=.*[0-9])(?=.*[a-zA-Z])[a-zA-Z0-9!@#$%^&*_]{8,}$/)
        .required(),
    });
    const { error } = schema.validate(req);
    if (error) {
      return Response.validationErrorResponseData(
        res,
        res.__(Helper.validationMessageKey("ResetPasswordValidation", error)),
      );
    }
    return callback(true);
  },

  /**
   * @description This function is used to validate change password fields.
   * @param req
   * @param res
   */

  // Validate change-password payload
  changePasswordValidation: (req, res, callback) => {
    const schema = Joi.object({
      old_password: Joi.string().trim().required(),
      password: Joi.string()
        .trim()
        .min(6)
        .regex(/^(?=.*[0-9])(?=.*[a-zA-Z])[a-zA-Z0-9!@#$%^&*]{6,}$/)
        .required(),
      confirm_password: Joi.string()
        .trim()
        .min(6)
        .regex(/^(?=.*[0-9])(?=.*[a-zA-Z])[a-zA-Z0-9!@#$%^&*]{6,}$/)
        .required(),
    });
    const { error } = schema.validate(req);
    if (error) {
      return Response.validationErrorResponseData(
        res,
        res.__(Helper.validationMessageKey("changePasswordValidation", error)),
      );
    }
    return callback(true);
  },

  /**
   * @description This function is used to validate logout field ID.
   * @param req
   * @param res
   */
  // Validate logout payload
  logoutValidation: (req, res, callback) => {
    const schema = Joi.object({
      user_id: Joi.string().trim().required(),
    });
    const { error } = schema.validate(req);
    if (error) {
      return Response.validationErrorResponseData(
        res,
        res.__(Helper.validationMessageKey("logoutValidation", error)),
      );
    }
    return callback(true);
  },
};
