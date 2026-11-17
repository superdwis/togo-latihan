import InvitationGuestPage from "../../components/InvitationGuestPage";

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
    <div
      style={{
        "--inv-serif": "Georgia",
        "--inv-sans": "Arial",
      }}
    >
      <InvitationGuestPage token={token} />
    </div>
  );
}
