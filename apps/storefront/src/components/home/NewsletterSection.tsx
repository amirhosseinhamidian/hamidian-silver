export function NewsletterSection() {
  return (
    <section
      className="
        border
        border-(--ui-border)
        py-8
        px-6
      "
    >
      <div
        className="
          flex
          flex-col
          items-center
          gap-4
          text-center
        "
      >
        <h3
          className="
            text-xl
            font-medium
          "
        >
          به باشگاه حمیدیان بپیوندید
        </h3>

        <p
          className="
            text-sm
            text-(--luxury-muted)
          "
        >
          جدیدترین مجموعه‌ها و پیشنهادهای ویژه را دریافت کنید.
        </p>

        <div
          className="
            flex
            w-full
            max-w-md
            border
            border-(--ui-border)
          "
        >
          <input
            placeholder="ایمیل خود را وارد کنید"
            className="
              flex-1
              px-4
              py-3
              outline-none
            "
          />

          <button
            className="
              bg-(--ui-primary)
              px-6
              text-white
            "
          >
            عضویت
          </button>
        </div>
      </div>
    </section>
  );
}
