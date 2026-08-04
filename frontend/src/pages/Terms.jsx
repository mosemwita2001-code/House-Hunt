import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <main className="bg-slate-50 px-4 py-12 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Terms and Conditions</h1>
        <p className="mt-3 text-sm text-slate-500">Effective Date: 4 August 2026</p>

        <div className="mt-8 space-y-5 leading-7 text-slate-700">
          <p>Welcome to Keja Hunt.</p>
          <p>These Terms and Conditions govern your access to and use of the Keja Hunt website and all related services .</p>
          <p>By creating an account, browsing the Platform, purchasing any paid feature, or using any service offered by Keja Hunt, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree with any part of these Terms, you must not access or use the Platform.</p>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">1. About Keja Hunt</h2>
            <p>Keja Hunt is an online rental property marketplace that connects landlords with prospective tenants.</p>
            <p className="mt-4">The Platform allows:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Visitors to browse available property listings without creating an account.</li>
              <li>Landlords to create accounts, publish rental property listings after paying the applicable listing fee, and manage those listings.</li>
              <li>Tenants to create accounts and pay to unlock detailed property information available through the Platform.</li>
            </ul>
            <p className="mt-4">Keja Hunt is not a landlord, property owner, property manager, estate agent, broker, or party to any tenancy agreement entered into between users.</p>
            <p className="mt-4">We only provide the technology platform through which landlords and tenants may connect.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">2. Eligibility</h2>
            <p>To use Keja Hunt you must:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Be at least 18 years old or have legal capacity under the laws of Kenya.</li>
              <li>Provide accurate and complete registration information.</li>
              <li>Use the Platform only for lawful purposes.</li>
              <li>Comply with these Terms at all times.</li>
            </ul>
            <p className="mt-4">We reserve the right to refuse registration or terminate any account that provides false information or violates these Terms.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">3. User Accounts</h2>
            <p>You may browse publicly available listings without creating an account.</p>
            <p className="mt-4">Certain services require registration.</p>
            <p className="mt-4">Users may register under one of the following account types.</p>
            <h3 className="mt-6 font-semibold text-slate-900">Tenant Account</h3>
            <p className="mt-3">A tenant account allows you to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Browse available rental properties.</li>
              <li>Save favourite listings (where available).</li>
              <li>Purchase access to detailed property information.</li>
              <li>Contact landlords after unlocking the property details.</li>
            </ul>
            <p className="mt-4">Tenant accounts cannot publish or advertise properties.</p>
            <hr className="my-8 border-slate-200" />
            <h3 className="font-semibold text-slate-900">Landlord Account</h3>
            <p className="mt-3">A landlord account allows you to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Create property listings.</li>
              <li>Edit or remove listings.</li>
              <li>Upload property photos.</li>
              <li>Receive enquiries from interested tenants.</li>
            </ul>
            <p className="mt-4">A property listing will only become visible after the required listing fee has been successfully paid.</p>
            <p className="mt-4">Landlords remain solely responsible for every listing they publish.</p>
            <hr className="my-8 border-slate-200" />
            <p>Administrator accounts are not available through public registration and are granted only internally by Keja Hunt.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">4. Property Listings</h2>
            <p>By publishing a property on Keja Hunt, you confirm that:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>You own the property or have legal authority to advertise it.</li>
              <li>All information provided is true, accurate and up to date.</li>
              <li>Photos uploaded belong to you or you have permission to use them.</li>
              <li>The property complies with applicable Kenyan laws.</li>
            </ul>
            <p className="mt-4">Keja Hunt may review, suspend, reject, edit or permanently remove any listing that:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Contains false or misleading information.</li>
              <li>Uses stolen images.</li>
              <li>Contains offensive or illegal content.</li>
              <li>Attempts to scam or defraud users.</li>
              <li>Violates these Terms.</li>
            </ul>
            <p className="mt-4">Removal of a listing does not entitle the landlord to any refund.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">5. Payments</h2>
            <p>Certain features on Keja Hunt require payment.</p>
            <p className="mt-4">These include but are not limited to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Publishing property listings.</li>
              <li>Unlocking detailed property information.</li>
            </ul>
            <p className="mt-4">All prices displayed on the Platform are in the applicable currency unless otherwise stated.</p>
            <p className="mt-4">Payments are processed through authorised third-party payment providers.</p>
            <p className="mt-4">Keja Hunt does not store your card details.</p>
            <p className="mt-4">Access to paid features is granted only after successful payment confirmation.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">6. Refund Policy</h2>
            <p>All payments made on Keja Hunt are final.</p>
            <p className="mt-4">Because our services involve immediate access to digital content and platform features, all purchases are non-refundable.</p>
            <p className="mt-4">By completing a payment, you agree that:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>You have reviewed the service before purchasing.</li>
              <li>You understand that payments cannot be cancelled after processing.</li>
              <li>You will not receive a refund if you change your mind.</li>
              <li>Failure to secure a rental property does not qualify for a refund.</li>
              <li>Removal or expiry of a listing after you have already accessed it does not qualify for a refund.</li>
            </ul>
            <p className="mt-4">Nothing in this section limits any rights that cannot legally be excluded under the laws of Kenya.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">7. Acceptable Use</h2>
            <p>When using the Platform, you agree that you will not:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Provide false, misleading, or fraudulent information at registration, when creating a listing, or at any other point.</li>
              <li>Attempt to access another user's account or data without authorisation.</li>
              <li>Attempt to bypass any payment requirement to access paid content or features.</li>
              <li>Copy, scrape, harvest, or otherwise extract listings, images, or user data from the Platform for use outside of Keja Hunt.</li>
              <li>Upload content that is unlawful, defamatory, obscene, or that infringes the rights of any third party.</li>
              <li>Interfere with, disrupt, or attempt to gain unauthorised access to the Platform, its servers, or any connected systems.</li>
              <li>Use the Platform to harass, defraud, impersonate, or otherwise cause harm to another user.</li>
            </ul>
            <p className="mt-4">We reserve the right to investigate any suspected violation of this section and to suspend or terminate accounts involved, without prior notice, where reasonably necessary to protect the Platform or its users.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">8. Intellectual Property</h2>
            <p>The Keja Hunt name, logo, website design, and underlying software are the property of Keja Hunt and are protected by applicable intellectual property laws. You may not copy, reproduce, modify, or distribute any part of the Platform without our prior written consent.</p>
            <p className="mt-4">Content you upload to the Platform  including property descriptions and photographs  remains your property. By uploading content, you grant Keja Hunt a non-exclusive, royalty-free licence to host, display, and distribute that content for the purpose of operating the Platform.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">9. No Guarantee of Property Accuracy or Outcome</h2>
            <p>Keja Hunt does not inspect, verify, or guarantee any property listed on the Platform, including its condition, legality, ownership, or availability. Tenants are strongly encouraged to independently verify all property details and to visit a property in person before making any payment or commitment.</p>
            <p className="mt-4">Keja Hunt is not a party to, and accepts no responsibility for, any tenancy agreement, negotiation, dispute, or transaction arising between a tenant and a landlord.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">10. Limitation of Liability</h2>
            <p>To the fullest extent permitted under the laws of Kenya, Keja Hunt shall not be liable for:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Any dispute, loss, or damage arising from a transaction or agreement between a tenant and a landlord.</li>
              <li>Inaccurate, incomplete, fraudulent, or misleading content published by a landlord.</li>
              <li>Any interruption, delay, error, or unavailability of the Platform.</li>
              <li>Any indirect, incidental, or consequential loss arising from use of the Platform.</li>
            </ul>
            <p className="mt-4">The Platform is provided on an "as is" and "as available" basis, without warranties of any kind, whether express or implied.</p>
            <p className="mt-4">Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited under the laws of Kenya.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">11. Suspension and Termination</h2>
            <p>We may suspend or terminate your account, with or without notice, if we reasonably believe you have violated these Terms, provided false information, or engaged in conduct that is harmful to the Platform or its users.</p>
            <p className="mt-4">You may stop using the Platform and request deletion of your account at any time by contacting Keja Hunt support using the details in Section 15.</p>
            <p className="mt-4">Termination of an account does not entitle you to a refund of any fees already paid.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">12. Privacy</h2>
            <p>Your use of the Platform is also governed by our <Link to="/privacy-policy" className="font-medium text-brand hover:text-brand-dark">Privacy Policy</Link>, which explains how we collect, use, and protect your personal information in accordance with the Data Protection Act, 2019 of Kenya. By using the Platform, you also agree to the terms of our Privacy Policy.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">13. Governing Law and Jurisdiction</h2>
            <p>These Terms are governed by the laws of the Republic of Kenya. Any dispute arising out of or in connection with these Terms or your use of the Platform shall be subject to the exclusive jurisdiction of the courts of Kenya.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">14. Changes to These Terms</h2>
            <p>We may amend these Terms from time to time to reflect changes in our services or applicable law. Where changes are material, we will take reasonable steps to notify users. Continued use of the Platform after any changes take effect constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">15. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us:</p>
            <p className="mt-4 whitespace-pre-line">Technical Support  WhatsApp: +254 705 598 222{`\n`}Customer Support  WhatsApp: +254 794 777 312</p>
          </section>
        </div>
      </article>
    </main>
  );
}
