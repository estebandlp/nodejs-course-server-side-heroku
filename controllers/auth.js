const User = require("../models/user");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const crypto = require("crypto");
const { validationResult } = require("express-validator/check");

const tranporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key:
        "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",
    },
  })
);

exports.getLogin = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("auth/login", {
      path: "/login",
      pageTitle: "Login",
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: req.body.email,
      },
      validationErrors: errors.array(),
    });
  }

  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    errorMessage: null,
    oldInput: {
      email: req.body.email,
    },
    validationErrors: [],
  });
};

exports.postLogin = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("auth/login", {
      path: "/signup",
      pageTitle: "Signup",
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: req.body.email,
      },
      validationErrors: errors.array(),
    });
  }

  User.findOne({ email: req.body.email })
    .then((user) => {
      req.session.isLoggedIn = true;
      req.session.user = user;
      req.session.save(() => {
        res.redirect("/");
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.status(500);
      return next(error);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
};

exports.getSignup = (req, res, next) => {
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    errorMessage: "",
    oldInput: { email: null, name: null },
    validationErrors: [],
  });
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const name = req.body.name;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Signup",
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: req.body.email,
        name: req.body.name,
      },
      validationErrors: errors.array(),
    });
  }

  return bcrypt
    .hash(password, 12)
    .then((hashedPassword) => {
      const user = new User({
        email: email,
        password: hashedPassword,
        name: name,
        cart: { items: [] },
      });

      return user.save();
    })
    .then(() => {
      res.redirect("/");
      return tranporter
        .sendMail({
          to: email,
          from: "estebanddlp@gmail.com",
          subject: "[Test] Signup succeeded!",
          html: "<h1>Succeded!</h1>",
        })
        .then((result) => {
          console.log(result);
        })
        .catch((err) => {
          console.log(err);
        });
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    res.redirect("/");
  });
};

exports.getReset = (req, res, next) => {
  const flashMessages = req.flash();
  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "reset",
    isAuthenticated: false,
    errorMessage: flashMessages.error ? flashMessages.error[0] : null,
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      req.flash("error", err);
      return res.redirect("/reset");
    }

    const token = buffer.toString("hex");
    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash("error", "No account with that email found.");
          return res.redirect("/reset");
        }

        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        return user.save();
      })
      .then((result) => {
        return tranporter
          .sendMail({
            to: req.body.email,
            from: "estebanddlp@gmail.com",
            subject: "[Test] Signup succeeded!",
            html: `
            <h1>Reset password!</h1>
            <p>You requested a passoword reset.</p>
            <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password.</p>
            `,
          })
          .then((result) => {
            console.log(result);
          })
          .catch((err) => {
            console.log(err);
            req.flash("error", "Error. Please retry in a few minutes.");
            return res.redirect("/reset");
          });
      })
      .then(() => {
        return res.redirect("/login");
      })
      .catch((err) => {
        console.log(err);
        req.flash("error", "Error. Please retry in a few minutes.");
        return res.redirect("/reset");
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  User.findOne({
    resetToken: req.params.token,
    resetTokenExpiration: {
      $gt: Date.now(),
    },
  })
    .then((user) => {
      if (!user) {
        req.flash(
          "error",
          "User not found with the given token to reset password."
        );
        return res.redirect("/login");
      }

      const flashMessages = req.flash();
      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "new-password",
        isAuthenticated: false,
        errorMessage: flashMessages.error ? flashMessages.error[0] : null,
        userId: user._id.toString(),
      });
    })
    .catch((err) => {
      console.log(err);
      return res.redirect("/login");
    });
};

exports.postNewPassword = (req, res, next) => {
  let resetUser;

  User.findOne({
    _id: req.body.userId,
  })
    .then((user) => {
      console.log(user);
      if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/login");
      }
      if (user.resetTokenExpiration < Date.now()) {
        req.flash("error", "The token is expired. Please generate a new one.");
        return res.redirect("/login");
      }

      resetUser = user;

      console.log(req.body.newPassword);
      return bcrypt.hash(req.body.newPassword, 12);
    })
    .then((hashedPassword) => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;

      return resetUser.save();
    })
    .then(() => {
      res.redirect("/login");
    })
    .catch((err) => {
      console.log(err);
      return res.redirect("/login");
    });
};
