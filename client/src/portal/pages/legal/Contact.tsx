import { Mail, Phone, MapPin } from 'lucide-react';
import LegalPageLayout from '../../components/LegalPageLayout';

export default function ContactUs() {
  return (
    <LegalPageLayout title="Contact Us" updated="27 August 2026">
      <p>SAYPX is operated by Sayan Arit Das. For any questions about your account, a plan or order, or the digital photo book service itself, reach us through any of the channels below.</p>

      <div className="grid gap-3 mt-4">
        <a href="mailto:sayandas0629@gmail.com" className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <Mail size={16} className="text-brand shrink-0" />
          <span>sayandas0629@gmail.com</span>
        </a>
        <a href="https://api.whatsapp.com/send/?phone=916294011684&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <Phone size={16} className="text-brand shrink-0" />
          <span>+91 62940 11684 (WhatsApp)</span>
        </a>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <MapPin size={16} className="text-brand shrink-0" />
          <span>Ranaghat, Nadia, West Bengal 741201, India</span>
        </div>
      </div>

      <h2 className="mt-6">Response Time</h2>
      <p>We aim to respond to all queries within 1-2 business days.</p>
    </LegalPageLayout>
  );
}
