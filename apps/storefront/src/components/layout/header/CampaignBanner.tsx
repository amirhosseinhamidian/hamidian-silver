interface CampaignBannerProps {
  message?: string;
}

export function CampaignBanner({
  message = 'ارسال رایگان برای سفارش‌های ویژه',
}: CampaignBannerProps) {
  return (
    <div
      className="
        bg-black
        py-2
        text-center
        text-xs
        text-white
      "
    >
      {message}
    </div>
  );
}
