import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GatewayVpnWarning } from './gateway-vpn-warning';

describe('GatewayVpnWarning', () => {
  it('only reminds customers to turn off VPN for gateway payments', () => {
    const { rerender } = render(<GatewayVpnWarning visible={false} />);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    rerender(<GatewayVpnWarning visible />);

    expect(screen.getByRole('note')).toHaveTextContent(
      'اگر VPN شما روشن است، پیش از رفتن به درگاه بانکی آن را خاموش کنید.',
    );
  });
});
