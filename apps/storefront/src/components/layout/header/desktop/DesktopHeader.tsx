import { LuxuryContainer } from '../../LuxuryContainer';

import { Logo } from '../Logo';
import { HeaderActions } from '../HeaderActions';
import { MainNavigation } from '../MainNavigation';

export function DesktopHeader() {
  return (
    <div className="hidden md:block">
      <LuxuryContainer>
        <div
          className="
            relative
            flex
            h-24
            items-center
            justify-between
          "
        >
          <HeaderActions />

          <div
            className="
              absolute
              left-1/2
              -translate-x-1/2
            "
          >
            <Logo />
          </div>

          <div className="w-32" />
        </div>
      </LuxuryContainer>

      <MainNavigation />
    </div>
  );
}
