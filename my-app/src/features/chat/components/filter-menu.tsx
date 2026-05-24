import type { RefObject } from 'react';
import type { View as ViewType } from 'react-native';

import { PopoverMenu, type PopoverItem } from '@/components/menu/popover-menu';
import { ChatFilters, type ChatFilter } from '../types';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  anchorRef: RefObject<ViewType | null>;
  active: ChatFilter;
  onSelect: (filter: ChatFilter) => void;
  onAddCustom: () => void;
};

const ORDER: ChatFilter[] = ['super', 'all', 'unread', 'group', 'favourites'];

/** Filter Chats dropdown — Figma "Filter Section" variant. */
export function FilterMenu({ visible, onDismiss, anchorRef, active, onSelect, onAddCustom }: Props) {
  const items: PopoverItem[] = ORDER.map((key) => ({
    key,
    label: ChatFilters[key],
    selected: key === active,
    onPress: () => onSelect(key),
  }));

  items.push({
    key: 'add-custom',
    label: 'Add',
    icon: 'plus',
    onPress: onAddCustom,
  });

  return (
    <PopoverMenu
      visible={visible}
      onDismiss={onDismiss}
      anchorRef={anchorRef}
      placement="bottom-left"
      width={208}
      items={items}
    />
  );
}
