import { SelectCheckbox } from "@/components/ui/row-select-checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { normalizeEntityId } from "@/lib/apiHelpers";
import { getElectionLabel, getElectionSubtitle } from "@/lib/electionHelpers";

export interface ElectionPickerOption {
  _id?: string;
  id?: string | number;
  title?: string;
  organization?: string;
}

interface ElectionMultiPickerProps {
  elections: ElectionPickerOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyMessage?: string;
}

export function ElectionMultiPicker({
  elections,
  selectedIds,
  onChange,
  emptyMessage = "No elections available for this franchise.",
}: ElectionMultiPickerProps) {
  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  if (elections.length === 0) {
    return <p className="text-sm text-gray-500 py-2">{emptyMessage}</p>;
  }

  return (
    <ScrollArea className="h-48 rounded-md border">
      <div className="divide-y p-1">
        {elections.map((e) => {
          const id = normalizeEntityId(e._id ?? e.id);
          if (!id) return null;
          const subtitle = getElectionSubtitle(e);
          return (
            <div
              key={id}
              className="flex items-center gap-2 rounded-md px-2 py-2.5 hover:bg-primary/5"
            >
              <SelectCheckbox
                checked={selectedIds.includes(id)}
                onCheckedChange={() => toggle(id)}
                aria-label={`Select ${getElectionLabel(e)}`}
              />
              <div className="min-w-0">
                <span className="app-detail-value">{getElectionLabel(e)}</span>
                {subtitle ? (
                  <span className="app-muted ml-1">({subtitle})</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
