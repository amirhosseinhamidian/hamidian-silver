import { CampaignBanner } from './CampaignBanner';
import { DesktopHeader } from './desktop/DesktopHeader';
import { MobileHeader } from './mobile/MobileHeader';

export function LuxuryHeader() {
  return (
    <header>
      <CampaignBanner />

      <DesktopHeader />

      <MobileHeader />
    </header>
  );
}
