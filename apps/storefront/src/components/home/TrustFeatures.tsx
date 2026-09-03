import { ShieldCheck, Truck, Gem, RotateCcw } from 'lucide-react';

const features = [
  {
    icon: Gem,
    title: 'تضمین اصالت',
    text: 'کیفیت و اصالت کالا',
  },
  {
    icon: Truck,
    title: 'ارسال سریع',
    text: 'به سراسر ایران',
  },
  {
    icon: ShieldCheck,
    title: 'پرداخت امن',
    text: 'درگاه معتبر',
  },
  {
    icon: RotateCcw,
    title: 'ضمانت بازگشت',
    text: '۷ روز ضمانت',
  },
];

export function TrustFeatures() {
  return (
    <section
      className="
        grid
        grid-cols-2
        gap-6
        py-10
        md:grid-cols-4
      "
    >
      {features.map(({ icon: Icon, title, text }) => (
        <div
          key={title}
          className="
              flex
              flex-col
              items-center
              gap-3
              text-center
            "
        >
          <Icon size={28} strokeWidth={1.3} />

          <h4 className="text-sm">{title}</h4>

          <p
            className="
                text-xs
                text-(--luxury-muted)
              "
          >
            {text}
          </p>
        </div>
      ))}
    </section>
  );
}
