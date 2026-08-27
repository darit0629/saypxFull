import LegalPageLayout from '../../components/LegalPageLayout';

export default function Privacy() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="27 August 2026">
      <p>This Privacy Policy explains what information SAYPX collects, why, and how it is used. SAYPX is operated by Sayan Arit Das (Ranaghat, Nadia, West Bengal, India).</p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li><strong>Account information:</strong> name, email address, phone number, and business name you provide at signup.</li>
        <li><strong>Content you upload:</strong> photos, page layouts, and (if used) background music you add to an album.</li>
        <li><strong>Payment information:</strong> processed directly by Razorpay - SAYPX does not receive or store your card, UPI, or bank details. We only receive confirmation of payment success/failure and the order amount.</li>
        <li><strong>Usage information:</strong> basic technical logs (e.g. login timestamps) used for account security and troubleshooting.</li>
      </ul>

      <h2>2. How We Use This Information</h2>
      <ul>
        <li>To create and operate your account and digital albums.</li>
        <li>To process plan purchases and activate album credits.</li>
        <li>To communicate with you about your account, orders, or support requests.</li>
      </ul>

      <h2>3. Sharing of Information</h2>
      <p>We do not sell your personal information. It is shared only with the service providers needed to run SAYPX, namely Razorpay for payment processing. Photos in an album you create are visible to anyone you share the album's link or QR code with - that is the intended purpose of the feature.</p>

      <h2>4. Data Retention</h2>
      <p>Your account and album data are retained for as long as your account is active. Albums remain accessible on their public link regardless of plan expiry; only the ability to create new albums is affected by plan status.</p>

      <h2>5. Cookies & Local Storage</h2>
      <p>SAYPX uses session cookies to keep you signed in, and may use local browser storage for basic UI preferences. We do not use third-party advertising trackers.</p>

      <h2>6. Your Rights</h2>
      <p>You can request a copy of your data, ask us to correct it, or request account deletion by contacting us at <a href="mailto:sayandas0629@gmail.com">sayandas0629@gmail.com</a>.</p>

      <h2>7. Changes to This Policy</h2>
      <p>We may update this policy from time to time; changes will be posted on this page.</p>

      <h2>8. Contact</h2>
      <p>For privacy-related questions, email <a href="mailto:sayandas0629@gmail.com">sayandas0629@gmail.com</a>.</p>
    </LegalPageLayout>
  );
}
