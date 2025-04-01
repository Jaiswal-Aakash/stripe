require("dotenv").config();
const admin = require("firebase-admin");
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const moment = require("moment");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://stripe-subscription-5d6d7-default-rtdb.firebaseio.com"
});

// Plan IDs
// const [monthly, yearly] = ['price_1QPHGsP8ddUM1m9kPntGvsx7', 'price_1PyCefP8ddUM1m9k6spJiFpg'];
// const [yearly] = ['price_1PyCefP8ddUM1m9k6spJiFpg'];

// Middleware
app.use(cors({
    origin: "http://localhost:5173",
}));

// Configure Express to use JSON for regular endpoints
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        express.raw({ type: 'application/json' })(req, res, next);
    } else {
        express.json()(req, res, next);
    }
});

app.use(bodyParser.json({ type: 'application/json' }));

// Initialize Stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Create checkout session function
const stripeSession = async (plan, customerId) => {
    try {
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: plan,
                    quantity: 1,
                },
            ],
            client_reference_id: customerId,
            success_url: `http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:5173/cancel`,
        });
        return session;
    } catch (error) {
        console.log(error);
        return error;
    }
};


// Create subscription checkout session endpoint
app.post("/api/v1/create-subscription-checkout-session", async (req, res) => {
    const { plan, customerId, currency } = req.body;
    console.log(plan, customerId, currency);

    const priceMapping = {
        Monthly: {
            USD: "price_1R4zSdP8ddUM1m9kngmkZT9K",
            INR: "price_1QPHGsP8ddUM1m9kPntGvsx7",
            EUR: "price_91011_eur_monthly",
        },
        Yearly: {
            USD: "price_1234_usd_yearly",
            INR: "price_1PyCefP8ddUM1m9k6spJiFpg",
            EUR: "price_91011_eur_yearly",
        },
    };

    let planId = null;
    if (plan == 'Monthly') planId = priceMapping[plan]?.[currency] || priceMapping[plan]?.["USD"];
    else if (plan == 'Yearly') planId = priceMapping[plan]?.[currency] || priceMapping[plan]?.["USD"];

    try {
        console.log("Planid", planId);
        const session = await stripeSession(planId, customerId);
        const user = await admin.auth().getUser(customerId);

        await admin.database().ref("users").child(user.uid).update({
            pendingSubscription: {
                sessionId: session.id
            },
        });
        console.log("Session", session);
        return res.json({ session });
    } catch (error) {
        console.log(error);
        res.send(error);
    }
});

// Payment success endpoint (simplified as webhook will handle most of this)
app.post("/api/v1/payment-success", async (req, res) => {
    const { sessionId } = req.body;

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
            return res.json({ message: "Payment successful" });
        } else {
            return res.json({ message: "Payment status pending" });
        }
    } catch (error) {
        console.log(error);
        res.status(400).send(error);
    }
});

// Get session status endpoint
app.get("/api/v1/session/:sessionId", async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        return res.json({ session });
    } catch (error) {
        console.log(error);
        res.status(400).send(error);
    }
});

// Webhook endpoint
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const customerId = session.client_reference_id;
            const subscriptionId = session.subscription;

            try {
                const user = await admin.auth().getUser(customerId);

                // Store session ID for pending payment status
                await admin.database().ref("users").child(user.uid).update({
                    subscription: {
                        sessionId: session.id,
                        subscriptionId: subscriptionId,
                        status: 'active'
                    }
                });

                console.log('Checkout session completed:', session.id);
            } catch (error) {
                console.error("Error updating user data:", error);
            }
            break;

        case 'invoice.paid':
            const invoice = event.data.object;
            const subscriptionDetails = invoice.subscription;

            try {
                // Find user with this subscription ID
                const snapshot = await admin.database().ref("users").orderByChild("subscription/subscriptionId").equalTo(subscriptionDetails).once("value");
                const userData = snapshot.val();

                if (userData) {
                    const userId = Object.keys(userData)[0];
                    const subscription = await stripe.subscriptions.retrieve(subscriptionDetails);

                    const planId = subscription.items.data[0].price.id;
                    const priceMapping ={
                        "price_1R4zSdP8ddUM1m9kngmkZT9K": "Monthly",
                        "price_1QPHGsP8ddUM1m9kPntGvsx7": "Monthly",
                        "price_1PyCefP8ddUM1m9k6spJiFpg": "Yearly",
                    }
                    const planType = priceMapping[planId] || "unknown"
                    // const planType = planId === "price_1QPHGsP8ddUM1m9kPntGvsx7" ? "Monthly" : "Yearly";
                    const startDate = moment.unix(subscription.current_period_start).format("YYYY-MM-DD");
                    const endDate = moment.unix(subscription.current_period_end).format("YYYY-MM-DD");
                    const durationInSeconds = subscription.current_period_end - subscription.current_period_start;
                    const durationInDays = moment.duration(durationInSeconds, "seconds").asDays();

                    await admin.database().ref("users").child(userId).update({
                        subscription: {
                            subscriptionId: subscriptionDetails,
                            planId: planId,
                            planType: planType,
                            planStartDate: startDate,
                            planEndDate: endDate,
                            planDurationInDays: durationInDays,
                            status: 'active',
                            lastPayment: moment().format("YYYY-MM-DD")
                        }
                    });

                    console.log('Invoice paid for subscription:', subscriptionDetails);
                }
            } catch (error) {
                console.error("Error processing invoice payment:", error);
            }
            break;

        case 'invoice.payment_failed':
            const failedInvoice = event.data.object;
            const failedSubscription = failedInvoice.subscription;

            try {
                // Find user with this subscription ID
                const snapshot = await admin.database().ref("users").orderByChild("subscription/subscriptionId").equalTo(failedSubscription).once("value");
                const userData = snapshot.val();

                if (userData) {
                    const userId = Object.keys(userData)[0];

                    await admin.database().ref("users").child(userId).update({
                        subscription: {
                            ...userData[userId].subscription,
                            status: 'past_due',
                            paymentFailed: true,
                            failedAt: moment().format("YYYY-MM-DD")
                        }
                    });

                    console.log('Payment failed for subscription:', failedSubscription);
                }
            } catch (error) {
                console.error("Error processing failed payment:", error);
            }
            break;

        case 'customer.subscription.updated':
            const updatedSubscription = event.data.object;

            try {
                // Find user with this subscription ID
                const snapshot = await admin.database().ref("users").orderByChild("subscription/subscriptionId").equalTo(updatedSubscription.id).once("value");
                const userData = snapshot.val();

                if (userData) {
                    const userId = Object.keys(userData)[0];

                    const planId = updatedSubscription.items.data[0].price.id;
                    const planType = planId === monthly ? "Monthly" : "Yearly";
                    const status = updatedSubscription.status;
                    const startDate = moment.unix(updatedSubscription.current_period_start).format("YYYY-MM-DD");
                    const endDate = moment.unix(updatedSubscription.current_period_end).format("YYYY-MM-DD");

                    await admin.database().ref("users").child(userId).update({
                        subscription: {
                            subscriptionId: updatedSubscription.id,
                            planId: planId,
                            planType: planType,
                            planStartDate: startDate,
                            planEndDate: endDate,
                            status: status,
                            updatedAt: moment().format("YYYY-MM-DD")
                        }
                    });

                    console.log('Subscription updated:', updatedSubscription.id);
                }
            } catch (error) {
                console.error("Error updating subscription:", error);
            }
            break;

        case 'customer.subscription.deleted':
            const deletedSubscription = event.data.object;

            try {
                // Find user with this subscription ID
                const snapshot = await admin.database().ref("users").orderByChild("subscription/subscriptionId").equalTo(deletedSubscription.id).once("value");
                const userData = snapshot.val();

                if (userData) {
                    const userId = Object.keys(userData)[0];

                    await admin.database().ref("users").child(userId).update({
                        subscription: {
                            status: 'canceled',
                            canceledAt: moment().format("YYYY-MM-DD")
                        }
                    });

                    console.log('Subscription canceled:', deletedSubscription.id);
                }
            } catch (error) {
                console.error("Error processing subscription cancellation:", error);
            }
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });

});



const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});