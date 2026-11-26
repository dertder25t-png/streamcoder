import { useId, useState, type ReactNode } from "react";

export function AccordionGroup({
  items,
  allowMultiple = false,
}: {
  items: { id: string; title: string; content: ReactNode }[];
  allowMultiple?: boolean;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const base = useId();

  const toggle = (id: string) => {
    setOpen((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      return allowMultiple ? [...cur, id] : [id];
    });
  };

  return (
    <div>
      {items.map((item) => {
        const isOpen = open.includes(item.id);
        const panelId = `${base}-panel-${item.id}`;
        return (
          <div key={item.id}>
            <h3>
              <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(item.id)}>
                {item.title}
              </button>
            </h3>
            <div id={panelId} role="region" hidden={!isOpen}>
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
