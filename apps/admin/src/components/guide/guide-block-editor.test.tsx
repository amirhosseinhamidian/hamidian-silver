import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuideBlockEditor, type GuideBlockDraft } from '@/components/guide/guide-block-editor';

const blocks: GuideBlockDraft[] = [
  {
    clientId: 'block-1',
    type: 'RICH_TEXT',
    variant: 'standard',
    anchorId: 'first-block',
    primaryMediaId: null,
    primaryMedia: null,
    heading: 'بخش اول',
    body: 'متن اول',
    auxiliary: '',
    buttonLabel: '',
    buttonHref: '',
  },
  {
    clientId: 'block-2',
    type: 'RICH_TEXT',
    variant: 'standard',
    anchorId: 'second-block',
    primaryMediaId: null,
    primaryMedia: null,
    heading: 'بخش دوم',
    body: 'متن دوم',
    auxiliary: '',
    buttonLabel: '',
    buttonHref: '',
  },
];

function StatefulEditor() {
  const [value, setValue] = useState(blocks);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  return (
    <GuideBlockEditor
      blocks={value}
      collapsedBlockIds={collapsed}
      disabled={false}
      onChange={setValue}
      onCollapsedChange={setCollapsed}
    />
  );
}

describe('GuideBlockEditor', () => {
  it('collapses one block to its header and expands it independently', () => {
    render(<StatefulEditor />);
    const panel = document.getElementById('guide-block-panel-block-1');

    expect(panel).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'جمع‌کردن بخش ۱' }));
    expect(panel).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'بازکردن بخش ۱' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'بازکردن بخش ۱' }));
    expect(panel).toBeVisible();
  });

  it('collapses and expands all blocks from the card action', () => {
    render(<StatefulEditor />);

    fireEvent.click(screen.getByRole('button', { name: 'جمع‌کردن همه' }));
    expect(document.getElementById('guide-block-panel-block-1')).not.toBeVisible();
    expect(document.getElementById('guide-block-panel-block-2')).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'بازکردن همه' }));
    expect(document.getElementById('guide-block-panel-block-1')).toBeVisible();
    expect(document.getElementById('guide-block-panel-block-2')).toBeVisible();
  });
});
