# LRF

## Project Details
LRF is an Express + MongoDB API service with user authentication, OTP verification, password resets, and supporting utilities for email delivery, Redis caching, and file storage.

### Tech Stack
- Node.js, Express
- MongoDB with Mongoose
- Redis
- JWT authentication
- i18n for messages
- Nodemailer + email-templates (Pug)

### Entry Points
- Server bootstrap: [server.js](file:///c:/LRF/server.js)
- Routes: [routes/index.js](file:///c:/LRF/src/routes/index.js) → [routes/api/index.js](file:///c:/LRF/src/routes/api/index.js) → [routes/api/v1.js](file:///c:/LRF/src/routes/api/v1.js)

### API Base Path
- `/api/v1`

### API Endpoints
- `POST /api/v1/sign-up`
  - **Note:** The `mobileNo` field is strictly required to be exactly 10 digits.

### Response Format
The API uses two different response structures:

**Success Response**
```json
{
  "data": { ... },
  "meta": {
    "code": 200,
    "message": "Success message"
  }
}
```

**Error / Validation Response**
Note: These responses return HTTP 200 OK, but contain an error code in the body.
```json
{
  "code": 400,
  "message": "Error description"
}
```

### API Endpoints
- `POST /api/v1/verify-otp`
  - **Note:** The `OTP` field is strictly required and must be a numeric string, even for `type: "Resend"` requests (though it may be ignored by the backend logic).
- `POST /api/v1/login`
- `POST /api/v1/forgot-password`
- `POST /api/v1/reset-password`
- `POST /api/v1/change-password`
- `POST /api/v1/logout`
- `POST /api/v1/refresh-token`

### Postman Collection
- https://dark-eclipse-192797.postman.co/workspace/My-Workspace~fe23da78-90ce-435b-83b5-d0f222ec5d2d/environment/11740435-40e3b9e4-826a-4561-a30c-f3e8525f9712?action=share&creator=11740435&active-environment=11740435-40e3b9e4-826a-4561-a30c-f3e8525f9712

### Environment Variables
- `PORT`
- `MONGO_CONNECTION_STRING`
- `NODE_ENV`
- `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`
- `JWT_USER_SECRETKEY`, `USER_TOKEN_EXPIRES_IN`
- `JWT_USER_REFRESH_SECRETKEY`, `USER_REFRESH_TOKEN_EXPIRES_IN`
- `SEND_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `COMPANY_EMAIL`
- `API_URL`
- `S3_ENABLE`, `AMZ_BUCKET`, `AMZ_BUCKET_URL`
- `PEM_FILE_PATH` (Optional: Path to MongoDB SSL CA certificate)

### How to Run
- Install dependencies: `npm install`
- Set required environment variables in `.env`
- Start in development: `npm run dev`
- Start in production: `npm run prod`
- Run tests: `npm test`

### Project Structure
```
server.js
src/
  config/
  controllers/
  i18n/
  logger/
  middlewares/
  models/
  routes/
  seeders/
  services/
  transformers/
  views/
tests/
```

## Workflow of Every Function

### server.js
- Application bootstrap
  - Loads environment variables
  - Creates Express app and HTTP server
  - Registers JSON, URL-encoded, static, logger, i18n, and CORS middleware
  - Registers routes
  - Connects to MongoDB
  - Starts server on configured port

### src/config/config.js
- `getConfig`
  - Builds a config object with `MODE` and `MONGO_CONNECTION_STRING`
  - Selects `MODE` based on `NODE_ENV`
  - Returns the config object

### src/config/dbConnection.js
- `connect`
  - Reads DB URL from config
  - Connects to MongoDB with Mongoose
  - Logs on open and error events
- `disconnect`
  - Disconnects Mongoose if connected
  - Logs when connection closes

### src/logger/logger.js
- `info`
  - Logs a message and optional JSON payload using pine
- `error`
  - Logs error messages using pine

### src/i18n/i18n.js
- i18n middleware
  - Configures `en` locale
  - Initializes i18n on each request

### src/routes/index.js
- Root router
  - Mounts API router at `/api`

### src/routes/api/index.js
- Version router
  - Mounts v1 router at `/v1`

### src/routes/api/v1.js
- Auth routes
  - Maps authController handlers to v1 endpoints
  - Protects `change-password` with userTokenAuth

### src/middlewares/user.js
- `userTokenAuth`
  - Reads Authorization header
  - Extracts bearer token and verifies JWT
  - Loads user and compares stored token
  - Blocks inactive or invalid users
  - Attaches `authUserId` then calls `next`

### src/models/user.js
- User schema
  - Defines user properties (including refreshToken) and indexes
  - Uses timestamps for created and updated dates

### src/models/index.js
- Model export
  - Exposes the User model

### src/controllers/app/authController.js
- `signUp`
  - Validates request
  - Normalizes username, email, and mobile
  - Checks for duplicates
  - Hashes password
  - Generates OTP and stores user data + OTP in Redis
  - Sends OTP email
  - Returns created user payload or failure
- `verifyOTP`
  - Validates request
  - Finds user by email
  - Handles OTP resend paths (with DB fallback if Redis data missing)
  - Validates OTP from Redis
  - For signup:
    - Loads user data from Redis and creates DB user
    - **Issues JWT and refresh token (Auto-login)**
    - **Updates user login metadata (last_login, tokens, IP addresses)**
    - Returns created user payload with tokens
  - For forgot password, sets reset flag in Redis
  - Returns success or failure
- `login`
  - Validates request
  - Finds user by username/email/mobile
  - Checks account status
  - Compares password hash
  - Requires email verification if email exists
  - Issues JWT and updates login metadata
  - Returns user payload and token
- `forgotPassword`
  - Validates request
  - Finds user and checks email verification and status
  - Generates OTP and stores in Redis
  - Sends OTP email
  - Returns success or failure
- `resetPassword`
  - Validates request
  - Finds user by email and checks email verification
  - Blocks if new password matches old
  - Verifies reset flag in Redis
  - Hashes and updates password
  - Clears reset flag and returns payload
- `changePassword`
  - Validates request
  - Ensures old and new password differ
  - Loads authenticated user and compares old password hash
  - Hashes and updates password
  - Returns success or failure
- `logout`
  - Validates request
  - Clears user token fields
  - Returns success
- `refreshToken`
  - Validates request
  - Verifies refresh token
  - Rotates refresh token (issues new one)
  - Issues new access token
  - Returns new tokens

### src/services/Constants.js
- Constants map
  - Exposes status codes, flags, and defaults used across the app

### src/services/Helper.js
- `toUpperCase`
  - Converts snake_case keys to camel-like TitleCase segments
- `makeRandomNumber`
  - Generates a random alphanumeric string
- `makeRandomOTPNumber`
  - Generates a numeric OTP string
- `validationMessageKey`
  - Builds an i18n key from Joi validation error context

### src/services/Response.js
- `successResponseData`
  - Returns a standard success payload with meta and optional extras
- `successResponseWithData`
  - Returns a success payload with HTTP status code
- `successResponseWithoutData`
  - Returns a success payload without data
- `errorResponseWithoutData`
  - Returns an error payload without data
- `errorResponseData`
  - Returns an error payload with status 200 and code field
- `validationErrorResponseData`
  - Returns a validation error payload with status 200 and code field

### src/services/Mailer.js
- `sendMail`
  - Sends a templated email via email-templates
  - Uses SMTP settings from environment
  - Returns send result or null
- `sendSimpleMail`
  - Sends a plain text email via nodemailer
  - Returns send result or null

### src/services/UserValidation.js
- `signUpValidation`
  - Validates signup fields with Joi
  - Returns a localized validation error or success
- `loginValidation`
  - Validates login fields with Joi
- `forgotPasswordValidation`
  - Validates forgot password email field
- `verifyOTPValidation`
  - Validates OTP verification inputs and allowed values
- `resetPassValidation`
  - Validates reset password fields and password policy
- `changePasswordValidation`
  - Validates change password fields and policy
- `logoutValidation`
  - Validates logout payload user_id
- `refreshTokenValidation`
  - Validates refresh token payload

### src/services/User_jwtToken.js
- `issueUser`
  - Signs a JWT with role and user id
- `issueDemoUser`
  - Signs a demo JWT with demo flags
- `verify`
  - Verifies a JWT and returns decoded payload or "error"
- `decode`
  - Extracts bearer token string from Authorization header
- `issueUserRefreshToken`
  - Signs a refresh token with user id
- `verifyRefreshToken`
  - Verifies a refresh token and returns decoded payload or "error"

### src/services/redisService.js
- `saveUserDetailsInRedis`
  - Stores signup user payload with TTL
- `getUserDetailsFromRedis`
  - Reads stored signup payload
- `saveOtpInRedis`
  - Stores OTP with TTL
- `getOtpFromRedis`
  - Reads OTP for username
- `deleteOtpFromRedis`
  - Deletes OTP key
- `betAlreadyInProcess`
  - Sets a short-lived bet-in-process flag
- `getPauseUserBetforSomeSecond`
  - Reads bet-in-process flag
- `saveResetPasswordFlag`
  - Stores reset flag with TTL
- `getResetPasswordFlag`
  - Reads reset flag
- `deleteResetPasswordFlag`
  - Deletes reset flag

### src/services/S3Bucket.js
- `base64ImageUpload`
  - Parses base64 image data
  - Uploads to S3 when enabled
  - Writes to local storage when S3 disabled
- `removeOldImage`
  - Deletes an image from S3 or local storage
- `mediaUrl`
  - Builds local media URL with date
- `s3MediaUrl`
  - Builds S3 media URL with date
- `mediaUrlForS3`
  - Builds URL for profile images based on storage type

### src/transformers/user/userAuthTransformer.js
- `Login`
  - Maps user fields for login responses
- `DemoLogin`
  - Maps fields for demo login responses

### src/transformers/admin/adminLoginTransformer.js
- `LoginTransformer`
  - Maps detailed admin login payload
- `Login`
  - Maps basic admin login payload

### src/seeders/userSeeder.js
- `createAdmin`
  - Loads configuration and SSL CA
  - Connects to MongoDB
  - Logs connection or error

## Tests
- Jest tests live in [tests/auth.test.js](file:///c:/LRF/tests/auth.test.js)
- Run `npm test`

## Validation Details

### Sign Up (`signUpValidation`)
- **name**: Required, string, trimmed, min 2 chars, max 100 chars.
- **username**: Required, string, trimmed, min 3 chars, max 100 chars.
- **email**: Required, string, trimmed, valid email format.
- **countryCode**: Required, string, trimmed, max 6 chars.
- **mobileNo**: Required, string, trimmed, exact length 10, numeric pattern (`^[0-9]+$`).
- **password**: Required, string, trimmed, min 8 chars, must contain at least one digit and one letter (`/^(?=.*[0-9])(?=.*[a-zA-Z])[a-zA-Z0-9!@#$%^&*_]{8,}$/`).
- **companyName**: Required, string, trimmed, min 2 chars, max 100 chars.
- **groupName**: Required, string, trimmed, min 2 chars, max 100 chars.

### Login (`loginValidation`)
- **username**: Required, string, trimmed.
- **password**: Required, string, trimmed.

### Forgot Password (`forgotPasswordValidation`)
- **email**: Required, string, trimmed, valid email format.

### OTP Verification (`verifyOTPValidation`)
- **type**: Required, one of "Confirm" or "Resend".
- **from**: Required, one of "forgotPassword" or "OTPVerification".
- **OTP**: Required, string, numeric pattern (`^[0-9]+$`).
- **email**: Required, string, trimmed, valid email format.

### Check Availability (`checkAvailabilityValidation`)
- At least one of the following fields is required:
    - **username**: String, trimmed, min 3 chars, max 100 chars.
    - **email**: String, trimmed, valid email format.
    - **mobileNo**: String, trimmed, exact length 10, numeric pattern (`^[0-9]+$`).

### Reset Password (`resetPassValidation`)
- **email**: Required, string, trimmed, valid email format.
- **password**: Required, string, trimmed, min 8 chars, must contain at least one digit and one letter (`/^(?=.*[0-9])(?=.*[a-zA-Z])[a-zA-Z0-9!@#$%^&*_]{8,}$/`).

### Change Password (`changePasswordValidation`)
- **oldPassword**: Required, string, trimmed.
- **password**: Required, string, trimmed, min 6 chars, must contain at least one digit and one letter (`/^(?=.*[0-9])(?=.*[a-zA-Z])[a-zA-Z0-9!@#$%^&*]{6,}$/`).

### Refresh Token (`refreshTokenValidation`)
- **refreshToken**: Required, string, trimmed.

### Logout (`logoutValidation`)
- **userId**: Required, string, trimmed.
