import LegalPageLayout from '../../components/LegalPageLayout';

export default function RefundPolicy() {
  return (
    <LegalPageLayout title="Cancellation & Refund Policy" updated="27 August 2026">
      <p>SAYPX sells digital plans (album credits + a validity period) that activate instantly on successful payment. This policy explains cancellations and refunds for these purchases.</p>

      <h2>1. No Physical Shipping</h2>
      <p>SAYPX is a fully digital service. No physical goods are shipped, so no shipping charges or delivery timelines apply to any purchase.</p>

      <h2>2. Cancellations</h2>
      <p>Plans are one-time purchases, not recurring subscriptions - there is nothing to "cancel" mid-cycle. Any unused album credits simply remain on your account until your plan's validity period ends.</p>

      <h2>3. Refunds</h2>
      <ul>
        <li>Because album credits are delivered to your account immediately after payment, purchases are non-refundable once a plan has been activated.</li>
        <li>If a payment is deducted or captured by Razorpay but your plan is not activated on your SAYPX account due to a technical error on our end, contact us and we will either fix the activation or issue a full refund to your original payment method.</li>
        <li>Approved refunds are processed via Razorpay back to the original payment method, typically within 5-7 business days.</li>
      </ul>

      <h2>4. How to Request a Refund</h2>
      <p>Email <a href="mailto:sayandas0629@gmail.com">sayandas0629@gmail.com</a> with your registered email and the order/payment ID from your Razorpay receipt. We aim to respond within 1-2 business days.</p>
    </LegalPageLayout>
  );
}
