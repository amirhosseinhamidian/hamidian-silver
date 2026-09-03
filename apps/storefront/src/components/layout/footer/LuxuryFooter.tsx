import { LuxuryContainer } from '../LuxuryContainer';

import { FooterColumns } from './FooterColumns';
import { SocialLinks } from './SocialLinks';
import { BottomBar } from './BottomBar';

export function LuxuryFooter() {
  return (
    <footer
      className="
        border-t
        border-(--ui-border)
      "
    >
      <LuxuryContainer>
        <div
          className="
            py-12
          "
        >
          <FooterColumns />
        </div>

        <div
          className="
            flex
            items-center
            justify-between
            border-t
            border-(--ui-border)
            py-6
          "
        >
          <SocialLinks />

          <BottomBar />
        </div>
      </LuxuryContainer>
    </footer>
  );
}
