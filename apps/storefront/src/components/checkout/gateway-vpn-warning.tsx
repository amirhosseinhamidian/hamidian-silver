export function GatewayVpnWarning({ visible }: Readonly<{ visible: boolean }>) {
  if (!visible) return null;

  return (
    <p
      role="note"
      className="mt-3 border-s-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 lg:mt-4"
    >
      اگر VPN شما روشن است، پیش از رفتن به درگاه بانکی آن را خاموش کنید.
    </p>
  );
}
