import Image from 'next/image';

export function AuthBrand() {
  return (
    <div
      className="
        flex
        flex-col
        items-center
        gap-3
        text-center
      "
    >
      <Image src="/logo.png" alt="گالری نقره حمیدیان" width={56} height={56} priority />

      <h1
        className="
          text-sm
          font-medium
          tracking-wide
        "
      >
        گالری نقره حمیدیان
      </h1>
    </div>
  );
}
