'use client';

export function SkipToContentLink() {
  return (
    <a
      href="#main-content"
      className="sf-skip-link"
      onClick={(event) => {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        event.preventDefault();
        if (!mainContent.hasAttribute('tabindex')) {
          mainContent.setAttribute('tabindex', '-1');
        }
        mainContent.focus();
      }}
    >
      رفتن به محتوای اصلی
    </a>
  );
}
