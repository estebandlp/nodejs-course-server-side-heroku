const express = require("express");
const { check, body } = require("express-validator/check");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const authController = require("../controllers/auth");

const router = express.Router();

router.get("/login", authController.getLogin);

router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .normalizeEmail()
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((user) => {
          if (!user) {
            return Promise.reject("Invalid email or password.");
          }

          return bcrypt
            .compare(req.body.password, user.password)
            .then((doMatch) => {
              if (!doMatch) {
                return Promise.reject("Invalid email or password.");
              }
              return true;
            });
        });
      }),
    body("password").trim(),
  ],
  authController.postLogin
);

router.post("/logout", authController.postLogout);

router.get("/signup", authController.getSignup);

router.post(
  "/signup",
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .normalizeEmail()
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject("Email already exists.");
          }

          return true;
        });
      }),
    body(
      "password",
      "Please enter a password with only numbers and text and at least 5 characters."
    )
      .isLength({ min: 2 })
      .isAlphanumeric()
      .trim(),
    body(
      "confirmPassword",
      "Please enter a password with only numbers and text and at least 5 characters."
    )
      .trim()
      .custom((value, { req }) => {
        if (value != req.body.password) {
          throw new Error("Password have to match!");
        }
        return true;
      }),
  ],
  authController.postSignup
);

router.get("/reset", authController.getReset);

router.post("/reset", authController.postReset);

router.get("/reset/:token", authController.getNewPassword);

router.post("/new-password", authController.postNewPassword);

module.exports = router;
