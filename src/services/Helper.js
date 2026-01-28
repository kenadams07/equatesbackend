/* Utility helpers shared across validation and auth flows. */
module.exports = {
  AppName: "xyz",

  /**
   * @description This function use for converting string to uppercase.
   * @param length
   * @returns {*}
   */
  toUpperCase: (str) => {
    if (str.length > 0) {
      const newStr = str
        .toLowerCase()
        .replace(/_([a-z])/, (m) => m.toUpperCase())
        .replace(/_/, "");
      return str.charAt(0).toUpperCase() + newStr.slice(1);
    }
    return "";
  },

  /**
   * @description This function use for create random number.
   * @param length
   * @returns {*}
   */
  makeRandomNumber: (length) => {
    let result = "";
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  },
  /**
   * @description This function use for create random number.
   * @param length
   * @returns {*}
   */
  makeRandomOTPNumber: (length) => {
    let result = "";
    const characters = "0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  },

  /**
   * @description This function use for create validation unique key.
   * @param apiTag
   * @param error
   * @return {*}
   */
  validationMessageKey: (apiTag, error) => {
    let key = module.exports.toUpperCase(error.details[0].context.key);
    let type = error.details[0].type.split(".");
    type = module.exports.toUpperCase(type[1]);
    key = apiTag + key + type;
    return key;
  },
};
