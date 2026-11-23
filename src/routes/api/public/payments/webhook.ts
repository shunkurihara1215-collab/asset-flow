import { createFileRoute } from "@tanstack/react-router";
import { receivePaymentWebhook } from "@/lib/payment-webhook.server";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return new Response("Invalid payment environment", { status: 400 });
        }
        return receivePaymentWebhook(request, rawEnv);
      },
    },
  },
});
