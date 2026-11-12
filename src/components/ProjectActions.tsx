import { useId, useRef, useState } from "react";
import { FolderOpen, HelpCircle, Menu, Plus, Settings } from "lucide-react";

export function ProjectActions({ onNew, onOpen, onHelp, onSettings }: {
  onNew: () => void;
  onOpen: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const actions = [
    { name: "New build", icon: Plus, run: onNew },
    { name: "Open project", icon: FolderOpen, run: onOpen },
    { name: "Settings", icon: Settings, run: onSettings },
    { name: "Help", icon: HelpCircle, run: onHelp },
  ];
  return <>
    <div className="project-actions-wide">
      {actions.map(({ name, icon: Icon, run }) => <button key={name} className="icon-button" title={name} aria-label={name} onClick={run}><Icon size={18} /></button>)}
    </div>
    <button className="icon-button project-menu-toggle" aria-label="Project menu" title="Project menu" popoverTarget={id}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ left: Math.max(8, Math.min(window.innerWidth - 184, rect.right - 176)), top: rect.bottom + 8 });
      }}><Menu size={20} /></button>
    <div ref={popup} id={id} popover="auto" className="project-menu-popup" style={position} aria-label="Project actions">
      {actions.map(({ name, icon: Icon, run }) => <button key={name} onClick={() => { popup.current?.hidePopover(); run(); }}><Icon size={16} />{name}</button>)}
    </div>
  </>;
}
