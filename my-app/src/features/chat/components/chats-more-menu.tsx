import type { RefObject } from 'react';
import type { View as ViewType } from 'react-native';

import { PopoverMenu } from '@/components/menu/popover-menu';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  anchorRef: RefObject<ViewType | null>;
  onSelectChats: () => void;
  onReadAll: () => void;
};

/** "3-dot" overflow menu — Figma "3 dot section" variant. */
export function ChatsMoreMenu({ visible, onDismiss, anchorRef, onSelectChats, onReadAll }: Props) {
  return (
    <PopoverMenu
      visible={visible}
      onDismiss={onDismiss}
      anchorRef={anchorRef}
      placement="bottom-right"
      width={184}
      items={[
        {
          key: 'select-chats',
          label: 'Select Chats',
          icon: 'check-square',
          onPress: onSelectChats,
        },
        {
          key: 'read-all',
          label: 'Read All',
          icon: 'eye',
          onPress: onReadAll,
        },
      ]}
    />
  );
}
