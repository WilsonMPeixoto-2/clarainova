import { useState, useEffect } from "react";
import { Check, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface ReportTag {
  id: string;
  name: string;
  color: string;
}

interface ReportTagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

const TAG_COLORS: Record<string, string> = {
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30",
  amber: "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30",
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30",
  cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30",
  pink: "bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30",
  slate: "bg-slate-500/20 text-slate-400 border-slate-500/30 hover:bg-slate-500/30",
  rose: "bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30",
  gray: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
};

export function getTagColorClass(color: string): string {
  return TAG_COLORS[color] || TAG_COLORS.gray;
}

export function ReportTagSelector({
  selectedTagIds,
  onChange,
  disabled = false,
}: ReportTagSelectorProps) {
  const [tags, setTags] = useState<ReportTag[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    const { data, error } = await supabase
      .from("report_tags")
      .select("*")
      .order("name");

    if (!error && data) {
      setTags(data);
    }
  };

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const removeTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  };

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
            className={cn(
              "text-xs px-2 py-0.5 flex items-center gap-1 transition-colors",
              getTagColorClass(tag.color)
            )}
          >
            {tag.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="ml-0.5 hover:opacity-70 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </Badge>
        ))}

        {!disabled && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Tag className="w-3 h-3 mr-1" />
                {selectedTags.length === 0 ? "Adicionar tags" : "Mais"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
                Selecionar tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "text-xs px-2 py-1 rounded-md border transition-all flex items-center gap-1",
                        getTagColorClass(tag.color),
                        isSelected && "ring-1 ring-primary/50"
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

// Display-only component for showing tags
export function ReportTagBadges({ tags }: { tags: ReportTag[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className={cn(
            "text-xs px-1.5 py-0 transition-colors",
            getTagColorClass(tag.color)
          )}
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}
