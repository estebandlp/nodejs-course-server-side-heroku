const Product = require("../models/product");
const Order = require("../models/order");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfKit");
const stripe = require("stripe")(process.env.STRIPE_KEY); 

const ITEMS_PER_PAGE = 1;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numParam) => {
      totalItems = numParam;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "Products",
        path: "/products",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.status(500);
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numParam) => {
      totalItems = numParam;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
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
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  const user = req.user;
  user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      products = user.cart.items;

      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((prod) => {
      return req.user.addToCart(prod);
    })
    .then((result) => {
      res.redirect("/cart");
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((cart) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.status(500);
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  let products;
  let total = 0;

  const user = req.user;
  user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      products = user.cart.items;
      total = 0;
      products.forEach((p) => {
        total += p.quantity * p.productId.price;
      });

      return stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: products.map((p) => {
          return {
            name: p.productId.title,
            description: p.productId.description,
            amount: p.productId.price * 100,
            currency: "usd",
            quantity: p.quantity,
          };
        }),
        success_url:
          req.protocol + "://" + req.get("host") + "/checkout/success",
        cancel_url: req.protocol + "://" + req.get("host") + "/checkout/cancel",
      });
    })
    .then((stripeSession) => {
      res.render("shop/checkout", {
        path: "/checkout",
        pageTitle: "Checkout",
        products: products,
        totalSum: total,
        sessionId: stripeSession.id,
      });
    });
};

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items.map((prod) => {
        return {
          product: { ...prod.productId._doc },
          quantity: prod.quantity,
        };
      });

      const order = new Order({
        user: {
          email: req.user.email,
          name: req.user.name,
          userId: req.user._id,
        },
        products: products,
      });

      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then((result) => {
      res.redirect("/orders");
    })
    .catch((err) => {
      const error = new Error(err);
      error.status(500);
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.status(500);
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;

  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error("No order found."));
      }

      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error("Unauthorized."));
      }

      const invoiceName = "invoice-" + orderId + ".pdf";
      const invoicePath = path.join("data", "invoices", invoiceName);

      const pdfDoc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="' + invoicePath + '"'
      );
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(18).text("It's just a dummy file to test PDFKit!");
      pdfDoc.fontSize(26).text("Involice", {
        underline: true,
      });
      pdfDoc.fontSize(18).text("Porducts in order:");

      let totalPrice = 0;
      let text = "";
      order.products.forEach((prod) => {
        totalPrice = +prod.product.price * prod.quantity;

        text =
          prod.product.title +
          " - " +
          prod.quantity +
          " x $ " +
          prod.product.price;

        pdfDoc.fontSize(13).text(text);
      });
      pdfDoc.fontSize(13).text("Total: $" + totalPrice);

      pdfDoc.end();
    })
    .catch((err) => {
      next(err);
    });
};
