import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GuideMarkdownEditor } from '@/components/guide/guide-markdown-editor';

describe('GuideMarkdownEditor', () => {
  it('applies toolbar formatting to the selected text', () => {
    const onChange = vi.fn();
    render(
      <GuideMarkdownEditor id="markdown" value="متن مهم" disabled={false} onChange={onChange} />,
    );
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(4, 7);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));

    expect(onChange).toHaveBeenCalledWith('متن **مهم**');
  });

  it('shows an RTL preview without rendering raw HTML', () => {
    const { container } = render(
      <GuideMarkdownEditor
        id="markdown"
        value={'### عنوان\n\n<script>alert(1)</script>'}
        disabled={false}
        onChange={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'پیش‌نمایش' }));

    expect(screen.getByRole('heading', { level: 3, name: 'عنوان' })).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });
});
