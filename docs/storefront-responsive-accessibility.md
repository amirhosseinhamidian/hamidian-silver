# Storefront responsive and accessibility verification

Automated checks are a regression safety net, not a replacement for testing with assistive
technology and physical devices.

## Automated matrix

`pnpm storefront:test:e2e` runs the purchase journey in these Playwright projects:

| Project        | Viewport        | Input profile        |
| -------------- | --------------- | -------------------- |
| Desktop Chrome | 1440 × 900      | mouse and keyboard   |
| Tablet Chrome  | 768 × 1024      | touch-enabled        |
| Mobile Chrome  | Pixel 7 profile | touch-enabled mobile |

`pnpm storefront:test:a11y` verifies WCAG 2.0/2.1 A and AA rules detectable by axe, horizontal
overflow, skip navigation, dialog focus trapping and focus restoration. Scan results are attached
to the Playwright report when a violation is found.

## Required manual release pass

Complete this checklist on the production-like staging build before release:

- Use one physical iOS or Android phone in portrait and landscape for home, product, cart,
  checkout, payment result and order detail.
- Use a physical or emulated tablet and a desktop at 200% browser zoom; confirm there is no clipped
  content, hidden action or two-dimensional scrolling.
- Complete the purchase flow using only a keyboard. Confirm the focus indicator is always visible,
  the focus order is logical and every dialog returns focus to its trigger.
- Check the navigation, product details, validation errors, checkout and payment result with
  VoiceOver or TalkBack. Confirm names, roles, states and dynamic messages are announced.
- Verify forced-colors/high-contrast mode and `prefers-reduced-motion`; information and controls
  must not depend on color or animation alone.
- Record device, OS, browser, assistive technology, date, result and any issue in the release notes.

Do not mark the physical-device or screen-reader rows complete based only on automated results.
