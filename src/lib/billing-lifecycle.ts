export type PaymentEnvironment = "sandbox" | "live";

export function paymentEnvironment(token: string | undefined): PaymentEnvironment {
  if (token?.startsWith("pk_test_")) return "sandbox";
  if (token?.startsWith("pk_live_")) return "live";
  throw new Error("決済環境を確認できません。時間をおいて再度お試しください。");
}

export function assertPaymentEnvironment(requested: PaymentEnvironment, configured: PaymentEnvironment) {
  if (requested !== configured) throw new Error("この決済環境は利用できません。");
}

export interface CancellationPort {
  list(): Promise<{ id: string; status: string }[]>;
  cancel(id: string): Promise<{ status: string }>;
  retrieve(id: string): Promise<{ status: string }>;
}

/** No deletion is permitted until every discovered contract is terminal. */
export async function confirmCancellations(port: CancellationPort): Promise<void> {
  for (const subscription of await port.list()) {
    if (["canceled", "incomplete_expired"].includes(subscription.status)) continue;
    await port.cancel(subscription.id);
    const confirmed = await port.retrieve(subscription.id);
    if (confirmed.status !== "canceled") throw new Error("契約の解約を確認できませんでした。");
  }
}

export async function cancelBeforeDelete(cancel: () => Promise<void>, remove: () => Promise<void>) {
  await cancel();
  await remove();
}