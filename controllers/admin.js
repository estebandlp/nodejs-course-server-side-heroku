const Product = require("../models/product");
const { validationResult } = require("express-validator/check");
const fileHelper = require("../util/file");
const product = require("../models/product");

exports.getAddProduct = (req, res, next) => {
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  res.render("admin/edit-product", {
    pageTitle: "Add Product",
    path: "/admin/add-product",
    editing: false,
    hasError: false,
    errorMessage: null,
    validationErrors: [],
  });
};

exports.postAddProduct = (req, res, next) => {
  if (!req.file) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/add-product",
      editing: false,
      hasError: true,
      errorMessage: "Attached file is not an image.",
      validationErrors: [],
      product: {
        _id: req.productId,
        title: req.body.title,
        price: req.body.price,
        description: req.body.description,
      },
    });
  }

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/add-product",
      editing: false,
      hasError: true,
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
      product: {
        _id: req.productId,
        title: req.body.title,
        price: req.body.price,
        description: req.body.description,
      },
    });
  }

  const product = new Product({
    title: req.body.title,
    price: req.body.price,
    description: req.body.description,
    imageUrl: req.file.path,
    userId: req.user,
  });

  product
    .save()
    .then((result) => {
      res.redirect("/admin/products");
    })
    .catch((err) => {
      const error = new Error(err);
      error.status(500);
      return next(error);
    });
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;

  if (!editMode) {
    return res.redirect("/");
  }

  const prodId = req.params.productId;

  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return res.redirect("/");
      }
      res.render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/edit-product",
        editing: editMode,
        hasError: false,
        product: product,
        errorMessage: null,
        validationErrors: [],
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.status(500);
      return next(error);
    });
};

exports.getProducts = (req, res, next) => {
  Product.find({
    userId: req.user._id,
  })
    .then((products) => {
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.status(500);
      return next(error);
    });
};

exports.postEditProduct = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/add-product",
      editing: true,
      hasError: true,
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
      product: {
        _id: req.body.productId,
        title: req.body.title,
        price: req.body.price,
        description: req.body.description,
      },
    });
  }

  Product.findById(req.body.productId)
    .then((productFetched) => {
      if (productFetched.userId.toString() !== req.user._id.toString()) {
        return res.redirect("/");
      }
      productFetched.title = req.body.title;
      productFetched.price = req.body.price;
      productFetched.description = req.body.description;

      if (req.file) {
        fileHelper.deleteFile(productFetched.imageUrl);
        productFetched.imageUrl = req.file.path;
      }

      productFetched
        .save()
        .then(() => {
          res.redirect("/admin/products");
        })
        .catch((err) => {
          const error = new Error(err);
          error.status(500);
          return next(error);
        });
    })
    .catch((err) => {
      console.log(err);

      const error = new Error(err);
      error.status(500);
      return next(error);
    });
};

exports.deleteProduct = (req, res, next) => {
  Product.findById(req.params.productId)
    .then((prod) => {
      if (!prod) {
        return next(new Error("Product not found."));
      }

      fileHelper.deleteFile(prod.imageUrl);

      return Product.deleteOne({
        _id: req.body.productId,
        userId: req.user._id,
      });
    })
    .then(() => {
      res.status(200).json({
        message: "Success!",
      });
    })
    .catch((err) => {
      res.status(500).json({
        message: "Deleting product failed!",
      });
    });
};
