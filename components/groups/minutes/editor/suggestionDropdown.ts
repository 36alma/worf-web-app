import type {SuggestionOptions, SuggestionProps, SuggestionKeyDownProps} from '@tiptap/suggestion';

export interface SuggestionDropdownConfig<TItem> {
  getLabel: (item: TItem) => string;
  getSubLabel?: (item: TItem) => string | undefined;
  emptyLabel: string;
}

/**
 * Dependency-free (no tippy.js) floating dropdown for TipTap `Suggestion` plugins.
 * Shared by the @mention and /command extensions.
 */
export function createSuggestionRender<TItem>(
  config: SuggestionDropdownConfig<TItem>
): NonNullable<SuggestionOptions<TItem>['render']> {
  return () => {
    let container: HTMLDivElement | null = null;
    let items: TItem[] = [];
    let selectedIndex = 0;
    let commandFn: ((item: TItem) => void) | null = null;

    const renderList = () => {
      if (!container) return;
      container.innerHTML = '';
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'suggestion-dropdown-empty';
        empty.textContent = config.emptyLabel;
        container.appendChild(empty);
        return;
      }
      items.forEach((item, index) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `suggestion-dropdown-item${index === selectedIndex ? ' is-selected' : ''}`;
        const label = document.createElement('div');
        label.className = 'suggestion-dropdown-item-label';
        label.textContent = config.getLabel(item);
        el.appendChild(label);
        const sub = config.getSubLabel?.(item);
        if (sub) {
          const subEl = document.createElement('div');
          subEl.className = 'suggestion-dropdown-item-sub';
          subEl.textContent = sub;
          el.appendChild(subEl);
        }
        el.addEventListener('mousedown', (event) => {
          event.preventDefault();
          commandFn?.(item);
        });
        container!.appendChild(el);
      });
    };

    const updatePosition = (clientRect: SuggestionProps<TItem>['clientRect']) => {
      if (!container) return;
      const rect = clientRect?.();
      if (!rect) return;
      container.style.left = `${rect.left + window.scrollX}px`;
      container.style.top = `${rect.bottom + window.scrollY + 4}px`;
    };

    return {
      onStart: (props: SuggestionProps<TItem>) => {
        items = props.items;
        commandFn = props.command;
        selectedIndex = 0;
        container = document.createElement('div');
        container.className = 'suggestion-dropdown';
        document.body.appendChild(container);
        renderList();
        updatePosition(props.clientRect);
      },
      onUpdate: (props: SuggestionProps<TItem>) => {
        items = props.items;
        commandFn = props.command;
        selectedIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));
        renderList();
        updatePosition(props.clientRect);
      },
      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === 'Escape') {
          container?.remove();
          container = null;
          return true;
        }
        if (props.event.key === 'ArrowDown') {
          selectedIndex = items.length ? (selectedIndex + 1) % items.length : 0;
          renderList();
          return true;
        }
        if (props.event.key === 'ArrowUp') {
          selectedIndex = items.length ? (selectedIndex - 1 + items.length) % items.length : 0;
          renderList();
          return true;
        }
        if (props.event.key === 'Enter' || props.event.key === 'Tab') {
          if (items[selectedIndex]) {
            commandFn?.(items[selectedIndex]);
          }
          return true;
        }
        return false;
      },
      onExit: () => {
        container?.remove();
        container = null;
      }
    };
  };
}
