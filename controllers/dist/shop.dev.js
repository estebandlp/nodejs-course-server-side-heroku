"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Product = require("../models/product");

var Order = require("../models/order");

var fs = require("fs");

var path = require("path");

var PDFDocument = require("pdfKit");

var stripe = require("stripe")(process.env.STRIPE_KEY);

var ITEMS_PER_PAGE = 1;

exports.getProducts = function (req, res, next) {
  var page = +req.query.page || 1;
  var totalItems;
  Product.find().countDocuments().then(function (numParam) {
    totalItems = numParam;
    return Product.find().skip((page - 1) * ITEMS_PER_PAGE).limit(ITEMS_PER_PAGE);
  }).then(function (products) {
    res.render("shop/product-list", {
      prods: products,
      pageTitle: "Products",
      path: "/products",
      currentPage: page,
      hasNextPage: ITEMS_PER_PAGE * page < totalItems,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
    });
  })["catch"](function (err) {
    var error = new Error(err);
    return next(error);
  });
};

exports.getProduct = function (req, res, next) {
  var prodId = req.params.productId;
  Product.findById(prodId).then(function (product) {
    res.render("shop/product-detail", {
      product: product,
      pageTitle: product.title,
      path: "/products"
    });
  })["catch"](function (err) {
    var error = new Error(err);
    error.status(500);
    return next(error);
  });
};

exports.getIndex = function (req, res, next) {
  var page = +req.query.page || 1;
  var totalItems;
  Product.find().countDocuments().then(function (numParam) {
    totalItems = numParam;
    return Product.find().skip((page - 1) * ITEMS_PER_PAGE).limit(ITEMS_PER_PAGE);
  }).then(function (products) {
    console.log(Math.ceil(totalItems / ITEMS_PER_PAGE));
    res.render("shop/index", {
      prods: products,
      pageTitle: "Shop",
      path: "/",
      currentPage: page,
      hasNextPage: ITEMS_PER_PAGE * page < totalItems,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
    });
  })["catch"](function (err) {
    var error = new Error(err);
    return next(error);
  });
};

exports.getCart = function (req, res, next) {
  var user = req.user;
  user.populate("cart.items.productId").execPopulate().then(function (user) {
    products = user.cart.items;
    res.render("shop/cart", {
      path: "/cart",
      pageTitle: "Your Cart",
      products: products
    });
  });
};

exports.postCart = function (req, res, next) {
  var prodId = req.body.productId;
  Product.findById(prodId).then(function (prod) {
    return req.user.addToCart(prod);
  }).then(function (result) {
    res.redirect("/cart");
  });
};

exports.postCartDeleteProduct = function (req, res, next) {
  var prodId = req.body.productId;
  req.user.removeFromCart(prodId).then(function (cart) {
    res.redirect("/cart");
  })["catch"](function (err) {
    var error = new Error(err);
    error.status(500);
    return next(error);
  });
};

exports.getCheckout = function (req, res, next) {
  var products;
  var total = 0;
  var user = req.user;
  user.populate("cart.items.productId").execPopulate().then(function (user) {
    products = user.cart.items;
    total = 0;
    products.forEach(function (p) {
      total += p.quantity * p.productId.price;
    });
    return stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: products.map(function (p) {
        return {
          name: p.productId.title,
          description: p.productId.description,
          amount: p.productId.price * 100,
          currency: "usd",
          quantity: p.quantity
        };
      }),
      success_url: req.protocol + "://" + req.get("host") + "/checkout/success",
      cancel_url: req.protocol + "://" + req.get("host") + "/checkout/cancel"
    });
  }).then(function (stripeSession) {
    res.render("shop/checkout", {
      path: "/checkout",
      pageTitle: "Checkout",
      products: products,
      totalSum: total,
      sessionId: stripeSession.id
    });
  });
};

exports.getCheckoutSuccess = function (req, res, next) {
  req.user.populate("cart.items.productId").execPopulate().then(function (user) {
    var products = user.cart.items.map(function (prod) {
      return {
        product: _objectSpread({}, prod.productId._doc),
        quantity: prod.quantity
      };
    });
    var order = new Order({
      user: {
        email: req.user.email,
        name: req.user.name,
        userId: req.user._id
      },
      products: products
    });
    return order.save();
  }).then(function (result) {
    return req.user.clearCart();
  }).then(function (result) {
    res.redirect("/orders");
  })["catch"](function (err) {
    var error = new Error(err);
    error.status(500);
    return next(error);
  });
};

exports.getOrders = function (req, res, next) {
  Order.find({
    "user.userId": req.user._id
  }).then(function (orders) {
    res.render("shop/orders", {
      path: "/orders",
      pageTitle: "Your Orders",
      orders: orders
    });
  })["catch"](function (err) {
    var error = new Error(err);
    error.status(500);
    return next(error);
  });
};

exports.getInvoice = function (req, res, next) {
  var orderId = req.params.orderId;
  Order.findById(orderId).then(function (order) {
    if (!order) {
      return next(new Error("No order found."));
    }

    if (order.user.userId.toString() !== req.user._id.toString()) {
      return next(new Error("Unauthorized."));
    }

    var invoiceName = "invoice-" + orderId + ".pdf";
    var invoicePath = path.join("data", "invoices", invoiceName);
    var pdfDoc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="' + invoicePath + '"');
    pdfDoc.pipe(fs.createWriteStream(invoicePath));
    pdfDoc.pipe(res);
    pdfDoc.fontSize(18).text("It's just a dummy file to test PDFKit!");
    pdfDoc.fontSize(26).text("Involice", {
      underline: true
    });
    pdfDoc.fontSize(18).text("Porducts in order:");
    var totalPrice = 0;
    var text = "";
    order.products.forEach(function (prod) {
      totalPrice = +prod.product.price * prod.quantity;
      text = prod.product.title + " - " + prod.quantity + " x $ " + prod.product.price;
      pdfDoc.fontSize(13).text(text);
    });
    pdfDoc.fontSize(13).text("Total: $" + totalPrice);
    pdfDoc.end();
  })["catch"](function (err) {
    next(err);
  });
};