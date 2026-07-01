import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableArrayItemProps {
  id: string;
  children: React.ReactNode;
  isBoundary?: boolean;
}

export function SortableArrayItem({ id, children, isBoundary }: SortableArrayItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-start gap-2 group ${isDragging ? 'opacity-50' : ''}`}>
      <div 
        {...attributes} 
        {...listeners} 
        className={`mt-2 p-1 text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing ${isBoundary ? 'hidden' : 'block'}`}
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
