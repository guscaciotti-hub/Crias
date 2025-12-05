import Stripe from "stripe";
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function buffer(readable) {
  return new Promise((resolve) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const sig = req.headers["stripe-signature"];
  const buf = await buffer(req);

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("⚠️ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // --------------------------
  // Stripe Events
  // --------------------------
  switch (event.type) {
    case "invoice.payment_succeeded":
      // Cliente pagou → liberar o app
      const paidCustomer = event.data.object.customer;
      console.log("Payment succeeded for:", paidCustomer);

      // FAZER REQUISIÇÃO PARA O BASE44 → liberar usuário
      await fetch(process.env.BASE44_UNLOCK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: paidCustomer }),
      });

      break;

    case "customer.subscription.deleted":
      // Assinatura cancelada → travar o app
      const canceledCustomer = event.data.object.customer;

      await fetch(process.env.BASE44_LOCK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: canceledCustomer }),
      });

      break;
  }

  res.json({ received: true });
}
