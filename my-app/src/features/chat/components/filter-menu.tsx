import type { ChatFilterRow } from '@scalechat/shared';
import type { RefObject } from 'react';
import type { View as ViewType } from 'react-native';

import { PopoverMenu, type PopoverItem } from '@/components/menu/popover-menu';
import { ChatFilters, type ChatFilter } from '../types';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  anchorRef: RefObject<ViewType | null>;
  /** Active preset, or null when a custom filter is currently applied. */
  active: ChatFilter | null;
  customFilters: ChatFilterRow[];
  activeCustomId: string | null;
  onSelect: (filter: ChatFilter) => void;
  onSelectCustom: (id: string) => void;
  onAddCustom: () => void;
};

const ORDER: ChatFilter[] = ['super', 'all', 'unread', 'group', 'favourites'];

/** Filter Chats dropdown — Figma "Filter Section" variant + user-defined chips. */
export function FilterMenu({
  visible,
  onDismiss,
  anchorRef,
  active,
  customFilters,
  activeCustomId,
  onSelect,
  onSelectCustom,
  onAddCustom,
}: Props) {
  const presetItems: PopoverItem[] = ORDER.map((key) => ({
    key: `preset:${key}`,
    label: ChatFilters[key],
    selected: active === key,
    onPress: () => onSelect(key),
  }));

  const customItems: PopoverItem[] = customFilters.map((f) => ({
    key: `custom:${f.id}`,
    label: f.name,
    selected: activeCustomId === f.id,
    onPress: () => onSelectCustom(f.id),
  }));

  return (
    <PopoverMenu
      visible={visible}
      onDismiss={onDismiss}
      anchorRef={anchorRef}
      placement="bottom-left"
      width={208}
      items={[
        ...presetItems,
        ...customItems,
        {
          key: 'add-custom',
          label: 'Add',
          icon: 'plus',
          onPress: onAddCustom,
        },
      ]}
    />
  );
}
