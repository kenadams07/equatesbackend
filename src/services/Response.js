/* Response helpers to keep API payloads consistent. */
module.exports = {
    /**
     * @description This function use for format success response of rest api
     * @param data
     * @param code
     * @param message
     * @param res
     * @param extras
     * @returns {{data: *, meta: {message: *, code: *}}}
     */

    // Standard success response with data and optional meta extras
    successResponseData(res, data, code = 1, message, extras) {
        const response = {
            data,
            meta: {
                code,
                message
            }
        };
        if (extras) {
            Object.keys(extras).forEach((key) => {
                if ({}.hasOwnProperty.call(extras, key)) {
                    response.meta[key] = extras[key];
                }
            });
        }
        return res.send(response);
    },
    // Alternative success response with explicit HTTP status
    successResponseWithData(res, data, message, statusCode){
        return res.status(statusCode).json({
          success: true,
          message,
          data,
        });
      },
    // Success response without payload data
    successResponseWithoutData(res, message, code = 1) {
        const response = {
            meta: {
                code,
                message
            }
        };
        return res.send(response);
    },

    // Error response with no data payload
    errorResponseWithoutData(res, message, code = 0) {
        const response = {
            data: null,
            meta: {
                code,
                message
            }
        };
        return res.send(response);
    },

    // Error response with code/message at HTTP 200 (legacy pattern)
    errorResponseData(res, message, code = 400) {
        const response = {
            code,
            message
        };
        return res.status(200)
            .send(response);
    },

    // Validation error response (legacy pattern)
    validationErrorResponseData(res, message, code = 400) {
        console.log(`🚀 Validation error response:`, message, res);
        const response = {
            code,
            message
        };
        return res.status(200)
            .send(response);
    }
};
