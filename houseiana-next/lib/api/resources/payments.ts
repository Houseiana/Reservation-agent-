import { api, USE_MOCK } from "../client";
import { ENDPOINTS } from "../endpoints";

export type PaymentMethod = "card" | "paylink" | "instapay";

export interface SendPaymentLinkInput {
  method: PaymentMethod;
  amount: number;
  currency: string;
}

export interface PaymentLinkResult {
  url?: string;          // hosted payment page (for card/paylink)
  reference?: string;    // instapay reference / provider txn id
  sentAt: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  paidAt?: string;
  amount?: number;
}

export async function sendPaymentLink(
  bookingRef: string,
  input: SendPaymentLinkInput,
): Promise<PaymentLinkResult> {
  if (USE_MOCK) {
    return {
      url: input.method === "card" || input.method === "paylink"
        ? `https://pay.example.com/${bookingRef}`
        : undefined,
      reference: input.method === "instapay" ? `INSTA-${bookingRef}` : undefined,
      sentAt: new Date().toISOString(),
    };
  }
  return api.post<PaymentLinkResult>(
    ENDPOINTS.payments.sendLink(bookingRef),
    input as unknown as Record<string, unknown>,
  );
}

export async function verifyPayment(bookingRef: string): Promise<VerifyPaymentResult> {
  if (USE_MOCK) {
    return { verified: true, paidAt: new Date().toISOString() };
  }
  return api.post<VerifyPaymentResult>(ENDPOINTS.payments.verify(bookingRef));
}
