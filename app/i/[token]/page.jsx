import { Cormorant_Garamond, Jost } from "next/font/google";
import InvitationGuestPage from "../../components/InvitationGuestPage";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--inv-serif",
  display: "swap",
});

const sans = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--inv-sans",
  display: "swap",
});

export const metadata = {
  title: "Undangan",
  description: "Undangan online personal.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PublicInvitationPage({ params }) {
  const { token } = await params;
  return (
    <div className={`${serif.variable} ${sans.variable}`}>
      <InvitationGuestPage token={token} />
    </div>
  );
}
