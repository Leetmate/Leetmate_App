/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// 1. Backend endpoint to create a Stripe Checkout Session for a logged-in user
//    (called by the frontend)

// 2. Webhook endpoint that Stripe calls after a successful payment 
//    (e.g. checkout.session.completed)
//    → verifies the Stripe event
//    → updates Firestore (e.g. unlock premium or add coins)


const { onRequest } = require("firebase-functions/v2/https"); // Firebase Functions SDK
const logger = require("firebase-functions/logger"); // Firebase Functions Logger SDK
const admin = require("firebase-admin"); // Firebase Admin SDK
const Stripe = require("stripe"); // Stripe SDK

admin.initializeApp();
const db = admin.firestore();

// Creates a Stripe instance using secret key
// To call Stripe APIs securely from backend
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Missing Authorization header");
  }
  const idToken = authHeader.slice("Bearer ".length);
  // Verify token and return decoded user info
  return admin.auth().verifyIdToken(idToken);
}

// Define catalog of products for checkout session
const PREMIUM_PRODUCT = {
  purchaseType: "premium",
  unitAmount: 399,
  currency: "usd",
  name: "LeetMate Premium",
  description: "Unlock extra XP, coins, themes, and exclusive rewards",
};

const COIN_PACKAGES = {
  coins_100: {
    purchaseType: "coins",
    //purchaseType: "coinsFifty",
    coinAmount: 50,
    unitAmount: 99,
    currency: "usd",
    name: "50 LeetMate Coins",
    description: "Coin pack for LeetMate",
  },
  coins_250: {
    purchaseType: "coins",
    //purchaseType: "coinsOneFifty",
    coinAmount: 150,
    unitAmount: 199,
    currency: "usd",
    name: "150 LeetMate Coins",
    description: "Coin pack for LeetMate",
  },
  coins_700: {
    purchaseType: "coins",
    //purchaseType: "coinsFiveHun",
    coinAmount: 500,
    unitAmount: 499,
    currency: "usd",
    name: "500 LeetMate Coins",
    description: "Coin pack for LeetMate",
  },
};

// ---- Create a checkout session for the user ---- 
// This is the endpoint that the client will call to create a checkout session
exports.createCheckoutSession = onRequest(
  {
    cors: true, // Allow requests from all origins
    secrets: ["STRIPE_SECRET_KEY"],
  },
  // Handle POST requests to create a checkout session
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const decodedToken = await verifyFirebaseUser(req);
      const uid = decodedToken.uid;
      const email = decodedToken.email || req.body?.email || "";
      const stripe = getStripe();
      const purchaseType = req.body?.purchaseType;
      const packageId = req.body?.packageId || null;

      // Select the product from catalog 
      let product;
      if (purchaseType === "premium") {
        // Block repurchase if user is already premium 
        const userDoc = await db.collection("users").doc(uid).get();
        if (purchaseType === "premium" && userDoc.exists && userDoc.data()?.premium) {
          return res.status(400).json({ error: "User is already premium" });
        }
        product = PREMIUM_PRODUCT;
        
      } else if (purchaseType === "coins") {
        product = COIN_PACKAGES[packageId];
        if (!product) {
          return res.status(400).json({ error: "Invalid coin package" });
        }
      } else {
        return res.status(400).json({ error: "Invalid purchase type" });
      }

      // Create metadata for the checkout session
      const metadata = {
        uid,
        purchaseType: product.purchaseType,
      };

      if (product.purchaseType === "coins") {
        metadata.packageId = packageId;
        metadata.coinAmount = String(product.coinAmount);
      }

      // Create a checkout session using Stripe API
      const session = await stripe.checkout.sessions.create({
        mode: "payment", // one-time payment
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: product.currency,
              product_data: {
                name: product.name,
                description: product.description,
              },
              unit_amount: product.unitAmount,
            },
            quantity: 1,
          },
        ],
        metadata,
        success_url:
          "https://leetmate-b4182.web.app/stripe-success.html?session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          "https://leetmate-b4182.web.app/stripe-cancel.html",
      });

      return res.status(200).json({ url: session.url });
    } catch (err) {
      logger.error("createCheckoutSession failed", err);
      return res.status(401).json({
        error: err.message || "Unable to create checkout session",
      });
    }
  }
);

// ---- Stripe webhook ----
// This endpoint is called by Stripe when a payment event occurs (e.g. checkout.session.completed)
// Stripe -> Backend -> Firestore
exports.stripeWebhook = onRequest(
  {
    cors: false, // Allow requests from all origins
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }

    const stripe = getStripe();
    let event;

    try {
      // Verify the webhook signature to make sure request came from Stripe
      const signature = req.headers["stripe-signature"];
      // Parse the webhook event
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      logger.error("Webhook signature verification failed", err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      // Handle the event depending on its type 
      switch (event.type) {
        // ---- Checkout.session.completed event ----
        case "checkout.session.completed": {
          const session = event.data.object;
          const uid = session.metadata?.uid;
          const purchaseType = session.metadata?.purchaseType;
          const paymentStatus = session.payment_status || "unknown";

          // Check if the session has the required metadata
          if (!uid || !purchaseType) {
            logger.error("Missing required metadata", {
              sessionId: session.id,
              uid,
              purchaseType,
            });
            break;
          }

          // Prevent double-processing
          const paymentRef = db
            .collection("users")
            .doc(uid)
            .collection("payments")
            .doc(session.id);

          // Check if the payment has already been processed by this webhook
          const paymentDoc = await paymentRef.get();
          if (paymentDoc.exists) {
            logger.info("Session already processed", {
              uid,
              sessionId: session.id,
            });
            break;
          }
          const batch = db.batch();

          // ---- Premium purchase ----
          if (purchaseType === "premium") {
            // Update the user's premium status in Firestore
            const userRef = db.collection("users").doc(uid);
            batch.set(
              userRef,
              {
                premium: true,
              },
              { merge: true }
            );

            // Save premium payment record in Firestore
            batch.set(paymentRef, {
              type: "premium",
              status: paymentStatus,
              sessionId: session.id,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            logger.info("Premium enabled", { uid, sessionId: session.id });
          
          // ---- Coins purchase ----
          } else if (purchaseType === "coins") {
            const packageId = session.metadata?.packageId;
            const packageConfig = COIN_PACKAGES[packageId];

            if (!packageConfig) {
              logger.error("Invalid coin package in webhook metadata", {
                sessionId: session.id,
                uid,
                packageId,
              });
              break;
            }

            // Update the user's coins in Firestore
            const userRef = db.collection("users").doc(uid);
            batch.set(
              userRef,
              {
                coins: admin.firestore.FieldValue.increment(packageConfig.coinAmount),
              },
              { merge: true }
            );

            // Save coin payment record in Firestore
            batch.set(paymentRef, {
              type: "coins",
              packageId,
              coinAmount: packageConfig.coinAmount,
              status: paymentStatus,
              sessionId: session.id,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            logger.info("Coins granted", {
              uid,
              sessionId: session.id,
              packageId,
              coinAmount: packageConfig.coinAmount,
            });
          } else {
            logger.error("Unknown purchaseType", {
              sessionId: session.id,
              uid,
              purchaseType,
            });
            break;
          }

          await batch.commit();
          break;
        }

        // ---- Handle other event types (e.g. checkout.session.expired) ----
        default:
          logger.info("Unhandled Stripe event type", { type: event.type });
      }
      // Return success response to Stripe
      return res.status(200).json({ received: true });
      // Return error response if webhook handling fails
    } catch (err) {
      logger.error("Webhook handling failed", err);
      return res.status(500).send("Internal server error");
    }
  }
);