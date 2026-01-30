/* Response field mappers for user auth responses. */
module.exports = {
  Login: {
    username: "username",
    name: "name",
    email: "email",
    mobileNo: "mobileNo",
    emailVerify: "emailVerify",
    countryCode: "countryCode",
    groupName: "groupName",
    companyName: "companyName",
    createdAt: "createdAt",
    updatedAt: "updated_at",
    // type: false, // for demo user identification
  },

  DemoLogin: {
    id: "_id",
    email: "email",
    status: "status",
    createdAt: "createdAt",
    updatedAt: "updated_at",
    casino: "casino",
    currency: "currencyId",
    // type: true, // for demo user identification
  },
};
