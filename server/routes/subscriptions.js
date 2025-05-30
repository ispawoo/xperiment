const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

router.post('/create-subscription', async (req, res) => {
  try {
    const { paymentMethodId, planId } = req.body;
    
    // Create customer
    const customer = await stripe.customers.create({
      payment_method: paymentMethodId,
      email: req.user.email,
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ plan: planId }],
      expand: ['latest_invoice.payment_intent'],
    });

    // Update user in database
    await User.findByIdAndUpdate(req.user.id, {
      stripeCustomerId: customer.id,
      subscriptionStatus: 'active',
      plan: planId,
      submissionLimit: getLimitForPlan(planId)
    });

    res.json({
      status: subscription.status,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function getLimitForPlan(planId) {
  const plans = {
    'plan_free': 100,
    'plan_basic': 1000,
    'plan_pro': 10000,
    'plan_enterprise': 100000
  };
  return plans[planId] || 100;
}

module.exports = router;